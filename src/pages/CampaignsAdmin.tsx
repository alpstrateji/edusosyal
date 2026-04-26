import { useEffect, useMemo, useState } from "react";
import { supabase, type Campaign, type School } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Megaphone, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["active", "paused", "ended", "draft"];

const STATUS_CLASS: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  paused: "bg-warning/10 text-warning border-warning/20",
  ended: "bg-muted text-muted-foreground border-border",
  draft: "bg-info/10 text-info border-info/20",
};

interface FormState {
  id?: string;
  name: string;
  school_id: string;
  status: string;
  spend: string;
  roas: string;
  cpa: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  school_id: "",
  status: "active",
  spend: "0",
  roas: "0",
  cpa: "0",
};

const inr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

export default function CampaignsAdmin() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);

  async function load() {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("schools").select("*").order("name"),
    ]);
    if (cRes.error) toast.error(`Failed to load campaigns: ${cRes.error.message}`);
    if (sRes.error) toast.error(`Failed to load schools: ${sRes.error.message}`);
    setCampaigns((cRes.data as Campaign[]) ?? []);
    setSchools((sRes.data as School[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const schoolMap = useMemo(
    () => Object.fromEntries(schools.map((s) => [s.id, s.name])),
    [schools],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (schoolFilter !== "all" && c.school_id !== schoolFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (schoolMap[c.school_id] ?? "").toLowerCase().includes(q)
      );
    });
  }, [campaigns, query, statusFilter, schoolFilter, schoolMap]);

  const totals = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((c) => c.status === "active").length;
    const spend = campaigns.reduce((a, c) => a + Number(c.spend), 0);
    const avgRoas = total
      ? +(campaigns.reduce((a, c) => a + Number(c.roas), 0) / total).toFixed(2)
      : 0;
    return { total, active, spend, avgRoas };
  }, [campaigns]);

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      school_id: schools[0]?.id ?? "",
    });
    setDialogOpen(true);
  }

  function openEdit(c: Campaign) {
    setForm({
      id: c.id,
      name: c.name,
      school_id: c.school_id,
      status: c.status,
      spend: String(c.spend),
      roas: String(c.roas),
      cpa: String(c.cpa),
    });
    setDialogOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) return toast.error("Name is required");
    if (name.length < 2) return toast.error("Name must be at least 2 characters");
    if (!form.school_id) return toast.error("School is required");

    const spend = Number(form.spend);
    const roas = Number(form.roas);
    const cpa = Number(form.cpa);
    if (!Number.isFinite(spend) || spend < 0) return toast.error("Spend must be ≥ 0");
    if (!Number.isFinite(roas) || roas < 0) return toast.error("ROAS must be ≥ 0");
    if (!Number.isFinite(cpa) || cpa < 0) return toast.error("CPA must be ≥ 0");

    setSaving(true);
    const payload = {
      name,
      school_id: form.school_id,
      status: form.status,
      spend,
      roas,
      cpa,
    };
    const res = form.id
      ? await supabase.from("campaigns").update(payload).eq("id", form.id)
      : await supabase.from("campaigns").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(`Save failed: ${res.error.message}`);
      return;
    }
    toast.success(form.id ? "Campaign updated" : `Campaign created: ${name}`);
    setDialogOpen(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function toggleStatus(c: Campaign) {
    const next = c.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("campaigns")
      .update({ status: next })
      .eq("id", c.id);
    if (error) {
      toast.error(`Update failed: ${error.message}`);
      return;
    }
    toast.success(`Campaign ${next}`);
    load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", pendingDelete.id);
    setPendingDelete(null);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      return;
    }
    toast.success("Campaign deleted");
    load();
  }

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <span>Admin</span>
            <span>/</span>
            <span className="text-foreground">Campaigns</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage campaigns across all schools — create, edit, pause, or delete.
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow"
          onClick={openCreate}
          disabled={!schools.length}
        >
          <Plus className="h-3.5 w-3.5" /> New campaign
        </Button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total" value={totals.total.toString()} />
        <StatTile label="Active" value={totals.active.toString()} tone="success" />
        <StatTile label="Total spend" value={inr(totals.spend)} />
        <StatTile label="Avg ROAS" value={`${totals.avgRoas}x`} tone="info" />
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by campaign or school name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
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
              <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
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
            <div className="px-5 py-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : !filtered.length ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              {!schools.length
                ? "Create a school first, then add campaigns."
                : "No campaigns match the current filters."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Created {new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {schoolMap[c.school_id] ?? "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleStatus(c)}
                        title={
                          c.status === "active" ? "Click to pause" : "Click to activate"
                        }
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase cursor-pointer",
                            STATUS_CLASS[c.status] ?? STATUS_CLASS.draft,
                          )}
                        >
                          {c.status}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {inr(Number(c.spend))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {Number(c.roas).toFixed(2)}x
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {inr(Number(c.cpa))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              {form.id ? "Edit campaign" : "New campaign"}
            </DialogTitle>
            <DialogDescription>
              {form.id
                ? "Update the campaign details."
                : "Create a new campaign for one of your schools."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input
                id="c-name"
                placeholder="e.g. Summer Admissions Drive"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-school">School</Label>
                <Select
                  value={form.school_id}
                  onValueChange={(v) => setForm({ ...form, school_id: v })}
                >
                  <SelectTrigger id="c-school">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger id="c-status">
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
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-spend">Spend (₹)</Label>
                <Input
                  id="c-spend"
                  type="number"
                  min="0"
                  step="100"
                  value={form.spend}
                  onChange={(e) => setForm({ ...form, spend: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-roas">ROAS</Label>
                <Input
                  id="c-roas"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.roas}
                  onChange={(e) => setForm({ ...form, roas: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-cpa">CPA (₹)</Label>
                <Input
                  id="c-cpa"
                  type="number"
                  min="0"
                  step="10"
                  value={form.cpa}
                  onChange={(e) => setForm({ ...form, cpa: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {form.id ? "Save changes" : "Create campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the campaign. Leads attached to other
              campaigns are unaffected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "info"
      ? "text-info"
      : "text-foreground";
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-semibold tracking-tight mt-1", toneClass)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
