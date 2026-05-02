// Edge Function: send-message
// Sends a message to a single lead via the configured provider.
// Body: { lead_id: string, body: string, provider?: 'telegram'|'whatsapp' }
// Auth: requires logged-in user JWT OR service-role key (used by cron).
//
// Deploy:
//   supabase functions deploy send-message --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/http.ts";
import { sendMessage, pickProvider, type Provider } from "../_shared/messaging.ts";

interface Body {
  lead_id: string;
  body: string;
  provider?: Provider;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth: allow service-role bypass for internal callers (cron).
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Unauthorized" }, 401);
  const isServiceRole = bearer === SERVICE_ROLE;
  if (!isServiceRole) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: claims, error } = await userClient.auth.getClaims(bearer);
    if (error || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  if (!body.lead_id || !body.body || body.body.length > 1000) {
    return json({ error: "lead_id and body (≤1000 chars) required" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, school_id, name, phone, telegram_chat_id")
    .eq("id", body.lead_id)
    .maybeSingle();
  if (leadErr || !lead) return json({ error: leadErr?.message ?? "Lead not found" }, 404);

  // Default provider: from app_settings, fallback 'telegram'.
  let preferred: Provider = body.provider ?? "telegram";
  if (!body.provider) {
    const { data: setting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "default_provider")
      .maybeSingle();
    if (setting?.value && typeof setting.value === "string") {
      preferred = setting.value as Provider;
    }
  }

  const provider = pickProvider(lead, preferred);
  const result = await sendMessage(provider, lead, body.body);

  // Always log into lead_messages — even failures, with provider='console'
  // so the operator sees what happened. Also write into agent_logs for the
  // "system activity" view.
  if (result.ok) {
    await admin.from("lead_messages").insert({
      lead_id: lead.id,
      school_id: lead.school_id,
      direction: "outgoing",
      provider,
      body: body.body,
      external_id: result.external_id,
      metadata: { invoked_by: isServiceRole ? "system" : "user" },
    });
  }

  await admin.from("agent_logs").insert({
    school_id: lead.school_id,
    agent_type: "nurturing",
    action: result.ok ? "send_message" : "send_message_failed",
    reasoning: result.ok
      ? `Sent via ${provider} to ${lead.name}`
      : `Send via ${provider} FAILED: ${result.error ?? "unknown"}`,
    severity: result.ok ? "info" : "error",
    metadata: {
      lead_id: lead.id,
      provider,
      message: body.body,
      error: result.ok ? null : result.error,
      external_id: result.external_id,
    },
  });

  if (!result.ok) return json({ success: false, provider, error: result.error }, 502);
  return json({ success: true, provider, external_id: result.external_id });
});
