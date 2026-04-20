import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Check, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRecommendations, type Recommendation } from "@/hooks/useRecommendations";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEVERITY_CLASS: Record<Recommendation["severity"], string> = {
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
};

export function RecommendationsPanel() {
  const { data, loading, setStatus, regenerate } = useRecommendations();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRegenerate() {
    setRefreshing(true);
    try {
      await regenerate();
      toast.success("Recommendations refreshing — new items will stream in shortly.");
    } catch {
      toast.error("Failed to start regeneration");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-4">
        <div className="flex items-start gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">AI Recommendations</CardTitle>
            <CardDescription className="text-xs">
              Daily decisions ranked by impact — what happened, why it matters, what to do.
            </CardDescription>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={refreshing}
          className="gap-1.5"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Regenerate
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Loading recommendations…
          </div>
        )}
        {!loading && !data.length && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No open recommendations. Click <span className="text-foreground">Regenerate</span> to
            ask the AI for the next decisions.
          </div>
        )}
        {data.map((r) => (
          <div
            key={r.id}
            className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("text-[10px] uppercase", SEVERITY_CLASS[r.severity])}>
                    {r.category}
                  </Badge>
                  <p className="text-sm font-medium leading-tight">{r.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{r.rationale}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-success hover:text-success"
                  onClick={() => setStatus(r.id, "applied")}
                  title="Mark applied"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => setStatus(r.id, "dismissed")}
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="text-xs bg-background/60 border border-border/60 rounded-md px-3 py-2">
              <span className="text-muted-foreground">Action: </span>
              <span className="text-foreground">{r.action}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
