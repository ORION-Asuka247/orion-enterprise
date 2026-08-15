-- ORION Enterprise v1.0
-- Update 022: Require persisted inspection sign-off notes
--
-- Prevent an inspection from being submitted if the final engineer sign-off note
-- is missing. This converts silent loss of final notes into an explicit validation
-- failure and guarantees every submitted guided inspection retains its sign-off.

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
  v_signoff_notes text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_signoff_notes := nullif(trim(p_engineer_notes), '');
  if v_signoff_notes is null then
    raise exception 'Final inspection notes are required before submission';
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
      engineer_notes = v_signoff_notes,
      updated_at = now()
  where id = p_inspection_id;

  return jsonb_build_object(
    'inspection_id', p_inspection_id,
    'outcome', v_outcome,
    'failed_items', v_fail_count
  );
end;
$$;

revoke execute on function public.orion_submit_inspection(uuid, text)
from public, anon;
grant execute on function public.orion_submit_inspection(uuid, text)
to authenticated;
