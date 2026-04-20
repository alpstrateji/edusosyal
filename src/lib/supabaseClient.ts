import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iqiqlpzhdawjfrndrikb.supabase.co";
// Publishable / anon key — safe to ship to the client.
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable__B100iR3xt4-RPke_Tnh6g_-p2nIOPX";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
  },
});

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
  created_at: string;
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
