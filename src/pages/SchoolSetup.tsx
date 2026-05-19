import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, School as SchoolIcon, MessageSquare, Send, Users, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSchools } from "@/hooks/useSchools";
import { useLeads } from "@/hooks/useLeads";
import { supabase } from "@/lib/supabaseClient";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";

/**
 * Per-school onboarding & quick stats. school_admin lands here from the
 * sidebar to get their Telegram deep-link, copy lead-import templates,
 * and see today's traffic for *their* school only.
 */
export default function SchoolSetup() {
  const { profile } = useAuth();
  const { data: schools, loading: schoolsLoading } = useSchools();
  const { data: leads, loading: leadsLoading } = useLeads();
  const { values: settings } = useAppSettings();
  const [botUsername, setBotUsername] = useState<string>("");
  const [msgCount, setMsgCount] = useState<{ out: number; inb: number } | null>(null);

  const school = useMemo(() => {
    if (!profile) return null;
    if (profile.role === "agency_admin") return schools[0] ?? null;
    return schools.find((s) => s.id === profile.school_id) ?? null;
  }, [profile, schools]);

  // bot_username lives in app_settings as a string. Fall back to a sensible placeholder.
  useEffect(() => {
    const v = settings.telegram_bot_username;
    if (typeof v === "string" && v) setBotUsername(v);
  }, [settings.telegram_bot_username]);

  // Pull 24h messaging counts for this school only.
  useEffect(() => {
    if (!school) return;
    let active = true;
    async function load() {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [out, inb] = await Promise.all([
        supabase
          .from("lead_messages")
          .select("*", { count: "exact", head: true })
          .eq("school_id", school.id)
          .eq("direction", "outgoing")
          .gte("created_at", since),
        supabase
          .from("lead_messages")
          .select("*", { count: "exact", head: true })
          .eq("school_id", school.id)
          .eq("direction", "incoming")
          .gte("created_at", since),
      ]);
      if (!active) return;
      setMsgCount({ out: out.count ?? 0, inb: inb.count ?? 0 });
    }
    load();
    return () => {
      active = false;
    };
  }, [school]);

  const schoolLeads = useMemo(
    () => (school ? leads.filter((l) => l.school_id === school.id) : []),
    [leads, school],
  );

  const high = schoolLeads.filter((l) => l.intent_level === "high").length;
  const replied = schoolLeads.filter((l) => !!l.replied_at).length;

  if (schoolsLoading) {
    return (
      <div className="px-4 md:px-8 py-12 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Yükleniyor…
      </div>
    );
  }

  if (!school) {
    return (
      <div className="px-4 md:px-8 py-12 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Okul atanmamış</CardTitle>
            <CardDescription>
              Hesabınıza bir okul atanmamış. Lütfen ajans yöneticinizle iletişime geçin.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const deepLink = botUsername
    ? `https://t.me/${botUsername.replace(/^@/, "")}?start=${school.id}`
    : null;

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} kopyalandı`);
    } catch {
      toast.error("Kopyalanamadı");
    }
  }

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 animate-fade-in max-w-4xl">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <span>Okul</span>
          <span>/</span>
          <span className="text-foreground">Kurulum</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <SchoolIcon className="h-5 w-5" />
          {school.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bot bağlantınız, hızlı istatistikler ve lead toplama bağlantısı bu sayfada.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Toplam Lead" value={schoolLeads.length} icon={Users} loading={leadsLoading} />
        <StatTile label="Yüksek Niyet" value={high} icon={Sparkles} tone="success" loading={leadsLoading} />
        <StatTile
          label="Gönderilen (24s)"
          value={msgCount?.out ?? 0}
          icon={Send}
          loading={!msgCount}
        />
        <StatTile
          label="Gelen (24s)"
          value={msgCount?.inb ?? 0}
          icon={MessageSquare}
          tone="info"
          loading={!msgCount}
        />
      </div>

      {/* Telegram setup */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Telegram bağlantınız</CardTitle>
          <CardDescription className="text-xs">
            Lead'leri bota bağlamak için bu deep-link'i Meta reklamlarınıza ya da WhatsApp
            CTA'larınıza ekleyin. Kullanıcı bota ilk <code>/start</code> attığında otomatik
            olarak okulunuzla eşleşir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deepLink ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 px-3 py-2 rounded-md bg-muted text-xs break-all">
                {deepLink}
              </code>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5"
                  onClick={() => copy(deepLink, "Bot bağlantısı")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Kopyala
                </Button>
                <Button asChild size="sm" variant="outline" className="h-9 gap-1.5">
                  <a href={deepLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Aç
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/30 border border-border/60 rounded-md p-3">
              Henüz Telegram bot kullanıcı adı ayarlanmamış. Ajans yöneticisi{" "}
              <code className="px-1 py-0.5 bg-muted rounded">/settings</code> sayfasından
              <code className="mx-1 px-1 py-0.5 bg-muted rounded">telegram_bot_username</code>{" "}
              değerini eklesin.
            </div>
          )}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">school_id</Badge>
            <code className="text-[10px]">{school.id}</code>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px]"
              onClick={() => copy(school.id, "school_id")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding checklist */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Kurulum kontrol listesi</CardTitle>
          <CardDescription className="text-xs">
            Otomatik satış akışının düzgün çalışması için bu adımları tamamlayın.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Checklist
            ok={!!deepLink}
            label="Telegram bot bağlantısı hazır"
            hint="Yöneticinin bot kullanıcı adını ayarlamasıyla aktif olur."
          />
          <Checklist
            ok={schoolLeads.length > 0}
            label="En az 1 lead toplandı"
            hint="Meta reklamlarınız webhook'a bağlandığında otomatik akar."
          />
          <Checklist
            ok={replied > 0}
            label="En az 1 lead bota yanıt verdi"
            hint="Deep-link'i CTA'ya eklediğinizde gelmeye başlar."
          />
          <Checklist
            ok={settings.auto_send === true && settings.ai_enabled === true}
            label="Otomatik AI yanıt açık"
            hint="Ajans yöneticisi /settings sayfasından AUTO_SEND ve AI_ENABLED açar."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "info";
  loading?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "info"
        ? "text-info"
        : "text-foreground";
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`text-2xl font-semibold mt-1 ${toneClass}`}>
            {loading ? "…" : value}
          </p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground mt-1" />
      </CardContent>
    </Card>
  );
}

function Checklist({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
          ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
        }`}
      >
        {ok ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </div>
      <div>
        <p className={`text-sm ${ok ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
