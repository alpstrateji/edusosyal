import { useMemo } from "react";
import { useLeads } from "@/hooks/useLeads";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useCampaigns } from "@/hooks/useCampaigns";

const DAY = 24 * 60 * 60 * 1000;

export function useGrowthStats() {
  const { data: leads, loading: leadsLoading } = useLeads();
  const { data: logs } = useAgentLogs();
  const { data: campaigns } = useCampaigns();

  return useMemo(() => {
    const now = Date.now();
    const since7d = now - 7 * DAY;

    const leads7d = leads.filter((l) => new Date(l.created_at).getTime() >= since7d);
    const qualified = leads7d.filter((l: any) => l.intent_level === "high").length;
    const replies = leads7d.filter((l: any) => !!l.replied_at).length;

    const sent7d = logs.filter(
      (l) =>
        l.agent_type === "nurturing" &&
        l.action?.startsWith("WhatsApp sent") &&
        new Date(l.created_at).getTime() >= since7d,
    ).length;

    const replyRate = sent7d ? replies / sent7d : 0;
    const qualifiedRate = leads7d.length ? qualified / leads7d.length : 0;

    // Cost per lead per campaign — uses campaign.spend (lifetime) and last-7d lead count.
    const cplByCampaign = new Map<string, { name: string; leads: number; spend: number; cpl: number }>();
    for (const c of campaigns) {
      const cLeads = leads7d.filter((l: any) => l.campaign_id === c.id).length;
      const spend = Number(c.spend) || 0;
      cplByCampaign.set(c.id, {
        name: c.name,
        leads: cLeads,
        spend,
        cpl: cLeads > 0 ? Math.round(spend / cLeads) : 0,
      });
    }

    const cplEntries = [...cplByCampaign.values()].filter((v) => v.leads > 0);
    const avgCpl = cplEntries.length
      ? Math.round(cplEntries.reduce((a, v) => a + v.cpl, 0) / cplEntries.length)
      : 0;

    const best = cplEntries.length
      ? cplEntries.reduce((a, b) => (b.leads > a.leads ? b : a))
      : null;

    return {
      loading: leadsLoading,
      leads7d: leads7d.length,
      qualified,
      qualifiedRate,
      replies,
      sent7d,
      replyRate,
      avgCpl,
      bestCampaign: best,
      cplByCampaign: cplEntries,
    };
  }, [leads, logs, campaigns, leadsLoading]);
}
