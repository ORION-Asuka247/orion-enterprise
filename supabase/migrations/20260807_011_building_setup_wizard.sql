-- ORION Enterprise v1.0 Implementation
-- Migration 011: transactional first-run building setup wizard.

create or replace function public.create_building_setup(
  p_company_id uuid,
  p_property jsonb,
  p_block_names jsonb,
  p_floors_above integer default 0,
  p_basement_levels integer default 0,
  p_create_lobby boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;
  v_block_id uuid;
  v_floor_id uuid;
  v_block_name text;
  v_ref text;
  v_i integer;
  v_blocks jsonb := coalesce(p_block_names, '[]'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_permission(p_company_id, 'property.create') then
    raise exception 'You do not have permission to create properties for this company';
  end if;

  if coalesce(trim(p_property->>'name'), '') = '' then
    raise exception 'Property name is required';
  end if;

  if p_floors_above < 0 or p_floors_above > 100 then
    raise exception 'Floors above ground must be between 0 and 100';
  end if;

  if p_basement_levels < 0 or p_basement_levels > 20 then
    raise exception 'Basement levels must be between 0 and 20';
  end if;

  if jsonb_array_length(v_blocks) = 0 then
    v_blocks := '["Main Building"]'::jsonb;
  end if;

  v_ref := nullif(trim(p_property->>'reference_code'), '');

  insert into public.properties(
    company_id,
    name,
    reference_code,
    address_line1,
    address_line2,
    town_city,
    county,
    postcode,
    country_code
  ) values (
    p_company_id,
    trim(p_property->>'name'),
    v_ref,
    nullif(trim(p_property->>'address_line1'), ''),
    nullif(trim(p_property->>'address_line2'), ''),
    nullif(trim(p_property->>'town_city'), ''),
    nullif(trim(p_property->>'county'), ''),
    nullif(upper(trim(p_property->>'postcode')), ''),
    coalesce(nullif(upper(trim(p_property->>'country_code')), ''), 'GB')
  )
  returning id into v_property_id;

  for v_block_name in
    select trim(value)
    from jsonb_array_elements_text(v_blocks)
  loop
    if v_block_name = '' then
      continue;
    end if;

    insert into public.blocks(
      company_id, property_id, name, code, sort_order
    ) values (
      p_company_id,
      v_property_id,
      v_block_name,
      upper(regexp_replace(v_block_name, '[^a-zA-Z0-9]+', '_', 'g')),
      0
    )
    returning id into v_block_id;

    -- Basement levels: deepest first in sort order.
    if p_basement_levels > 0 then
      for v_i in reverse p_basement_levels..1 loop
        insert into public.floors(
          company_id, block_id, name, level_number, code, sort_order
        ) values (
          p_company_id,
          v_block_id,
          'Basement ' || v_i,
          -v_i,
          'B' || v_i,
          -v_i
        );
      end loop;
    end if;

    -- Ground floor.
    insert into public.floors(
      company_id, block_id, name, level_number, code, sort_order
    ) values (
      p_company_id,
      v_block_id,
      'Ground Floor',
      0,
      'G',
      0
    )
    returning id into v_floor_id;

    if p_create_lobby then
      insert into public.areas(
        company_id, floor_id, name, code, area_type, sort_order
      ) values (
        p_company_id,
        v_floor_id,
        'Lobby',
        'LOBBY',
        'communal',
        0
      );
    end if;

    -- Floors above ground.
    if p_floors_above > 0 then
      for v_i in 1..p_floors_above loop
        insert into public.floors(
          company_id, block_id, name, level_number, code, sort_order
        ) values (
          p_company_id,
          v_block_id,
          'Floor ' || v_i,
          v_i,
          'F' || v_i,
          v_i
        );
      end loop;
    end if;
  end loop;

  return v_property_id;
end;
$$;

grant execute on function public.create_building_setup(
  uuid, jsonb, jsonb, integer, integer, boolean
) to authenticated;
