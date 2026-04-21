-- =====================================================================
-- EDUSOSYAL — SEED SCRIPT (run once in Supabase SQL editor)
-- Inserts: 1 school, 2 campaigns, 2 meta_ad_mappings, 10 leads.
-- Idempotent-ish: safe to re-run; uses fixed names so re-runs add dupes
-- only if you don't clean first. To reset, delete the school first
-- (cascades to campaigns/leads/mappings).
-- =====================================================================

do $$
declare
  v_school_id uuid;
  v_camp_1    uuid;
  v_camp_2    uuid;
  v_lead_count int;
  v_camp_count int;
  v_map_count  int;
begin
  -- 1) School
  insert into public.schools (name)
  values ('Test School')
  returning id into v_school_id;

  -- 2) Campaigns
  insert into public.campaigns (school_id, name, status, roas, cpa, spend)
  values (v_school_id, 'Kampanya 1 — Anaokulu', 'active', 2.4, 85, 4200)
  returning id into v_camp_1;

  insert into public.campaigns (school_id, name, status, roas, cpa, spend)
  values (v_school_id, 'Kampanya 2 — İlkokul', 'active', 1.8, 110, 3300)
  returning id into v_camp_2;

  -- 3) Meta ad mappings
  insert into public.meta_ad_mappings (school_id, campaign_id, label)
  values
    (v_school_id, 'meta_test_1', 'Kampanya 1'),
    (v_school_id, 'meta_test_2', 'Kampanya 2');

  -- 4) Leads — 3 high / 4 medium / 3 low-or-empty
  insert into public.leads (school_id, name, phone, intent, status, source, campaign_id)
  values
    -- HIGH intent (clear buying signals)
    (v_school_id, 'Ayşe Yılmaz',  '+905321112201', 'Fiyat bilgisi ve kayıt için acil dönüş istiyorum', 'new', 'meta', 'meta_test_1'),
    (v_school_id, 'Mehmet Demir', '+905321112202', 'Yarın okulu gezmek istiyorum, randevu alabilir miyim?', 'new', 'meta', 'meta_test_2'),
    (v_school_id, 'Zeynep Kaya',  '+905321112203', 'Kayıt şartları ve ücret nedir?', 'new', 'meta', 'meta_test_1'),

    -- MEDIUM intent (interest, no commitment)
    (v_school_id, 'Ali Şahin',    '+905321112204', 'Okul hakkında bilgi almak istiyorum', 'new', 'meta', 'meta_test_1'),
    (v_school_id, 'Fatma Arslan', '+905321112205', 'Broşür gönderebilir misiniz?', 'new', 'meta', 'meta_test_2'),
    (v_school_id, 'Hasan Çelik',  '+905321112206', 'Sınıf mevcudu kaç kişi?', 'new', 'meta', 'meta_test_2'),
    (v_school_id, 'Elif Aydın',   '+905321112207', 'Servis hizmeti var mı?', 'new', 'meta', 'meta_test_1'),

    -- LOW / empty intent
    (v_school_id, 'Burak Öztürk', '+905321112208', 'sadece bakıyorum', 'new', 'meta', 'meta_test_2'),
    (v_school_id, 'Selin Koç',    '+905321112209', '', 'new', 'meta', 'meta_test_1'),
    (v_school_id, 'Emre Doğan',   '+905321112210', null, 'new', 'meta', 'meta_test_2');

  -- counts
  select count(*) into v_camp_count from public.campaigns where school_id = v_school_id;
  select count(*) into v_map_count  from public.meta_ad_mappings where school_id = v_school_id;
  select count(*) into v_lead_count from public.leads where school_id = v_school_id;

  raise notice '====================================';
  raise notice 'SEED REPORT';
  raise notice '  school_id:     %', v_school_id;
  raise notice '  campaigns:     %', v_camp_count;
  raise notice '  meta_mappings: %', v_map_count;
  raise notice '  leads:         %', v_lead_count;
  raise notice '====================================';

  if v_lead_count <> 10 or v_camp_count <> 2 or v_map_count <> 2 then
    raise exception 'SEED FAIL — expected 1 school / 2 campaigns / 2 mappings / 10 leads, got %/%/%',
      v_camp_count, v_map_count, v_lead_count;
  end if;
end $$;

-- Final verification select (so you see rows in the SQL editor result pane)
select 'schools' as tbl, count(*) from public.schools where name = 'Test School'
union all select 'campaigns',     count(*) from public.campaigns c join public.schools s on s.id = c.school_id where s.name = 'Test School'
union all select 'meta_mappings', count(*) from public.meta_ad_mappings m join public.schools s on s.id = m.school_id where s.name = 'Test School'
union all select 'leads',         count(*) from public.leads l join public.schools s on s.id = l.school_id where s.name = 'Test School';
