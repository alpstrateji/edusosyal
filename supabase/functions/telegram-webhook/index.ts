// Edge Function: telegram-webhook
// Receives Telegram bot updates. Match by chat_id (or phone via /start),
// store the message in lead_messages, then optionally invoke ai-reply.
//
// Setup:
//   1. Deploy:  supabase functions deploy telegram-webhook --no-verify-jwt
//   2. Tell Telegram to use it:
//        curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
//          -d url=https://<project>.supabase.co/functions/v1/telegram-webhook \
//          -d secret_token=$TELEGRAM_WEBHOOK_SECRET
//
// Telegram will send the secret in the `X-Telegram-Bot-Api-Secret-Token`
// header — we verify it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify the shared secret. Telegram sends it as a header — anything else
  // is a forged request. The secret is MANDATORY: without it, anyone could
  // forge inbound updates and trigger AI auto-replies on arbitrary leads.
  if (!SECRET) {
    console.error("telegram-webhook: TELEGRAM_WEBHOOK_SECRET not configured");
    return json({ error: "Webhook secret not configured" }, 500);
  }
  const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (got !== SECRET) return json({ error: "Forbidden" }, 403);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const message = (payload as any).message ?? (payload as any).edited_message;
  if (!message) {
    // Other update types (callback_query, channel_post, etc.) — ignore but
    // 200 OK so Telegram stops retrying.
    return json({ ok: true, ignored: true });
  }

  const chatId: number = message.chat?.id;
  const text: string = String(message.text ?? "").trim();
  const messageId: number = message.message_id;
  const fromUsername: string | null = message.from?.username ?? null;
  const contact = message.contact; // present when user shares their phone

  if (!chatId || (!text && !contact)) return json({ ok: true, ignored: true });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Try to find a lead. Order of preference:
  //   1. Already-mapped telegram_chat_id
  //   2. /start <lead_id> deep-link payload
  //   3. Shared contact → phone match
  let lead: { id: string; school_id: string } | null = null;

  {
    const { data } = await admin
      .from("leads")
      .select("id, school_id")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();
    if (data) lead = data;
  }

  if (!lead && text.startsWith("/start")) {
    const arg = text.slice(6).trim();
    if (arg) {
      const { data } = await admin
        .from("leads")
        .select("id, school_id")
        .eq("id", arg)
        .maybeSingle();
      if (data) {
        await admin.from("leads").update({ telegram_chat_id: chatId }).eq("id", data.id);
        lead = data;
      }
    }
  }

  if (!lead && contact?.phone_number) {
    const tail = contact.phone_number.replace(/\D/g, "").slice(-10);
    if (tail) {
      const { data } = await admin
        .from("leads")
        .select("id, school_id")
        .ilike("phone", `%${tail}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        await admin.from("leads").update({ telegram_chat_id: chatId }).eq("id", data.id);
        lead = data;
      }
    }
  }

  if (!lead) {
    // Unknown sender — log to agent_logs (no school_id available, skip).
    console.warn(`telegram-webhook: no lead for chat_id=${chatId} username=${fromUsername}`);
    return json({ ok: true, matched: false });
  }

  // Idempotent insert — provider+external_id is unique.
  const inboundText = text || `[contact shared: ${contact?.phone_number ?? ""}]`;
  const { error: insertErr } = await admin
    .from("lead_messages")
    .insert({
      lead_id: lead.id,
      school_id: lead.school_id,
      direction: "incoming",
      provider: "telegram",
      body: inboundText,
      external_id: String(messageId),
      metadata: { chat_id: chatId, from_username: fromUsername },
    });

  if (insertErr && !String(insertErr.message).includes("duplicate")) {
    console.error("telegram-webhook insert failed", insertErr);
    return json({ ok: false, error: insertErr.message }, 500);
  }

  await admin.from("agent_logs").insert({
    school_id: lead.school_id,
    agent_type: "nurturing",
    action: "incoming_message",
    reasoning: `Inbound Telegram from ${fromUsername ?? chatId}: ${inboundText.slice(0, 200)}`,
    severity: "info",
    metadata: { lead_id: lead.id, chat_id: chatId, text: inboundText },
  });

  // Auto-respond if AUTO_SEND + AI both enabled.
  const [{ data: autoSetting }, { data: aiSetting }] = await Promise.all([
    admin.from("app_settings").select("value").eq("key", "auto_send").maybeSingle(),
    admin.from("app_settings").select("value").eq("key", "ai_enabled").maybeSingle(),
  ]);
  const autoSend = autoSetting?.value === true;
  const aiEnabled = aiSetting?.value === true;

  if (autoSend && aiEnabled) {
    // Fire-and-forget the AI reply function. We don't want Telegram to wait.
    fetch(`${SUPABASE_URL}/functions/v1/ai-reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lead_id: lead.id, send: true }),
    }).catch((e) => console.error("ai-reply invoke failed", e));
  }

  return json({ ok: true, matched: true, lead_id: lead.id });
});
