import { useMemo, useState } from "react";
import { Search, Users, Phone, MessageSquare, Filter } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLeads } from "@/hooks/useLeads";
import { useSchools } from "@/hooks/useSchools";
import { supabase, type Lead } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const INTENT_CLASS: Record<string, string> = {
  high: "bg-success/10 text-success border-success/20",
  medium: "bg-info/10 text-info border-info/20",
  low: "bg-warning/10 text-warning border-warning/20",
  unknown: "bg-muted text-muted-foreground border-border",
};

const STATUS_CLASS: Record<string, string> = {
  new: "bg-info/10 text-info border-info/20",
  contacted: "bg-warning/10 text-warning border-warning/20",
  replied: "bg-success/10 text-success border-success/20",
  qualified: "bg-success/10 text-success border-success/20",
  converted: "bg-primary/10 text-primary border-primary/20",
  lost: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_OPTIONS = ["new", "contacted", "replied", "qualified", "converted", "lost"];
const INTENT_OPTIONS = ["high", "medium", "low", "unknown"];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Leads() {
  const { data: leads, loading, refetch } = useLeads();
  const { data: schools } = useSchools();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [updating, setUpdating] = useState(false);

  const schoolMap = useMemo(
    () => Object.fromEntries(schools.map((s) => [s.id, s.name])),
    [schools],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && (l.status ?? "new") !== statusFilter) return false;
      if (intentFilter !== "all" && (l.intent_level ?? "unknown") !== intentFilter) return false;
      if (schoolFilter !== "all" && l.school_id !== schoolFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        (schoolMap[l.school_id] ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, query, statusFilter, intentFilter, schoolFilter, schoolMap]);

  const counts = useMemo(() => {
    const total = leads.length;
    const high = leads.filter((l) => l.intent_level === "high").length;
    const newCount = leads.filter((l) => (l.status ?? "new") === "new").length;
    const replied = leads.filter((l) => l.replied_at).length;
    return { total, high, newCount, replied };
  }, [leads]);

  async function updateStatus(lead: Lead, status: string) {
    setUpdating(true);
    const { error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", lead.id);
    setUpdating(false);
    if (error) {
      toast.error(`Failed to update: ${error.message}`);
      return;
    }
    toast.success(`Status updated to ${status}`);
    setSelected({ ...lead, status });
    refetch();
  }

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-foreground">Leads</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All inbound leads across schools — search, filter, and update status.
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total leads" value={counts.total} icon={Users} />
        <StatTile label="High intent" value={counts.high} icon={Filter} tone="success" />
        <StatTile label="New (untouched)" value={counts.newCount} icon={MessageSquare} tone="info" />
        <StatTile label="Replied" value={counts.replied} icon={Phone} tone="success" />
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or school…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={intentFilter} onValueChange={setIntentFilter}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="Intent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All intents</SelectItem>
                  {INTENT_OPTIONS.map((i) => (
                    <SelectItem key={i} value={i} className="capitalize">
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="School" />
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              Loading leads…
            </div>
          ) : !filtered.length ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              No leads match the current filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const level = (l.intent_level ?? "unknown") as keyof typeof INTENT_CLASS;
                  const status = (l.status ?? "new") as keyof typeof STATUS_CLASS;
                  return (
                    <TableRow
                      key={l.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(l)}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">{l.name}</div>
                        <div className="text-[11px] text-muted-foreground">{l.phone}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {schoolMap[l.school_id] ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {l.source ?? "manual"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] uppercase", INTENT_CLASS[level])}
                        >
                          {level}
                          {l.intent_score != null &&
                            ` · ${Math.round(Number(l.intent_score) * 100)}%`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase",
                            STATUS_CLASS[status] ?? STATUS_CLASS.new,
                          )}
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(l.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="space-y-2">
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {selected.phone}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <DetailField label="School" value={schoolMap[selected.school_id] ?? "—"} />
                  <DetailField label="Source" value={selected.source ?? "manual"} />
                  <DetailField
                    label="Intent"
                    value={
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase",
                          INTENT_CLASS[selected.intent_level ?? "unknown"],
                        )}
                      >
                        {selected.intent_level ?? "unknown"}
                        {selected.intent_score != null &&
                          ` · ${Math.round(Number(selected.intent_score) * 100)}%`}
                      </Badge>
                    }
                  />
                  <DetailField
                    label="Created"
                    value={new Date(selected.created_at).toLocaleString()}
                  />
                  {selected.replied_at && (
                    <DetailField
                      label="Replied"
                      value={new Date(selected.replied_at).toLocaleString()}
                    />
                  )}
                  {selected.scored_at && (
                    <DetailField
                      label="Scored"
                      value={new Date(selected.scored_at).toLocaleString()}
                    />
                  )}
                </div>

                {selected.score_reason && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Score reason
                    </p>
                    <p className="text-sm bg-muted/40 border border-border/60 rounded-md p-3 leading-relaxed">
                      {selected.score_reason}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Update status
                  </p>
                  <Select
                    value={selected.status ?? "new"}
                    onValueChange={(v) => updateStatus(selected, v)}
                    disabled={updating}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Refresh the page to see the change reflected in the list.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
                    <a href={`tel:${selected.phone}`}>
                      <Phone className="h-3.5 w-3.5" />
                      Call
                    </a>
                  </Button>
                  <Button asChild size="sm" className="flex-1 gap-1.5">
                    <a
                      href={`https://wa.me/${selected.phone.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "text-success bg-success/10"
      : tone === "info"
      ? "text-info bg-info/10"
      : "text-primary bg-primary/10";
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-9 w-9 rounded-md flex items-center justify-center", toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}
