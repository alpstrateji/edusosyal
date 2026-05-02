// Shared AI reply generator using OpenRouter.
// Tone strategy is determined by intent_level so we don't ask the model to
// decide what type of message to send — only how to phrase it.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ConversationTurn {
  direction: "outgoing" | "incoming";
  body: string;
  created_at: string;
}

export interface ReplyContext {
  lead: {
    name: string;
    intent: string | null;
    intent_level: "high" | "medium" | "low" | "unknown" | null;
    intent_score: number | null;
    score_reason: string | null;
  };
  school_name: string | null;
  history: ConversationTurn[];
  // Optional latest inbound text to react to. If absent, this is a "first
  // touch" message rather than a reply.
  latest_inbound: string | null;
}

const STRATEGY: Record<string, string> = {
  high:
    "Lead'in alım niyeti YÜKSEK. Hedef: bugün/yarın bir görüşme veya kampüs ziyareti randevusu. " +
    "Doğrudan tarih/saat öner, harekete geçirici tek bir CTA bırak.",
  medium:
    "Lead'in alım niyeti ORTA. Hedef: faydalarla eğit ve karar süreci için bir sonraki adımı netleştir. " +
    "Kısa fayda + bir tek soru ile diyaloğu açık tut.",
  low:
    "Lead'in alım niyeti DÜŞÜK. Hedef: yumuşak temas, baskı yapmadan değer sun. " +
    "Bir bilgi parçası paylaş + opsiyonel bir soru sor; satış dili kullanma.",
  unknown:
    "Lead'in niyeti BELİRSİZ. Hedef: kısa, kibar açıklayıcı bir soru ile niyeti netleştir. " +
    "Hangi okul kademesi / ne arıyor — bunu öğren.",
};

function systemPrompt(ctx: ReplyContext): string {
  const intent = (ctx.lead.intent_level ?? "unknown") as keyof typeof STRATEGY;
  const strategy = STRATEGY[intent];
  return [
    `Sen ${ctx.school_name ?? "bir özel okulun"} dijital satış asistanısın.`,
    `WhatsApp/Telegram üzerinden TÜRKÇE, samimi ama profesyonel cevap yazıyorsun.`,
    ``,
    `KURALLAR:`,
    `- Mesaj 2-4 kısa cümle, MAKSİMUM 280 karakter.`,
    `- Emoji kullanma ya da en fazla 1 tane.`,
    `- Asla "merhaba" tekrarı yapma; sohbet zaten başlamışsa selamlama yazma.`,
    `- Robot gibi yazma; kişisel ad varsa kullan: "${ctx.lead.name}".`,
    `- Fiyat verme; fiyatı sormuşsa "size detaylı bilgi göndermem için bir görüşme planlayalım mı?" gibi yönlendir.`,
    `- Asla telefon numarası, link, veya tek tek sayılı liste yazma.`,
    ``,
    `STRATEJİ: ${strategy}`,
    ctx.lead.score_reason ? `Skor gerekçesi (sana özel not): ${ctx.lead.score_reason}` : ``,
  ]
    .filter(Boolean)
    .join("\n");
}

function historyMessages(ctx: ReplyContext) {
  return ctx.history.slice(-10).map((t) => ({
    role: t.direction === "outgoing" ? "assistant" : "user",
    content: t.body,
  }));
}

export async function generateReply(
  ctx: ReplyContext,
  model = "openai/gpt-4o-mini",
): Promise<{ ok: true; text: string; raw: unknown } | { ok: false; error: string; raw: unknown }> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return { ok: false, error: "OPENROUTER_API_KEY missing", raw: null };

  const messages = [
    { role: "system" as const, content: systemPrompt(ctx) },
    ...historyMessages(ctx),
  ];

  // If we have a fresh inbound message, prepend the standard "reply to this"
  // framing. If not, we're cold-opening — give the model that context.
  if (ctx.latest_inbound) {
    messages.push({
      role: "user" as const,
      content: ctx.latest_inbound,
    });
  } else {
    messages.push({
      role: "user" as const,
      content:
        ctx.lead.intent
          ? `(İlk temas mesajı yazıyorsun. Lead'in başlangıç niyeti: "${ctx.lead.intent}".)`
          : "(İlk temas mesajı yazıyorsun.)",
    });
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://edusosyal.lovable.app",
      "X-Title": "Edusonex AI Sales",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 220,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: json?.error?.message ?? `OpenRouter HTTP ${res.status}`,
      raw: json,
    };
  }
  const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) return { ok: false, error: "Empty completion", raw: json };
  return { ok: true, text, raw: json };
}
