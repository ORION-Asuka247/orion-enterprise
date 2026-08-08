-- ORION Enterprise v1.0 Implementation
-- Migration 014: Guided Inspection Engine + Automatic Defect Creation
--
-- Safe design:
-- - adds new ORION inspection workflow tables
-- - does not delete or rewrite legacy inspections/defects
-- - evaluates controlled rules server-side
-- - Fire Door gap tolerance is 2-4 mm inclusive
-- - failed controlled items can create automatic defects

create extension if not exists pgcrypto;

create table if not exists public.orion_inspection_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  asset_type_code text not null,
  version integer not null default 1,
  status text not null default 'active'
    check (status in ('draft','active','retired')),
  created_at timestamptz not null default now(),
  unique(company_id, code, version)
);

create table if not exists public.orion_inspection_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.orion_inspection_templates(id) on delete cascade,
  item_code text not null,
  section_name text not null,
  prompt text not null,
  help_text text,
  rule_type text not null
    check (rule_type in ('numeric_range','choice','text')),
  input_type text not null
    check (input_type in ('number','choice','text')),
  min_value numeric,
  max_value numeric,
  unit text,
  choices jsonb not null default '[]'::jsonb,
  pass_values jsonb not null default '[]'::jsonb,
  failure_severity text not null default 'medium'
    check (failure_severity in ('low','medium','high','critical')),
  photo_required_on_fail boolean not null default false,
  notes_required_on_fail boolean not null default true,
  suggested_action text,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique(template_id, item_code)
);

create table if not exists public.orion_inspection_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  template_id uuid not null references public.orion_inspection_templates(id) on delete restrict,
  inspector_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'in_progress'
    check (status in ('in_progress','submitted','cancelled')),
  outcome text not null default 'pending'
    check (outcome in ('pending','pass','fail')),
  started_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  engineer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orion_inspection_answers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inspection_id uuid not null references public.orion_inspection_runs(id) on delete cascade,
  item_id uuid not null references public.orion_inspection_template_items(id) on delete restrict,
  response_text text,
  response_number numeric,
  result text not null
    check (result in ('pass','fail','na')),
  failure_reason text,
  engineer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(inspection_id, item_id)
);

create table if not exists public.orion_inspection_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inspection_id uuid not null references public.orion_inspection_runs(id) on delete cascade,
  answer_id uuid references public.orion_inspection_answers(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  storage_bucket text not null default 'inspection-evidence',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  captured_by uuid not null references auth.users(id) on delete restrict,
  captured_at timestamptz not null default clock_timestamp()
);

create table if not exists public.orion_inspection_defects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  inspection_id uuid not null references public.orion_inspection_runs(id) on delete cascade,
  answer_id uuid not null references public.orion_inspection_answers(id) on delete restrict,
  defect_code text not null,
  title text not null,
  description text not null,
  severity text not null
    check (severity in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','assigned','in_progress','resolved','closed')),
  suggested_action text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  unique(answer_id)
);

create index if not exists orion_inspection_runs_asset_idx
  on public.orion_inspection_runs(asset_id, created_at desc);

create index if not exists orion_inspection_answers_run_idx
  on public.orion_inspection_answers(inspection_id);

create index if not exists orion_inspection_defects_asset_idx
  on public.orion_inspection_defects(asset_id, status, created_at desc);

create index if not exists orion_inspection_evidence_run_idx
  on public.orion_inspection_evidence(inspection_id, captured_at desc);

alter table public.orion_inspection_templates enable row level security;
alter table public.orion_inspection_template_items enable row level security;
alter table public.orion_inspection_runs enable row level security;
alter table public.orion_inspection_answers enable row level security;
alter table public.orion_inspection_evidence enable row level security;
alter table public.orion_inspection_defects enable row level security;

drop policy if exists orion_template_select on public.orion_inspection_templates;
create policy orion_template_select
on public.orion_inspection_templates
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists orion_template_item_select on public.orion_inspection_template_items;
create policy orion_template_item_select
on public.orion_inspection_template_items
for select to authenticated
using (
  exists (
    select 1
    from public.orion_inspection_templates t
    where t.id = template_id
      and public.is_company_member(t.company_id)
  )
);

drop policy if exists orion_run_select on public.orion_inspection_runs;
create policy orion_run_select
on public.orion_inspection_runs
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists orion_run_write on public.orion_inspection_runs;
create policy orion_run_write
on public.orion_inspection_runs
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.edit')
)
with check (
  public.is_platform_admin()
  or public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.edit')
);

drop policy if exists orion_answer_select on public.orion_inspection_answers;
create policy orion_answer_select
on public.orion_inspection_answers
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists orion_answer_write on public.orion_inspection_answers;
create policy orion_answer_write
on public.orion_inspection_answers
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.edit')
)
with check (
  public.is_platform_admin()
  or public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.edit')
);

drop policy if exists orion_evidence_select on public.orion_inspection_evidence;
create policy orion_evidence_select
on public.orion_inspection_evidence
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists orion_evidence_write on public.orion_inspection_evidence;
create policy orion_evidence_write
on public.orion_inspection_evidence
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.edit')
)
with check (
  public.is_platform_admin()
  or public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.edit')
);

drop policy if exists orion_defect_select on public.orion_inspection_defects;
create policy orion_defect_select
on public.orion_inspection_defects
for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists orion_defect_write on public.orion_inspection_defects;
create policy orion_defect_write
on public.orion_inspection_defects
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.edit')
)
with check (
  public.is_platform_admin()
  or public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.edit')
);

-- Seed one controlled Fire Door template per active company.
insert into public.orion_inspection_templates(
  company_id, code, name, asset_type_code, version, status
)
select
  c.id,
  'FD_STANDARD',
  'Fire Door Inspection',
  'FIRE_DOOR',
  1,
  'active'
from public.companies c
where c.is_active = true
on conflict (company_id, code, version) do update
set name = excluded.name,
    asset_type_code = excluded.asset_type_code,
    status = 'active';

insert into public.orion_inspection_template_items(
  template_id, item_code, section_name, prompt, help_text,
  rule_type, input_type, min_value, max_value, unit,
  choices, pass_values, failure_severity,
  photo_required_on_fail, notes_required_on_fail,
  suggested_action, display_order
)
select t.id, seed.item_code, seed.section_name, seed.prompt, seed.help_text,
       seed.rule_type, seed.input_type, seed.min_value, seed.max_value, seed.unit,
       seed.choices::jsonb, seed.pass_values::jsonb, seed.failure_severity,
       seed.photo_required, seed.notes_required, seed.suggested_action, seed.display_order
from public.orion_inspection_templates t
cross join (
  values
  (
    'FD-GAP-TOP','Door gaps','Measure the top door gap',
    'Enter the measured gap in millimetres. ORION accepts 2-4 mm inclusive.',
    'numeric_range','number',2::numeric,4::numeric,'mm',
    '[]','[]','high',true,true,
    'Adjust the door or frame to restore the controlled 2-4 mm gap.',10
  ),
  (
    'FD-GAP-HINGE','Door gaps','Measure the hinge-side door gap',
    'Enter the measured gap in millimetres. ORION accepts 2-4 mm inclusive.',
    'numeric_range','number',2::numeric,4::numeric,'mm',
    '[]','[]','high',true,true,
    'Adjust the door or frame to restore the controlled 2-4 mm gap.',20
  ),
  (
    'FD-GAP-LOCK','Door gaps','Measure the lock-side door gap',
    'Enter the measured gap in millimetres. ORION accepts 2-4 mm inclusive.',
    'numeric_range','number',2::numeric,4::numeric,'mm',
    '[]','[]','high',true,true,
    'Adjust the door or frame to restore the controlled 2-4 mm gap.',30
  ),
  (
    'FD-CLOSER','Operation','Does the door self-close and latch correctly?',
    'Test from an open position and confirm the leaf closes fully into the frame.',
    'choice','choice',null,null,null,
    '["Yes","No"]','["Yes"]','high',true,true,
    'Inspect and adjust or replace the closer/latching hardware.',40
  ),
  (
    'FD-SEALS','Fire and smoke seals','Are the intumescent/smoke seals present and serviceable?',
    'Check for missing, damaged, painted-over or incompatible seals.',
    'choice','choice',null,null,null,
    '["Good","Defective","Missing"]','["Good"]','high',true,true,
    'Replace defective or missing seals with a compatible tested system.',50
  ),
  (
    'FD-HINGES','Hardware','Are hinges secure and serviceable?',
    'Check fixings, excessive wear, damage and obvious movement.',
    'choice','choice',null,null,null,
    '["Secure","Defective"]','["Secure"]','medium',true,true,
    'Repair fixings or replace defective hinges with suitable fire-door hardware.',60
  ),
  (
    'FD-DAMAGE','Leaf and frame','Is the door leaf/frame free from significant damage?',
    'Record impact damage, splits, deformation or unauthorised alterations.',
    'choice','choice',null,null,null,
    '["Yes","No"]','["Yes"]','high',true,true,
    'Undertake a competent repair or replace the affected component where repair is unsuitable.',70
  )
) seed(
  item_code,section_name,prompt,help_text,rule_type,input_type,
  min_value,max_value,unit,choices,pass_values,failure_severity,
  photo_required,notes_required,suggested_action,display_order
)
where t.code = 'FD_STANDARD'
  and t.version = 1
on conflict (template_id, item_code) do update
set section_name = excluded.section_name,
    prompt = excluded.prompt,
    help_text = excluded.help_text,
    rule_type = excluded.rule_type,
    input_type = excluded.input_type,
    min_value = excluded.min_value,
    max_value = excluded.max_value,
    unit = excluded.unit,
    choices = excluded.choices,
    pass_values = excluded.pass_values,
    failure_severity = excluded.failure_severity,
    photo_required_on_fail = excluded.photo_required_on_fail,
    notes_required_on_fail = excluded.notes_required_on_fail,
    suggested_action = excluded.suggested_action,
    display_order = excluded.display_order;

create or replace function public.orion_start_asset_inspection(
  p_company_id uuid,
  p_asset_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_asset_type_code text;
  v_run_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_permission(p_company_id, 'inspection.create')
    or public.has_permission(p_company_id, 'inspection.edit')
  ) then
    raise exception 'You do not have permission to start inspections';
  end if;

  select at.code
    into v_asset_type_code
  from public.assets a
  join public.asset_types at on at.id = a.asset_type_id
  where a.id = p_asset_id
    and a.company_id = p_company_id;

  if v_asset_type_code is null then
    raise exception 'Asset or asset type not found';
  end if;

  select id
    into v_template_id
  from public.orion_inspection_templates
  where company_id = p_company_id
    and asset_type_code = v_asset_type_code
    and status = 'active'
  order by version desc
  limit 1;

  if v_template_id is null then
    raise exception 'No active inspection template is available for this asset type';
  end if;

  insert into public.orion_inspection_runs(
    company_id, asset_id, template_id, inspector_user_id
  )
  values (
    p_company_id, p_asset_id, v_template_id, auth.uid()
  )
  returning id into v_run_id;

  return v_run_id;
end;
$$;

grant execute on function public.orion_start_asset_inspection(uuid, uuid)
to authenticated;

create or replace function public.orion_save_inspection_answer(
  p_inspection_id uuid,
  p_item_id uuid,
  p_response_text text default null,
  p_response_number numeric default null,
  p_engineer_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_asset_id uuid;
  v_item public.orion_inspection_template_items%rowtype;
  v_result text := 'pass';
  v_reason text;
  v_answer_id uuid;
  v_defect_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select company_id, asset_id
    into v_company_id, v_asset_id
  from public.orion_inspection_runs
  where id = p_inspection_id
    and status = 'in_progress';

  if v_company_id is null then
    raise exception 'Active inspection not found';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_permission(v_company_id, 'inspection.create')
    or public.has_permission(v_company_id, 'inspection.edit')
  ) then
    raise exception 'You do not have permission to record inspection responses';
  end if;

  select *
    into v_item
  from public.orion_inspection_template_items
  where id = p_item_id
    and template_id = (
      select template_id
      from public.orion_inspection_runs
      where id = p_inspection_id
    );

  if v_item.id is null then
    raise exception 'Inspection item not found';
  end if;

  if v_item.rule_type = 'numeric_range' then
    if p_response_number is null then
      raise exception 'A measurement is required';
    end if;

    if p_response_number < v_item.min_value
       or p_response_number > v_item.max_value then
      v_result := 'fail';
      v_reason := format(
        'Measured %s %s. Required range is %s-%s %s.',
        p_response_number, coalesce(v_item.unit,''),
        v_item.min_value, v_item.max_value, coalesce(v_item.unit,'')
      );
    end if;

  elsif v_item.rule_type = 'choice' then
    if coalesce(trim(p_response_text),'') = '' then
      raise exception 'A response is required';
    end if;

    if not (v_item.pass_values ? p_response_text) then
      v_result := 'fail';
      v_reason := format(
        'Recorded response "%s" does not meet the configured pass criterion.',
        p_response_text
      );
    end if;

  else
    if coalesce(trim(p_response_text),'') = '' then
      raise exception 'A response is required';
    end if;
  end if;

  if v_result = 'fail'
     and v_item.notes_required_on_fail
     and coalesce(trim(p_engineer_notes),'') = '' then
    raise exception 'Engineer notes are required for this failed item';
  end if;

  insert into public.orion_inspection_answers(
    company_id, inspection_id, item_id,
    response_text, response_number, result,
    failure_reason, engineer_notes
  )
  values(
    v_company_id, p_inspection_id, p_item_id,
    nullif(trim(p_response_text),''),
    p_response_number,
    v_result,
    v_reason,
    nullif(trim(p_engineer_notes),'')
  )
  on conflict (inspection_id, item_id) do update
  set response_text = excluded.response_text,
      response_number = excluded.response_number,
      result = excluded.result,
      failure_reason = excluded.failure_reason,
      engineer_notes = excluded.engineer_notes,
      updated_at = now()
  returning id into v_answer_id;

  if v_result = 'fail' then
    insert into public.orion_inspection_defects(
      company_id, asset_id, inspection_id, answer_id,
      defect_code, title, description, severity,
      suggested_action, created_by
    )
    values(
      v_company_id,
      v_asset_id,
      p_inspection_id,
      v_answer_id,
      'DEF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
      v_item.prompt,
      coalesce(v_reason,'Inspection item failed.')
        || case
             when coalesce(trim(p_engineer_notes),'') <> ''
             then ' Engineer notes: ' || trim(p_engineer_notes)
             else ''
           end,
      v_item.failure_severity,
      v_item.suggested_action,
      auth.uid()
    )
    on conflict (answer_id) do update
    set title = excluded.title,
        description = excluded.description,
        severity = excluded.severity,
        suggested_action = excluded.suggested_action,
        updated_at = now()
    returning id into v_defect_id;
  else
    delete from public.orion_inspection_defects
    where answer_id = v_answer_id
      and status = 'open';
  end if;

  return jsonb_build_object(
    'answer_id', v_answer_id,
    'result', v_result,
    'failure_reason', v_reason,
    'defect_id', v_defect_id,
    'photo_required_on_fail', v_item.photo_required_on_fail
  );
end;
$$;

grant execute on function public.orion_save_inspection_answer(
  uuid, uuid, text, numeric, text
) to authenticated;

create or replace function public.orion_submit_inspection(
  p_inspection_id uuid,
  p_engineer_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_template_id uuid;
  v_required integer;
  v_answered integer;
  v_missing_evidence integer;
  v_fail_count integer;
  v_outcome text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select company_id, template_id
    into v_company_id, v_template_id
  from public.orion_inspection_runs
  where id = p_inspection_id
    and status = 'in_progress';

  if v_company_id is null then
    raise exception 'Active inspection not found';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_permission(v_company_id, 'inspection.create')
    or public.has_permission(v_company_id, 'inspection.edit')
  ) then
    raise exception 'You do not have permission to submit inspections';
  end if;

  select count(*) into v_required
  from public.orion_inspection_template_items
  where template_id = v_template_id;

  select count(*) into v_answered
  from public.orion_inspection_answers
  where inspection_id = p_inspection_id;

  if v_answered < v_required then
    raise exception 'All inspection items must be completed before submission';
  end if;

  select count(*) into v_missing_evidence
  from public.orion_inspection_answers a
  join public.orion_inspection_template_items i on i.id = a.item_id
  where a.inspection_id = p_inspection_id
    and a.result = 'fail'
    and i.photo_required_on_fail = true
    and not exists (
      select 1
      from public.orion_inspection_evidence e
      where e.answer_id = a.id
    );

  if v_missing_evidence > 0 then
    raise exception 'Photographic evidence is required for % failed item(s)', v_missing_evidence;
  end if;

  select count(*) into v_fail_count
  from public.orion_inspection_answers
  where inspection_id = p_inspection_id
    and result = 'fail';

  v_outcome := case when v_fail_count > 0 then 'fail' else 'pass' end;

  update public.orion_inspection_runs
  set status = 'submitted',
      outcome = v_outcome,
      submitted_at = clock_timestamp(),
      engineer_notes = nullif(trim(p_engineer_notes),''),
      updated_at = now()
  where id = p_inspection_id;

  return jsonb_build_object(
    'inspection_id', p_inspection_id,
    'outcome', v_outcome,
    'failed_items', v_fail_count
  );
end;
$$;

grant execute on function public.orion_submit_inspection(uuid, text)
to authenticated;

-- Optional integration into ORION's central audit trail if the table exists.
do $$
begin
  if to_regclass('public.audit_log') is not null then
    -- Existing ORION audit mechanisms continue to record controlled database changes.
    null;
  end if;
end $$;
-- Supabase Storage policies for the private `inspection-evidence` bucket.
-- The bucket itself is created once in the Supabase Storage dashboard.
-- These policies restrict objects to authenticated members of the company
-- encoded as the first folder segment in the generated object path.

drop policy if exists orion_inspection_evidence_storage_select on storage.objects;
create policy orion_inspection_evidence_storage_select
on storage.objects
for select
to authenticated
using (
  case
    when bucket_id = 'inspection-evidence'
      and array_length(storage.foldername(name), 1) >= 1
    then public.is_company_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists orion_inspection_evidence_storage_insert on storage.objects;
create policy orion_inspection_evidence_storage_insert
on storage.objects
for insert
to authenticated
with check (
  case
    when bucket_id = 'inspection-evidence'
      and array_length(storage.foldername(name), 1) >= 1
    then public.is_company_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists orion_inspection_evidence_storage_update on storage.objects;
create policy orion_inspection_evidence_storage_update
on storage.objects
for update
to authenticated
using (
  case
    when bucket_id = 'inspection-evidence'
      and array_length(storage.foldername(name), 1) >= 1
    then public.is_company_member(((storage.foldername(name))[1])::uuid)
    else false
  end
)
with check (
  case
    when bucket_id = 'inspection-evidence'
      and array_length(storage.foldername(name), 1) >= 1
    then public.is_company_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists orion_inspection_evidence_storage_delete on storage.objects;
create policy orion_inspection_evidence_storage_delete
on storage.objects
for delete
to authenticated
using (
  case
    when bucket_id = 'inspection-evidence'
      and array_length(storage.foldername(name), 1) >= 1
    then public.is_company_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);
