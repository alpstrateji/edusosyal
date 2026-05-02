# Edusonex — Messaging & AI Reply Setup

This document covers everything required to bring the Telegram + AI sales
agent online after the UI/code changes. **Run these in order.**

## 0. Prerequisites
- Supabase CLI logged in & linked to project `iqiqlpzhdawjfrndrikb`
- Project secrets set in Supabase dashboard → **Settings → Edge Functions → Secrets**:
  - `OPENROUTER_API_KEY`        — required
  - `TELEGRAM_BOT_TOKEN`        — required (BotFather → `/newbot`)
  - `TELEGRAM_WEBHOOK_SECRET`   — any random string, you'll reuse it in step 3
  - `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` — only if you'll use WhatsApp fallback

## 1. Run the SQL migration
In the Supabase SQL editor, run **once**:
```
supabase_messaging_migration.sql
```
This adds `lead_messages`, `app_settings`, the trigger that mirrors latest
message onto the lead row, and sensible defaults (`auto_send=true`, etc.).

Verify:
```sql
select key, value from public.app_settings;
```

## 2. Deploy edge functions
```bash
supabase functions deploy send-message       --no-verify-jwt
supabase functions deploy ai-reply           --no-verify-jwt
supabase functions deploy telegram-webhook   --no-verify-jwt
supabase functions deploy auto-send-cron     --no-verify-jwt
```
All four use shared modules from `supabase/functions/_shared/` — the CLI
bundles them automatically.

## 3. Wire Telegram → webhook
Replace `<PROJECT>` and the env vars below with real values:
```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<PROJECT>.supabase.co/functions/v1/telegram-webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d 'allowed_updates=["message","edited_message"]'
```
Confirm: `curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"`
should show `pending_update_count: 0` and your URL.

### Linking a lead to a Telegram chat
End-users start the bot via a deep link tied to their lead id:
```
https://t.me/<your_bot_username>?start=<LEAD_UUID>
```
The webhook auto-binds the chat id to that lead on first `/start`.

If you don't have a deep link, the bot also auto-binds when the user
shares their phone number via Telegram's "Share contact" button — we
match by the trailing 10 digits of `leads.phone`.

## 4. Schedule the auto-send cron
In SQL editor, run **once** (replace `<ANON_KEY>` and project ref):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'edusonex-auto-send',
  '*/2 * * * *',  -- every 2 minutes
  $$
  select net.http_post(
    url     := 'https://iqiqlpzhdawjfrndrikb.supabase.co/functions/v1/auto-send-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  ) as request_id;
  $$
);
```
**Use the SERVICE ROLE key here** (not anon). The function rejects
anything else.

To pause: `select cron.unschedule('edusonex-auto-send');`

## 5. Operate
- `/settings` → toggle `AUTO_SEND` and `AI_ENABLED` on/off, change provider/model.
- `/leads` → row-level "Generate AI draft" (sparkles) and "Generate & Send" (paper plane) buttons. Open the drawer to see the conversation timeline and send manual messages.

## Architecture summary

```
                        ┌────────────────────────┐
   Telegram user ───►   │ telegram-webhook       │ ──► lead_messages (incoming)
                        │  • verifies secret     │     trigger → leads.replied_at
                        │  • matches by chat_id  │
                        │  • triggers ai-reply   │
                        └─────────┬──────────────┘
                                  │ (auto, if AUTO_SEND+AI on)
                                  ▼
   Cron (pg_cron) ─►  auto-send-cron ──► ai-reply ──► OpenRouter
                                            │
                                            ▼
                                       send-message ──► Telegram / WhatsApp
                                            │
                                            ▼
                                  lead_messages (outgoing)
                                  trigger → leads.last_message_*
```

Everything is idempotent:
- `lead_messages.(provider, external_id)` is unique → webhook retries dedupe.
- `auto-send-cron` only picks rows where `whatsapp_sent_at IS NULL` and `last_reply_text IS NOT NULL`; the trigger flips those after the first send so the row isn't picked again.
- `app_settings` is a singleton key/value table; toggles take effect immediately.
