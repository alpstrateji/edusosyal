import { supabase } from "@/lib/supabaseClient";

export interface SendMessageResult {
  success: boolean;
  provider?: string;
  external_id?: string | null;
  error?: string;
}

/**
 * Wrapper around the `send-message` edge function. The function logs the
 * outbound message to lead_messages + agent_logs, so callers only need to
 * refetch local data on success.
 */
export async function sendMessage(
  leadId: string,
  body: string,
  provider?: "telegram" | "whatsapp",
): Promise<SendMessageResult> {
  const { data, error } = await supabase.functions.invoke("send-message", {
    body: { lead_id: leadId, body, provider },
  });
  if (error) return { success: false, error: error.message };
  return data as SendMessageResult;
}

export interface AiReplyResult {
  success: boolean;
  text?: string;
  sent?: { provider: string; external_id: string | null } | null;
  error?: string;
}

/**
 * Generate (and optionally send) an AI reply for a lead.
 */
export async function generateAiReply(
  leadId: string,
  send: boolean,
): Promise<AiReplyResult> {
  const { data, error } = await supabase.functions.invoke("ai-reply", {
    body: { lead_id: leadId, send },
  });
  if (error) return { success: false, error: error.message };
  return data as AiReplyResult;
}
