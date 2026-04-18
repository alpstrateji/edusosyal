-- =====================================================================
-- EDUSONEX AaaS — Supabase schema + RLS + seed
-- Run this in your Supabase project: SQL Editor → New query → Run
-- Project: https://iqiqlpzhdawjfrndrikb.supabase.co
-- =====================================================================

-- ---------- ENUMS ----------
do $$ begin
  create type public.app_role as enum ('agency_admin', 'school_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.agent_type as enum ('performance','creative','budget','audience','nurturing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.log_severity as enum ('info','success','warning','error');
exception when duplicate_object then null; end $$;

-- ---------- TABLES ----------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'school_admin',
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  roas numeric not null default 0,
  cpa numeric not null default 0,
  spend numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  phone text not null,
  intent text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  agent_type public.agent_type not null,
  action text not null,
  reasoning text not null,
  metadata jsonb,
  severity public.log_severity not null default 'info',
  created_at timestamptz not null default now()
);

create index if not exists idx_campaigns_school on public.campaigns(school_id);
create index if not exists idx_leads_school on public.leads(school_id);
create index if not exists idx_agent_logs_school on public.agent_logs(school_id);
create index if not exists idx_agent_logs_created on public.agent_logs(created_at desc);

-- ---------- SECURITY DEFINER HELPERS (avoid RLS recursion) ----------
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

-- ---------- AUTO-CREATE PROFILE ON SIGNUP ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
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

-- ---------- ENABLE RLS ----------
alter table public.schools       enable row level security;
alter table public.user_profiles enable row level security;
alter table public.campaigns     enable row level security;
alter table public.leads         enable row level security;
alter table public.agent_logs    enable row level security;

-- ---------- POLICIES ----------
-- user_profiles: each user sees their own row; agency_admin sees all
drop policy if exists "profiles_self_select" on public.user_profiles;
create policy "profiles_self_select" on public.user_profiles
  for select to authenticated
  using (id = auth.uid() or public.is_agency_admin());

drop policy if exists "profiles_self_update" on public.user_profiles;
create policy "profiles_self_update" on public.user_profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- schools
drop policy if exists "schools_select" on public.schools;
create policy "schools_select" on public.schools
  for select to authenticated
  using (public.is_agency_admin() or id = public.current_school_id());

-- campaigns
drop policy if exists "campaigns_select" on public.campaigns;
create policy "campaigns_select" on public.campaigns
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "campaigns_modify" on public.campaigns;
create policy "campaigns_modify" on public.campaigns
  for all to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id())
  with check (public.is_agency_admin() or school_id = public.current_school_id());

-- leads
drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "leads_modify" on public.leads;
create policy "leads_modify" on public.leads
  for all to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id())
  with check (public.is_agency_admin() or school_id = public.current_school_id());

-- agent_logs
drop policy if exists "agent_logs_select" on public.agent_logs;
create policy "agent_logs_select" on public.agent_logs
  for select to authenticated
  using (public.is_agency_admin() or school_id = public.current_school_id());

drop policy if exists "agent_logs_insert" on public.agent_logs;
create policy "agent_logs_insert" on public.agent_logs
  for insert to authenticated
  with check (public.is_agency_admin() or school_id = public.current_school_id());

-- ---------- REALTIME ----------
alter publication supabase_realtime add table public.agent_logs;

-- =====================================================================
-- SEED DATA
-- =====================================================================
with s as (
  insert into public.schools (name) values
    ('Greenfield International School'),
    ('Sunrise Academy'),
    ('Northbridge College')
  returning id, name
)
select * from s;

-- Campaigns (4 per school)
insert into public.campaigns (school_id, name, status, roas, cpa, spend)
select s.id, c.name, c.status, c.roas, c.cpa, c.spend
from public.schools s
cross join lateral (values
  ('Admissions 2025 — Grade 6',     'active', 4.2, 380, 125000),
  ('Open House — November',          'active', 3.6, 420,  86000),
  ('Brand Awareness — Local',        'paused', 2.1, 610,  42000),
  ('Scholarship Program',            'active', 5.8, 290,  68000)
) as c(name, status, roas, cpa, spend);

-- Leads (20 per school) using generate_series
insert into public.leads (school_id, name, phone, intent, status)
select
  s.id,
  'Parent ' || s.name || ' #' || g,
  '+9198' || lpad((floor(random()*99999999))::int::text, 8, '0'),
  (array['Grade 6 admission','Grade 9 transfer','Scholarship inquiry','Open house RSVP','Fee structure'])[1 + (g % 5)],
  (array['new','contacted','qualified','converted'])[1 + (g % 4)]
from public.schools s
cross join generate_series(1, 20) g;

-- Agent logs — 50+ realistic entries with reasoning
insert into public.agent_logs (school_id, agent_type, action, reasoning, severity, metadata)
select
  s.id,
  l.agent_type::public.agent_type,
  l.action,
  l.reasoning,
  l.severity::public.log_severity,
  l.metadata::jsonb
from public.schools s
cross join lateral (values
  ('performance', 'Paused campaign "Brand Awareness — Local"',
   'CTR dropped by 18% in last 7 days → frequency exceeded 3.5 → action: pause campaign',
   'warning', '{"ctr_drop_pct":18,"frequency":3.7,"campaign":"Brand Awareness — Local"}'),
  ('creative', 'Rotated 3 underperforming ad creatives',
   'Creative fatigue detected: 5 of 8 ads below 1.2% CTR for 4 consecutive days → swapping with variants from top-performing cluster',
   'info', '{"rotated":3,"reason":"creative_fatigue"}'),
  ('budget', 'Reallocated ₹12,000 from Set B to Set A',
   'Set A ROAS = 5.8x vs Set B ROAS = 1.9x → shifted 30% of remaining daily budget toward higher ROAS set',
   'success', '{"from":"adset_B","to":"adset_A","amount":12000}'),
  ('audience', 'Created lookalike audience from converted leads',
   'Detected 14 new conversions in last 72h → seeded 1% LAL from converted_parents_v3 → expected reach: 240k',
   'success', '{"seed_size":14,"lal_pct":1,"reach_est":240000}'),
  ('nurturing', 'Sent follow-up to 7 stale leads',
   'Leads inactive >48h after first reply → auto-sent personalized follow-up template fee_structure_v2',
   'info', '{"leads_count":7,"template":"fee_structure_v2"}'),
  ('performance', 'Flagged anomaly in conversion tracking',
   'Conversion volume spiked 312% in 1h with no spend change → possible duplicate event firing → muted alert pending QA',
   'error', '{"spike_pct":312,"window":"1h"}'),
  ('creative', 'Generated 4 new headline variants',
   'Top headline reached 80% of total impressions → diversifying to prevent over-saturation',
   'info', '{"variants":4}'),
  ('budget', 'Increased daily budget on "Scholarship Program" by 25%',
   'Campaign ROAS = 5.8x sustained for 5 days, CPA ₹290 (target ₹400) → safe to scale +25%',
   'success', '{"campaign":"Scholarship Program","increase_pct":25}'),
  ('audience', 'Excluded 3 low-intent placements',
   'Audience Network placements showed 0.3% CTR vs feed 1.8% → excluded to improve efficiency',
   'info', '{"excluded":["audience_network_native","audience_network_classic","instream_video"]}'),
  ('nurturing', 'Escalated 2 high-intent leads to human counselor',
   'Lead intent score >0.85 + asked about admission timeline twice → flagged for human handover',
   'warning', '{"lead_count":2,"score_threshold":0.85}'),
  ('performance', 'Confirmed campaign pacing on track',
   'Spend at 48% of monthly budget at day 14/30 → pacing nominal, no action required',
   'success', '{"pacing":"on_track","day":14}'),
  ('creative', 'Tagged 2 winning creatives for next iteration',
   'Two ads exceeded 3% CTR with CVR >5% → marked as reference for next creative brief',
   'success', '{"winners":2}'),
  ('budget', 'Reduced spend on weekend slots',
   'Weekend conversion rate 42% lower than weekday avg → reduced weekend bid cap by 15%',
   'info', '{"reduction_pct":15,"days":["Sat","Sun"]}'),
  ('audience', 'Refreshed retargeting pool',
   'Visitors >30 days old showing fatigue (CTR -22%) → refreshed pool to last 14 days only',
   'info', '{"window_days":14}'),
  ('nurturing', 'Closed 3 leads as not-qualified',
   'Leads outside service area (>50km from campus) confirmed via WhatsApp → marked closed_lost',
   'info', '{"closed":3,"reason":"out_of_area"}'),
  ('performance', 'Detected attribution drift on Pixel',
   'Server-side conversions trailing client-side by 23% → recommended CAPI deduplication review',
   'warning', '{"drift_pct":23,"channel":"capi"}'),
  ('budget', 'Auto-paused overspend on Set C',
   'Daily spend reached 140% of cap due to bid surge → emergency pause triggered',
   'error', '{"overspend_pct":140,"adset":"C"}')
) as l(agent_type, action, reasoning, severity, metadata);
