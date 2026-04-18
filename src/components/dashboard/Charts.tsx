import { Card } from "@/components/ui/card";
import { performanceSeries } from "@/data/mockData";
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

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 4px 12px hsl(0 0% 0% / 0.15)",
};

const labelStyle = { color: "hsl(var(--muted-foreground))", marginBottom: 4 };

export function PerformanceChart() {
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
          <AreaChart data={performanceSeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
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
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ stroke: "hsl(var(--border))" }} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="spend"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#spendGrad)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="roas"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              fill="url(#roasGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function LeadsBarChart() {
  return (
    <Card className="p-5 bg-card border-border shadow-card">
      <div className="mb-5">
        <h3 className="text-sm font-semibold">Daily leads</h3>
        <p className="text-xs text-muted-foreground mt-0.5">WhatsApp + form leads</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={performanceSeries} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
            <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
