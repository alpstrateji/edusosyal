// Shared messaging service used by every edge function.
// Provider-agnostic: caller does sendMessage(provider, recipient, body).
// Currently supports Telegram + WhatsApp (Meta Cloud) + 'console' (dev).

export type Provider = "telegram" | "whatsapp" | "console";

export interface SendResult {
  ok: boolean;
  external_id: string | null;
  raw: unknown;
  error?: string;
}

export async function sendViaTelegram(
  chatId: string | number,
  body: string,
): Promise<SendResult> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false, external_id: null, raw: null, error: "TELEGRAM_BOT_TOKEN missing" };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: body,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    return {
      ok: false,
      external_id: null,
      raw: json,
      error: json?.description ?? `Telegram HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    external_id: String(json.result?.message_id ?? ""),
    raw: json,
  };
}

export async function sendViaWhatsApp(
  phone: string,
  body: string,
): Promise<SendResult> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  if (!token || !phoneId) {
    return { ok: false, external_id: null, raw: null, error: "WHATSAPP_TOKEN / WHATSAPP_PHONE_ID missing" };
  }
  const to = phone.replace(/\D/g, "");
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      external_id: null,
      raw: json,
      error: json?.error?.message ?? `WhatsApp HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    external_id: json?.messages?.[0]?.id ?? null,
    raw: json,
  };
}

/**
 * Decide which provider to use for a given lead.
 * Telegram requires a known chat_id; otherwise fall back to WhatsApp,
 * otherwise 'console' (logged only — used in dev).
 */
export function pickProvider(
  lead: { telegram_chat_id: number | null; phone: string | null },
  preferred: Provider,
): Provider {
  if (preferred === "telegram" && lead.telegram_chat_id) return "telegram";
  if (preferred === "whatsapp" && lead.phone) return "whatsapp";
  if (lead.telegram_chat_id) return "telegram";
  if (lead.phone) return "whatsapp";
  return "console";
}

export async function sendMessage(
  provider: Provider,
  lead: { telegram_chat_id: number | null; phone: string | null },
  body: string,
): Promise<SendResult> {
  if (provider === "telegram") {
    if (!lead.telegram_chat_id) {
      return { ok: false, external_id: null, raw: null, error: "lead has no telegram_chat_id" };
    }
    return sendViaTelegram(lead.telegram_chat_id, body);
  }
  if (provider === "whatsapp") {
    if (!lead.phone) {
      return { ok: false, external_id: null, raw: null, error: "lead has no phone" };
    }
    return sendViaWhatsApp(lead.phone, body);
  }
  // console provider — never hits a network. Only used when no provider is
  // configured for the lead. Marked ok=true so the message still gets
  // recorded in lead_messages with provider='console'.
  console.log(`[console-provider] would send to lead → ${body}`);
  return { ok: true, external_id: null, raw: { simulated: true } };
}
