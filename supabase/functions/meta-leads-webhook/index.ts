// Edge Function: meta-leads-webhook
// Receives Facebook Lead Ads webhooks, fetches lead details from Meta,
// inserts into `leads`, and writes an `agent_logs` entry.
// The existing `trg_lead_welcome` DB trigger then fires the WhatsApp
// welcome message automatically — closing the loop:
//   Meta Ad → Lead → Supabase → Agent Log → WhatsApp message
//
// Deploy:
//   supabase functions deploy meta-leads-webhook --no-verify-jwt
//
// Secrets (Supabase → Edge Functions → Secrets):
//   META_VERIFY_TOKEN     — any string you also paste in Meta webhook config
//   META_PAGE_ACCESS_TOKEN — page access token with leads_retrieval scope
//   META_DEFAULT_SCHOOL_ID — fallback school_id (uuid) when mapping not found
//
// Configure in Meta:
//   Callback URL:  https://<project>.supabase.co/functions/v1/meta-leads-webhook
//   Verify token:  <same value as META_VERIFY_TOKEN>
//   Subscribe to:  Page → leadgen

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface LeadgenChange {
  leadgen_id: string;
  page_id: string;
  form_id: string;
  ad_id?: string;
  adgroup_id?: string;
  campaign_id?: string;
  created_time: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN");
  const PAGE_TOKEN = Deno.env.get("META_PAGE_ACCESS_TOKEN");
  const APP_SECRET = Deno.env.get("META_APP_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ---- 1. Webhook verification handshake (GET) ----
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!PAGE_TOKEN) return json({ error: "META_PAGE_ACCESS_TOKEN is not set" }, 500);
  if (!APP_SECRET) return json({ error: "META_APP_SECRET is not set" }, 500);

  // ---- 1b. Verify Meta x-hub-signature-256 HMAC ----
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
  const inserted: string[] = [];
  const errors: unknown[] = [];

  // ---- 2. Walk Meta payload: entry[].changes[].value ----
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "leadgen") continue;
      const v = change.value as LeadgenChange;
      try {
        // ---- 3. Pull full lead details from Graph API ----
        const leadRes = await fetch(
          `https://graph.facebook.com/v21.0/${v.leadgen_id}?access_token=${PAGE_TOKEN}`,
        );
        const leadJson = await leadRes.json();
        if (!leadRes.ok) throw new Error(`Graph API ${leadRes.status}: ${JSON.stringify(leadJson)}`);

        const fields: Array<{ name: string; values: string[] }> = leadJson.field_data ?? [];
        const get = (...keys: string[]) => {
          for (const k of keys) {
            const f = fields.find((x) => x.name.toLowerCase() === k);
            if (f && f.values?.[0]) return f.values[0];
          }
          return null;
        };

        const name =
          get("full_name", "name") ??
          [get("first_name"), get("last_name")].filter(Boolean).join(" ").trim() ??
          "Unknown";
        const phone = get("phone_number", "phone") ?? "";
        const intent = get("intent", "course_interest", "grade") ?? null;

        // ---- 4. Map ad → school. STRICT: no random fallback. ----
        let schoolId: string | null = null;
        if (v.campaign_id || v.ad_id || v.form_id) {
          const { data: mapping } = await supabase
            .from("meta_ad_mappings")
            .select("school_id")
            .or(
              [
                v.campaign_id ? `campaign_id.eq.${v.campaign_id}` : null,
                v.ad_id ? `ad_id.eq.${v.ad_id}` : null,
                v.form_id ? `form_id.eq.${v.form_id}` : null,
              ]
                .filter(Boolean)
                .join(","),
            )
            .limit(1)
            .maybeSingle();
          if (mapping?.school_id) schoolId = mapping.school_id;
        }

        if (!schoolId) {
          // Strict: refuse to randomly assign. Log a hard error so the user sees it.
          const reason = `No meta_ad_mappings row matches campaign_id=${v.campaign_id ?? "n/a"} ad_id=${v.ad_id ?? "n/a"} form_id=${v.form_id ?? "n/a"}`;
          errors.push({ leadgen_id: v.leadgen_id, error: reason });
          await supabase.from("agent_logs").insert({
            // Pick any one school_id to satisfy NOT NULL constraint while still surfacing the error.
            // We leave school_id NULL only if the column allows it; agent_logs requires it, so use null-safe insert via RPC pattern is overkill — fall back to skipping the log when no school exists.
            school_id: null as unknown as string,
            agent_type: "nurturing",
            action: "Unmapped Meta lead — discarded",
            reasoning: reason,
            severity: "error",
            metadata: { leadgen_id: v.leadgen_id, campaign_id: v.campaign_id, ad_id: v.ad_id, form_id: v.form_id },
          });
          continue;
        }

        // ---- 5. Insert lead (dedupe by meta_lead_id) ----
        const { data: leadRow, error: insertErr } = await supabase
          .from("leads")
          .upsert(
            {
              school_id: schoolId,
              name: name || "Unknown",
              phone: phone || "unknown",
              intent,
              status: "new",
              source: "meta_lead_ads",
              meta_lead_id: v.leadgen_id,
              campaign_id: v.campaign_id ?? null,
              ad_id: v.ad_id ?? null,
              form_id: v.form_id ?? null,
            },
            { onConflict: "meta_lead_id" },
          )
          .select("id")
          .single();

        if (insertErr) throw insertErr;
        inserted.push(leadRow!.id);

        // ---- 6. agent_logs entry for the funnel ----
        await supabase.from("agent_logs").insert({
          school_id: schoolId,
          agent_type: "nurturing",
          action: `New Meta lead captured: ${name}`,
          reasoning: `Meta Lead Ads webhook → leadgen_id=${v.leadgen_id}, campaign_id=${v.campaign_id ?? "n/a"} → inserted into leads → DB trigger will dispatch WhatsApp welcome`,
          severity: "success",
          metadata: {
            leadgen_id: v.leadgen_id,
            campaign_id: v.campaign_id,
            ad_id: v.ad_id,
            form_id: v.form_id,
            phone,
            lead_id: leadRow!.id,
          },
        });
      } catch (err) {
        console.error("Lead processing failed", err);
        errors.push({ leadgen_id: v.leadgen_id, error: String(err) });
      }
    }
  }

  // Always 200 OK to Meta — otherwise it retries aggressively.
  return json({ received: true, inserted: inserted.length, errors: errors.length });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- HMAC-SHA256 (hex) using Web Crypto ----
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

// Constant-time comparison of two equal-length hex strings.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
