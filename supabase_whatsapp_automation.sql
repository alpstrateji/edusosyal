-- =====================================================================
-- WhatsApp automation: welcome on new lead + 24h follow-up via pg_cron
-- Run this in Supabase SQL editor AFTER supabase_setup.sql.
--
-- Prereqs (Supabase → Database → Extensions): enable pg_net and pg_cron.
--
-- ONE-TIME setup — run with your real values BEFORE the rest:
--   alter database postgres set app.supabase_url     = 'https://iqiqlpzhdawjfrndrikb.supabase.co';
--   alter database postgres set app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
-- =====================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table public.leads
  add column if not exists whatsapp_sent_at      timestamptz,
  add column if not exists whatsapp_followup_at  timestamptz,
  add column if not exists whatsapp_opted_out    boolean not null default false;

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

create or replace function public.on_lead_insert_send_welcome()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is not null and not coalesce(new.whatsapp_opted_out, false) then
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

select cron.unschedule('whatsapp-followup-sweep')
  where exists (select 1 from cron.job where jobname = 'whatsapp-followup-sweep');

select cron.schedule(
  'whatsapp-followup-sweep', '*/15 * * * *',
  $$ select public.send_whatsapp_followups(); $$
);
