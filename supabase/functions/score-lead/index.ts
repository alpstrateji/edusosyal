// Edge Function: score-lead
// Scores a lead's purchase intent (high/medium/low) using Lovable AI Gateway
// and writes intent_score + intent_level back to the row.
// Triggered by trg_lead_score on insert; also callable manually with { lead_id }.
//
// Strict behaviour:
// - Fails loudly (502) if AI returns no structured tool call.
// - Clamps score into [0, 1] and rejects non-finite numbers.
// - Logs every scoring decision to agent_logs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You score education leads for a school admissions agency.
Given a lead's name, declared intent text, source campaign, and channel,
call the score_lead tool with:
- score: number in [0,1] (probability the lead enrolls)
- level: "high" | "medium" | "low"
- reason: ONE sentence (max 140 chars) citing the concrete signal you used. No fluff.

Heuristics:
- Specific intent (grade level, scholarship, admission timeline, fees, dates) → high (>=0.66)
- Generic ("more info", "open house", "details") → medium (0.33-0.65)
- Vague / empty / off-topic / spam → low (<0.33)`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not set" }, 500);

  // Service-role only: this function is invoked by DB trigger / cron / admin.
  // No public callers — quota and data integrity must be protected.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (bearer !== SERVICE_ROLE) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const lead_id: string | undefined = body?.lead_id;
  if (!lead_id) return json({ error: "lead_id required" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, school_id, name, intent, source, campaign_id")
    .eq("id", lead_id)
    .maybeSingle();
  if (leadErr || !lead) return json({ error: leadErr?.message ?? "Lead not found" }, 404);

  let campaignLabel = lead.campaign_id ?? "manual";
  if (lead.campaign_id) {
    const { data: m } = await supabase
      .from("meta_ad_mappings")
      .select("label")
      .eq("campaign_id", lead.campaign_id)
      .limit(1)
      .maybeSingle();
    if (m?.label) campaignLabel = m.label;
  }

  const userPrompt = [
    `Lead name: ${lead.name}`,
    `Declared intent: ${lead.intent ?? "(none)"}`,
    `Source: ${lead.source ?? "manual"}`,
    `Campaign: ${campaignLabel}`,
  ].join("\n");

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "score_lead",
          description: "Return the intent score for this lead.",
          parameters: {
            type: "object",
            properties: {
              score:  { type: "number", minimum: 0, maximum: 1 },
              level:  { type: "string", enum: ["high", "medium", "low"] },
              reason: { type: "string", maxLength: 200 },
            },
            required: ["score", "level", "reason"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "score_lead" } },
    }),
  });

  if (!aiRes.ok) {
    const text = await aiRes.text();
    console.error("AI scoring failed", aiRes.status, text);
    if (aiRes.status === 429 || aiRes.status === 402) {
      return json({ error: "AI quota exceeded" }, aiRes.status);
    }
    return json({ error: "AI scoring failed" }, 502);
  }

  const aiJson = await aiRes.json();
  const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  let parsed: { score: number; level: string; reason: string } | null = null;
  try {
    parsed = call ? JSON.parse(call) : null;
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed.score !== "number" || !Number.isFinite(parsed.score)) {
    console.error("AI returned no structured output", aiJson);
    return json({ error: "AI returned no structured output" }, 502);
  }

  // Clamp + normalize defensively.
  const score = Math.max(0, Math.min(1, parsed.score));
  const level = (["high", "medium", "low"].includes(parsed.level) ? parsed.level : "low") as
    "high" | "medium" | "low";
  const reason = (parsed.reason ?? "").slice(0, 200);

  const { error: updErr } = await supabase
    .from("leads")
    .update({
      intent_score: score,
      intent_level: level,
      score_reason: reason,
      scored_at: new Date().toISOString(),
    })
    .eq("id", lead_id);

  if (updErr) {
    console.error("Lead update failed", updErr);
    return json({ error: "Lead update failed" }, 500);
  }

  await supabase.from("agent_logs").insert({
    school_id: lead.school_id,
    agent_type: "performance",
    action: `Scored lead ${lead.name}: ${level} (${(score * 100).toFixed(0)}%)`,
    reasoning: reason,
    severity: level === "high" ? "success" : level === "low" ? "warning" : "info",
    metadata: { lead_id, score, level },
  });

  return json({ ok: true, lead_id, level, score });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
