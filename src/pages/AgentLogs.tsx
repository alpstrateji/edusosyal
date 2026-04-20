import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  Search,
  Terminal,
  Activity,
  Sparkles,
  Wallet,
  Users,
  MessageCircle,
  type LucideIcon,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useSchools } from "@/hooks/useSchools";
import type { AgentLogRow, AgentType } from "@/lib/supabaseClient";

const agentIcons: Record<AgentType, LucideIcon> = {
  performance: Activity,
  creative: Sparkles,
  budget: Wallet,
  audience: Users,
  nurturing: MessageCircle,
};

const agentLabels: Record<AgentType, string> = {
  performance: "Performance Auditor",
  creative: "Creative Analyst",
  budget: "Budget Manager",
  audience: "Audience Architect",
  nurturing: "Lead Nurturing",
};

const severityConfig = {
  info: { icon: Info, className: "text-info border-info/30 bg-info/10" },
  success: { icon: CheckCircle2, className: "text-success border-success/30 bg-success/10" },
  warning: { icon: AlertTriangle, className: "text-warning border-warning/30 bg-warning/10" },
  error: { icon: XCircle, className: "text-destructive border-destructive/30 bg-destructive/10" },
} as const;

function fmtTime(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19);
}

function LogRow({ log, schoolName }: { log: AgentLogRow; schoolName: string }) {
  const [open, setOpen] = useState(false);
  const Icon = agentIcons[log.agent_type];
  const sev = severityConfig[log.severity];
  const SevIcon = sev.icon;

  return (
    <div className="border-b border-border last:border-0 font-mono text-[13px]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-90")} />
        <span className="text-muted-foreground tabular-nums shrink-0 hidden sm:inline">{fmtTime(log.created_at)}</span>
        <span className={cn("inline-flex items-center justify-center h-5 w-5 rounded shrink-0", sev.className)}>
          <SevIcon className="h-3 w-3" />
        </span>
        <span className="inline-flex items-center gap-1.5 shrink-0 text-muted-foreground min-w-[140px]">
          <Icon className="h-3.5 w-3.5" />
          <span className="text-foreground">{agentLabels[log.agent_type]}</span>
        </span>
        <span className="text-foreground truncate flex-1">{log.action}</span>
        <span className="text-muted-foreground text-xs shrink-0 hidden md:inline">{schoolName}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 pl-12 space-y-3 bg-muted/20 animate-fade-in">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Reasoning chain</div>
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground bg-background border border-border rounded-md p-3">
              <span className="text-success">$</span> agent.{log.agent_type}.explain(){"\n"}
              <span className="text-muted-foreground">› </span>
              {log.reasoning}
            </pre>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Metadata</div>
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-info bg-background border border-border rounded-md p-3">
              {JSON.stringify(log.metadata ?? {}, null, 2)}
            </pre>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>id: {log.id}</span>
            <span>·</span>
            <span>school_id: {log.school_id}</span>
            <span>·</span>
            <span>severity: {log.severity}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentLogs() {
  const { data: logs, loading, error } = useAgentLogs();
  const { data: schools } = useSchools();

  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const schoolMap = useMemo(() => Object.fromEntries(schools.map((s) => [s.id, s.name])), [schools]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (agentFilter !== "all" && l.agent_type !== agentFilter) return false;
      if (schoolFilter !== "all" && l.school_id !== schoolFilter) return false;
      if (severityFilter !== "all" && l.severity !== severityFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!l.action.toLowerCase().includes(q) && !l.reasoning.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, agentFilter, schoolFilter, severityFilter, query]);

  const counts = useMemo(
    () => ({
      total: logs.length,
      warning: logs.filter((l) => l.severity === "warning").length,
      error: logs.filter((l) => l.severity === "error").length,
      success: logs.filter((l) => l.severity === "success").length,
    }),
    [logs],
  );

  return (
    <div className="px-4 md:px-8 py-6 space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <span>Agents</span>
            <span>/</span>
            <span className="text-foreground">Logs</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Agent activity log
            <span className="ml-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-glow" />
              live
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every autonomous decision with its full reasoning chain. New events stream in via Realtime.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            <span className="text-foreground font-semibold tabular-nums">{counts.total}</span> events
          </span>
          <span className="inline-flex items-center gap-1 text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {counts.success}
          </span>
          <span className="inline-flex items-center gap-1 text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            {counts.warning}
          </span>
          <span className="inline-flex items-center gap-1 text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            {counts.error}
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3 bg-card border-border shadow-card">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search action or reasoning…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-9 bg-muted/40 border-border font-mono text-xs"
            />
          </div>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="h-9 w-full md:w-[180px] text-xs bg-muted/40">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="performance">Performance Auditor</SelectItem>
              <SelectItem value="creative">Creative Analyst</SelectItem>
              <SelectItem value="budget">Budget Manager</SelectItem>
              <SelectItem value="audience">Audience Architect</SelectItem>
              <SelectItem value="nurturing">Lead Nurturing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="h-9 w-full md:w-[200px] text-xs bg-muted/40">
              <SelectValue placeholder="All schools" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-9 w-full md:w-[140px] text-xs bg-muted/40">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => {
              setAgentFilter("all");
              setSchoolFilter("all");
              setSeverityFilter("all");
              setQuery("");
            }}
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Console */}
      <Card className="bg-card border-border shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 font-mono text-[11px] text-muted-foreground">
            edusonex@agents:~ $ tail -f /var/log/agents.jsonl ({filtered.length} matching)
          </span>
        </div>
        <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
          {loading && (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          )}
          {error && (
            <div className="p-8 text-center text-sm text-destructive font-mono">
              Unable to load logs. Please try again or contact support.
            </div>
          )}
          {!loading && !error && filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground font-mono">
              <Terminal className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No log entries match your filters.
            </div>
          ) : (
            !loading &&
            filtered.map((log) => (
              <LogRow key={log.id} log={log} schoolName={schoolMap[log.school_id] ?? log.school_id} />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
