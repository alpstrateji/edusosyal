import { useEffect, useState } from "react";
import { supabase, type Campaign } from "@/lib/supabaseClient";

export function useCampaigns(schoolId?: string) {
  const [data, setData] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let q = supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      if (schoolId) q = q.eq("school_id", schoolId);
      const { data, error } = await q;
      if (!active) return;
      if (error) setError(error.message);
      else setData((data as Campaign[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [schoolId]);

  return { data, loading, error };
}
