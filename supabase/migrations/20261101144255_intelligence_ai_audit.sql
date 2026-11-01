-- Read-only portfolio AI, with auditable provider usage. No customer data is sent automatically.
create table public.orion_ai_runs (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 actor_user_id uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 status text not null default 'pending' check(status in ('pending','completed','failed')),
 provider text not null default 'openai' check(provider='openai'),
 model text not null,
 prompt_version text not null default 'orion-portfolio-2026-11-v1',
 input_metrics jsonb not null,
 result jsonb,
 duration_ms integer check(duration_ms>=0),
 input_tokens integer check(input_tokens>=0),
 cached_input_tokens integer check(cached_input_tokens>=0 and cached_input_tokens<=input_tokens),
 output_tokens integer check(output_tokens>=0),
 estimated_cost_usd numeric(14,8) check(estimated_cost_usd>=0),
 cost_basis jsonb,
 error_code text
);
create index orion_ai_runs_company_created_idx on public.orion_ai_runs(company_id,created_at desc);
create index orion_ai_runs_actor_idx on public.orion_ai_runs(actor_user_id);
alter table public.orion_ai_runs enable row level security;
revoke all on public.orion_ai_runs from public,anon,authenticated;
grant select on public.orion_ai_runs to authenticated;
grant select,insert,update on public.orion_ai_runs to service_role;
create policy ai_runs_staff_read on public.orion_ai_runs for select to authenticated
using(public.has_permission(company_id,'report.generate') and not public.orion_is_customer_member(company_id));

create function public.orion_intelligence_context(p_company_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
begin
 if auth.uid() is null or not public.has_permission(p_company_id,'report.generate') or public.orion_is_customer_member(p_company_id) then
  raise exception 'Staff intelligence permission required';
 end if;
 return jsonb_build_object(
  'properties',(select count(*) from public.properties where company_id=p_company_id),
  'assets',(select count(*) from public.assets where company_id=p_company_id),
  'passed_inspections',(select count(*) from public.orion_inspection_runs where company_id=p_company_id and status='submitted' and outcome='pass'),
  'failed_inspections',(select count(*) from public.orion_inspection_runs where company_id=p_company_id and status='submitted' and outcome='fail'),
  'pending_inspections',(select count(*) from public.orion_inspection_runs where company_id=p_company_id and status='in_progress'),
  'open_defects',(select count(*) from public.orion_inspection_defects where company_id=p_company_id and status not in ('closed','verified')),
  'critical_defects',(select count(*) from public.orion_inspection_defects where company_id=p_company_id and severity='critical' and status not in ('closed','verified')),
  'reports',(select count(*) from public.orion_reports where company_id=p_company_id),
  'issued_reports',(select count(*) from public.orion_reports where company_id=p_company_id and status='issued')
 );
end; $$;
revoke all on function public.orion_intelligence_context(uuid) from public,anon;
grant execute on function public.orion_intelligence_context(uuid) to authenticated;

-- Only the authenticated Edge Function's server client can reserve a billable request.
create function public.orion_ai_begin_run(p_company_id uuid,p_actor_user_id uuid,p_model text,p_input_metrics jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare run_id uuid;
begin
 if not exists(select 1 from public.company_memberships m join public.roles r on r.id=m.role_id
   join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id
   where m.company_id=p_company_id and m.user_id=p_actor_user_id and m.status='active' and r.code<>'client' and p.code='report.generate')
   and not exists(select 1 from public.profiles where user_id=p_actor_user_id and is_platform_admin) then
  raise exception 'Active staff intelligence permission required';
 end if;
 if p_model<>'gpt-5.4-mini-2026-03-17' then raise exception 'Unapproved model'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company_id::text,7321));
 if (select count(*) from public.orion_ai_runs where company_id=p_company_id and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then
  raise exception 'Daily AI request limit reached';
 end if;
 if exists(select 1 from public.orion_ai_runs where company_id=p_company_id and actor_user_id=p_actor_user_id and created_at>clock_timestamp()-interval '15 seconds') then
  raise exception 'AI request cooldown active';
 end if;
 insert into public.orion_ai_runs(company_id,actor_user_id,model,input_metrics)
 values(p_company_id,p_actor_user_id,p_model,p_input_metrics) returning id into run_id;
 return run_id;
end; $$;
revoke all on function public.orion_ai_begin_run(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.orion_ai_begin_run(uuid,uuid,text,jsonb) to service_role;
