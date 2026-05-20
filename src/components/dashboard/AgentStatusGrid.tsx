import { Card } from "@/components/ui/card";
import {
  Activity,
  Sparkles,
  Wallet,
  Users,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import type { AgentType } from "@/lib/supabaseClient";

const AGENTS: { type: AgentType; name: string; description: string; icon: LucideIcon }[] = [
  { type: "performance", name: "Performans Denetçisi", description: "CTR, CPA, ROAS izler — düşük performansı durdurur", icon: Activity },
  { type: "creative", name: "Kreatif Analisti", description: "Kreatif yorgunluğunu tespit eder, varlıkları rotasyonlar", icon: Sparkles },
  { type: "budget", name: "Bütçe Yöneticisi", description: "Harcamayı en yüksek ROAS setlerine yönlendirir", icon: Wallet },
  { type: "audience", name: "Kitle Mimarı", description: "Dönüşen lead'lerden lookalike kitleler oluşturur", icon: Users },
  { type: "nurturing", name: "Lead Beslemesi", description: "Donuk lead'leri WhatsApp üzerinden takip eder", icon: MessageCircle },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)}g önce`;
}

export function AgentStatusGrid() {
  const { data: logs } = useAgentLogs();

  return (
    <Card className="p-5 bg-card border-border shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Otonom ajanlar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Portföyünüzde çalışan 5 uzman ajan
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const agentLogs = logs.filter((l) => l.agent_type === agent.type);
          const last = agentLogs[0];
          const hasError = agentLogs.some((l) => l.severity === "error");
          const hasWarn = agentLogs.some((l) => l.severity === "warning");
          const status = hasError ? "warning" : hasWarn ? "warning" : last ? "active" : "idle";
          const styles =
            status === "active"
              ? { dot: "bg-success shadow-[0_0_10px_hsl(var(--success))]", text: "text-success", label: "Aktif" }
              : status === "warning"
                ? { dot: "bg-warning shadow-[0_0_10px_hsl(var(--warning))]", text: "text-warning", label: "Dikkat" }
                : { dot: "bg-muted-foreground/50", text: "text-muted-foreground", label: "Boşta" };

          return (
            <div
              key={agent.type}
              className="group rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-colors p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div className="h-8 w-8 rounded-md bg-background border border-border flex items-center justify-center">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot, status === "active" && "animate-pulse-glow")} />
                  <span className={cn("text-[10px] uppercase tracking-wider font-medium", styles.text)}>
                    {styles.label}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-tight">{agent.name}</p>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{agent.description}</p>
              </div>
              <div className="pt-2 mt-auto border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="tabular-nums font-medium text-foreground">{agentLogs.length}</span>
                <span>{last ? timeAgo(last.created_at) : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
