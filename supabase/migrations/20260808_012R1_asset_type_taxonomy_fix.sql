-- ORION Enterprise v1.0 Implementation
-- Migration 012R.1: Asset Type Taxonomy De-duplication

do $$
declare
  r record;
begin
  -- Canonical names for known types.
  update public.asset_types set code='FIRE_DOOR', name='Fire Door'
   where lower(trim(name))='fire door' or upper(code) in ('FIRE_DOOR','FIREDOOR','FD');

  update public.asset_types set code='EMERGENCY_LIGHT', name='Emergency Light'
   where lower(trim(name)) in ('emergency light','emergency lighting')
      or upper(code) in ('EMERGENCY_LIGHT','EMERGENCY_LIGHTING','EML');

  update public.asset_types set code='AOV', name='Automatic Opening Vent'
   where lower(trim(name)) in ('aov','automatic opening vent')
      or upper(code) in ('AOV','AUTOMATIC_OPENING_VENT');

  update public.asset_types set code='ELECTRICAL', name='Electrical Asset'
   where lower(trim(name))='electrical asset'
      or upper(code) in ('ELECTRICAL','ELECTRICAL_ASSET');

  -- Re-point assets to a single canonical row for each company/code.
  for r in
    select company_id, code
    from public.asset_types
    where company_id is not null
    group by company_id, code
    having count(*) > 1
  loop
    with ranked as (
      select id,
             row_number() over (
               order by case when coalesce(is_system,false) then 0 else 1 end,
                        created_at,
                        id
             ) as rn
      from public.asset_types
      where company_id = r.company_id and code = r.code
    ),
    canonical as (
      select id from ranked where rn = 1
    )
    update public.assets a
       set asset_type_id = c.id
      from canonical c
     where a.asset_type_id in (select id from ranked where rn > 1);

    delete from public.asset_types
     where id in (
       select id
       from (
         select id,
                row_number() over (
                  order by case when coalesce(is_system,false) then 0 else 1 end,
                           created_at,
                           id
                ) as rn
         from public.asset_types
         where company_id = r.company_id and code = r.code
       ) x
       where rn > 1
     );
  end loop;
end $$;

insert into public.asset_types(
  company_id, code, name, compliance_domain, is_system,
  inspection_frequency_months, expected_life_years, is_active
)
select c.id, s.code, s.name, s.domain, true, s.months, s.life_years, true
from public.companies c
cross join (
  values
    ('ACCESS_SECURITY_DOOR','Access / Security Door','access_security',12,20),
    ('AOV','Automatic Opening Vent','aov',6,15),
    ('DRY_RISER','Dry Riser','fire_safety',6,30),
    ('ELECTRICAL','Electrical Asset','electrical',12,15),
    ('EMERGENCY_LIGHT','Emergency Light','emergency_lighting',1,10),
    ('FIRE_ALARM_DEVICE','Fire Alarm Device','fire_alarm',6,15),
    ('FIRE_DOOR','Fire Door','fire_safety',6,25),
    ('FIRE_EXTINGUISHER','Fire Extinguisher','fire_safety',12,10),
    ('GAS_ASSET','Gas Asset','gas_safety',12,15),
    ('LIFT','Lift / Elevator','lift_safety',6,25),
    ('WATER_HYGIENE','Water Hygiene Asset','water_hygiene',12,15)
) s(code,name,domain,months,life_years)
where c.is_active = true
on conflict (company_id, code) do update set
  name = excluded.name,
  compliance_domain = excluded.compliance_domain,
  is_system = true,
  inspection_frequency_months = excluded.inspection_frequency_months,
  expected_life_years = excluded.expected_life_years,
  is_active = true;

create unique index if not exists asset_types_company_code_uidx
  on public.asset_types(company_id, code)
  where company_id is not null;

create or replace view public.asset_type_taxonomy_health as
select company_id, code, min(name) as name, count(*) as row_count
from public.asset_types
where company_id is not null
group by company_id, code;

grant select on public.asset_type_taxonomy_health to authenticated;
