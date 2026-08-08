-- ORION Enterprise v1.0 Implementation
-- Update 016: Controlled Reports & Document Versioning

create table if not exists public.orion_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inspection_id uuid not null references public.orion_inspection_runs(id) on delete restrict,
  document_number text not null,
  report_type text not null default 'inspection_report' check (report_type in ('inspection_report','fraew_report','certificate')),
  title text not null,
  status text not null default 'generated' check (status in ('draft','generated','issued','superseded','withdrawn')),
  current_version integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  unique(company_id, document_number),
  unique(inspection_id, report_type)
);

create table if not exists public.orion_report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.orion_reports(id) on delete cascade,
  version_no integer not null,
  source_snapshot jsonb not null,
  generated_by uuid not null references auth.users(id) on delete restrict,
  generated_at timestamptz not null default clock_timestamp(),
  notes text,
  unique(report_id, version_no)
);

create index if not exists orion_reports_company_idx on public.orion_reports(company_id, created_at desc);
create index if not exists orion_report_versions_report_idx on public.orion_report_versions(report_id, version_no desc);

alter table public.orion_reports enable row level security;
alter table public.orion_report_versions enable row level security;

drop policy if exists orion_reports_select on public.orion_reports;
create policy orion_reports_select on public.orion_reports for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists orion_reports_write on public.orion_reports;
create policy orion_reports_write on public.orion_reports for all to authenticated
using (public.is_platform_admin() or public.has_permission(company_id,'report.generate'))
with check (public.is_platform_admin() or public.has_permission(company_id,'report.generate'));

drop policy if exists orion_report_versions_select on public.orion_report_versions;
create policy orion_report_versions_select on public.orion_report_versions for select to authenticated
using (exists (select 1 from public.orion_reports r where r.id=report_id and public.is_company_member(r.company_id)));

drop policy if exists orion_report_versions_write on public.orion_report_versions;
create policy orion_report_versions_write on public.orion_report_versions for all to authenticated
using (exists (select 1 from public.orion_reports r where r.id=report_id and (public.is_platform_admin() or public.has_permission(r.company_id,'report.generate'))))
with check (exists (select 1 from public.orion_reports r where r.id=report_id and (public.is_platform_admin() or public.has_permission(r.company_id,'report.generate'))));

create sequence if not exists public.orion_report_number_seq start 1;

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
    'evidence',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'answer_id',e.answer_id,'file_name',e.file_name,'mime_type',e.mime_type,'captured_at',e.captured_at) order by e.captured_at) from public.orion_inspection_evidence e where e.inspection_id=r.id),'[]'::jsonb)
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

create or replace function public.orion_generate_report(p_inspection_id uuid,p_report_type text default 'inspection_report',p_notes text default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_run public.orion_inspection_runs%rowtype; v_report_id uuid; v_version integer; v_snapshot jsonb; v_doc_no text; v_asset_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_run from public.orion_inspection_runs where id=p_inspection_id;
  if not found then raise exception 'Inspection not found'; end if;
  if v_run.status <> 'submitted' then raise exception 'Only submitted inspections can be reported'; end if;
  if not (public.is_platform_admin() or public.has_permission(v_run.company_id,'report.generate')) then raise exception 'You do not have permission to generate reports'; end if;
  if p_report_type not in ('inspection_report','fraew_report','certificate') then raise exception 'Unsupported report type'; end if;
  v_snapshot:=public.orion_build_report_snapshot(p_inspection_id);
  select asset_code into v_asset_code from public.assets where id=v_run.asset_id;
  select id,current_version into v_report_id,v_version from public.orion_reports where inspection_id=p_inspection_id and report_type=p_report_type for update;
  if v_report_id is null then
    v_doc_no:=case p_report_type when 'fraew_report' then 'FR' when 'certificate' then 'CERT' else 'IR' end||'-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.orion_report_number_seq')::text,5,'0');
    insert into public.orion_reports(company_id,inspection_id,document_number,report_type,title,current_version,created_by)
    values(v_run.company_id,p_inspection_id,v_doc_no,p_report_type,case p_report_type when 'fraew_report' then 'FRAEW Assessment - ' when 'certificate' then 'Inspection Certificate - ' else 'Inspection Report - ' end||coalesce(v_asset_code,'Asset'),1,auth.uid())
    returning id into v_report_id;
    v_version:=1;
  else
    v_version:=v_version+1;
    update public.orion_reports set current_version=v_version,status='generated',updated_at=now() where id=v_report_id;
  end if;
  insert into public.orion_report_versions(report_id,version_no,source_snapshot,generated_by,notes)
  values(v_report_id,v_version,v_snapshot,auth.uid(),nullif(trim(p_notes),''));
  return v_report_id;
end; $$;
revoke all on function public.orion_generate_report(uuid,text,text) from public, anon;
grant execute on function public.orion_generate_report(uuid,text,text) to authenticated;

create or replace function public.orion_issue_report(p_report_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_company uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select company_id into v_company from public.orion_reports where id=p_report_id;
  if v_company is null then raise exception 'Report not found'; end if;
  if not (public.is_platform_admin() or public.has_permission(v_company,'report.generate')) then raise exception 'Not authorised'; end if;
  update public.orion_reports set status='issued',issued_at=clock_timestamp(),updated_at=now() where id=p_report_id;
end; $$;
revoke all on function public.orion_issue_report(uuid) from public, anon;
grant execute on function public.orion_issue_report(uuid) to authenticated;
