-- ORION Job Completion & Evidence. Internal authenticated pilot workflow.
-- No public storage, guest links or automatic job completion are introduced.
alter table public.orion_inspection_defects add column completion_cycle integer not null default 1;
create table public.orion_completion_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  defect_id uuid not null references public.orion_inspection_defects(id),
  asset_id uuid not null references public.assets(id),
  completion_cycle integer not null,
  notes text not null check (length(trim(notes)) between 10 and 4000),
  wide_path text not null,
  detail_path text not null check (detail_path <> wide_path),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default clock_timestamp(),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  check ((status='pending' and reviewed_by is null and reviewed_at is null)
    or (status<>'pending' and reviewed_by is not null and reviewed_at is not null))
);
create index orion_completion_defect_idx on public.orion_completion_submissions(defect_id,submitted_at desc);
alter table public.orion_completion_submissions enable row level security;
revoke all on public.orion_completion_submissions from public,anon,authenticated;
grant select on public.orion_completion_submissions to authenticated;
create policy completion_read on public.orion_completion_submissions for select to authenticated
using (public.is_company_member(company_id) and public.has_permission(company_id,'defect.view'));

-- Separate private bucket; permissions follow the existing defect-management roles.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('completion-evidence','completion-evidence',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy completion_object_insert on storage.objects for insert to authenticated
with check (bucket_id='completion-evidence' and public.has_permission(((storage.foldername(name))[1])::uuid,'defect.manage')
  and (storage.foldername(name))[2]=auth.uid()::text);
create policy completion_object_read on storage.objects for select to authenticated
using (bucket_id='completion-evidence' and public.is_company_member(((storage.foldername(name))[1])::uuid)
  and public.has_permission(((storage.foldername(name))[1])::uuid,'defect.view'));

create or replace function public.orion_submit_completion(p_defect_id uuid,p_notes text,p_wide_path text,p_detail_path text)
returns uuid language plpgsql security definer set search_path=public as $$
declare d public.orion_inspection_defects%rowtype; v_id uuid; p text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into d from public.orion_inspection_defects where id=p_defect_id for update;
  if not found or not public.has_permission(d.company_id,'defect.manage') then raise exception 'Not authorised'; end if;
  if d.status in ('cancelled','closed') then raise exception 'This work is not open for evidence submissions'; end if;
  if length(trim(coalesce(p_notes,''))) not between 10 and 4000 then raise exception 'Enter completion notes (10–4000 characters)'; end if;
  if p_wide_path is null or p_detail_path is null or p_wide_path=p_detail_path then raise exception 'A wide and a separate detail photograph are required'; end if;
  foreach p in array array[p_wide_path,p_detail_path] loop
    if split_part(p,'/',1)<>d.company_id::text or split_part(p,'/',2)<>auth.uid()::text
      or split_part(p,'/',3)<>d.id::text or not exists (
      select 1 from storage.objects o where o.bucket_id='completion-evidence' and o.name=p
      and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
      and (o.metadata->>'size')::bigint between 1 and 10485760
    ) then raise exception 'Valid uploaded completion photographs are required'; end if;
  end loop;
  insert into public.orion_completion_submissions(company_id,defect_id,asset_id,completion_cycle,notes,wide_path,detail_path,submitted_by)
  values(d.company_id,d.id,d.asset_id,d.completion_cycle,trim(p_notes),p_wide_path,p_detail_path,auth.uid()) returning id into v_id;
  insert into public.audit_log(company_id,actor_user_id,action,entity_table,entity_id,reason)
  values(d.company_id,auth.uid(),'completion.submitted','orion_completion_submissions',v_id::text,'Evidence awaiting review');
  return v_id;
end; $$;
revoke all on function public.orion_submit_completion(uuid,text,text,text) from public,anon;
grant execute on function public.orion_submit_completion(uuid,text,text,text) to authenticated;

create or replace function public.orion_review_completion(p_submission_id uuid,p_accept boolean,p_notes text)
returns void language plpgsql security definer set search_path=public as $$
declare s public.orion_completion_submissions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into s from public.orion_completion_submissions where id=p_submission_id for update;
  if not found or not public.has_permission(s.company_id,'inspection.approve') then raise exception 'Reviewer permission required'; end if;
  if s.completion_cycle<>(select completion_cycle from public.orion_inspection_defects where id=s.defect_id) then raise exception 'Work has reopened; submit fresh completion evidence'; end if;
  if s.status<>'pending' then raise exception 'Submission has already been reviewed'; end if;
  if s.submitted_by=auth.uid() then raise exception 'A different authorised person must review completion evidence'; end if;
  if p_accept is null or length(trim(coalesce(p_notes,''))) not between 10 and 4000 then raise exception 'Enter a review decision and notes (10–4000 characters)'; end if;
  update public.orion_completion_submissions set status=case when p_accept then 'accepted' else 'rejected' end,
    reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_notes=trim(p_notes) where id=s.id;
  insert into public.audit_log(company_id,actor_user_id,action,entity_table,entity_id,reason)
  values(s.company_id,auth.uid(),case when p_accept then 'completion.accepted' else 'completion.rejected' end,
    'orion_completion_submissions',s.id::text,trim(p_notes));
  -- Review never changes defect status or creates/dispatches an invoice/report.
end; $$;
revoke all on function public.orion_review_completion(uuid,boolean,text) from public,anon;
grant execute on function public.orion_review_completion(uuid,boolean,text) to authenticated;

-- Apply to every write path, including direct table writes, not only the UI.
create or replace function public.orion_guard_completion_status()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  new.completion_cycle:=old.completion_cycle;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null and not exists (
    select 1 from public.company_memberships m where m.company_id=new.company_id and m.user_id=new.assigned_to and m.status='active'
  ) then raise exception 'Assigned engineer must be an active member of this company'; end if;
  if new.status is distinct from old.status and not (
    (old.status='open' and new.status in ('assigned','in_progress','cancelled')) or
    (old.status='assigned' and new.status in ('open','in_progress','cancelled')) or
    (old.status='in_progress' and new.status in ('assigned','resolved','cancelled')) or
    (old.status='resolved' and new.status in ('in_progress','verified')) or
    (old.status='verified' and new.status in ('in_progress','closed')) or
    (old.status='closed' and new.status='in_progress') or
    (old.status='cancelled' and new.status='open')
  ) then raise exception 'Invalid defect status transition'; end if;
  if new.status='in_progress' and old.status in ('resolved','verified','closed') or new.status='open' and old.status='cancelled' then
    new.completion_cycle:=old.completion_cycle+1;
  end if;
  if new.status is distinct from old.status and new.status in ('resolved','verified','closed') then
    if coalesce((select s.status from public.orion_completion_submissions s where s.defect_id=new.id and s.completion_cycle=new.completion_cycle order by s.submitted_at desc,s.id desc limit 1),'missing')<>'accepted' then
      raise exception 'Reviewed and accepted completion evidence is required before resolving or closing work';
    end if;
    if new.status in ('verified','closed') and not public.has_permission(new.company_id,'inspection.approve') then
      raise exception 'Reviewer permission required to verify or close work';
    end if;
    if coalesce(nullif(trim(new.resolution_notes),''),nullif(trim(new.remedial_notes),'')) is null then
      raise exception 'Completion notes are required';
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.orion_guard_completion_status() from public,anon,authenticated;
create trigger orion_completion_status_guard before update on public.orion_inspection_defects
for each row execute function public.orion_guard_completion_status();

-- Freeze accepted evidence and its storage references into new report versions.
create or replace function public.orion_build_report_snapshot(p_inspection_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare v_company uuid; v_snapshot jsonb;
begin
  select company_id into v_company from public.orion_inspection_runs where id=p_inspection_id;
  if v_company is null then raise exception 'Inspection not found'; end if;
  if not public.is_company_member(v_company) then raise exception 'Not authorised'; end if;
  select jsonb_build_object(
    'generated_at',clock_timestamp(),
    'inspection',jsonb_build_object('id',r.id,'status',r.status,'outcome',r.outcome,'started_at',r.started_at,'submitted_at',r.submitted_at,'engineer_notes',r.engineer_notes),
    'property',jsonb_build_object('id',p.id,'name',p.name,'reference_code',p.reference_code,'address_line1',p.address_line1,'address_line2',p.address_line2,'town_city',p.town_city,'county',p.county,'postcode',p.postcode),
    'asset',jsonb_build_object('id',a.id,'asset_code',a.asset_code,'name',a.name,'manufacturer',a.manufacturer,'model',a.model,'serial_number',a.serial_number,'status',a.status,'condition',a.condition,'block',b.name,'floor',f.name,'area',ar.name),
    'template',jsonb_build_object('code',t.code,'name',t.name,'version',t.version,'asset_type_code',t.asset_type_code),
    'answers',coalesce((select jsonb_agg(jsonb_build_object('item_code',i.item_code,'section_name',i.section_name,'prompt',i.prompt,'response_text',ans.response_text,'response_number',ans.response_number,'unit',i.unit,'result',ans.result,'failure_reason',ans.failure_reason,'engineer_notes',ans.engineer_notes,'suggested_action',i.suggested_action) order by i.display_order) from public.orion_inspection_template_items i left join public.orion_inspection_answers ans on ans.item_id=i.id and ans.inspection_id=r.id where i.template_id=r.template_id),'[]'::jsonb),
    'defects',coalesce((select jsonb_agg(jsonb_build_object('defect_code',d.defect_code,'title',d.title,'description',d.description,'severity',d.severity,'status',d.status,'suggested_action',d.suggested_action,'created_at',d.created_at) order by d.created_at) from public.orion_inspection_defects d where d.inspection_id=r.id),'[]'::jsonb),
    'evidence',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'answer_id',e.answer_id,'file_name',e.file_name,'mime_type',e.mime_type,'captured_at',e.captured_at,'storage_bucket',e.storage_bucket,'storage_path',e.storage_path) order by e.captured_at) from public.orion_inspection_evidence e where e.inspection_id=r.id),'[]'::jsonb)
    ,'completions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',cs.id,'defect_code',cd.defect_code,'notes',cs.notes,'review_notes',cs.review_notes,'reviewed_at',cs.reviewed_at,
      'photos',jsonb_build_array(
        jsonb_build_object('storage_bucket','completion-evidence','storage_path',cs.wide_path,'caption','Wide completion view'),
        jsonb_build_object('storage_bucket','completion-evidence','storage_path',cs.detail_path,'caption','Completion detail'))
    ) order by cs.reviewed_at) from public.orion_completion_submissions cs
      join public.orion_inspection_defects cd on cd.id=cs.defect_id
      where cd.inspection_id=r.id and cs.status='accepted'),'[]'::jsonb)
  ) into v_snapshot
  from public.orion_inspection_runs r
  join public.assets a on a.id=r.asset_id
  join public.properties p on p.id=a.property_id
  left join public.blocks b on b.id=a.block_id
  left join public.floors f on f.id=a.floor_id
  left join public.areas ar on ar.id=a.area_id
  join public.orion_inspection_templates t on t.id=r.template_id
  where r.id=p_inspection_id;
  return v_snapshot;
end; $$;
revoke all on function public.orion_build_report_snapshot(uuid) from public, anon;
grant execute on function public.orion_build_report_snapshot(uuid) to authenticated;

