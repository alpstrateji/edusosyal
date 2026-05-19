import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface MessagingStats {
  outbound24h: number;
  inbound24h: number;
  outbound7d: number;
  inbound7d: number;
  responseRate7d: number; // inbound / outbound
  loading: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Reads counts straight from lead_messages so the dashboard reflects
 * real provider traffic — not just agent_logs entries.
 */
export function useMessagingStats(): MessagingStats {
  const [stats, setStats] = useState<MessagingStats>({
    outbound24h: 0,
    inbound24h: 0,
    outbound7d: 0,
    inbound7d: 0,
    responseRate7d: 0,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    async function load() {
      const now = Date.now();
      const since24 = new Date(now - DAY).toISOString();
      const since7d = new Date(now - 7 * DAY).toISOString();

      const [out24, in24, out7, in7] = await Promise.all([
        supabase
          .from("lead_messages")
          .select("*", { count: "exact", head: true })
          .eq("direction", "outgoing")
          .gte("created_at", since24),
        supabase
          .from("lead_messages")
          .select("*", { count: "exact", head: true })
          .eq("direction", "incoming")
          .gte("created_at", since24),
        supabase
          .from("lead_messages")
          .select("*", { count: "exact", head: true })
          .eq("direction", "outgoing")
          .gte("created_at", since7d),
        supabase
          .from("lead_messages")
          .select("*", { count: "exact", head: true })
          .eq("direction", "incoming")
          .gte("created_at", since7d),
      ]);

      if (!active) return;
      const outbound7d = out7.count ?? 0;
      const inbound7d = in7.count ?? 0;
      setStats({
        outbound24h: out24.count ?? 0,
        inbound24h: in24.count ?? 0,
        outbound7d,
        inbound7d,
        responseRate7d: outbound7d ? inbound7d / outbound7d : 0,
        loading: false,
      });
    }
    load();

    const channel = supabase
      .channel(`messaging_stats_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_messages" },
        load,
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return stats;
}
