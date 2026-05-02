// Edge Function: auto-send-cron
// Finds leads ready for an automated outbound message and dispatches AI
// replies. A lead is "ready" when:
//   status = 'contacted' AND last_reply_text IS NOT NULL AND whatsapp_sent_at IS NULL
// Idempotency: setting last_message_at + status='replied'/'contacted' through
// the trigger ensures we don't pick the same row twice.
//
// Deploy:
//   supabase functions deploy auto-send-cron --no-verify-jwt
// Then schedule with pg_cron (see supabase_messaging_migration.sql NOTE).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/http.ts";

const BATCH = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Only accept service-role bearer (cron) — no public callers.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (bearer !== SERVICE_ROLE) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: autoSetting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "auto_send")
    .maybeSingle();
  if (autoSetting?.value !== true) {
    return json({ ok: true, skipped: "auto_send disabled" });
  }

  const { data: leads, error: leadsErr } = await admin
    .from("leads")
    .select("id")
    .eq("status", "contacted")
    .not("last_reply_text", "is", null)
    .is("whatsapp_sent_at", null)
    .limit(BATCH);

  if (leadsErr) return json({ error: leadsErr.message }, 500);
  if (!leads?.length) return json({ ok: true, processed: 0 });

  const results: Array<{ lead_id: string; ok: boolean; error?: string }> = [];

  for (const lead of leads) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-reply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lead_id: lead.id, send: true }),
      });
      const body = await res.json().catch(() => ({}));
      results.push({ lead_id: lead.id, ok: res.ok && body?.success !== false, error: body?.error });
    } catch (e) {
      results.push({ lead_id: lead.id, ok: false, error: String(e) });
    }
  }

  return json({ ok: true, processed: results.length, results });
});
