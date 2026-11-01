-- Customer accounts are limited to explicitly assigned properties and issued reports.
-- Staff permissions are unchanged. No real customer assignment is created by this migration.
create table public.orion_customer_properties (
  user_id uuid not null references auth.users(id),
  property_id uuid not null references public.properties(id),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default clock_timestamp(),
  primary key(user_id,property_id)
);
alter table public.orion_customer_properties enable row level security;
revoke all on public.orion_customer_properties from public,anon,authenticated;
grant select on public.orion_customer_properties to authenticated;
create policy customer_assignments_read on public.orion_customer_properties for select to authenticated
using(user_id=(select auth.uid()) or public.is_platform_admin() or exists(
 select 1 from public.properties p join public.company_memberships m on m.company_id=p.company_id
 join public.roles r on r.id=m.role_id where p.id=property_id and m.user_id=(select auth.uid()) and m.status='active' and r.code='company_admin'));

create or replace function public.orion_is_customer_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and not public.is_platform_admin() and exists(
   select 1 from public.company_memberships m join public.roles r on r.id=m.role_id
   where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active' and r.code='client');
$$;
revoke all on function public.orion_is_customer_member(uuid) from public,anon;
grant execute on function public.orion_is_customer_member(uuid) to authenticated;

create or replace function public.orion_can_access_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.properties p where p.id=p_property_id and (
   public.is_platform_admin() or exists(
     select 1 from public.company_memberships m join public.roles r on r.id=m.role_id
     where m.company_id=p.company_id and m.user_id=auth.uid() and m.status='active' and (
       r.code in ('company_admin','compliance_manager','property_manager','engineer','auditor','read_only','subcontractor')
       or (r.code='client' and exists(select 1 from public.orion_customer_properties cp where cp.user_id=auth.uid() and cp.property_id=p.id))
     )
   )
 ));
$$;
revoke all on function public.orion_can_access_property(uuid) from public,anon;
grant execute on function public.orion_can_access_property(uuid) to authenticated;

create or replace function public.orion_can_read_report(p_report_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(
   select 1 from public.orion_reports r
   left join public.orion_inspection_runs i on i.id=r.inspection_id
   left join public.assets a on a.id=i.asset_id
   where r.id=p_report_id and public.is_company_member(r.company_id)
   and (not public.orion_is_customer_member(r.company_id)
     or (r.status='issued' and public.orion_can_access_property(coalesce(r.property_id,a.property_id))))
 );
$$;
revoke all on function public.orion_can_read_report(uuid) from public,anon;
grant execute on function public.orion_can_read_report(uuid) to authenticated;

-- Broad existing permissive company policies cannot override these restrictions.
do $$ declare t record; predicate text;
begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity
   and exists(select 1 from information_schema.columns x where x.table_schema='public' and x.table_name=c.relname and x.column_name='company_id')
 loop
   predicate:=case t.relname
     when 'properties' then 'public.orion_can_access_property(id)'
     when 'assets' then 'public.orion_can_access_property(property_id)'
     when 'blocks' then 'public.orion_can_access_property(property_id)'
     when 'floors' then 'exists(select 1 from public.blocks b where b.id=block_id and public.orion_can_access_property(b.property_id))'
     when 'areas' then 'exists(select 1 from public.floors f join public.blocks b on b.id=f.block_id where f.id=floor_id and public.orion_can_access_property(b.property_id))'
     when 'orion_reports' then 'public.orion_can_read_report(id)'
     when 'company_memberships' then 'not public.orion_is_customer_member(company_id) or user_id=(select auth.uid())'
     when 'portal_users' then 'not public.orion_is_customer_member(company_id) or id=(select auth.uid())'
     when 'asset_types' then 'true'
     else 'not public.orion_is_customer_member(company_id)' end;
   execute format('create policy customer_read_boundary on public.%I as restrictive for select to authenticated using (%s)',t.relname,predicate);
 end loop;
end $$;
create policy customer_report_version_boundary on public.orion_report_versions as restrictive for select to authenticated
using(exists(select 1 from public.orion_reports r where r.id=report_id and public.orion_can_read_report(r.id)
 and (not public.orion_is_customer_member(r.company_id) or version_no=r.current_version)));
create policy customer_vault_boundary on public.document_vault as restrictive for select to authenticated
using(public.orion_can_access_property(property_id));
create policy customer_messages_read_boundary on public.portal_messages as restrictive for select to authenticated
using(public.orion_can_access_property(property_id));
create policy customer_messages_insert_boundary on public.portal_messages as restrictive for insert to authenticated
with check(public.orion_can_access_property(property_id) and sender_id=(select auth.uid()));

-- Legacy derived tables have no company_id; follow their owning asset/property.
create policy customer_lifecycle_boundary on public.asset_lifecycle as restrictive for select to authenticated
using(exists(select 1 from public.assets a where a.id=asset_id and not public.orion_is_customer_member(a.company_id)));
create policy customer_prediction_boundary on public.asset_predictions as restrictive for select to authenticated
using(exists(select 1 from public.assets a where a.id=asset_id and not public.orion_is_customer_member(a.company_id)));
create policy customer_health_boundary on public.building_health as restrictive for select to authenticated
using(exists(select 1 from public.properties p where p.id=property_id and not public.orion_is_customer_member(p.company_id)));
-- Raw snapshots are internal. Authorised report-generation RPCs still call this as their owner.
revoke execute on function public.orion_build_report_snapshot(uuid) from authenticated,anon;

grant select on public.document_vault to authenticated;
create or replace function public.orion_can_read_storage(p_bucket text,p_path text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare c uuid;
begin
 if auth.uid() is null then return false; end if;
 if p_bucket not in ('inspection-evidence','completion-evidence','generated-documents') then return true; end if;
 begin c:=split_part(p_path,'/',1)::uuid; exception when invalid_text_representation then return false; end;
 if not public.is_company_member(c) then return false; end if;
 if not public.orion_is_customer_member(c) then return true; end if;
 if p_bucket='generated-documents' then
   return exists(select 1 from public.document_vault v where (v.storage_path=p_path or v.storage_path='generated-documents/'||p_path)
     and public.orion_can_access_property(v.property_id));
 end if;
 return exists(select 1 from public.orion_reports r join public.orion_report_versions v on v.report_id=r.id and v.version_no=r.current_version
   where r.company_id=c and r.status='issued' and public.orion_can_read_report(r.id) and (
     (p_bucket='inspection-evidence' and exists(
       select 1 from public.orion_inspection_evidence e where e.inspection_id=r.inspection_id and e.storage_path=p_path
       and exists(select 1 from jsonb_array_elements(coalesce(v.source_snapshot->'evidence','[]')) x where x->>'id'=e.id::text)))
     or (p_bucket='completion-evidence' and exists(
       select 1 from jsonb_array_elements(coalesce(v.source_snapshot->'completions','[]')) cs,
         jsonb_array_elements(coalesce(cs->'photos','[]')) ph where ph->>'storage_path'=p_path))
   ));
end; $$;
revoke all on function public.orion_can_read_storage(text,text) from public,anon;
grant execute on function public.orion_can_read_storage(text,text) to authenticated;
create policy customer_private_file_boundary on storage.objects as restrictive for select to authenticated
using(public.orion_can_read_storage(bucket_id,name));

-- Explicit, audited management. No customers are assigned automatically.
create or replace function public.orion_set_customer_property(p_user_id uuid,p_property_id uuid,p_allow boolean)
returns void language plpgsql security definer set search_path=public as $$
declare c uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select company_id into c from public.properties where id=p_property_id;
 if c is null or not (public.is_platform_admin() or exists(
   select 1 from public.company_memberships m join public.roles r on r.id=m.role_id
   where m.company_id=c and m.user_id=auth.uid() and m.status='active' and r.code='company_admin')) then raise exception 'Company administrator required'; end if;
 if not exists(select 1 from public.company_memberships m join public.roles r on r.id=m.role_id
   where m.company_id=c and m.user_id=p_user_id and m.status='active' and r.code='client') then raise exception 'An active client membership in this company is required'; end if;
 if p_allow is null then raise exception 'Access decision required'; end if;
 if p_allow then insert into public.orion_customer_properties(user_id,property_id,granted_by) values(p_user_id,p_property_id,auth.uid()) on conflict do nothing;
 else delete from public.orion_customer_properties where user_id=p_user_id and property_id=p_property_id; end if;
 insert into public.audit_log(company_id,actor_user_id,action,entity_table,entity_id,reason)
 values(c,auth.uid(),case when p_allow then 'customer.property.granted' else 'customer.property.revoked' end,'properties',p_property_id::text,'Customer property access managed for user '||p_user_id::text);
end; $$;
revoke all on function public.orion_set_customer_property(uuid,uuid,boolean) from public,anon;
grant execute on function public.orion_set_customer_property(uuid,uuid,boolean) to authenticated;

alter table public.portal_messages alter column id set default gen_random_uuid();
alter table public.document_vault alter column id set default gen_random_uuid();

-- Older approved snapshots can resolve photo locations without exposing raw inspection tables.
create or replace function public.orion_report_evidence_location(p_report_id uuid,p_evidence_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.orion_can_read_report(p_report_id) then raise exception 'Report access denied'; end if;
 select jsonb_build_object('storage_bucket',e.storage_bucket,'storage_path',e.storage_path) into result
 from public.orion_reports r join public.orion_report_versions v on v.report_id=r.id and v.version_no=r.current_version
 join public.orion_inspection_evidence e on e.inspection_id=r.inspection_id
 where r.id=p_report_id and e.id=p_evidence_id and exists(
   select 1 from jsonb_array_elements(coalesce(v.source_snapshot->'evidence','[]')) x where x->>'id'=e.id::text);
 if result is null then raise exception 'Evidence is not included in this report'; end if;
 return result;
end; $$;
revoke all on function public.orion_report_evidence_location(uuid,uuid) from public,anon;
grant execute on function public.orion_report_evidence_location(uuid,uuid) to authenticated;

revoke truncate,references,trigger on public.orion_report_versions from authenticated,anon;
