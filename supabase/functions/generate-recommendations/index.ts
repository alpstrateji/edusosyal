// Edge Function: generate-recommendations
// Aggregates last-7-day funnel stats and asks Lovable AI to produce
// 3-5 prioritised, actionable recommendations per school. Writes them
// into `ai_recommendations`. Old open recs for the same school are
// closed (status='dismissed') to avoid clutter.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an autonomous performance-marketing analyst for a school admissions agency.
Given the JSON metrics for ONE school, output 3-5 concrete recommendations the agency should act on TODAY.
Each recommendation must include:
- title: one short sentence summarising what happened (max 90 chars)
- rationale: why it matters, citing the numbers (max 220 chars)
- action: the exact next action to take (max 160 chars, imperative voice)
- category: one of "budget" | "audience" | "creative" | "nurturing" | "alert"
- severity: "info" | "success" | "warning" | "error"

Rules:
- Increase budget on campaigns producing high-intent leads at acceptable CPL.
- Pause / narrow audience for campaigns producing mostly low-intent leads.
- Flag template change when WhatsApp reply rate < 15% on >10 sent.
- Never invent metrics. If data is insufficient, return ONE 'alert' recommendation explaining what to track next.`;

interface Metrics {
  school_id: string;
  school_name: string;
  campaigns: { id: string; name: string; status: string; spend: number; cpa: number; roas: number }[];
  leads_7d: number;
  high_intent_7d: number;
  low_intent_7d: number;
  whatsapp_sent_7d: number;
  whatsapp_replies_7d: number;
  reply_rate: number;
  best_campaign?: { name: string; leads: number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not set" }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: schools } = await supabase.from("schools").select("id, name");
  if (!schools?.length) return json({ ok: true, generated: 0 });

  let generated = 0;

  for (const school of schools) {
    const [{ data: campaigns }, { data: leads }, { data: logs }] = await Promise.all([
      supabase.from("campaigns").select("id, name, status, spend, cpa, roas")
        .eq("school_id", school.id),
      supabase.from("leads").select("id, intent_level, replied_at, campaign_id")
        .eq("school_id", school.id).gte("created_at", since),
      supabase.from("agent_logs").select("action, agent_type")
        .eq("school_id", school.id).eq("agent_type", "nurturing")
        .gte("created_at", since),
    ]);

    const leadsArr = leads ?? [];
    const high = leadsArr.filter((l) => l.intent_level === "high").length;
    const low = leadsArr.filter((l) => l.intent_level === "low").length;
    const replies = leadsArr.filter((l) => !!l.replied_at).length;
    const sent = (logs ?? []).filter((l) => l.action?.startsWith("WhatsApp sent")).length;

    // Best campaign by lead count (last 7d).
    const byCampaign = new Map<string, number>();
    for (const l of leadsArr) {
      if (!l.campaign_id) continue;
      byCampaign.set(l.campaign_id, (byCampaign.get(l.campaign_id) ?? 0) + 1);
    }
    let best: Metrics["best_campaign"];
    if (byCampaign.size) {
      const [topId, topCount] = [...byCampaign.entries()].sort((a, b) => b[1] - a[1])[0];
      best = { name: topId, leads: topCount };
    }

    const metrics: Metrics = {
      school_id: school.id,
      school_name: school.name,
      campaigns: (campaigns ?? []).map((c) => ({
        id: c.id, name: c.name, status: c.status,
        spend: Number(c.spend), cpa: Number(c.cpa), roas: Number(c.roas),
      })),
      leads_7d: leadsArr.length,
      high_intent_7d: high,
      low_intent_7d: low,
      whatsapp_sent_7d: sent,
      whatsapp_replies_7d: replies,
      reply_rate: sent ? +(replies / sent).toFixed(3) : 0,
      best_campaign: best,
    };

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
          { role: "user", content: JSON.stringify(metrics) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_recommendations",
            description: "Submit 3-5 ranked recommendations.",
            parameters: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  minItems: 1,
                  maxItems: 5,
                  items: {
                    type: "object",
                    properties: {
                      title:    { type: "string" },
                      rationale:{ type: "string" },
                      action:   { type: "string" },
                      category: { type: "string", enum: ["budget","audience","creative","nurturing","alert"] },
                      severity: { type: "string", enum: ["info","success","warning","error"] },
                    },
                    required: ["title","rationale","action","category","severity"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["recommendations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_recommendations" } },
      }),
    });

    if (!aiRes.ok) {
      console.error("AI recs failed for", school.id, aiRes.status, await aiRes.text());
      continue;
    }
    const aiJson = await aiRes.json();
    const args = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let recs: Array<{ title: string; rationale: string; action: string; category: string; severity: string }> = [];
    try { recs = JSON.parse(args ?? "{}").recommendations ?? []; } catch { recs = []; }
    if (!recs.length) continue;

    // Close previous open recs for this school.
    await supabase.from("ai_recommendations")
      .update({ status: "dismissed" })
      .eq("school_id", school.id)
      .eq("status", "open");

    const { error: insErr } = await supabase.from("ai_recommendations").insert(
      recs.map((r) => ({
        school_id: school.id,
        title: r.title,
        rationale: r.rationale,
        action: r.action,
        category: r.category,
        severity: r.severity,
        metadata: { source: "ai", model: "google/gemini-3-flash-preview" },
      })),
    );
    if (insErr) {
      console.error("Insert recs failed", insErr);
      continue;
    }
    generated += recs.length;

    await supabase.from("agent_logs").insert({
      school_id: school.id,
      agent_type: "performance",
      action: `Generated ${recs.length} AI recommendations`,
      reasoning: `Analysed last 7 days: ${metrics.leads_7d} leads, ${high} high-intent, reply rate ${(metrics.reply_rate * 100).toFixed(0)}%`,
      severity: "info",
      metadata: { count: recs.length },
    });
  }

  return json({ ok: true, generated });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
