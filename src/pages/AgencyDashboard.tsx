import { Activity, IndianRupee, MessageSquare, Reply, Send, Target, TrendingUp, Trophy, UserPlus, Users, Zap } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LeadsBarChart, PerformanceChart } from "@/components/dashboard/Charts";
import { AgentStatusGrid } from "@/components/dashboard/AgentStatusGrid";
import { SchoolsTable } from "@/components/dashboard/SchoolsTable";
import { WhatsAppPanel } from "@/components/dashboard/WhatsAppPanel";
import { RecommendationsPanel } from "@/components/dashboard/RecommendationsPanel";
import { RecentLeadsFeed } from "@/components/dashboard/RecentLeadsFeed";
import { Button } from "@/components/ui/button";
import { useSchools } from "@/hooks/useSchools";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useFunnelStats } from "@/hooks/useFunnelStats";
import { useGrowthStats } from "@/hooks/useGrowthStats";
import { useMessagingStats } from "@/hooks/useMessagingStats";

const inr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export default function AgencyDashboard() {
  const { data: schools } = useSchools();
  const { data: campaigns } = useCampaigns();
  const { data: logs } = useAgentLogs();
  const funnel = useFunnelStats();
  const growth = useGrowthStats();

  const totalSpend = campaigns.reduce((a, c) => a + Number(c.spend), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const avgRoas = campaigns.length
    ? +(campaigns.reduce((a, c) => a + Number(c.roas), 0) / campaigns.length).toFixed(2)
    : 0;
  const avgCpa = campaigns.length
    ? Math.round(campaigns.reduce((a, c) => a + Number(c.cpa), 0) / campaigns.length)
    : 0;

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <span>Agency</span>
            <span>/</span>
            <span className="text-foreground">Overview</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Good morning, Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Autonomous decisions across {schools.length} schools — what to do next, ranked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            Last 7 days
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
            <Zap className="h-3.5 w-3.5" />
            New campaign
          </Button>
        </div>
      </div>

      {/* Spend KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Spend" value={inr(totalSpend)} delta={12} icon={IndianRupee} hint="vs last 14d" />
        <KpiCard label="Active Campaigns" value={activeCampaigns.toString()} delta={6} icon={Users} hint={`${campaigns.length} total`} />
        <KpiCard label="Avg ROAS" value={`${avgRoas}x`} delta={8} icon={TrendingUp} hint="across portfolio" />
        <KpiCard label="Avg CPA" value={`₹${avgCpa}`} delta={-6} icon={Target} hint="cost per acquisition" />
      </div>

      {/* Growth KPIs — the new decision metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Reply Rate (7d)"
          value={growth.loading ? "…" : pct(growth.replyRate)}
          icon={Reply}
          hint={`${growth.replies}/${growth.sent7d} WhatsApp`}
        />
        <KpiCard
          label="Qualified Lead Rate"
          value={growth.loading ? "…" : pct(growth.qualifiedRate)}
          icon={Target}
          hint={`${growth.qualified} high-intent of ${growth.leads7d}`}
        />
        <KpiCard
          label="Avg Cost / Lead"
          value={growth.loading ? "…" : `₹${growth.avgCpl}`}
          icon={IndianRupee}
          hint="across active campaigns"
        />
        <KpiCard
          label="Best Campaign (7d)"
          value={growth.bestCampaign ? `${growth.bestCampaign.leads} leads` : "—"}
          icon={Trophy}
          hint={growth.bestCampaign?.name?.slice(0, 28) ?? "no campaign data"}
        />
      </div>

      {/* Funnel pulse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="New Leads (last 24h)"
          value={funnel.loading ? "…" : funnel.newLeads24h.toString()}
          icon={UserPlus}
          hint="from Meta Lead Ads + manual"
        />
        <KpiCard
          label="Auto-messages sent (24h)"
          value={funnel.loading ? "…" : funnel.autoMessages24h.toString()}
          icon={MessageSquare}
          hint="WhatsApp via nurturing agent"
        />
      </div>

      {/* AI Recommendations + Recent Leads — the decision engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecommendationsPanel />
        <RecentLeadsFeed />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PerformanceChart />
        <LeadsBarChart />
      </div>

      <AgentStatusGrid />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WhatsAppPanel />
        <SchoolsTable />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
        <Activity className="h-3 w-3" />
        <span>
          {activeCampaigns} active campaigns · agents executed {logs.length} actions recently
        </span>
      </div>
    </div>
  );
}
