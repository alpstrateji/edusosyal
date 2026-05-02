import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SettingValue = unknown;

export function useAppSettings() {
  const [values, setValues] = useState<Record<string, SettingValue>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("app_settings").select("key, value");
    if (error) setError(error.message);
    else {
      const map: Record<string, SettingValue> = {};
      (data ?? []).forEach((r: { key: string; value: SettingValue }) => {
        map[r.key] = r.value;
      });
      setValues(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const setSetting = useCallback(
    async (key: string, value: SettingValue) => {
      // Upsert pattern — `app_settings` PK is `key`.
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { values, loading, error, refetch, setSetting };
}
