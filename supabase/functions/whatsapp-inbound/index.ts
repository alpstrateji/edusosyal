// Edge Function: whatsapp-inbound
// Receives inbound WhatsApp messages from Meta Cloud API webhook.
//
// Behaviour:
//   GET  → verification handshake using META_VERIFY_TOKEN (shared with Meta).
//   POST → parses webhook payload, extracts phone + text, matches a lead by
//          phone (last 10 digits), and inserts ONE agent_logs row:
//            agent_type: "nurturing"
//            action:     "WhatsApp reply"
//            metadata:   { lead_id, text, from, wa_message_id }
//          The existing DB trigger `trg_log_mark_reply` then flips the lead
//          to status=replied and sets replied_at. We do NOT duplicate that
//          logic here.
//
// Deploy: supabase/config.toml sets verify_jwt = false for this function
// (Meta cannot send a Supabase JWT).
//
// Secrets:
//   META_VERIFY_TOKEN — shared verify token configured in Meta webhook UI
//   META_APP_SECRET   — used to verify x-hub-signature-256 on POST
//
// Configure in Meta (WhatsApp → Configuration → Webhook):
//   Callback URL: https://<project>.supabase.co/functions/v1/whatsapp-inbound
//   Verify token: <same as META_VERIFY_TOKEN>
//   Subscribe to: messages

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN");
  const APP_SECRET = Deno.env.get("META_APP_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ---- 1. Verification handshake ----
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!APP_SECRET) return json({ error: "META_APP_SECRET not set" }, 500);

  // ---- 2. Verify Meta HMAC signature ----
  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
  if (!sigHeader.startsWith("sha256=")) {
    return json({ error: "Missing signature" }, 401);
  }
  const expectedHex = await hmacSha256Hex(APP_SECRET, rawBody);
  const providedHex = sigHeader.slice("sha256=".length);
  if (!timingSafeEqualHex(providedHex, expectedHex)) {
    return json({ error: "Invalid signature" }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let processed = 0;
  let skipped = 0;
  const errors: unknown[] = [];

  // ---- 3. Walk Meta WhatsApp payload ----
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "messages") continue;
      const messages = change?.value?.messages ?? [];
      for (const m of messages) {
        try {
          const from: string = m.from ?? "";
          const waMsgId: string | null = m.id ?? null;
          // Extract text from the supported message types.
          let text: string | null = null;
          if (m.type === "text") text = m.text?.body ?? null;
          else if (m.type === "button") text = m.button?.text ?? null;
          else if (m.type === "interactive") {
            text =
              m.interactive?.button_reply?.title ??
              m.interactive?.list_reply?.title ?? null;
          }
          if (!from || !text) {
            skipped += 1;
            continue;
          }

          // ---- 4. Match lead by phone (last 10 digits) ----
          const digits = from.replace(/\D/g, "");
          const tail = digits.slice(-10);
          if (!tail) { skipped += 1; continue; }

          const { data: lead, error: leadErr } = await supabase
            .from("leads")
            .select("id, school_id")
            .ilike("phone", `%${tail}`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (leadErr) throw leadErr;
          if (!lead) {
            // Fail loudly — no fake matching.
            console.error(`No lead matched WhatsApp reply from ${from}`);
            skipped += 1;
            continue;
          }

          // ---- 5. Insert agent_logs row. The DB trigger handles the rest. ----
          const { error: logErr } = await supabase.from("agent_logs").insert({
            school_id: lead.school_id,
            agent_type: "nurturing",
            action: "WhatsApp reply",
            reasoning: `Inbound WhatsApp from ${from}: ${text.slice(0, 200)}`,
            severity: "info",
            metadata: {
              lead_id: lead.id,
              text,
              from,
              wa_message_id: waMsgId,
            },
          });
          if (logErr) throw logErr;
          processed += 1;
        } catch (err) {
          console.error("Inbound WhatsApp processing failed", err);
          errors.push({ id: m?.id, error: String(err) });
        }
      }
    }
  }

  // Always 200 OK to Meta to prevent aggressive retries.
  return json({ received: true, processed, skipped, errors: errors.length });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
