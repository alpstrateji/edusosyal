/**
 * KABUK UI MODU — Supabase bağlantısı yok.
 *
 * Bu dosya gerçek bir Supabase istemcisi YERİNE no-op bir stub export eder.
 * Tüm sorgular boş veri / null döner, auth her zaman "oturum yok" der,
 * realtime kanalları sessizce abone olur. Böylece mevcut hook'lar ve sayfalar
 * hata vermeden render olur; UI tamamen statik bir kabuk gibi davranır.
 *
 * Backend'e bağlanmaya hazır olduğunda bu dosyayı gerçek createClient ile
 * değiştir; tüketici dosyalar değişmeden çalışmaya devam eder.
 */

type Result<T = unknown> = { data: T; error: null };

function ok<T>(data: T): Promise<Result<T>> {
  return Promise.resolve({ data, error: null });
}

/**
 * Hem zincirlenebilir (.eq().order()...) hem de await edilebilir bir nesne.
 * Default await sonucu: { data: [], error: null }.
 * .single()/.maybeSingle() çağrıldığında { data: null, error: null }.
 */
function makeQueryBuilder(): any {
  const arrayResult: Result<unknown[]> = { data: [], error: null };
  const builder: any = {
    // Mutasyonlar — hepsi self-return
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    // Filtreler
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    is: () => builder,
    in: () => builder,
    contains: () => builder,
    or: () => builder,
    not: () => builder,
    match: () => builder,
    // Modifiers
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    // Terminators
    single: () => ok<null>(null),
    maybeSingle: () => ok<null>(null),
    // Thenable — await edildiğinde boş liste döner
    then: (resolve: (v: Result<unknown[]>) => void) => resolve(arrayResult),
    catch: () => builder,
  };
  return builder;
}

const channelStub = {
  on: () => channelStub,
  subscribe: () => channelStub,
  unsubscribe: () => Promise.resolve("ok"),
};

const AUTH_DISABLED_MSG =
  "Kimlik doğrulama devre dışı (kabuk UI modu). Adres çubuğundan sayfalara doğrudan gidebilirsin.";

export const supabase: any = {
  from: () => makeQueryBuilder(),
  rpc: () => ok(null),
  channel: () => channelStub,
  removeChannel: () => {},
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signInWithPassword: () =>
      Promise.resolve({ data: { session: null, user: null }, error: { message: AUTH_DISABLED_MSG } }),
    signUp: () =>
      Promise.resolve({ data: { session: null, user: null }, error: { message: AUTH_DISABLED_MSG } }),
    signOut: () => Promise.resolve({ error: null }),
  },
  functions: {
    invoke: () =>
      Promise.resolve({ data: null, error: { message: "Edge functions devre dışı (kabuk UI modu)." } }),
  },
  storage: {
    from: () => ({
      upload: () => ok(null),
      download: () => ok(null),
      remove: () => ok(null),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    }),
  },
};

// ============================================================
// Tip tanımları — UI bileşenlerinin import ettiği şekiller
// ============================================================

export type AgentType =
  | "performance"
  | "creative"
  | "budget"
  | "audience"
  | "nurturing";

export type Severity = "info" | "success" | "warning" | "error";

export interface School {
  id: string;
  name: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  school_id: string;
  name: string;
  status: string;
  roas: number;
  cpa: number;
  spend: number;
  created_at: string;
}

export type IntentLevel = "high" | "medium" | "low" | "unknown";
export type MessageProvider = "telegram" | "whatsapp" | "console";

export interface Lead {
  id: string;
  school_id: string;
  name: string;
  phone: string;
  intent: string | null;
  status: string;
  source?: string | null;
  campaign_id?: string | null;
  intent_score?: number | null;
  intent_level?: IntentLevel;
  score_reason?: string | null;
  scored_at?: string | null;
  replied_at?: string | null;
  last_reply_text?: string | null;
  whatsapp_sent_at?: string | null;
  telegram_chat_id?: number | null;
  last_message_text?: string | null;
  last_message_at?: string | null;
  last_provider?: MessageProvider | null;
  created_at: string;
}

export interface LeadMessage {
  id: string;
  lead_id: string;
  school_id: string;
  direction: "outgoing" | "incoming";
  provider: MessageProvider;
  body: string;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface AgentLogRow {
  id: string;
  school_id: string;
  agent_type: AgentType;
  action: string;
  reasoning: string;
  metadata: Record<string, unknown> | null;
  severity: Severity;
  created_at: string;
}

export interface UserProfile {
  id: string;
  role: "agency_admin" | "school_admin";
  school_id: string | null;
}
