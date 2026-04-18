import { Activity, IndianRupee, Target, TrendingUp, Users, Zap } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LeadsBarChart, PerformanceChart } from "@/components/dashboard/Charts";
import { AgentStatusGrid } from "@/components/dashboard/AgentStatusGrid";
import { SchoolsTable } from "@/components/dashboard/SchoolsTable";
import { agencyKpis } from "@/data/mockData";
import { Button } from "@/components/ui/button";

const inr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export default function AgencyDashboard() {
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
            Here&apos;s what your autonomous agents executed across {agencyKpis.totalSchools} schools today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            Last 14 days
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
            <Zap className="h-3.5 w-3.5" />
            New campaign
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Spend"
          value={inr(agencyKpis.totalSpend)}
          delta={12}
          icon={IndianRupee}
          hint="vs last 14d"
        />
        <KpiCard
          label="Total Leads"
          value={agencyKpis.totalLeads.toString()}
          delta={24}
          icon={Users}
          hint="WhatsApp + form"
        />
        <KpiCard
          label="Avg ROAS"
          value={`${agencyKpis.avgRoas}x`}
          delta={8}
          icon={TrendingUp}
          hint="across portfolio"
        />
        <KpiCard
          label="Avg CPA"
          value={`₹${agencyKpis.avgCpa}`}
          delta={-6}
          icon={Target}
          hint="cost per acquisition"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PerformanceChart />
        <LeadsBarChart />
      </div>

      {/* Agent status */}
      <AgentStatusGrid />

      {/* Schools table */}
      <SchoolsTable />

      {/* Footer hint */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
        <Activity className="h-3 w-3" />
        <span>
          {agencyKpis.activeCampaigns} active campaigns · agents executed {agencyKpis.totalLeads}+ actions in the last 24h
        </span>
      </div>
    </div>
  );
}
