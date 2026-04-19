// Edge Function: send-whatsapp-message
// Sends a WhatsApp message via Meta Cloud API and logs to agent_logs.
//
// Deploy:
//   supabase functions deploy send-whatsapp-message --no-verify-jwt
//
// Secrets (set in Supabase project — Settings → Edge Functions → Secrets):
//   WHATSAPP_TOKEN     — permanent or system-user access token
//   WHATSAPP_PHONE_ID  — phone number ID from Meta WhatsApp Business
//
// Invoke:
//   POST { phone: "+919812345678", template: "welcome", variables: { name: "Aarav" } }
//   or:  { phone: "...", text: "Free-form text (only allowed inside 24h session)" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  phone: string;
  template?: string;            // template name registered in Meta
  language?: string;            // default en_US
  variables?: Record<string, string>; // body params {{1}}, {{2}}...
  text?: string;                // free-form fallback (within 24h window)
  school_id?: string;           // for agent_logs row
  lead_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const TOKEN = Deno.env.get("WHATSAPP_TOKEN");
  const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!TOKEN || !PHONE_ID) {
    return json({ error: "WHATSAPP_TOKEN and WHATSAPP_PHONE_ID must be set" }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.phone) return json({ error: "phone is required" }, 400);
  if (!body.template && !body.text) return json({ error: "template or text is required" }, 400);

  const to = body.phone.replace(/[^\d]/g, "");
  const language = body.language ?? "en_US";

  // Build Meta Cloud API payload
  const payload: Record<string, unknown> = body.template
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: body.template,
          language: { code: language },
          ...(body.variables && Object.keys(body.variables).length > 0
            ? {
                components: [
                  {
                    type: "body",
                    parameters: Object.values(body.variables).map((v) => ({
                      type: "text",
                      text: String(v),
                    })),
                  },
                ],
              }
            : {}),
        },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: body.text },
      };

  const metaRes = await fetch(
    `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    },
  );

  const metaJson = await metaRes.json().catch(() => ({}));
  const ok = metaRes.ok;
  const messageId = metaJson?.messages?.[0]?.id ?? null;

  // Log to agent_logs
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  await supabase.from("agent_logs").insert({
    school_id: body.school_id ?? null,
    agent_type: "nurturing",
    action: ok
      ? `WhatsApp sent to ${to}${body.template ? ` (template: ${body.template})` : ""}`
      : `WhatsApp send FAILED to ${to}`,
    reasoning: ok
      ? `Outbound WhatsApp via Meta Cloud API → message_id=${messageId}`
      : `Meta Cloud API rejected message → ${JSON.stringify(metaJson?.error ?? metaJson)}`,
    severity: ok ? "info" : "error",
    metadata: {
      to,
      template: body.template ?? null,
      variables: body.variables ?? null,
      lead_id: body.lead_id ?? null,
      meta_message_id: messageId,
      meta_response: metaJson,
    },
  });

  return json(
    ok
      ? { success: true, message_id: messageId }
      : { success: false, error: metaJson?.error ?? metaJson },
    ok ? 200 : 502,
  );
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
