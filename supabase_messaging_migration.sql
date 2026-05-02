-- =====================================================================
-- EDUSONEX — MESSAGING & AI REPLY MIGRATION
-- Run AFTER supabase_full_migration.sql in the Supabase SQL editor.
-- Idempotent. Adds: telegram chat mapping, conversation log, app_settings,
-- and a few useful columns/indexes for the auto-send + reply pipeline.
-- =====================================================================

-- ---------- 1. Lead messaging columns ----------
-- whatsapp_sent_at + last_reply_text + replied_at already exist from
-- supabase_full_migration.sql. We add Telegram + provider tracking.

alter table public.leads
  add column if not exists telegram_chat_id   bigint,
  add column if not exists last_message_text  text,
  add column if not exists last_message_at    timestamptz,
  add column if not exists last_provider      text;        -- 'telegram' | 'whatsapp' | 'console'

create index if not exists idx_leads_telegram_chat_id
  on public.leads(telegram_chat_id) where telegram_chat_id is not null;

-- Phone is the universal join key for inbound webhooks. Keep it indexed
-- by the trailing 10 digits so `ilike '%xxxxxxxxxx'` is fast.
create index if not exists idx_leads_phone_tail
  on public.leads ((right(regexp_replace(phone, '\D', '', 'g'), 10)));

-- ---------- 2. Conversation messages (chat-style timeline) ----------
-- Source of truth for the lead detail "Conversation" panel. Edge functions
-- and the inbound webhook write here; the UI subscribes via Supabase
-- realtime if enabled.

create table if not exists public.lead_messages (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  school_id    uuid not null references public.schools(id) on delete cascade,
  direction    text not null check (direction in ('outgoing','incoming')),
  provider     text not null check (provider in ('telegram','whatsapp','console')),
  body         text not null,
  -- Provider-side message id (Telegram message_id, WhatsApp wamid). Unique
  -- per provider so we can dedupe webhook retries.
  external_id  text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_lead_messages_lead_created
  on public.lead_messages(lead_id, created_at desc);
create index if not exists idx_lead_messages_school_created
  on public.lead_messages(school_id, created_at desc);
create unique index if not exists uq_lead_messages_provider_external
  on public.lead_messages(provider, external_id)
  where external_id is not null;

alter table public.lead_messages enable row level security;

drop policy if exists "lead_messages_select" on public.lead_messages;
create policy "lead_messages_select" on public.lead_messages
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "lead_messages_insert" on public.lead_messages;
create policy "lead_messages_insert" on public.lead_messages
  for insert to authenticated
  with check (public.is_agency_admin() or school_id = public.current_school_id());

-- ---------- 3. App settings (singleton key/value) ----------
-- Stores AUTO_SEND, default provider, AI model, etc. Editable only by
-- agency admins from the Settings page.

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "app_settings_modify" on public.app_settings;
create policy "app_settings_modify" on public.app_settings
  for all to authenticated
  using (public.is_agency_admin())
  with check (public.is_agency_admin());

-- Seed defaults (only inserted if absent).
insert into public.app_settings (key, value)
values
  ('auto_send',         'true'::jsonb),
  ('default_provider',  '"telegram"'::jsonb),
  ('ai_model',          '"openai/gpt-4o-mini"'::jsonb),
  ('ai_enabled',        'true'::jsonb)
on conflict (key) do nothing;

-- ---------- 4. Convenience: trigger to keep lead.last_message_* in sync ----------
-- Whenever a lead_messages row is inserted, mirror the latest body/timestamp/
-- provider onto the lead row so list/table queries stay cheap (no join).

create or replace function public.lead_messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'outgoing' then
    update public.leads
       set last_message_text = new.body,
           last_message_at   = new.created_at,
           last_provider     = new.provider,
           whatsapp_sent_at  = case
             when new.provider = 'whatsapp' then coalesce(whatsapp_sent_at, new.created_at)
             else whatsapp_sent_at
           end
     where id = new.lead_id;
  else
    update public.leads
       set last_reply_text = new.body,
           replied_at      = new.created_at,
           status          = case when status in ('new','contacted') then 'replied' else status end
     where id = new.lead_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_lead_messages_after_insert on public.lead_messages;
create trigger trg_lead_messages_after_insert
  after insert on public.lead_messages
  for each row execute function public.lead_messages_after_insert();

-- ---------- 5. Helper: read a setting from SQL/edge-fn cleanly ----------
create or replace function public.get_setting(_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = _key
$$;

-- ---------- Done ----------
-- Verify with:
--   select key, value from public.app_settings;
--   select column_name from information_schema.columns
--     where table_name='leads' and column_name in
--       ('telegram_chat_id','last_message_text','last_message_at','last_provider');
