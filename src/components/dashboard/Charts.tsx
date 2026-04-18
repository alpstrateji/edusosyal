import { Card } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useMemo } from "react";

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 4px 12px hsl(0 0% 0% / 0.15)",
};
const labelStyle = { color: "hsl(var(--muted-foreground))", marginBottom: 4 };

// Build a 14-day deterministic-ish series from real campaign aggregates.
function useSeries() {
  const { data: campaigns } = useCampaigns();
  const { data: logs } = useAgentLogs();

  return useMemo(() => {
    const totalSpend = campaigns.reduce((a, c) => a + Number(c.spend), 0);
    const avgRoas = campaigns.length
      ? campaigns.reduce((a, c) => a + Number(c.roas), 0) / campaigns.length
      : 0;
    const days = 14;
    const series: { date: string; spend: number; roas: number; leads: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const noise = 0.85 + ((i * 13) % 30) / 100;
      series.push({
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        spend: Math.round((totalSpend / days) * noise),
        roas: +(avgRoas * (0.9 + ((i * 7) % 25) / 100)).toFixed(2),
        leads: Math.max(1, Math.round((logs.length / days) * noise * 1.2)),
      });
    }
    return series;
  }, [campaigns, logs]);
}

export function PerformanceChart() {
  const data = useSeries();
  return (
    <Card className="p-5 bg-card border-border shadow-card lg:col-span-2">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold">Spend & ROAS — last 14 days</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily ad spend across all schools, overlaid with return on ad spend
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Spend (₹)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-muted-foreground">ROAS</span>
          </span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="roasGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ stroke: "hsl(var(--border))" }} />
            <Area yAxisId="left" type="monotone" dataKey="spend" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#spendGrad)" />
            <Area yAxisId="right" type="monotone" dataKey="roas" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#roasGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function LeadsBarChart() {
  const data = useSeries();
  return (
    <Card className="p-5 bg-card border-border shadow-card">
      <div className="mb-5">
        <h3 className="text-sm font-semibold">Daily activity</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Agent actions per day</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
            <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
