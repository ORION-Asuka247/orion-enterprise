-- ORION Enterprise v1.0 Implementation
-- Update 015: Defect & Remedial Lifecycle

insert into public.permissions(code,description) values
('defect.view','View defects and remedial actions'),
('defect.manage','Manage defect and remedial action lifecycle')
on conflict (code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where p.code='defect.view' and r.code in ('company_admin','compliance_manager','property_manager','engineer','auditor','client','read_only','subcontractor')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where p.code='defect.manage' and r.code in ('company_admin','compliance_manager','property_manager','engineer')
on conflict do nothing;

alter table public.orion_inspection_defects
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists target_date date,
  add column if not exists remedial_notes text,
  add column if not exists resolution_notes text,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz;

alter table public.orion_inspection_defects drop constraint if exists orion_inspection_defects_status_check;
alter table public.orion_inspection_defects add constraint orion_inspection_defects_status_check
check (status in ('open','assigned','in_progress','resolved','verified','closed','cancelled'));

create index if not exists orion_inspection_defects_company_status_idx
on public.orion_inspection_defects(company_id,status,severity,created_at desc);

create or replace function public.orion_update_defect(
  p_defect_id uuid,
  p_status text default null,
  p_assigned_to uuid default null,
  p_target_date date default null,
  p_remedial_notes text default null,
  p_resolution_notes text default null
)
returns public.orion_inspection_defects
language plpgsql
security definer
set search_path=public
as $$
declare
  v_defect public.orion_inspection_defects%rowtype;
  v_company_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select company_id into v_company_id from public.orion_inspection_defects where id=p_defect_id;
  if v_company_id is null then raise exception 'Defect not found'; end if;
  if not (public.is_platform_admin() or public.has_permission(v_company_id,'defect.manage')) then
    raise exception 'You do not have permission to manage defects';
  end if;
  if p_status is not null and p_status not in ('open','assigned','in_progress','resolved','verified','closed','cancelled') then
    raise exception 'Invalid defect status';
  end if;

  update public.orion_inspection_defects
  set status=coalesce(p_status,status),
      assigned_to=case when p_assigned_to is not null then p_assigned_to else assigned_to end,
      target_date=case when p_target_date is not null then p_target_date else target_date end,
      remedial_notes=case when p_remedial_notes is not null then nullif(trim(p_remedial_notes),'') else remedial_notes end,
      resolution_notes=case when p_resolution_notes is not null then nullif(trim(p_resolution_notes),'') else resolution_notes end,
      resolved_by=case when p_status='resolved' then auth.uid() else resolved_by end,
      resolved_at=case when p_status='resolved' then clock_timestamp() else resolved_at end,
      verified_by=case when p_status='verified' then auth.uid() else verified_by end,
      verified_at=case when p_status='verified' then clock_timestamp() else verified_at end,
      updated_at=now()
  where id=p_defect_id
  returning * into v_defect;

  insert into public.audit_log(company_id,actor_user_id,action,entity_table,entity_id,new_data,reason)
  values(v_company_id,auth.uid(),'defect.lifecycle.update','orion_inspection_defects',p_defect_id::text,to_jsonb(v_defect),coalesce(p_remedial_notes,p_resolution_notes,p_status));

  return v_defect;
end;
$$;

revoke all on function public.orion_update_defect(uuid,text,uuid,date,text,text) from public, anon;
grant execute on function public.orion_update_defect(uuid,text,uuid,date,text,text) to authenticated;

drop policy if exists orion_defect_select on public.orion_inspection_defects;
create policy orion_defect_select on public.orion_inspection_defects
for select to authenticated
using (public.is_platform_admin() or (public.is_company_member(company_id) and public.has_permission(company_id,'defect.view')));

drop policy if exists orion_defect_write on public.orion_inspection_defects;
create policy orion_defect_write on public.orion_inspection_defects
for all to authenticated
using (public.is_platform_admin() or public.has_permission(company_id,'defect.manage'))
with check (public.is_platform_admin() or public.has_permission(company_id,'defect.manage'));
