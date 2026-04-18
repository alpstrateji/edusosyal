import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
  hint?: string;
}

export function KpiCard({ label, value, delta, icon: Icon, hint }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-5 bg-card border-border shadow-card hover:border-primary/30 transition-colors group">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <div className="h-9 w-9 rounded-md bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
      {(delta !== undefined || hint) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium tabular-nums",
                positive
                  ? "text-success bg-success/10"
                  : "text-destructive bg-destructive/10",
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
