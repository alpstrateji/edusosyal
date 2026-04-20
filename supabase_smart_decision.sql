-- =====================================================================
-- SMART DECISION LAYER
-- Adds: lead intent scoring, reply tracking, AI recommendations table,
--       reply-detection trigger, helper views.
-- Run AFTER supabase_setup.sql, supabase_whatsapp_automation.sql,
-- and supabase_meta_leads.sql.
-- =====================================================================

-- ---------- Intent score on leads ----------
do $$ begin
  create type public.intent_level as enum ('high','medium','low','unknown');
exception when duplicate_object then null; end $$;

alter table public.leads
  add column if not exists intent_score    numeric,                 -- 0..1
  add column if not exists intent_level    public.intent_level
                                            not null default 'unknown',
  add column if not exists score_reason    text,
  add column if not exists scored_at       timestamptz,
  add column if not exists replied_at      timestamptz,
  add column if not exists last_reply_text text;

create index if not exists idx_leads_intent_level on public.leads(intent_level);
create index if not exists idx_leads_replied_at   on public.leads(replied_at desc);

-- ---------- AI recommendations table ----------
create table if not exists public.ai_recommendations (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid references public.schools(id) on delete cascade,
  title       text not null,           -- "What happened"
  rationale   text not null,           -- "Why it matters"
  action      text not null,           -- "What action to take"
  category    text not null,           -- budget|audience|creative|nurturing|alert
  severity    public.log_severity not null default 'info',
  campaign_id uuid references public.campaigns(id) on delete set null,
  metadata    jsonb,
  status      text not null default 'open',   -- open|applied|dismissed
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_recs_school   on public.ai_recommendations(school_id);
create index if not exists idx_ai_recs_status   on public.ai_recommendations(status);
create index if not exists idx_ai_recs_created  on public.ai_recommendations(created_at desc);

alter table public.ai_recommendations enable row level security;

drop policy if exists "ai_recs_select" on public.ai_recommendations;
create policy "ai_recs_select" on public.ai_recommendations
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "ai_recs_modify" on public.ai_recommendations;
create policy "ai_recs_modify" on public.ai_recommendations
  for all to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id())
  with check (public.is_agency_admin() or school_id = public.current_school_id());

alter publication supabase_realtime add table public.ai_recommendations;

-- ---------- Auto-score new leads via edge function ----------
-- Calls the `score-lead` edge function asynchronously through pg_net.
create or replace function public.invoke_score_lead(p_lead_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text := current_setting('app.supabase_url', true) || '/functions/v1/score-lead';
  v_key text := current_setting('app.service_role_key', true);
begin
  if v_url is null or v_key is null then
    raise notice 'app.supabase_url or app.service_role_key not set';
    return;
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_key
    ),
    body    := jsonb_build_object('lead_id', p_lead_id)
  );
end $$;

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

-- ---------- Reply tracking ----------
-- When the inbound webhook later inserts into agent_logs with a 'WhatsApp reply'
-- action carrying lead_id in metadata, mark the lead as replied + status.
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

-- ---------- Daily recommendations sweep (every 6h) ----------
create or replace function public.invoke_generate_recommendations()
returns void
language plpgsql security definer set search_path = public as $$
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

select cron.unschedule('ai-recommendations-sweep')
  where exists (select 1 from cron.job where jobname = 'ai-recommendations-sweep');

select cron.schedule(
  'ai-recommendations-sweep', '0 */6 * * *',
  $$ select public.invoke_generate_recommendations(); $$
);
