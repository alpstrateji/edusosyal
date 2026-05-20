import { useState } from "react";
import { Loader2, Save, Settings as SettingsIcon, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";

const PROVIDER_OPTIONS = [
  { value: "telegram", label: "Telegram (birincil)" },
  { value: "whatsapp", label: "WhatsApp (Meta)" },
];

// Curated subset — OpenRouter has hundreds, but these cover the common
// price/quality tradeoffs.
const MODEL_OPTIONS = [
  { value: "openai/gpt-4o-mini", label: "GPT-4o mini (hızlı / uygun)" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "google/gemini-pro-1.5", label: "Gemini 1.5 Pro" },
  { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
];

export default function SettingsPage() {
  const { values, loading, setSetting } = useAppSettings();
  const [saving, setSaving] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState("");

  const autoSend = values.auto_send === true;
  const aiEnabled = values.ai_enabled === true;
  const provider = (typeof values.default_provider === "string" ? values.default_provider : "telegram") as string;
  const model = (typeof values.ai_model === "string" ? values.ai_model : "openai/gpt-4o-mini") as string;
  const isCustomModel = !MODEL_OPTIONS.some((m) => m.value === model);

  async function update(key: string, value: unknown) {
    setSaving(key);
    try {
      await setSetting(key, value);
      toast.success(`${key} güncellendi`);
    } catch (e) {
      toast.error(`Kaydedilemedi: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-12 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ayarlar yükleniyor…
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 animate-fade-in max-w-3xl">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <span>Çalışma Alanı</span>
          <span>/</span>
          <span className="text-foreground">Ayarlar</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          Otomasyon ayarları
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI satış ajanını yönetir. Değişiklikler yeni gönderimlerde hemen geçerli olur.
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Otomatik gönderim</CardTitle>
          <CardDescription className="text-xs">
            Açıldığında cron işi,
            <code className="mx-1 px-1 py-0.5 bg-muted rounded text-[10px]">contacted</code>
            olarak işaretli, yeni inbound yanıtı olan lead'lere AI yanıtlarını otomatik gönderir.
            Kapalıyken
            <span className="font-medium"> önce-incele </span> modunda çalışır (yalnızca taslak).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto_send" className="flex flex-col gap-1">
              <span className="text-sm font-medium">AUTO_SEND</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Otomatik gönderim cron'u ve webhook otomatik yanıtları için ana anahtar.
              </span>
            </Label>
            <Switch
              id="auto_send"
              checked={autoSend}
              disabled={saving === "auto_send"}
              onCheckedChange={(v) => update("auto_send", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="ai_enabled" className="flex flex-col gap-1">
              <span className="text-sm font-medium">AI yanıtları aktif</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Kapalı = sistem OpenRouter'ı hiç çağırmaz (sadece manuel mesajlaşma).
              </span>
            </Label>
            <Switch
              id="ai_enabled"
              checked={aiEnabled}
              disabled={saving === "ai_enabled"}
              onCheckedChange={(v) => update("ai_enabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Varsayılan mesajlaşma sağlayıcısı</CardTitle>
          <CardDescription className="text-xs">
            Lead için açık bir kanal belirlenmediğinde kullanılır. Lead için
            <code className="px-1 py-0.5 bg-muted rounded text-[10px]">telegram_chat_id</code>
            biliniyorsa Telegram her zaman tercih edilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={provider}
            onValueChange={(v) => update("default_provider", v)}
            disabled={saving === "default_provider"}
          >
            <SelectTrigger className="h-9 max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">AI modeli (OpenRouter)</CardTitle>
          <CardDescription className="text-xs">
            <code className="px-1 py-0.5 bg-muted rounded text-[10px]">generateReply</code> tarafından kullanılan model.
            Herhangi bir OpenRouter slug'ı için özel alan kullanın.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={isCustomModel ? "__custom" : model}
            onValueChange={(v) => {
              if (v === "__custom") {
                setCustomModel(model);
              } else {
                update("ai_model", v);
              }
            }}
            disabled={saving === "ai_model"}
          >
            <SelectTrigger className="h-9 max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
              <SelectItem value="__custom">Özel (slug gir)…</SelectItem>
            </SelectContent>
          </Select>

          {isCustomModel && (
            <div className="flex gap-2 max-w-md">
              <Input
                value={customModel || model}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="sağlayıcı/model-adı"
                className="h-9"
              />
              <Button
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => update("ai_model", customModel.trim())}
                disabled={!customModel.trim() || saving === "ai_model"}
              >
                <Save className="h-3.5 w-3.5" />
                Kaydet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/30 border border-border/60 rounded-md p-3">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Edge fonksiyonları ve cron planları Supabase CLI ile ayrıca deploy edilmelidir.
          Şema için <code className="px-1 py-0.5 bg-muted rounded">supabase_messaging_migration.sql</code> dosyasına ve
          deploy komutları için README'ye bakın.
        </p>
      </div>
    </div>
  );
}
