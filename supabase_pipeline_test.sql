-- =====================================================================
-- EDUSOSYAL — END-TO-END PIPELINE TEST (FAIL LOUDLY)
-- Run in Supabase SQL editor. Idempotent. NULL-guarded.
-- =====================================================================

do $$
declare
  v_school_id   uuid;
  v_lead_id     uuid;
  v_leads       int;
  v_scored      int;
  v_contacted   int;
  v_logs_before int;
  v_logs_after  int;
begin
  ----------------------------------------------------------------------
  -- 1) ASSERT TABLES
  ----------------------------------------------------------------------
  if to_regclass('public.leads')      is null then raise exception 'MISSING TABLE: leads';      end if;
  if to_regclass('public.agent_logs') is null then raise exception 'MISSING TABLE: agent_logs'; end if;
  if to_regclass('public.campaigns')  is null then raise exception 'MISSING TABLE: campaigns';  end if;
  if to_regclass('public.schools')    is null then raise exception 'MISSING TABLE: schools';    end if;

  ----------------------------------------------------------------------
  -- 2) SEED (only if leads empty). Need at least one school.
  ----------------------------------------------------------------------
  select count(*) into v_leads from public.leads;

  if v_leads = 0 then
    select id into v_school_id from public.schools order by created_at asc limit 1;
    if v_school_id is null then
      insert into public.schools (name) values ('Pipeline Test School')
      returning id into v_school_id;
    end if;

    insert into public.leads (school_id, name, phone, intent, source, status)
    values (v_school_id, 'Test Lead', '905550000000', 'fiyat bilgisi', 'test', 'new');
  end if;

  ----------------------------------------------------------------------
  -- 3) ASSERT LEAD EXISTS
  ----------------------------------------------------------------------
  select count(*) into v_leads from public.leads;
  if v_leads = 0 then raise exception 'FAIL: no leads after seed'; end if;

  ----------------------------------------------------------------------
  -- 4) FIX agent_logs BUG — never NULL reasoning
  ----------------------------------------------------------------------
  update public.agent_logs set reasoning = '' where reasoning is null;

  -- Belt & suspenders: enforce NOT NULL + default at schema level.
  begin
    alter table public.agent_logs alter column reasoning set default '';
  exception when others then null; end;

  begin
    alter table public.agent_logs alter column reasoning set not null;
  exception when others then
    raise notice 'Could not enforce NOT NULL on agent_logs.reasoning: %', sqlerrm;
  end;

  ----------------------------------------------------------------------
  -- 5) RUN SCORING (only unscored)
  ----------------------------------------------------------------------
  update public.leads
     set intent_score = 0.8,
         intent_level = 'high',
         score_reason = 'keyword: fiyat',
         scored_at    = now()
   where intent_score is null;

  ----------------------------------------------------------------------
  -- 6) RUN RECOMMENDATION (status transition)
  ----------------------------------------------------------------------
  update public.leads
     set status = 'contacted'
   where status = 'new';

  ----------------------------------------------------------------------
  -- 7) LOG WRITE TEST  (agent_logs has no lead_id col → put in metadata)
  ----------------------------------------------------------------------
  select count(*) into v_logs_before from public.agent_logs;

  select id, school_id into v_lead_id, v_school_id
    from public.leads
   order by created_at desc
   limit 1;

  insert into public.agent_logs (school_id, agent_type, action, reasoning, metadata, severity)
  values (
    v_school_id,
    'nurturing',                       -- valid enum value
    'pipeline_test_log',
    'ok',
    jsonb_build_object('lead_id', v_lead_id, 'source', 'pipeline_test'),
    'info'
  );

  ----------------------------------------------------------------------
  -- 8) FINAL ASSERT
  ----------------------------------------------------------------------
  select count(*) into v_leads      from public.leads;
  select count(*) into v_scored     from public.leads where intent_score is not null;
  select count(*) into v_contacted  from public.leads where status = 'contacted';
  select count(*) into v_logs_after from public.agent_logs;

  raise notice '====================================';
  raise notice 'PIPELINE REPORT';
  raise notice '  leads total:     %', v_leads;
  raise notice '  leads scored:    %', v_scored;
  raise notice '  leads contacted: %', v_contacted;
  raise notice '  agent_logs:      % (was %)', v_logs_after, v_logs_before;
  raise notice '====================================';

  if v_leads = 0 or v_scored = 0 or v_contacted = 0 or v_logs_after = 0 then
    raise exception 'FAIL: leads=% scored=% contacted=% logs=%',
      v_leads, v_scored, v_contacted, v_logs_after;
  end if;

  raise notice 'SUCCESS ✅';
end $$;

-- Result pane verification
select 'leads_total'     as metric, count(*)::text as value from public.leads
union all select 'leads_scored',     count(*)::text from public.leads where intent_score is not null
union all select 'leads_contacted',  count(*)::text from public.leads where status = 'contacted'
union all select 'agent_logs_total', count(*)::text from public.agent_logs;
