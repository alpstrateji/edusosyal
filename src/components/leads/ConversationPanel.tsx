import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLeadMessages } from "@/hooks/useLeadMessages";
import { sendMessage, generateAiReply } from "@/lib/messagingService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  leadId: string;
  onChanged?: () => void; // bubble back so parent can refresh leads list
}

export function ConversationPanel({ leadId, onChanged }: Props) {
  const { data: messages, loading, refetch } = useLeadMessages(leadId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    const res = await sendMessage(leadId, body);
    setSending(false);
    if (!res.success) {
      toast.error(`Send failed: ${res.error ?? "unknown error"}`);
      return;
    }
    toast.success(`Sent via ${res.provider}`);
    setDraft("");
    refetch();
    onChanged?.();
  }

  async function handleGenerate(send: boolean) {
    setGenerating(true);
    const res = await generateAiReply(leadId, send);
    setGenerating(false);
    if (!res.success) {
      toast.error(`AI failed: ${res.error ?? "unknown"}`);
      return;
    }
    if (send) {
      toast.success(`AI reply sent`);
      refetch();
      onChanged?.();
    } else if (res.text) {
      setDraft(res.text);
      toast.success("Draft generated — review before sending");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Conversation
        </p>
        <span className="text-[11px] text-muted-foreground">
          {messages.length} {messages.length === 1 ? "message" : "messages"}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-[200px] max-h-[320px] overflow-y-auto rounded-md border border-border/60 bg-muted/20 p-3 space-y-2"
      >
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
        ) : !messages.length ? (
          <div className="text-center py-10 text-xs text-muted-foreground space-y-2">
            <MessageSquare className="h-6 w-6 mx-auto opacity-40" />
            <p>No messages yet.</p>
            <p className="text-[10px]">Generate an AI reply or write one manually below.</p>
          </div>
        ) : (
          messages.map((m) => {
            const outgoing = m.direction === "outgoing";
            return (
              <div
                key={m.id}
                className={cn("flex flex-col gap-1", outgoing ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    outgoing
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border/60 rounded-bl-sm",
                  )}
                >
                  {m.body}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="capitalize">{m.provider}</span>
                  <span>·</span>
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                  {m.metadata && (m.metadata as { ai_generated?: boolean }).ai_generated && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      AI
                    </Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message, or generate one with AI…"
          rows={3}
          maxLength={1000}
          className="resize-none text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => handleGenerate(false)}
            disabled={generating || sending}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate AI draft
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => handleGenerate(true)}
            disabled={generating || sending}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate &amp; send
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleSend}
            disabled={!draft.trim() || sending || generating}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
