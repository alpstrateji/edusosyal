import { useEffect, useState } from "react";
import { supabase, type School } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2, X, Check } from "lucide-react";

export default function SchoolsAdmin() {
  const [rows, setRows] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load schools", description: error.message, variant: "destructive" });
    setRows((data as School[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const { error } = await supabase.from("schools").insert({ name });
    setCreating(false);
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    setNewName("");
    toast({ title: "School created", description: name });
    load();
  }

  async function save(id: string) {
    const name = editingName.trim();
    if (!name) return;
    const { error } = await supabase.from("schools").update({ name }).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setEditingId(null);
    setEditingName("");
    load();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will cascade to its campaigns, leads and logs.`)) return;
    const { error } = await supabase.from("schools").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: name });
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

      <Card className="p-4 bg-card border-border shadow-card">
        <div className="flex items-center gap-2">
          <Input
            placeholder="New school name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
            className="max-w-md"
          />
          <Button onClick={create} disabled={creating || !newName.trim()} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </Card>

      <Card className="bg-card border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-5 py-2.5">Name</th>
                <th className="text-left font-medium px-3 py-2.5">Created</th>
                <th className="text-right font-medium px-5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={3} className="px-5 py-6"><Skeleton className="h-4 w-full" /></td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No schools yet. Add one above.
                </td></tr>
              )}
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    {editingId === s.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") save(s.id); if (e.key === "Escape") setEditingId(null); }}
                        autoFocus
                        className="max-w-md h-8"
                      />
                    ) : (
                      <span className="font-medium">{s.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {editingId === s.id ? (
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => save(s.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(s.id); setEditingName(s.name); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(s.id, s.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
