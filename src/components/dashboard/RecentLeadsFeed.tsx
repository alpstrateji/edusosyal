import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useSchools } from "@/hooks/useSchools";
import { cn } from "@/lib/utils";

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
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)}g önce`;
}

export function RecentLeadsFeed() {
  const { data: leads, loading } = useLeads();
  const { data: schools } = useSchools();
  const top = leads.slice(0, 12);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Inbox className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Son Lead'ler</CardTitle>
            <CardDescription className="text-xs">
              Canlı akış — isim, kaynak, niyet skoru, durum.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Yükleniyor…</div>
        )}
        {!loading && !top.length && (
          <div className="text-sm text-muted-foreground py-8 text-center">Henüz lead yok.</div>
        )}
        <ul className="divide-y divide-border/60">
          {top.map((l: any) => {
            const school = schools.find((s) => s.id === l.school_id)?.name ?? "—";
            const level = (l.intent_level ?? "unknown") as keyof typeof INTENT_CLASS;
            const status = (l.status ?? "new") as keyof typeof STATUS_CLASS;
            return (
              <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{l.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {school} · {l.source ?? "manuel"} · {timeAgo(l.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className={cn("text-[10px] uppercase", INTENT_CLASS[level])}>
                    {level}
                    {l.intent_score != null && ` · ${Math.round(Number(l.intent_score) * 100)}%`}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_CLASS[status] ?? STATUS_CLASS.new)}>
                    {status}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
