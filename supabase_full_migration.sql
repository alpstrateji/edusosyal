-- =====================================================================
-- EDUSONEX — CONSOLIDATED MIGRATION (single pass, idempotent)
-- Run this ONCE in Supabase SQL editor for project iqiqlpzhdawjfrndrikb.
-- Replaces: supabase_setup.sql + supabase_whatsapp_automation.sql +
--           supabase_meta_leads.sql + supabase_smart_decision.sql.
--
-- Before running, also execute these two ALTER DATABASE statements with
-- your real values (needed by pg_net to call edge functions):
--
--   alter database postgres set app.supabase_url     = 'https://iqiqlpzhdawjfrndrikb.supabase.co';
--   alter database postgres set app.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';
--
-- This migration intentionally seeds NO leads / campaigns / agent_logs.
-- The system must run on real data only ("no fake/default data").
-- It does seed exactly ONE empty school placeholder so signup works,
-- but you should rename it (or insert your own schools) afterwards.
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- Enums ----------
do $$ begin
  create type public.app_role     as enum ('agency_admin','school_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.agent_type   as enum ('performance','creative','budget','audience','nurturing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.log_severity as enum ('info','success','warning','error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.intent_level as enum ('high','medium','low','unknown');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.app_role not null default 'school_admin',
  school_id   uuid references public.schools(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  status      text not null default 'active',
  roas        numeric not null default 0,
  cpa         numeric not null default 0,
  spend       numeric not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  name                  text not null,
  phone                 text not null,
  intent                text,
  status                text not null default 'new',
  -- Meta Lead Ads
  source                text not null default 'manual',
  meta_lead_id          text,
  campaign_id           text,
  ad_id                 text,
  form_id               text,
  -- WhatsApp automation
  whatsapp_sent_at      timestamptz,
  whatsapp_followup_at  timestamptz,
  whatsapp_opted_out    boolean not null default false,
  -- Smart decision layer
  intent_score          numeric,
  intent_level          public.intent_level not null default 'unknown',
  score_reason          text,
  scored_at             timestamptz,
  replied_at            timestamptz,
  last_reply_text       text,
  created_at            timestamptz not null default now()
);

create unique index if not exists uq_leads_meta_lead_id
  on public.leads(meta_lead_id) where meta_lead_id is not null;
create index if not exists idx_leads_school        on public.leads(school_id);
create index if not exists idx_leads_created_at    on public.leads(created_at desc);
create index if not exists idx_leads_source        on public.leads(source);
create index if not exists idx_leads_intent_level  on public.leads(intent_level);
create index if not exists idx_leads_replied_at    on public.leads(replied_at desc);

create table if not exists public.agent_logs (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  agent_type  public.agent_type not null,
  action      text not null,
  reasoning   text not null,
  metadata    jsonb,
  severity    public.log_severity not null default 'info',
  created_at  timestamptz not null default now()
);
create index if not exists idx_agent_logs_school   on public.agent_logs(school_id);
create index if not exists idx_agent_logs_created  on public.agent_logs(created_at desc);

create table if not exists public.meta_ad_mappings (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  campaign_id  text,
  ad_id        text,
  form_id      text,
  label        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_meta_map_campaign on public.meta_ad_mappings(campaign_id);
create index if not exists idx_meta_map_ad       on public.meta_ad_mappings(ad_id);
create index if not exists idx_meta_map_form     on public.meta_ad_mappings(form_id);

create table if not exists public.ai_recommendations (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid references public.schools(id) on delete cascade,
  title       text not null,
  rationale   text not null,
  action      text not null,
  category    text not null,                   -- budget|audience|creative|nurturing|alert
  severity    public.log_severity not null default 'info',
  campaign_id text,
  metadata    jsonb,
  status      text not null default 'open',    -- open|applied|dismissed
  created_at  timestamptz not null default now()
);
create index if not exists idx_ai_recs_school  on public.ai_recommendations(school_id);
create index if not exists idx_ai_recs_status  on public.ai_recommendations(status);
create index if not exists idx_ai_recs_created on public.ai_recommendations(created_at desc);

-- ---------- Security definer helpers (no RLS recursion) ----------
create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.user_profiles where id = auth.uid()
$$;

create or replace function public.current_school_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select school_id from public.user_profiles where id = auth.uid()
$$;

create or replace function public.is_agency_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_profiles where id = auth.uid() and role = 'agency_admin')
$$;

-- ---------- Auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, role, school_id)
  values (new.id, 'school_admin', null)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Enable RLS ----------
alter table public.schools             enable row level security;
alter table public.user_profiles       enable row level security;
alter table public.campaigns           enable row level security;
alter table public.leads               enable row level security;
alter table public.agent_logs          enable row level security;
alter table public.meta_ad_mappings    enable row level security;
alter table public.ai_recommendations  enable row level security;

-- ---------- Policies (drop+create for idempotency) ----------
drop policy if exists "profiles_self_select" on public.user_profiles;
create policy "profiles_self_select" on public.user_profiles
  for select to authenticated
  using (id = auth.uid() or public.is_agency_admin());

drop policy if exists "profiles_self_update" on public.user_profiles;
create policy "profiles_self_update" on public.user_profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "schools_select" on public.schools;
create policy "schools_select" on public.schools
  for select to authenticated
  using (public.is_agency_admin() or id = public.current_school_id());

drop policy if exists "schools_modify" on public.schools;
create policy "schools_modify" on public.schools
  for all to authenticated
  using (public.is_agency_admin())
  with check (public.is_agency_admin());

drop policy if exists "campaigns_select" on public.campaigns;
create policy "campaigns_select" on public.campaigns
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "campaigns_modify" on public.campaigns;
create policy "campaigns_modify" on public.campaigns
  for all to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id())
  with check (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "leads_modify" on public.leads;
create policy "leads_modify" on public.leads
  for all to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id())
  with check (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "agent_logs_select" on public.agent_logs;
create policy "agent_logs_select" on public.agent_logs
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "agent_logs_insert" on public.agent_logs;
create policy "agent_logs_insert" on public.agent_logs
  for insert to authenticated
  with check (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "meta_map_select" on public.meta_ad_mappings;
create policy "meta_map_select" on public.meta_ad_mappings
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "meta_map_modify" on public.meta_ad_mappings;
create policy "meta_map_modify" on public.meta_ad_mappings
  for all to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id())
  with check (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "ai_recs_select" on public.ai_recommendations;
create policy "ai_recs_select" on public.ai_recommendations
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "ai_recs_modify" on public.ai_recommendations;
create policy "ai_recs_modify" on public.ai_recommendations
  for all to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id())
  with check (public.is_agency_admin() or school_id = public.current_school_id());

-- ---------- Realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.agent_logs;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.leads;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.ai_recommendations;
exception when duplicate_object then null; end $$;

-- =====================================================================
-- AUTOMATION
-- =====================================================================

-- ---------- Edge function dispatchers via pg_net ----------
create or replace function public.invoke_whatsapp(
  p_phone text, p_template text, p_variables jsonb,
  p_school_id uuid, p_lead_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text := current_setting('app.supabase_url', true) || '/functions/v1/send-whatsapp-message';
  v_key text := current_setting('app.service_role_key', true);
begin
  if v_url is null or v_key is null then
    raise notice 'app.supabase_url or app.service_role_key not set';
    return;
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body    := jsonb_build_object(
      'phone', p_phone, 'template', p_template, 'variables', p_variables,
      'school_id', p_school_id, 'lead_id', p_lead_id
    )
  );
end $$;

create or replace function public.invoke_score_lead(p_lead_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text := current_setting('app.supabase_url', true) || '/functions/v1/score-lead';
  v_key text := current_setting('app.service_role_key', true);
begin
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body    := jsonb_build_object('lead_id', p_lead_id)
  );
end $$;

create or replace function public.invoke_generate_recommendations()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text := current_setting('app.supabase_url', true) || '/functions/v1/generate-recommendations';
  v_key text := current_setting('app.service_role_key', true);
begin
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body    := jsonb_build_object('trigger', 'cron')
  );
end $$;

-- ---------- Triggers ----------
-- Auto-score on new lead.
create or replace function public.on_lead_insert_score()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.invoke_score_lead(new.id);
  return new;
end $$;

drop trigger if exists trg_lead_score on public.leads;
create trigger trg_lead_score
  after insert on public.leads
  for each row execute function public.on_lead_insert_score();

-- Auto-WhatsApp welcome on new lead.
create or replace function public.on_lead_insert_send_welcome()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is not null and new.phone <> '' and not coalesce(new.whatsapp_opted_out, false) then
    perform public.invoke_whatsapp(
      new.phone, 'welcome', jsonb_build_object('1', new.name),
      new.school_id, new.id
    );
    update public.leads set whatsapp_sent_at = now() where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_lead_welcome on public.leads;
create trigger trg_lead_welcome
  after insert on public.leads
  for each row execute function public.on_lead_insert_send_welcome();

-- Mark lead as replied when a 'WhatsApp reply' agent_log lands.
create or replace function public.on_log_mark_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_lead uuid;
begin
  if new.agent_type = 'nurturing'
     and new.action ilike 'WhatsApp reply%'
     and new.metadata ? 'lead_id'
  then
    v_lead := (new.metadata->>'lead_id')::uuid;
    update public.leads
       set replied_at = coalesce(replied_at, now()),
           last_reply_text = coalesce(new.metadata->>'text', last_reply_text),
           status = case when status in ('new','contacted') then 'replied' else status end
     where id = v_lead;
  end if;
  return new;
end $$;

drop trigger if exists trg_log_mark_reply on public.agent_logs;
create trigger trg_log_mark_reply
  after insert on public.agent_logs
  for each row execute function public.on_log_mark_reply();

-- ---------- 24h follow-up sweep ----------
create or replace function public.send_whatsapp_followups()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id, phone, name, school_id from public.leads
     where whatsapp_sent_at is not null
       and whatsapp_followup_at is null
       and whatsapp_opted_out = false
       and status in ('new','contacted')
       and whatsapp_sent_at < now() - interval '24 hours'
     limit 200
  loop
    perform public.invoke_whatsapp(
      r.phone, 'followup_24h', jsonb_build_object('1', r.name),
      r.school_id, r.id
    );
    update public.leads set whatsapp_followup_at = now() where id = r.id;
  end loop;
end $$;

-- ---------- Cron jobs ----------
select cron.unschedule('whatsapp-followup-sweep')
  where exists (select 1 from cron.job where jobname = 'whatsapp-followup-sweep');
select cron.schedule(
  'whatsapp-followup-sweep', '*/15 * * * *',
  $$ select public.send_whatsapp_followups(); $$
);

select cron.unschedule('ai-recommendations-sweep')
  where exists (select 1 from cron.job where jobname = 'ai-recommendations-sweep');
select cron.schedule(
  'ai-recommendations-sweep', '0 */6 * * *',
  $$ select public.invoke_generate_recommendations(); $$
);

-- =====================================================================
-- POST-MIGRATION (do this once, in the SQL editor):
--   1. alter database postgres set app.supabase_url     = '...';
--      alter database postgres set app.service_role_key = '...';
--   2. Add edge function secrets in Supabase:
--      WHATSAPP_TOKEN, WHATSAPP_PHONE_ID,
--      META_VERIFY_TOKEN, META_PAGE_ACCESS_TOKEN, META_APP_SECRET,
--      LOVABLE_API_KEY (if not auto-provisioned).
--   3. Sign up at /signup → your profile is auto-created and promoted to
--      agency_admin by the app code. Insert your real schools + campaigns
--      from the admin UI (or directly via SQL).
-- =====================================================================
