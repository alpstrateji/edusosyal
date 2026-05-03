// Edge Function: ai-reply
// Generates an AI reply for a lead. Optionally sends it immediately.
// Body: { lead_id: string, send?: boolean }
//
// Deploy:
//   supabase functions deploy ai-reply --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/http.ts";
import { generateReply, type ConversationTurn } from "../_shared/ai-reply.ts";
import { sendMessage, pickProvider, type Provider } from "../_shared/messaging.ts";

interface Body {
  lead_id: string;
  send?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Unauthorized" }, 401);
  const isServiceRole = bearer === SERVICE_ROLE;
  let callerUserId: string | null = null;
  if (!isServiceRole) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: claims, error } = await userClient.auth.getClaims(bearer);
    if (error || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    callerUserId = claims.claims.sub as string;
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body.lead_id) return json({ error: "lead_id required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select(
      "id, school_id, name, phone, telegram_chat_id, intent, intent_level, intent_score, score_reason, last_reply_text",
    )
    .eq("id", body.lead_id)
    .maybeSingle();
  if (leadErr || !lead) return json({ error: leadErr?.message ?? "Lead not found" }, 404);

  // Authorization: non-service-role caller must own the lead's school.
  if (!isServiceRole && callerUserId) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role, school_id")
      .eq("id", callerUserId)
      .maybeSingle();
    if (!profile) return json({ error: "Forbidden" }, 403);
    if (profile.role !== "agency_admin" && profile.school_id !== lead.school_id) {
      return json({ error: "Forbidden" }, 403);
    }
  }

  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", lead.school_id)
    .maybeSingle();

  const { data: history } = await admin
    .from("lead_messages")
    .select("direction, body, created_at")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: true })
    .limit(20);

  // Pull AI model from settings.
  const { data: modelSetting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "ai_model")
    .maybeSingle();
  const model =
    typeof modelSetting?.value === "string" ? modelSetting.value : "openai/gpt-4o-mini";

  const result = await generateReply(
    {
      lead: {
        name: lead.name,
        intent: lead.intent,
        intent_level: lead.intent_level as
          | "high" | "medium" | "low" | "unknown" | null,
        intent_score: lead.intent_score as number | null,
        score_reason: lead.score_reason as string | null,
      },
      school_name: school?.name ?? null,
      history: (history ?? []) as ConversationTurn[],
      latest_inbound: lead.last_reply_text ?? null,
    },
    model,
  );

  if (!result.ok) {
    await admin.from("agent_logs").insert({
      school_id: lead.school_id,
      agent_type: "nurturing",
      action: "ai_reply_failed",
      reasoning: `OpenRouter error: ${result.error}`,
      severity: "error",
      metadata: { lead_id: lead.id, error: result.error },
    });
    return json({ success: false, error: result.error }, 502);
  }

  await admin.from("agent_logs").insert({
    school_id: lead.school_id,
    agent_type: "nurturing",
    action: "ai_reply_generated",
    reasoning: `AI generated reply (${model})`,
    severity: "info",
    metadata: { lead_id: lead.id, model, text: result.text },
  });

  // Optionally send immediately. Used by auto-send-cron and the
  // "Generate & Send" button in the UI.
  let sent: { provider: Provider; external_id: string | null } | null = null;
  if (body.send) {
    const { data: providerSetting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "default_provider")
      .maybeSingle();
    const preferred =
      (typeof providerSetting?.value === "string" ? providerSetting.value : "telegram") as Provider;
    const provider = pickProvider(lead, preferred);
    const sendResult = await sendMessage(provider, lead, result.text);
    if (sendResult.ok) {
      await admin.from("lead_messages").insert({
        lead_id: lead.id,
        school_id: lead.school_id,
        direction: "outgoing",
        provider,
        body: result.text,
        external_id: sendResult.external_id,
        metadata: { ai_generated: true, model },
      });
      sent = { provider, external_id: sendResult.external_id };
    } else {
      await admin.from("agent_logs").insert({
        school_id: lead.school_id,
        agent_type: "nurturing",
        action: "send_message_failed",
        reasoning: `Send via ${provider} FAILED after AI generation: ${sendResult.error}`,
        severity: "error",
        metadata: { lead_id: lead.id, provider, error: sendResult.error },
      });
    }
  }

  return json({ success: true, text: result.text, sent });
});
