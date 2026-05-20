import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Cloud } from "lucide-react";

export function RecommendationsPanel() {
  return (
    <Card className="border-border/50">
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-4">
        <div className="flex items-start gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">AI Önerileri</CardTitle>
            <CardDescription className="text-xs">
              Etkiye göre sıralanmış günlük kararlar — sıradaki en iyi aksiyon.
            </CardDescription>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase gap-1 bg-muted/50">
          <Cloud className="h-3 w-3" />
          Backend bekleniyor
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">AI motoru henüz devrede değil</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Öneriler henüz deploy edilmemiş bir Edge Function tarafından üretilir.
              Arayüz hazır — fonksiyon canlıya alındığında sıralı kararlar burada otomatik
              olarak görünecek.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-muted-foreground">
            <span className="font-mono px-1.5 py-0.5 rounded bg-muted border border-border/60">
              generate-recommendations
            </span>
            <span>· Supabase CLI ile deploy edin</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
