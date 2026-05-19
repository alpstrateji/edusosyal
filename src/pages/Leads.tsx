import { useMemo, useState } from "react";
import {
  Search,
  Users,
  Phone,
  MessageSquare,
  Filter,
  Download,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ConversationPanel } from "@/components/leads/ConversationPanel";
import { generateAiReply } from "@/lib/messagingService";

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
const REPLY_OPTIONS = [
  { value: "all", label: "All replies" },
  { value: "replied", label: "Replied" },
  { value: "not_replied", label: "Not replied" },
];

const INTENT_RANK: Record<string, number> = { high: 3, medium: 2, low: 1, unknown: 0 };

type SortField = "created_at" | "name" | "intent_score" | "status";
type SortDir = "asc" | "desc";


function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: Lead[], schoolMap: Record<string, string>) {
  const headers = [
    "id",
    "name",
    "phone",
    "school",
    "source",
    "status",
    "intent_level",
    "intent_score",
    "score_reason",
    "replied_at",
    "scored_at",
    "created_at",
  ];
  const lines = [headers.join(",")];
  rows.forEach((l) => {
    lines.push(
      [
        l.id,
        l.name,
        l.phone,
        schoolMap[l.school_id] ?? "",
        l.source ?? "",
        l.status ?? "",
        l.intent_level ?? "",
        l.intent_score ?? "",
        l.score_reason ?? "",
        l.replied_at ?? "",
        l.scored_at ?? "",
        l.created_at,
      ]
        .map(csvEscape)
        .join(","),
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Leads() {
  const { data: leads, loading, refetch } = useLeads();
  const { data: schools } = useSchools();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [replyFilter, setReplyFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [updating, setUpdating] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkAiRunning, setBulkAiRunning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [rowAction, setRowAction] = useState<{ id: string; kind: "send" | "ai" } | null>(null);

  const schoolMap = useMemo(
    () => Object.fromEntries(schools.map((s) => [s.id, s.name])),
    [schools],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = leads.filter((l) => {
      if (statusFilter !== "all" && (l.status ?? "new") !== statusFilter) return false;
      if (intentFilter !== "all" && (l.intent_level ?? "unknown") !== intentFilter) return false;
      if (schoolFilter !== "all" && l.school_id !== schoolFilter) return false;
      if (replyFilter === "replied" && !l.replied_at) return false;
      if (replyFilter === "not_replied" && l.replied_at) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        (schoolMap[l.school_id] ?? "").toLowerCase().includes(q)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortField === "intent_score") {
        // Combine numeric score with level rank as tiebreaker.
        av = a.intent_score != null ? Number(a.intent_score) : INTENT_RANK[a.intent_level ?? "unknown"] / 10;
        bv = b.intent_score != null ? Number(b.intent_score) : INTENT_RANK[b.intent_level ?? "unknown"] / 10;
      } else if (sortField === "created_at") {
        av = new Date(a.created_at).getTime();
        bv = new Date(b.created_at).getTime();
      } else if (sortField === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else {
        av = a.status ?? "";
        bv = b.status ?? "";
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [leads, query, statusFilter, intentFilter, schoolFilter, replyFilter, schoolMap, sortField, sortDir]);

  async function quickAiReply(lead: Lead, send: boolean) {
    setRowAction({ id: lead.id, kind: send ? "send" : "ai" });
    const res = await generateAiReply(lead.id, send);
    setRowAction(null);
    if (!res.success) {
      toast.error(`AI failed: ${res.error ?? "unknown"}`);
      return;
    }
    if (send) {
      toast.success("AI reply sent");
      refetch();
    } else if (res.text) {
      // No drawer open — just let the user know it's queued in their pipeline.
      toast.success("Draft generated — open the lead to review");
    }
  }

  const counts = useMemo(() => {
    const total = leads.length;
    const high = leads.filter((l) => l.intent_level === "high").length;
    const newCount = leads.filter((l) => (l.status ?? "new") === "new").length;
    const replied = leads.filter((l) => l.replied_at).length;
    return { total, high, newCount, replied };
  }, [leads]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "status" ? "asc" : "desc");
    }
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function toggleOne(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  }

  async function updateStatus(lead: Lead, status: string) {
    setUpdating(true);
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    setUpdating(false);
    if (error) {
      toast.error(`Failed to update: ${error.message}`);
      return;
    }
    toast.success(`Status updated to ${status}`);
    setSelected({ ...lead, status });
    refetch();
  }

  async function bulkUpdateStatus(status: string) {
    if (!selectedIds.size) return;
    setBulkUpdating(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("leads").update({ status }).in("id", ids);
    setBulkUpdating(false);
    if (error) {
      toast.error(`Bulk update failed: ${error.message}`);
      return;
    }
    toast.success(`Updated ${ids.length} leads to "${status}"`);
    setSelectedIds(new Set());
    refetch();
  }

  function exportCsv(scope: "filtered" | "selected") {
    const rows =
      scope === "selected"
        ? filtered.filter((l) => selectedIds.has(l.id))
        : filtered;
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    downloadCsv(rows, schoolMap);
    toast.success(`Exported ${rows.length} leads`);
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
            All inbound leads across schools — search, filter, sort, and update in bulk.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => exportCsv("filtered")}
          disabled={!filtered.length}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV ({filtered.length})
        </Button>
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
              <Select value={replyFilter} onValueChange={setReplyFilter}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="Reply" />
                </SelectTrigger>
                <SelectContent>
                  {REPLY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="px-5 py-3 border-y border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-medium">{selectedIds.size}</span> selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value=""
                onValueChange={(v) => bulkUpdateStatus(v)}
                disabled={bulkUpdating}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Set status to…" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => bulkGenerateDrafts()}
                disabled={bulkAiRunning}
              >
                {bulkAiRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Bulk AI draft
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => exportCsv("selected")}
              >
                <Download className="h-3.5 w-3.5" />
                Export selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={(c) => toggleAll(!!c)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <SortHeader
                    label="Name"
                    field="name"
                    sortField={sortField}
                    sortDir={sortDir}
                    onClick={toggleSort}
                  />
                  <TableHead>School</TableHead>
                  <TableHead>Source</TableHead>
                  <SortHeader
                    label="Intent"
                    field="intent_score"
                    sortField={sortField}
                    sortDir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortHeader
                    label="Status"
                    field="status"
                    sortField={sortField}
                    sortDir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortHeader
                    label="Created"
                    field="created_at"
                    sortField={sortField}
                    sortDir={sortDir}
                    onClick={toggleSort}
                  />
                  <TableHead>Last activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const level = (l.intent_level ?? "unknown") as keyof typeof INTENT_CLASS;
                  const status = (l.status ?? "new") as keyof typeof STATUS_CLASS;
                  const isSelected = selectedIds.has(l.id);
                  return (
                    <TableRow
                      key={l.id}
                      data-state={isSelected ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => setSelected(l)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(c) => toggleOne(l.id, !!c)}
                          aria-label={`Select ${l.name}`}
                        />
                      </TableCell>
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
                      <TableCell className="text-xs whitespace-nowrap">
                        <ActivityCell lead={l} />
                      </TableCell>
                      <TableCell
                        className="text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Generate AI reply (draft)"
                            disabled={rowAction?.id === l.id}
                            onClick={() => quickAiReply(l, false)}
                          >
                            {rowAction?.id === l.id && rowAction.kind === "ai" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Generate &amp; send AI reply"
                            disabled={rowAction?.id === l.id}
                            onClick={() => quickAiReply(l, true)}
                          >
                            {rowAction?.id === l.id && rowAction.kind === "send" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
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
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
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
                  {selected.whatsapp_sent_at && (
                    <DetailField
                      label="First sent"
                      value={new Date(selected.whatsapp_sent_at).toLocaleString()}
                    />
                  )}
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
                </div>

                <ConversationPanel
                  leadId={selected.id}
                  leadName={selected.name}
                  schoolName={schoolMap[selected.school_id]}
                  onChanged={refetch}
                />

                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
                    <a href={`tel:${selected.phone}`}>
                      <Phone className="h-3.5 w-3.5" />
                      Call
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
                    <a
                      href={`https://wa.me/${selected.phone.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Open WhatsApp
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

function SortHeader({
  label,
  field,
  sortField,
  sortDir,
  onClick,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onClick: (f: SortField) => void;
}) {
  const active = sortField === field;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onClick(field)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
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

function ActivityCell({ lead }: { lead: Lead }) {
  if (lead.replied_at) {
    return (
      <div className="flex items-center gap-1.5 text-success">
        <CheckCircle2 className="h-3 w-3" />
        <span>Replied · {timeAgo(lead.replied_at)}</span>
      </div>
    );
  }
  if (lead.whatsapp_sent_at || lead.last_message_at) {
    const ts = lead.last_message_at ?? lead.whatsapp_sent_at!;
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Send className="h-3 w-3" />
        <span>Sent · {timeAgo(ts)}</span>
      </div>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}
