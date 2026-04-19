import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface FunnelStats {
  newLeads24h: number;
  autoMessages24h: number;
  loading: boolean;
}

export function useFunnelStats() {
  const [stats, setStats] = useState<FunnelStats>({
    newLeads24h: 0,
    autoMessages24h: 0,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    async function load() {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [{ count: leadsCount }, { count: msgCount }] = await Promise.all([
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since),
        supabase
          .from("agent_logs")
          .select("*", { count: "exact", head: true })
          .eq("agent_type", "nurturing")
          .gte("created_at", since)
          .ilike("action", "WhatsApp sent%"),
      ]);

      if (!active) return;
      setStats({
        newLeads24h: leadsCount ?? 0,
        autoMessages24h: msgCount ?? 0,
        loading: false,
      });
    }
    load();

    // Refresh whenever a new lead or log lands
    const channel = supabase.channel(`funnel_stats_${Math.random().toString(36).slice(2)}`);
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_logs" }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return stats;
}
