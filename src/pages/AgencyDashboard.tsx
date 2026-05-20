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
  const messaging = useMessagingStats();

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
            <span>Ajans</span>
            <span>/</span>
            <span className="text-foreground">Genel Bakış</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Günaydın, Yönetici</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {schools.length} okul genelinde otonom kararlar — sıradaki en iyi aksiyon.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            Son 7 gün
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
            <Zap className="h-3.5 w-3.5" />
            Yeni kampanya
          </Button>
        </div>
      </div>

      {/* Spend KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Toplam Harcama" value={inr(totalSpend)} delta={12} icon={IndianRupee} hint="son 14 güne göre" />
        <KpiCard label="Aktif Kampanya" value={activeCampaigns.toString()} delta={6} icon={Users} hint={`${campaigns.length} toplam`} />
        <KpiCard label="Ortalama ROAS" value={`${avgRoas}x`} delta={8} icon={TrendingUp} hint="portföy geneli" />
        <KpiCard label="Ortalama CPA" value={`₹${avgCpa}`} delta={-6} icon={Target} hint="edinme başına maliyet" />
      </div>

      {/* Growth KPIs — the new decision metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Yanıt Oranı (7g)"
          value={growth.loading ? "…" : pct(growth.replyRate)}
          icon={Reply}
          hint={`${growth.replies}/${growth.sent7d} WhatsApp`}
        />
        <KpiCard
          label="Nitelikli Lead Oranı"
          value={growth.loading ? "…" : pct(growth.qualifiedRate)}
          icon={Target}
          hint={`${growth.leads7d} içinden ${growth.qualified} yüksek niyet`}
        />
        <KpiCard
          label="Lead Başına Ortalama Maliyet"
          value={growth.loading ? "…" : `₹${growth.avgCpl}`}
          icon={IndianRupee}
          hint="aktif kampanyalar"
        />
        <KpiCard
          label="En İyi Kampanya (7g)"
          value={growth.bestCampaign ? `${growth.bestCampaign.leads} lead` : "—"}
          icon={Trophy}
          hint={growth.bestCampaign?.name?.slice(0, 28) ?? "veri yok"}
        />
      </div>

      {/* Funnel pulse */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Yeni Lead (24s)"
          value={funnel.loading ? "…" : funnel.newLeads24h.toString()}
          icon={UserPlus}
          hint="Meta Lead Ads + manuel"
        />
        <KpiCard
          label="Gönderilen mesaj (24s)"
          value={messaging.loading ? "…" : messaging.outbound24h.toString()}
          icon={Send}
          hint="Telegram + WhatsApp giden"
        />
        <KpiCard
          label="Gelen yanıt (24s)"
          value={messaging.loading ? "…" : messaging.inbound24h.toString()}
          icon={MessageSquare}
          hint="lead → bot, canlı sayım"
        />
        <KpiCard
          label="Yanıt oranı (7g)"
          value={messaging.loading ? "…" : pct(messaging.responseRate7d)}
          icon={Reply}
          hint={`${messaging.inbound7d} gelen / ${messaging.outbound7d} giden`}
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
          {activeCampaigns} aktif kampanya · ajanlar son zamanlarda {logs.length} aksiyon gerçekleştirdi
        </span>
      </div>
    </div>
  );
}
