import { useEffect, useState } from "react";
import { supabase, type School } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Plus, Trash2, X, Check, School as SchoolIcon } from "lucide-react";

interface SchoolRow extends School {
  campaign_count: number;
  lead_count: number;
}

export default function SchoolsAdmin() {
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SchoolRow | null>(null);

  async function load() {
    setLoading(true);
    const [schoolsRes, campaignsRes, leadsRes] = await Promise.all([
      supabase.from("schools").select("*").order("created_at", { ascending: false }),
      supabase.from("campaigns").select("school_id"),
      supabase.from("leads").select("school_id"),
    ]);

    if (schoolsRes.error) {
      toast.error(`Failed to load schools: ${schoolsRes.error.message}`);
      setLoading(false);
      return;
    }

    const campaignCounts = new Map<string, number>();
    (campaignsRes.data ?? []).forEach((c: { school_id: string }) => {
      campaignCounts.set(c.school_id, (campaignCounts.get(c.school_id) ?? 0) + 1);
    });
    const leadCounts = new Map<string, number>();
    (leadsRes.data ?? []).forEach((l: { school_id: string }) => {
      leadCounts.set(l.school_id, (leadCounts.get(l.school_id) ?? 0) + 1);
    });

    const merged: SchoolRow[] = ((schoolsRes.data as School[]) ?? []).map((s) => ({
      ...s,
      campaign_count: campaignCounts.get(s.id) ?? 0,
      lead_count: leadCounts.get(s.id) ?? 0,
    }));
    setRows(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const name = newName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (name.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A school with that name already exists");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("schools").insert({ name });
    setCreating(false);
    if (error) {
      toast.error(`Create failed: ${error.message}`);
      return;
    }
    setNewName("");
    toast.success(`School created: ${name}`);
    load();
  }

  async function save(id: string) {
    const name = editingName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (name.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    const { error } = await supabase.from("schools").update({ name }).eq("id", id);
    if (error) {
      toast.error(`Update failed: ${error.message}`);
      return;
    }
    setEditingId(null);
    setEditingName("");
    toast.success("School updated");
    load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    const { error } = await supabase.from("schools").delete().eq("id", id);
    setPendingDelete(null);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      return;
    }
    toast.success(`Deleted: ${name}`);
    load();
  }

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <span>Admin</span>
          <span>/</span>
          <span className="text-foreground">Schools</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each school is a tenant. Campaigns, leads and logs scope to it.
        </p>
      </div>

      {/* Create */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Add school
          </CardTitle>
          <CardDescription className="text-xs">
            Create a new tenant. Each school keeps its own campaigns, leads and logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. Greenfield International"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
              className="max-w-md h-9"
              maxLength={100}
            />
            <Button
              onClick={create}
              disabled={creating || !newName.trim()}
              size="sm"
              className="gap-1.5 h-9"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SchoolIcon className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">All schools</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {rows.length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-5 py-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No schools yet. Add one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Campaigns</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {editingId === s.id ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") save(s.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          className="max-w-md h-8"
                          maxLength={100}
                        />
                      ) : (
                        <span className="font-medium text-sm">{s.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] tabular-nums">
                        {s.campaign_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] tabular-nums">
                        {s.lead_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === s.id ? (
                        <div className="inline-flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-success hover:text-success"
                            onClick={() => save(s.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(s.id);
                              setEditingName(s.name);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setPendingDelete(s)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the school and cascade to{" "}
              <span className="text-foreground font-medium">
                {pendingDelete?.campaign_count ?? 0} campaigns
              </span>{" "}
              and{" "}
              <span className="text-foreground font-medium">
                {pendingDelete?.lead_count ?? 0} leads
              </span>
              , along with all associated agent logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete school
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
