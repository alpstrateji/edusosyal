-- =====================================================================
-- Meta Lead Ads schema additions
-- Run AFTER supabase_setup.sql and supabase_whatsapp_automation.sql
-- =====================================================================

-- ---------- leads: source + Meta identifiers ----------
alter table public.leads
  add column if not exists source        text not null default 'manual',
  add column if not exists meta_lead_id  text,
  add column if not exists campaign_id   text,
  add column if not exists ad_id         text,
  add column if not exists form_id       text;

create unique index if not exists uq_leads_meta_lead_id
  on public.leads(meta_lead_id)
  where meta_lead_id is not null;

create index if not exists idx_leads_created_at on public.leads(created_at desc);
create index if not exists idx_leads_source     on public.leads(source);

-- ---------- ad → school mapping (optional, but recommended) ----------
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

alter table public.meta_ad_mappings enable row level security;

drop policy if exists "meta_map_select" on public.meta_ad_mappings;
create policy "meta_map_select" on public.meta_ad_mappings
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "meta_map_modify" on public.meta_ad_mappings;
create policy "meta_map_modify" on public.meta_ad_mappings
  for all to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id())
  with check (public.is_agency_admin() or school_id = public.current_school_id());
