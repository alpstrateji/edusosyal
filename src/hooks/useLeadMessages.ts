import { useCallback, useEffect, useState } from "react";
import { supabase, type LeadMessage } from "@/lib/supabaseClient";

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

  return { data, loading, error, refetch: fetchMessages };
}
