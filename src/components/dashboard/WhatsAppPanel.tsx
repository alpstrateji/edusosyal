import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLeads } from "@/hooks/useLeads";
import { useSchools } from "@/hooks/useSchools";
import { toast } from "sonner";

const TEMPLATES = [
  { value: "welcome", label: "Welcome — first touch" },
  { value: "followup_24h", label: "Follow-up — 24h" },
  { value: "open_house", label: "Open house invite" },
  { value: "scholarship_info", label: "Scholarship info" },
];

export function WhatsAppPanel() {
  const { data: leads, loading } = useLeads();
  const { data: schools } = useSchools();
  const [leadId, setLeadId] = useState<string>("");
  const [template, setTemplate] = useState<string>("welcome");
  const [variable1, setVariable1] = useState("");
  const [sending, setSending] = useState(false);

  const selectedLead = useMemo(() => leads.find((l) => l.id === leadId), [leads, leadId]);
  const schoolName = useMemo(
    () => schools.find((s) => s.id === selectedLead?.school_id)?.name ?? "",
    [schools, selectedLead],
  );

  async function handleSend() {
    if (!selectedLead) {
      toast.error("Pick a lead first");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
      body: {
        phone: selectedLead.phone,
        template,
        variables: { "1": variable1 || selectedLead.name },
        school_id: selectedLead.school_id,
        lead_id: selectedLead.id,
      },
    });
    setSending(false);

    if (error || (data && data.success === false)) {
      toast.error(`Send failed: ${error?.message ?? JSON.stringify(data?.error ?? data)}`);
      return;
    }
    toast.success(`Sent to ${selectedLead.name}`);
    setVariable1("");
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <CardTitle className="text-base">Send WhatsApp</CardTitle>
            <CardDescription className="text-xs">
              Trigger a templated WhatsApp message via Meta Cloud API.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lead">Lead</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger id="lead">
                <SelectValue placeholder={loading ? "Loading leads…" : "Select a lead"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {leads.slice(0, 100).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    <span className="truncate">{l.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{l.phone}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLead && (
              <p className="text-[11px] text-muted-foreground">
                {schoolName} · status: {selectedLead.status}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger id="template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="var1">
            Variable {"{{1}}"} <span className="text-muted-foreground">— defaults to lead name</span>
          </Label>
          <Input
            id="var1"
            value={variable1}
            onChange={(e) => setVariable1(e.target.value)}
            placeholder={selectedLead?.name ?? "Recipient name"}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-muted-foreground">
            Logged automatically to <span className="text-foreground">agent_logs</span>.
          </p>
          <Button onClick={handleSend} disabled={sending || !leadId} className="gap-1.5">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
