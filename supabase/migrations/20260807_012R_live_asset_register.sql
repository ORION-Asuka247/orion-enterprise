-- ORION Enterprise v1.0 Implementation
-- Migration 012R: Live Asset Register (schema-aligned revision)
--
-- IMPORTANT:
-- Phase 1 already created:
-- asset_types, assets, asset_code, qr_token, manufacturer, model,
-- serial_number, install_date, status, notes and asset_status_history.
-- This migration extends that existing schema; it does not duplicate it.

alter table public.asset_types
  add column if not exists inspection_frequency_months integer,
  add column if not exists expected_life_years integer,
  add column if not exists is_active boolean not null default true;

alter table public.assets
  add column if not exists condition text not null default 'unknown';

-- Seed practical baseline asset types for every active company.
insert into public.asset_types(
  company_id,
  code,
  name,
  compliance_domain,
  is_system,
  inspection_frequency_months,
  expected_life_years,
  is_active
)
select
  c.id,
  seed.code,
  seed.name,
  seed.domain,
  true,
  seed.months,
  seed.life_years,
  true
from public.companies c
cross join (
  values
    ('FIRE_DOOR','Fire Door','fire_safety',6,25),
    ('EMERGENCY_LIGHT','Emergency Light','emergency_lighting',1,10),
    ('AOV','Automatic Opening Vent','aov',6,15),
    ('FIRE_EXTINGUISHER','Fire Extinguisher','fire_safety',12,10),
    ('DRY_RISER','Dry Riser','fire_safety',6,30),
    ('ELECTRICAL','Electrical Asset','electrical',12,15),
    ('WATER_HYGIENE','Water Hygiene Asset','water_hygiene',12,15),
    ('LIFT','Lift / Elevator','lift_safety',6,25)
) as seed(code,name,domain,months,life_years)
where c.is_active = true
on conflict (company_id, code) do update
set
  name = excluded.name,
  compliance_domain = excluded.compliance_domain,
  inspection_frequency_months = excluded.inspection_frequency_months,
  expected_life_years = excluded.expected_life_years,
  is_active = true;

alter table public.asset_types enable row level security;

drop policy if exists "asset_types_select_member" on public.asset_types;
create policy "asset_types_select_member"
on public.asset_types
for select
to authenticated
using (
  public.is_company_member(company_id)
);

drop policy if exists "asset_types_manage_authorised" on public.asset_types;
create policy "asset_types_manage_authorised"
on public.asset_types
for all
to authenticated
using (
  public.has_permission(company_id, 'asset.create')
  or public.has_permission(company_id, 'asset.edit')
  or public.is_platform_admin()
)
with check (
  public.has_permission(company_id, 'asset.create')
  or public.has_permission(company_id, 'asset.edit')
  or public.is_platform_admin()
);

create or replace function public.create_asset_record(
  p_company_id uuid,
  p_property_id uuid,
  p_block_id uuid,
  p_floor_id uuid,
  p_area_id uuid,
  p_asset_type_id uuid,
  p_asset_code text,
  p_name text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_serial_number text default null,
  p_install_date date default null,
  p_condition text default 'unknown',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_permission(p_company_id, 'asset.create')
    or public.has_permission(p_company_id, 'asset.edit')
    or public.is_platform_admin()
  ) then
    raise exception 'You do not have permission to create assets';
  end if;

  if coalesce(trim(p_asset_code), '') = '' then
    raise exception 'Asset code is required';
  end if;

  if not exists (
    select 1 from public.properties
    where id = p_property_id and company_id = p_company_id
  ) then
    raise exception 'Property does not belong to this company';
  end if;

  if p_block_id is not null and not exists (
    select 1 from public.blocks
    where id = p_block_id and company_id = p_company_id and property_id = p_property_id
  ) then
    raise exception 'Block does not belong to the selected property';
  end if;

  if p_floor_id is not null and not exists (
    select 1 from public.floors f
    join public.blocks b on b.id = f.block_id
    where f.id = p_floor_id
      and f.company_id = p_company_id
      and b.property_id = p_property_id
  ) then
    raise exception 'Floor does not belong to the selected property';
  end if;

  if not exists (
    select 1 from public.asset_types
    where id = p_asset_type_id
      and (company_id = p_company_id or company_id is null)
  ) then
    raise exception 'Invalid asset type';
  end if;

  insert into public.assets(
    company_id,
    property_id,
    block_id,
    floor_id,
    area_id,
    asset_type_id,
    asset_code,
    name,
    manufacturer,
    model,
    serial_number,
    install_date,
    condition,
    status,
    notes
  ) values (
    p_company_id,
    p_property_id,
    p_block_id,
    p_floor_id,
    p_area_id,
    p_asset_type_id,
    upper(trim(p_asset_code)),
    nullif(trim(p_name), ''),
    nullif(trim(p_manufacturer), ''),
    nullif(trim(p_model), ''),
    nullif(trim(p_serial_number), ''),
    p_install_date,
    coalesce(nullif(trim(p_condition), ''), 'unknown'),
    'active'::public.asset_status,
    nullif(trim(p_notes), '')
  )
  returning id into v_id;

  insert into public.asset_status_history(
    company_id, asset_id, from_status, to_status, reason, changed_by
  ) values (
    p_company_id, v_id, null, 'active'::public.asset_status,
    'Asset registered in ORION', auth.uid()
  );

  insert into public.audit_log(
    company_id, actor_user_id, action, entity_table, entity_id, new_data
  )
  select
    p_company_id,
    auth.uid(),
    'create',
    'assets',
    v_id::text,
    to_jsonb(a)
  from public.assets a
  where a.id = v_id;

  return v_id;
end;
$$;

grant execute on function public.create_asset_record(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, date, text, text
) to authenticated;

create or replace function public.lookup_asset(
  p_company_id uuid,
  p_identifier text
)
returns setof public.assets
language sql
stable
security definer
set search_path = public
as $$
  select a.*
  from public.assets a
  where a.company_id = p_company_id
    and (
      upper(a.asset_code) = upper(trim(p_identifier))
      or a.qr_token::text = trim(p_identifier)
      or lower(coalesce(a.serial_number,'')) = lower(trim(p_identifier))
    )
  limit 1;
$$;

grant execute on function public.lookup_asset(uuid, text) to authenticated;
