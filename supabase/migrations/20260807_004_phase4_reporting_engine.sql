-- ORION Enterprise Phase 4
-- Reporting & Document Engine
-- Requires Phases 1-3.

create extension if not exists pgcrypto;

do $$ begin
  create type public.document_type as enum (
    'inspection_report',
    'fraew_report',
    'certificate',
    'management_summary',
    'quotation',
    'work_order',
    'completion_report'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_status as enum (
    'draft',
    'generated',
    'issued',
    'superseded',
    'withdrawn'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.generation_status as enum (
    'queued',
    'processing',
    'completed',
    'failed'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- REPORT TEMPLATES
-- ============================================================

create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  document_type public.document_type not null,
  description text,
  is_system boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create index if not exists idx_report_templates_company on public.report_templates(company_id);
create index if not exists idx_report_templates_type on public.report_templates(document_type);

drop trigger if exists trg_report_templates_updated_at on public.report_templates;
create trigger trg_report_templates_updated_at
before update on public.report_templates
for each row execute function public.set_updated_at();

create table if not exists public.report_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_templates(id) on delete cascade,
  version_no integer not null,
  status public.template_status not null default 'draft',
  schema_json jsonb not null default '{}'::jsonb,
  branding_json jsonb not null default '{}'::jsonb,
  change_summary text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(template_id, version_no)
);

create index if not exists idx_report_template_versions_template
on public.report_template_versions(template_id);

-- ============================================================
-- DOCUMENT REGISTER
-- One logical document may have multiple immutable versions.
-- ============================================================

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  inspection_id uuid references public.inspections(id) on delete set null,
  document_type public.document_type not null,
  document_number text not null,
  title text not null,
  status public.document_status not null default 'draft',
  current_version_no integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, document_number)
);

create index if not exists idx_documents_company on public.documents(company_id);
create index if not exists idx_documents_property on public.documents(property_id);
create index if not exists idx_documents_asset on public.documents(asset_id);
create index if not exists idx_documents_inspection on public.documents(inspection_id);
create index if not exists idx_documents_type on public.documents(document_type);

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_no integer not null,
  report_template_version_id uuid references public.report_template_versions(id) on delete restrict,
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  file_size_bytes bigint,
  sha256 text not null,
  source_snapshot jsonb not null,
  generated_by uuid references auth.users(id),
  generated_at timestamptz not null default now(),
  issued_by uuid references auth.users(id),
  issued_at timestamptz,
  supersedes_version_id uuid references public.document_versions(id),
  notes text,
  unique(document_id, version_no)
);

create index if not exists idx_document_versions_document
on public.document_versions(document_id, version_no desc);

create unique index if not exists uq_document_version_hash
on public.document_versions(document_id, sha256);

-- ============================================================
-- GENERATION JOBS
-- ============================================================

create table if not exists public.report_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  inspection_id uuid references public.inspections(id) on delete set null,
  requested_type public.document_type not null,
  report_template_version_id uuid references public.report_template_versions(id),
  status public.generation_status not null default 'queued',
  requested_by uuid references auth.users(id),
  request_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_report_jobs_company_status
on public.report_generation_jobs(company_id, status, created_at);

-- ============================================================
-- MANAGEMENT SUMMARY SNAPSHOTS
-- ============================================================

create table if not exists public.management_summary_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- NUMBERING
-- ============================================================

create table if not exists public.document_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type public.document_type not null,
  year integer not null,
  last_number integer not null default 0,
  primary key(company_id, document_type, year)
);

create or replace function public.next_document_number(
  p_company_id uuid,
  p_document_type public.document_type
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from current_date)::integer;
  v_next integer;
  v_prefix text;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Not authorised';
  end if;

  insert into public.document_sequences(company_id, document_type, year, last_number)
  values(p_company_id, p_document_type, v_year, 1)
  on conflict(company_id, document_type, year)
  do update set last_number = public.document_sequences.last_number + 1
  returning last_number into v_next;

  v_prefix := case p_document_type
    when 'inspection_report' then 'IR'
    when 'fraew_report' then 'FR'
    when 'certificate' then 'CERT'
    when 'management_summary' then 'MS'
    when 'quotation' then 'Q'
    when 'work_order' then 'WO'
    when 'completion_report' then 'CR'
  end;

  return v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 5, '0');
end;
$$;

-- ============================================================
-- REPORT SOURCE SNAPSHOT
-- Freezes the inspection/report source data before PDF creation.
-- ============================================================

create or replace function public.build_inspection_report_snapshot(
  p_inspection_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_snapshot jsonb;
begin
  select company_id into v_company
  from public.inspections
  where id = p_inspection_id;

  if v_company is null then
    raise exception 'Inspection not found';
  end if;

  if not public.is_company_member(v_company) then
    raise exception 'Not authorised';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'inspection', jsonb_build_object(
      'id', i.id,
      'status', i.status,
      'outcome', i.outcome,
      'started_at', i.started_at,
      'submitted_at', i.submitted_at,
      'notes', i.notes,
      'rule_snapshot', i.rule_snapshot
    ),
    'property', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'reference_code', p.reference_code,
      'address_line1', p.address_line1,
      'address_line2', p.address_line2,
      'town_city', p.town_city,
      'county', p.county,
      'postcode', p.postcode
    ),
    'asset', jsonb_build_object(
      'id', a.id,
      'asset_code', a.asset_code,
      'name', a.name,
      'manufacturer', a.manufacturer,
      'model', a.model,
      'serial_number', a.serial_number,
      'status', a.status,
      'block', b.name,
      'floor', f.name,
      'area', ar.name
    ),
    'template', jsonb_build_object(
      'template_id', t.id,
      'template_code', t.code,
      'template_name', t.name,
      'template_version_id', tv.id,
      'template_version_no', tv.version_no
    ),
    'answers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'section_code', s.code,
          'section_title', s.title,
          'question_id', q.id,
          'question_code', q.code,
          'prompt', q.prompt,
          'question_type', q.question_type,
          'unit', q.unit,
          'answer', ans.answer,
          'outcome', ans.outcome,
          'evaluation_detail', ans.evaluation_detail
        )
        order by s.sort_order, q.sort_order
      )
      from public.inspection_sections s
      join public.inspection_questions q on q.section_id = s.id
      left join public.inspection_answers ans
        on ans.question_id = q.id and ans.inspection_id = i.id
      where s.template_version_id = i.template_version_id
    ), '[]'::jsonb),
    'defects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'reference_code', d.reference_code,
          'title', d.title,
          'description', d.description,
          'severity', d.severity,
          'status', d.status,
          'recommended_action', d.recommended_action,
          'target_date', d.target_date
        )
        order by d.created_at
      )
      from public.defects d
      where d.inspection_id = i.id
    ), '[]'::jsonb),
    'evidence', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'question_id', e.question_id,
          'evidence_type', e.evidence_type,
          'storage_path', e.storage_path,
          'original_filename', e.original_filename,
          'captured_at', e.captured_at,
          'metadata', e.metadata
        )
        order by e.created_at
      )
      from public.inspection_evidence e
      where e.inspection_id = i.id
    ), '[]'::jsonb)
  )
  into v_snapshot
  from public.inspections i
  join public.properties p on p.id = i.property_id
  join public.assets a on a.id = i.asset_id
  left join public.blocks b on b.id = a.block_id
  left join public.floors f on f.id = a.floor_id
  left join public.areas ar on ar.id = a.area_id
  join public.inspection_templates t on t.id = i.template_id
  join public.inspection_template_versions tv on tv.id = i.template_version_id
  where i.id = p_inspection_id;

  return v_snapshot;
end;
$$;

-- ============================================================
-- DOCUMENT VERSION REGISTRATION
-- The binary is uploaded first; then its immutable metadata is recorded.
-- ============================================================

create or replace function public.register_document_version(
  p_document_id uuid,
  p_template_version_id uuid,
  p_storage_path text,
  p_file_size bigint,
  p_sha256 text,
  p_source_snapshot jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.documents%rowtype;
  v_next integer;
  v_prev uuid;
  v_id uuid;
begin
  select * into d from public.documents where id = p_document_id;
  if not found then raise exception 'Document not found'; end if;

  if not public.has_permission(d.company_id, 'report.generate') then
    raise exception 'Not authorised';
  end if;

  select id into v_prev
  from public.document_versions
  where document_id = p_document_id
  order by version_no desc
  limit 1;

  v_next := d.current_version_no + 1;

  insert into public.document_versions(
    document_id,
    version_no,
    report_template_version_id,
    storage_path,
    file_size_bytes,
    sha256,
    source_snapshot,
    generated_by,
    supersedes_version_id,
    notes
  )
  values(
    p_document_id,
    v_next,
    p_template_version_id,
    p_storage_path,
    p_file_size,
    p_sha256,
    p_source_snapshot,
    auth.uid(),
    v_prev,
    p_notes
  )
  returning id into v_id;

  update public.documents
  set
    current_version_no = v_next,
    status = 'generated'
  where id = p_document_id;

  return v_id;
end;
$$;

-- ============================================================
-- STORAGE
-- ============================================================

insert into storage.buckets(id, name, public)
values ('generated-documents', 'generated-documents', false)
on conflict(id) do update set public = false;

drop policy if exists "generated documents select" on storage.objects;
create policy "generated documents select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'generated-documents'
  and public.is_company_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "generated documents insert" on storage.objects;
create policy "generated documents insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'generated-documents'
  and public.has_permission((storage.foldername(name))[1]::uuid, 'report.generate')
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.report_templates enable row level security;
alter table public.report_template_versions enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.report_generation_jobs enable row level security;
alter table public.management_summary_snapshots enable row level security;
alter table public.document_sequences enable row level security;

drop policy if exists "report_templates_select" on public.report_templates;
create policy "report_templates_select"
on public.report_templates for select
using (company_id is null or public.is_company_member(company_id));

drop policy if exists "report_template_versions_select" on public.report_template_versions;
create policy "report_template_versions_select"
on public.report_template_versions for select
using (
  exists (
    select 1 from public.report_templates rt
    where rt.id = template_id
      and (rt.company_id is null or public.is_company_member(rt.company_id))
  )
);

drop policy if exists "documents_select" on public.documents;
create policy "documents_select"
on public.documents for select
using (public.is_company_member(company_id));

drop policy if exists "documents_insert" on public.documents;
create policy "documents_insert"
on public.documents for insert
with check (public.has_permission(company_id, 'report.generate'));

drop policy if exists "documents_update" on public.documents;
create policy "documents_update"
on public.documents for update
using (public.has_permission(company_id, 'report.generate'))
with check (public.has_permission(company_id, 'report.generate'));

drop policy if exists "document_versions_select" on public.document_versions;
create policy "document_versions_select"
on public.document_versions for select
using (
  exists (
    select 1 from public.documents d
    where d.id = document_id
      and public.is_company_member(d.company_id)
  )
);

drop policy if exists "report_jobs_select" on public.report_generation_jobs;
create policy "report_jobs_select"
on public.report_generation_jobs for select
using (public.is_company_member(company_id));

drop policy if exists "report_jobs_insert" on public.report_generation_jobs;
create policy "report_jobs_insert"
on public.report_generation_jobs for insert
with check (public.has_permission(company_id, 'report.generate'));

drop policy if exists "summary_snapshots_select" on public.management_summary_snapshots;
create policy "summary_snapshots_select"
on public.management_summary_snapshots for select
using (public.is_company_member(company_id));

-- ============================================================
-- AUDIT
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'report_templates',
    'report_template_versions',
    'documents',
    'document_versions',
    'report_generation_jobs',
    'management_summary_snapshots'
  ]
  loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t, t
    );
  end loop;
end $$;
