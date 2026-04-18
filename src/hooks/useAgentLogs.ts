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
      if (error) setError(error.message);
      else setData((data as AgentLogRow[]) ?? []);
      setLoading(false);
    })();

    // Realtime subscription — new logs stream in like a terminal
    const channel = supabase
      .channel("agent_logs_stream")
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
