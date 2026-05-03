// Edge Function: generate-recommendations
// Aggregates last-7-day funnel stats per school and asks Lovable AI for
// 1-5 ranked, actionable recommendations. Writes them into ai_recommendations
// (closing prior open recs first to avoid clutter) and logs to agent_logs.
//
// Strict behaviour:
// - No generic advice. AI is told to cite real numbers.
// - If a school has weak data (<5 leads in 7d), AI must return ONE 'alert'
//   recommendation, not invent insights.
// - Best campaign is resolved to a real name (not a UUID) using the
//   campaigns / meta_ad_mappings tables.
// - Recommendations are inserted in AI's order (rank by impact).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an autonomous performance-marketing analyst for a school admissions agency.
Given JSON metrics for ONE school, output 1-5 concrete recommendations the agency should act on TODAY,
ORDERED FROM HIGHEST IMPACT TO LOWEST.

Each recommendation must include:
- title: one short sentence summarising what happened (max 90 chars)
- rationale: why it matters, CITING THE EXACT NUMBERS from the metrics (max 220 chars)
- action: the exact next action to take (max 160 chars, imperative voice, name the campaign if relevant)
- category: one of "budget" | "audience" | "creative" | "nurturing" | "alert"
- severity: "info" | "success" | "warning" | "error"

Hard rules:
- Never invent metrics. Only cite numbers present in the input JSON.
- No generic advice ("improve targeting", "test creatives") — every action must reference a specific campaign, audience, template, or lead segment from the input.
- If leads_7d < 5 OR whatsapp_sent_7d < 5, return EXACTLY ONE recommendation with category="alert" explaining what data is missing and what to track next.
- If reply_rate < 0.15 on whatsapp_sent_7d >= 10 → recommend changing the WhatsApp template (category="nurturing", severity="warning").
- If a campaign has high_intent share >= 50% AND cpa <= the school's avg_cpa → recommend scaling its budget (category="budget", severity="success").
- If a campaign has low_intent share >= 60% AND leads >= 5 → recommend pausing or narrowing audience (category="audience", severity="warning").`;

interface CampaignStat {
  id: string;
  name: string;
  status: string;
  spend: number;
  cpa: number;
  roas: number;
  leads_7d: number;
  high_intent_7d: number;
  low_intent_7d: number;
  cpl_7d: number | null;
}

interface Metrics {
  school_id: string;
  school_name: string;
  leads_7d: number;
  high_intent_7d: number;
  medium_intent_7d: number;
  low_intent_7d: number;
  unknown_intent_7d: number;
  whatsapp_sent_7d: number;
  whatsapp_replies_7d: number;
  reply_rate: number;
  avg_cpl_7d: number | null;
  campaigns: CampaignStat[];
  best_campaign: { id: string; name: string; leads: number } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not set" }, 500);

  // Service-role only: this is a cron-style aggregator; never public.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (bearer !== SERVICE_ROLE) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: schools, error: schoolErr } = await supabase.from("schools").select("id, name");
  if (schoolErr) return json({ error: schoolErr.message }, 500);
  if (!schools?.length) return json({ ok: true, generated: 0, note: "no schools" });

  // Mapping campaign_id (text from Meta) → label, used to resolve best campaign name.
  const { data: mappings } = await supabase
    .from("meta_ad_mappings")
    .select("campaign_id, label");
  const labelByCampaignId = new Map<string, string>();
  for (const m of mappings ?? []) {
    if (m.campaign_id && m.label) labelByCampaignId.set(m.campaign_id, m.label);
  }

  let generated = 0;

  for (const school of schools) {
    const [{ data: campaigns }, { data: leads }, { data: logs }] = await Promise.all([
      supabase.from("campaigns").select("id, name, status, spend, cpa, roas")
        .eq("school_id", school.id),
      supabase.from("leads").select("id, intent_level, replied_at, campaign_id")
        .eq("school_id", school.id).gte("created_at", since),
      supabase.from("agent_logs").select("action")
        .eq("school_id", school.id).eq("agent_type", "nurturing")
        .gte("created_at", since),
    ]);

    const leadsArr = leads ?? [];
    const high    = leadsArr.filter((l) => l.intent_level === "high").length;
    const medium  = leadsArr.filter((l) => l.intent_level === "medium").length;
    const low     = leadsArr.filter((l) => l.intent_level === "low").length;
    const unknown = leadsArr.filter((l) => !l.intent_level || l.intent_level === "unknown").length;
    const replies = leadsArr.filter((l) => !!l.replied_at).length;
    const sent    = (logs ?? []).filter((l) => l.action?.startsWith("WhatsApp sent")).length;

    // Per-campaign aggregation by Meta campaign_id (text on leads).
    const byCampaign = new Map<string, { leads: number; high: number; low: number }>();
    for (const l of leadsArr) {
      if (!l.campaign_id) continue;
      const cur = byCampaign.get(l.campaign_id) ?? { leads: 0, high: 0, low: 0 };
      cur.leads += 1;
      if (l.intent_level === "high") cur.high += 1;
      if (l.intent_level === "low")  cur.low  += 1;
      byCampaign.set(l.campaign_id, cur);
    }

    // Map internal campaigns table to per-meta-campaign stats by name match
    // (best-effort — meta_ad_mappings.label or campaigns.name).
    const campaignStats: CampaignStat[] = (campaigns ?? []).map((c) => {
      // Find meta campaign_id whose label matches this campaign name.
      let metaId: string | null = null;
      for (const [cid, label] of labelByCampaignId.entries()) {
        if (label === c.name) { metaId = cid; break; }
      }
      const agg = metaId ? byCampaign.get(metaId) : undefined;
      const leadCount = agg?.leads ?? 0;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        spend: Number(c.spend) || 0,
        cpa: Number(c.cpa) || 0,
        roas: Number(c.roas) || 0,
        leads_7d: leadCount,
        high_intent_7d: agg?.high ?? 0,
        low_intent_7d: agg?.low ?? 0,
        cpl_7d: leadCount > 0 ? Math.round((Number(c.spend) || 0) / leadCount) : null,
      };
    });

    const cplValues = campaignStats.map((c) => c.cpl_7d).filter((v): v is number => v != null);
    const avgCpl = cplValues.length
      ? Math.round(cplValues.reduce((a, b) => a + b, 0) / cplValues.length)
      : null;

    // Best campaign by lead volume in last 7d.
    let best: Metrics["best_campaign"] = null;
    const sortedCampaigns = [...campaignStats].sort((a, b) => b.leads_7d - a.leads_7d);
    if (sortedCampaigns.length && sortedCampaigns[0].leads_7d > 0) {
      best = {
        id: sortedCampaigns[0].id,
        name: sortedCampaigns[0].name,
        leads: sortedCampaigns[0].leads_7d,
      };
    } else if (byCampaign.size) {
      // Fallback: pick top meta campaign_id and resolve to label.
      const [topId, topAgg] = [...byCampaign.entries()].sort((a, b) => b[1].leads - a[1].leads)[0];
      best = {
        id: topId,
        name: labelByCampaignId.get(topId) ?? topId,
        leads: topAgg.leads,
      };
    }

    const metrics: Metrics = {
      school_id: school.id,
      school_name: school.name,
      leads_7d: leadsArr.length,
      high_intent_7d: high,
      medium_intent_7d: medium,
      low_intent_7d: low,
      unknown_intent_7d: unknown,
      whatsapp_sent_7d: sent,
      whatsapp_replies_7d: replies,
      reply_rate: sent ? +(replies / sent).toFixed(3) : 0,
      avg_cpl_7d: avgCpl,
      campaigns: campaignStats,
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
            description: "Submit 1-5 ranked recommendations, ordered highest impact first.",
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
                      title:     { type: "string", maxLength: 100 },
                      rationale: { type: "string", maxLength: 240 },
                      action:    { type: "string", maxLength: 180 },
                      category:  { type: "string", enum: ["budget","audience","creative","nurturing","alert"] },
                      severity:  { type: "string", enum: ["info","success","warning","error"] },
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
      const t = await aiRes.text();
      console.error("AI recs failed for", school.id, aiRes.status, t);
      // Fail loudly — log to agent_logs so it's visible.
      await supabase.from("agent_logs").insert({
        school_id: school.id,
        agent_type: "performance",
        action: "AI recommendations FAILED",
        reasoning: `Lovable AI Gateway returned ${aiRes.status}`,
        severity: "error",
        metadata: { http_status: aiRes.status },
      });
      continue;
    }

    const aiJson = await aiRes.json();
    const args = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let recs: Array<{ title: string; rationale: string; action: string; category: string; severity: string }> = [];
    try { recs = JSON.parse(args ?? "{}").recommendations ?? []; } catch { recs = []; }
    if (!recs.length) {
      console.error("AI returned no recommendations for", school.id, aiJson);
      continue;
    }

    // Close previous open recs.
    await supabase.from("ai_recommendations")
      .update({ status: "dismissed" })
      .eq("school_id", school.id)
      .eq("status", "open");

    // Insert in rank order — created_at orders them, but rank is also stored in metadata.
    const { error: insErr } = await supabase.from("ai_recommendations").insert(
      recs.map((r, idx) => ({
        school_id: school.id,
        title:     r.title,
        rationale: r.rationale,
        action:    r.action,
        category:  r.category,
        severity:  r.severity,
        metadata:  { source: "ai", model: "google/gemini-3-flash-preview", rank: idx + 1 },
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
      reasoning:
        `Last 7d: ${metrics.leads_7d} leads (${high} high / ${low} low intent), ` +
        `WhatsApp ${replies}/${sent} replies (${(metrics.reply_rate * 100).toFixed(0)}%), ` +
        `avg CPL ${avgCpl ?? "n/a"}.`,
      severity: "info",
      metadata: { count: recs.length, metrics },
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
