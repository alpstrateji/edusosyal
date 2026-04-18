import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { schools } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const inr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

const statusMap = {
  healthy: "bg-success/15 text-success border-success/30",
  attention: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function SchoolsTable() {
  return (
    <Card className="bg-card border-border shadow-card overflow-hidden">
      <div className="p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Schools portfolio</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live performance across {schools.length} active client schools
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
          View all <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-5 py-2.5">School</th>
              <th className="text-right font-medium px-3 py-2.5">Spend</th>
              <th className="text-right font-medium px-3 py-2.5">Leads</th>
              <th className="text-right font-medium px-3 py-2.5">CPA</th>
              <th className="text-right font-medium px-3 py-2.5">ROAS</th>
              <th className="text-right font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr
                key={s.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-5 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.city} · target {s.studentsTarget} admissions
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{inr(s.monthlySpend)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{s.leads}</td>
                <td className="px-3 py-3 text-right tabular-nums">{inr(s.cpa)}</td>
                <td className="px-3 py-3 text-right tabular-nums font-medium">
                  <span className={cn(s.roas >= 4 ? "text-success" : s.roas >= 3 ? "text-warning" : "text-destructive")}>
                    {s.roas.toFixed(1)}x
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Badge variant="outline" className={cn("capitalize text-[10px] font-medium", statusMap[s.status])}>
                    {s.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
