import { Card } from "@/components/ui/card";
import { agentStatuses, type AgentStatus, type AgentType } from "@/data/mockData";
import {
  Activity,
  Sparkles,
  Wallet,
  Users,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<AgentType, LucideIcon> = {
  performance: Activity,
  creative: Sparkles,
  budget: Wallet,
  audience: Users,
  nurturing: MessageCircle,
};

const statusStyles: Record<AgentStatus, { dot: string; text: string; label: string }> = {
  active: { dot: "bg-success shadow-[0_0_10px_hsl(var(--success))]", text: "text-success", label: "Active" },
  warning: { dot: "bg-warning shadow-[0_0_10px_hsl(var(--warning))]", text: "text-warning", label: "Attention" },
  idle: { dot: "bg-muted-foreground/50", text: "text-muted-foreground", label: "Idle" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AgentStatusGrid() {
  return (
    <Card className="p-5 bg-card border-border shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Autonomous agents</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            5 specialized agents operating across your portfolio
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {agentStatuses.map((agent) => {
          const Icon = iconMap[agent.type];
          const styles = statusStyles[agent.status];
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
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      styles.dot,
                      agent.status === "active" && "animate-pulse-glow",
                    )}
                  />
                  <span className={cn("text-[10px] uppercase tracking-wider font-medium", styles.text)}>
                    {styles.label}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-tight">{agent.name}</p>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                  {agent.description}
                </p>
              </div>
              <div className="pt-2 mt-auto border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="tabular-nums font-medium text-foreground">
                  {agent.actionsToday}
                </span>
                <span>{timeAgo(agent.lastActionAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
