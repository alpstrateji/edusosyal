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
      setData((data as Recommendation[]) ?? []);
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
    setData((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("ai_recommendations").update({ status }).eq("id", id);
  }

  async function regenerate() {
    await supabase.functions.invoke("generate-recommendations", {
      body: { trigger: "manual" },
    });
  }

  return { data, loading, setStatus, regenerate };
}
