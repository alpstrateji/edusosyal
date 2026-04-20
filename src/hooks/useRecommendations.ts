import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface Recommendation {
  id: string;
  school_id: string | null;
  title: string;
  rationale: string;
  action: string;
  category: "budget" | "audience" | "creative" | "nurturing" | "alert";
  severity: "info" | "success" | "warning" | "error";
  status: "open" | "applied" | "dismissed";
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

export function useRecommendations() {
  const [data, setData] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("ai_recommendations")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!active) return;
      if (error) console.error("[useRecommendations]", error);
      // Sort by AI-assigned rank (metadata.rank) within the same generation batch.
      const rows = ((data as Recommendation[]) ?? []).slice().sort((a, b) => {
        const ra = Number((a.metadata as any)?.rank ?? 999);
        const rb = Number((b.metadata as any)?.rank ?? 999);
        if (a.created_at !== b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return ra - rb;
      });
      setData(rows);
      setLoading(false);
    }
    load();

    const channel = supabase.channel(`ai_recs_${Math.random().toString(36).slice(2)}`);
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_recommendations" },
        load,
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function setStatus(id: string, status: "applied" | "dismissed") {
    const rec = data.find((r) => r.id === id);
    setData((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase
      .from("ai_recommendations")
      .update({ status })
      .eq("id", id);
    if (error) console.error("[setStatus]", error);

    // Log the decision to agent_logs (spec: "Log every important action").
    if (rec?.school_id) {
      await supabase.from("agent_logs").insert({
        school_id: rec.school_id,
        agent_type: "performance",
        action: status === "applied"
          ? `Applied recommendation: ${rec.title}`
          : `Dismissed recommendation: ${rec.title}`,
        reasoning: rec.rationale,
        severity: status === "applied" ? "success" : "info",
        metadata: { recommendation_id: id, category: rec.category, action: rec.action },
      });
    }
  }

  async function regenerate() {
    const { error } = await supabase.functions.invoke("generate-recommendations", {
      body: { trigger: "manual" },
    });
    if (error) throw error;
  }

  return { data, loading, setStatus, regenerate };
}
