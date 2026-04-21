import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSchools } from "@/hooks/useSchools";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2, X, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MetaMapping {
  id: string;
  school_id: string;
  campaign_id: string | null;
  ad_id: string | null;
  form_id: string | null;
  label: string | null;
  created_at: string;
}

export default function MetaMappingsAdmin() {
  const { data: schools } = useSchools();
  const [rows, setRows] = useState<MetaMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState("");
  const [label, setLabel] = useState("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCampaignId, setEditCampaignId] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("meta_ad_mappings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load mappings", description: error.message, variant: "destructive" });
    setRows((data as MetaMapping[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    const cid = campaignId.trim();
    const lbl = label.trim();
    if (!cid || !lbl || !schoolId) {
      toast({ title: "Missing fields", description: "School, campaign_id and label are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("meta_ad_mappings").insert({
      school_id: schoolId,
      campaign_id: cid,
      label: lbl,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    setCampaignId("");
    setLabel("");
    toast({ title: "Mapping added", description: `${cid} → ${lbl}` });
    load();
  }

  async function save(id: string) {
    const updates: Partial<MetaMapping> = {
      campaign_id: editCampaignId.trim() || null,
      label: editLabel.trim() || null,
    };
    const { error } = await supabase.from("meta_ad_mappings").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setEditingId(null);
    load();
  }

  async function remove(id: string, label: string | null) {
    if (!confirm(`Delete mapping "${label ?? id}"?`)) return;
    const { error } = await supabase.from("meta_ad_mappings").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    load();
  }

  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <span>Admin</span>
          <span>/</span>
          <span className="text-foreground">Meta ad mappings</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Meta ad mappings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Map a Meta <code className="text-xs">campaign_id</code> to a school + human-readable label.
          Required so inbound Meta leads route correctly and AI recommendations cite real campaign names.
        </p>
      </div>

      <Card className="p-4 bg-card border-border shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger><SelectValue placeholder="School" /></SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Meta campaign_id"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          />
          <Input
            placeholder="Label (e.g. Class 11 Admissions Q4)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
          />
          <Button onClick={create} disabled={creating} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add mapping
          </Button>
        </div>
      </Card>

      <Card className="bg-card border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-5 py-2.5">Label</th>
                <th className="text-left font-medium px-3 py-2.5">Campaign ID</th>
                <th className="text-left font-medium px-3 py-2.5">School</th>
                <th className="text-left font-medium px-3 py-2.5">Created</th>
                <th className="text-right font-medium px-5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-5 py-6"><Skeleton className="h-4 w-full" /></td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No mappings yet. Add one above so Meta lead webhooks can resolve.
                </td></tr>
              )}
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    {editingId === m.id ? (
                      <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8" />
                    ) : (
                      <span className="font-medium">{m.label ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {editingId === m.id ? (
                      <Input value={editCampaignId} onChange={(e) => setEditCampaignId(e.target.value)} className="h-8 font-mono" />
                    ) : (
                      m.campaign_id ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-3">{schoolName(m.school_id)}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {editingId === m.id ? (
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => save(m.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
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
                            setEditingId(m.id);
                            setEditLabel(m.label ?? "");
                            setEditCampaignId(m.campaign_id ?? "");
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => remove(m.id, m.label)}
                        >
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
