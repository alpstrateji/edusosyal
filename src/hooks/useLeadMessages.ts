import { useCallback, useEffect, useState } from "react";
import { supabase, type LeadMessage } from "@/lib/supabaseClient";

/**
 * Fetches messages for a lead and subscribes to realtime inserts so the
 * conversation panel stays live without manual refetches.
 */
export function useLeadMessages(leadId: string | null) {
  const [data, setData] = useState<LeadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!leadId) {
      setData([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) setError(error.message);
    else setData((data as LeadMessage[]) ?? []);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime: append new rows as they land. Filter server-side by lead_id.
  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`lead_messages:${leadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lead_messages",
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          const row = payload.new as LeadMessage;
          setData((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  return { data, loading, error, refetch: fetchMessages };
}
