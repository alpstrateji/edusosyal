import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSchools } from "@/hooks/useSchools";
import { useCampaigns } from "@/hooks/useCampaigns";
import { Skeleton } from "@/components/ui/skeleton";

const inr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

const statusMap: Record<string, string> = {
  healthy: "bg-success/15 text-success border-success/30",
  attention: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusLabel: Record<string, string> = {
  healthy: "Sağlıklı",
  attention: "Dikkat",
  critical: "Kritik",
};

export function SchoolsTable() {
  const { data: schools, loading } = useSchools();
  const { data: campaigns } = useCampaigns();

  const rows = schools.map((s) => {
    const sc = campaigns.filter((c) => c.school_id === s.id);
    const spend = sc.reduce((a, c) => a + Number(c.spend), 0);
    const avgRoas = sc.length ? sc.reduce((a, c) => a + Number(c.roas), 0) / sc.length : 0;
    const avgCpa = sc.length ? sc.reduce((a, c) => a + Number(c.cpa), 0) / sc.length : 0;
    const status: "healthy" | "attention" | "critical" =
      avgRoas >= 4 ? "healthy" : avgRoas >= 2.5 ? "attention" : "critical";
    return { id: s.id, name: s.name, spend, roas: avgRoas, cpa: avgCpa, campaigns: sc.length, status };
  });

  return (
    <Card className="bg-card border-border shadow-card overflow-hidden">
      <div className="p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Okul portföyü</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {schools.length} aktif okulda canlı performans
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
          Tümünü gör <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-5 py-2.5">Okul</th>
              <th className="text-right font-medium px-3 py-2.5">Harcama</th>
              <th className="text-right font-medium px-3 py-2.5">Kampanya</th>
              <th className="text-right font-medium px-3 py-2.5">CPA</th>
              <th className="text-right font-medium px-3 py-2.5">ROAS</th>
              <th className="text-right font-medium px-5 py-2.5">Durum</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-6">
                  <Skeleton className="h-4 w-full" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Okul bulunamadı. Supabase projenizde seed SQL'i çalıştırın.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.campaigns} aktif kampanya</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{inr(s.spend)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{s.campaigns}</td>
                <td className="px-3 py-3 text-right tabular-nums">{inr(Math.round(s.cpa))}</td>
                <td className="px-3 py-3 text-right tabular-nums font-medium">
                  <span className={cn(s.roas >= 4 ? "text-success" : s.roas >= 3 ? "text-warning" : "text-destructive")}>
                    {s.roas.toFixed(1)}x
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Badge variant="outline" className={cn("text-[10px] font-medium", statusMap[s.status])}>
                    {statusLabel[s.status]}
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
