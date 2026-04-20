import { useEffect, useState } from "react";
import { supabase, type AgentLogRow } from "@/lib/supabaseClient";

export function useAgentLogs() {
  const [data, setData] = useState<AgentLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("agent_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      if (error) {
        console.error("[useAgentLogs] fetch failed", error);
        setError("load_failed");
      }
      else setData((data as AgentLogRow[]) ?? []);
      setLoading(false);
    })();

    // Realtime subscription — new logs stream in like a terminal.
    // IMPORTANT: register `.on(...)` BEFORE `.subscribe()` to avoid the
    // "cannot add postgres_changes callbacks after subscribe()" error.
    const channel = supabase.channel(`agent_logs_stream_${Math.random().toString(36).slice(2)}`);
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_logs" },
        (payload) => {
          setData((prev) => [payload.new as AgentLogRow, ...prev].slice(0, 500));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { data, loading, error };
}
