// Quick reply templates for the conversation panel.
// Placeholders: {{name}} -> lead.name, {{school}} -> school name.
// Keep these short — operators tweak before sending.

export interface QuickReply {
  id: string;
  label: string;
  body: string;
}

export const QUICK_REPLIES: QuickReply[] = [
  {
    id: "greet",
    label: "Selam & tanışma",
    body:
      "Merhaba {{name}}, {{school}} dijital danışmanıyım. Size kısaca süreci anlatabilir miyim?",
  },
  {
    id: "visit",
    label: "Kampüs ziyareti",
    body:
      "{{name}}, dilerseniz bu hafta kampüs ziyareti planlayalım. Çarşamba 14:00 veya Cuma 11:00 uygun mu?",
  },
  {
    id: "price",
    label: "Fiyat yönlendir",
    body:
      "Fiyatlandırma kademeye göre değişiyor — size özel bilgileri görüşmede paylaşmam daha doğru olur. 15 dakikalık bir görüşme planlayalım mı?",
  },
  {
    id: "followup",
    label: "Nazik takip",
    body:
      "Merhaba {{name}}, mesajımı görme şansınız oldu mu? Aklınıza takılan bir konu varsa yardımcı olmak isterim.",
  },
  {
    id: "thanks",
    label: "Teşekkür & kapanış",
    body:
      "Teşekkürler {{name}}, görüşmek üzere. Aklınıza takılan olursa bu kanaldan ulaşabilirsiniz.",
  },
];

export function applyTemplate(
  body: string,
  vars: { name?: string | null; school?: string | null },
): string {
  return body
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name ?? "")
    .replace(/\{\{\s*school\s*\}\}/gi, vars.school ?? "okulumuz")
    .replace(/\s+/g, " ")
    .trim();
}
