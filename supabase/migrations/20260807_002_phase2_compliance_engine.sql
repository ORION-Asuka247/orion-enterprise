-- ORION Enterprise Phase 2
-- Universal Compliance & Inspection Engine
-- Requires Phase 1 foundation.

create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type public.template_status as enum ('draft','in_review','approved','retired');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.question_type as enum (
    'boolean',
    'single_choice',
    'multi_choice',
    'number',
    'text',
    'date',
    'photo',
    'signature'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.inspection_status as enum (
    'draft',
    'in_progress',
    'submitted',
    'approved',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.inspection_outcome as enum (
    'pass',
    'fail',
    'conditional',
    'not_applicable',
    'pending'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.rule_operator as enum (
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'between',
    'in',
    'not_in',
    'is_true',
    'is_false',
    'required'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.defect_severity as enum ('low','medium','high','critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.defect_status as enum ('open','assigned','in_progress','resolved','verified','closed','cancelled');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- COMPLIANCE DOMAINS / STANDARDS
-- ============================================================

create table if not exists public.compliance_domains (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.standards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  issuer text,
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_standards_updated_at on public.standards;
create trigger trg_standards_updated_at
before update on public.standards
for each row execute function public.set_updated_at();

-- ============================================================
-- TEMPLATES + VERSIONING
-- ============================================================

create table if not exists public.inspection_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  compliance_domain_id uuid references public.compliance_domains(id),
  asset_type_id uuid references public.asset_types(id),
  description text,
  is_system boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create index if not exists idx_inspection_templates_company on public.inspection_templates(company_id);
create index if not exists idx_inspection_templates_asset_type on public.inspection_templates(asset_type_id);

drop trigger if exists trg_inspection_templates_updated_at on public.inspection_templates;
create trigger trg_inspection_templates_updated_at
before update on public.inspection_templates
for each row execute function public.set_updated_at();

create table if not exists public.inspection_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.inspection_templates(id) on delete cascade,
  version_no integer not null,
  status public.template_status not null default 'draft',
  effective_from date,
  effective_to date,
  change_summary text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(template_id, version_no)
);

create index if not exists idx_template_versions_template on public.inspection_template_versions(template_id);
create index if not exists idx_template_versions_status on public.inspection_template_versions(status);

create table if not exists public.inspection_sections (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.inspection_template_versions(id) on delete cascade,
  code text not null,
  title text not null,
  instructions text,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  unique(template_version_id, code)
);

create index if not exists idx_inspection_sections_version on public.inspection_sections(template_version_id);

create table if not exists public.inspection_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.inspection_sections(id) on delete cascade,
  code text not null,
  prompt text not null,
  help_text text,
  question_type public.question_type not null,
  unit text,
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  evidence_required boolean not null default false,
  min_photos integer not null default 0,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique(section_id, code)
);

create index if not exists idx_inspection_questions_section on public.inspection_questions(section_id);

-- ============================================================
-- RULES + SOURCE LINKS
-- ============================================================

create table if not exists public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  compliance_domain_id uuid references public.compliance_domains(id),
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

drop trigger if exists trg_compliance_rules_updated_at on public.compliance_rules;
create trigger trg_compliance_rules_updated_at
before update on public.compliance_rules
for each row execute function public.set_updated_at();

create table if not exists public.compliance_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.compliance_rules(id) on delete cascade,
  version_no integer not null,
  status public.template_status not null default 'draft',
  operator public.rule_operator not null,
  expected_value jsonb,
  min_value numeric,
  max_value numeric,
  unit text,
  failure_outcome public.inspection_outcome not null default 'fail',
  severity public.defect_severity not null default 'medium',
  failure_message text,
  effective_from date,
  effective_to date,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(rule_id, version_no)
);

create index if not exists idx_rule_versions_rule on public.compliance_rule_versions(rule_id);
create index if not exists idx_rule_versions_status on public.compliance_rule_versions(status);

create table if not exists public.rule_standard_links (
  rule_version_id uuid not null references public.compliance_rule_versions(id) on delete cascade,
  standard_id uuid not null references public.standards(id) on delete cascade,
  clause_reference text,
  notes text,
  primary key (rule_version_id, standard_id, clause_reference)
);

create table if not exists public.question_rules (
  question_id uuid not null references public.inspection_questions(id) on delete cascade,
  rule_version_id uuid not null references public.compliance_rule_versions(id) on delete restrict,
  evaluation_order integer not null default 0,
  stop_on_match boolean not null default false,
  primary key (question_id, rule_version_id)
);

-- ============================================================
-- INSPECTIONS
-- ============================================================

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  template_id uuid not null references public.inspection_templates(id) on delete restrict,
  template_version_id uuid not null references public.inspection_template_versions(id) on delete restrict,
  status public.inspection_status not null default 'draft',
  outcome public.inspection_outcome not null default 'pending',
  scheduled_for timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  inspector_user_id uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  notes text,
  rule_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inspections_company on public.inspections(company_id);
create index if not exists idx_inspections_property on public.inspections(property_id);
create index if not exists idx_inspections_asset on public.inspections(asset_id);
create index if not exists idx_inspections_status on public.inspections(status);
create index if not exists idx_inspections_inspector on public.inspections(inspector_user_id);

drop trigger if exists trg_inspections_updated_at on public.inspections;
create trigger trg_inspections_updated_at
before update on public.inspections
for each row execute function public.set_updated_at();

create table if not exists public.inspection_answers (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  question_id uuid not null references public.inspection_questions(id) on delete restrict,
  answer jsonb,
  outcome public.inspection_outcome not null default 'pending',
  evaluated_rule_version_id uuid references public.compliance_rule_versions(id) on delete restrict,
  evaluation_detail jsonb not null default '{}'::jsonb,
  answered_by uuid references auth.users(id),
  answered_at timestamptz not null default now(),
  unique(inspection_id, question_id)
);

create index if not exists idx_answers_inspection on public.inspection_answers(inspection_id);
create index if not exists idx_answers_question on public.inspection_answers(question_id);

create table if not exists public.inspection_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  question_id uuid references public.inspection_questions(id) on delete set null,
  evidence_type text not null check (evidence_type in ('photo','video','document','signature','measurement','voice_note')),
  storage_path text,
  original_filename text,
  mime_type text,
  captured_at timestamptz,
  captured_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_inspection_evidence_inspection on public.inspection_evidence(inspection_id);
create index if not exists idx_inspection_evidence_question on public.inspection_evidence(question_id);

-- ============================================================
-- DEFECTS
-- ============================================================

create table if not exists public.defects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  inspection_id uuid references public.inspections(id) on delete set null,
  inspection_answer_id uuid references public.inspection_answers(id) on delete set null,
  reference_code text,
  title text not null,
  description text,
  severity public.defect_severity not null,
  status public.defect_status not null default 'open',
  recommended_action text,
  target_date date,
  assigned_to uuid references auth.users(id),
  created_by uuid references auth.users(id),
  resolved_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, reference_code)
);

create index if not exists idx_defects_company on public.defects(company_id);
create index if not exists idx_defects_asset on public.defects(asset_id);
create index if not exists idx_defects_inspection on public.defects(inspection_id);
create index if not exists idx_defects_status on public.defects(status);
create index if not exists idx_defects_severity on public.defects(severity);

drop trigger if exists trg_defects_updated_at on public.defects;
create trigger trg_defects_updated_at
before update on public.defects
for each row execute function public.set_updated_at();

-- ============================================================
-- RULE EVALUATION
-- ============================================================

create or replace function public.evaluate_rule(
  p_rule_version_id uuid,
  p_answer jsonb
)
returns jsonb
language plpgsql
stable
as $$
declare
  r public.compliance_rule_versions%rowtype;
  v_num numeric;
  v_text text;
  v_bool boolean;
  v_pass boolean := false;
begin
  select * into r
  from public.compliance_rule_versions
  where id = p_rule_version_id;

  if not found then
    raise exception 'Rule version not found: %', p_rule_version_id;
  end if;

  case r.operator
    when 'required' then
      v_pass := p_answer is not null and p_answer <> 'null'::jsonb;

    when 'is_true' then
      begin
        v_bool := (p_answer #>> '{}')::boolean;
        v_pass := v_bool is true;
      exception when others then
        v_pass := false;
      end;

    when 'is_false' then
      begin
        v_bool := (p_answer #>> '{}')::boolean;
        v_pass := v_bool is false;
      exception when others then
        v_pass := false;
      end;

    when 'eq' then
      v_pass := p_answer = r.expected_value;

    when 'neq' then
      v_pass := p_answer <> r.expected_value;

    when 'gt' then
      begin
        v_num := (p_answer #>> '{}')::numeric;
        v_pass := v_num > r.min_value;
      exception when others then
        v_pass := false;
      end;

    when 'gte' then
      begin
        v_num := (p_answer #>> '{}')::numeric;
        v_pass := v_num >= r.min_value;
      exception when others then
        v_pass := false;
      end;

    when 'lt' then
      begin
        v_num := (p_answer #>> '{}')::numeric;
        v_pass := v_num < r.max_value;
      exception when others then
        v_pass := false;
      end;

    when 'lte' then
      begin
        v_num := (p_answer #>> '{}')::numeric;
        v_pass := v_num <= r.max_value;
      exception when others then
        v_pass := false;
      end;

    when 'between' then
      begin
        v_num := (p_answer #>> '{}')::numeric;
        v_pass := v_num >= r.min_value and v_num <= r.max_value;
      exception when others then
        v_pass := false;
      end;

    when 'in' then
      v_text := p_answer #>> '{}';
      v_pass := exists (
        select 1
        from jsonb_array_elements_text(coalesce(r.expected_value, '[]'::jsonb)) x(value)
        where x.value = v_text
      );

    when 'not_in' then
      v_text := p_answer #>> '{}';
      v_pass := not exists (
        select 1
        from jsonb_array_elements_text(coalesce(r.expected_value, '[]'::jsonb)) x(value)
        where x.value = v_text
      );
  end case;

  return jsonb_build_object(
    'pass', v_pass,
    'rule_version_id', r.id,
    'operator', r.operator,
    'failure_outcome', r.failure_outcome,
    'severity', r.severity,
    'failure_message', r.failure_message,
    'min_value', r.min_value,
    'max_value', r.max_value,
    'unit', r.unit
  );
end;
$$;

-- Evaluates all rules linked to a question. First failure governs by evaluation_order.
create or replace function public.evaluate_question_answer(
  p_question_id uuid,
  p_answer jsonb
)
returns jsonb
language plpgsql
stable
as $$
declare
  qr record;
  result jsonb;
begin
  for qr in
    select qrules.rule_version_id
    from public.question_rules qrules
    join public.compliance_rule_versions rv on rv.id = qrules.rule_version_id
    where qrules.question_id = p_question_id
      and rv.status = 'approved'
      and (rv.effective_from is null or rv.effective_from <= current_date)
      and (rv.effective_to is null or rv.effective_to >= current_date)
    order by qrules.evaluation_order, rv.version_no desc
  loop
    result := public.evaluate_rule(qr.rule_version_id, p_answer);
    if coalesce((result->>'pass')::boolean, false) = false then
      return result;
    end if;
  end loop;

  return jsonb_build_object(
    'pass', true,
    'rule_version_id', null,
    'failure_outcome', 'pass',
    'severity', null,
    'failure_message', null
  );
end;
$$;

-- ============================================================
-- INSPECTION RULE SNAPSHOT
-- Freeze approved rule definitions against an inspection.
-- ============================================================

create or replace function public.capture_inspection_rule_snapshot(p_inspection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
begin
  select jsonb_build_object(
    'captured_at', now(),
    'template_version_id', i.template_version_id,
    'rules', coalesce(jsonb_agg(
      jsonb_build_object(
        'question_id', q.id,
        'question_code', q.code,
        'rule_version_id', rv.id,
        'rule_code', cr.code,
        'rule_name', cr.name,
        'rule_version_no', rv.version_no,
        'operator', rv.operator,
        'expected_value', rv.expected_value,
        'min_value', rv.min_value,
        'max_value', rv.max_value,
        'unit', rv.unit,
        'failure_outcome', rv.failure_outcome,
        'severity', rv.severity,
        'failure_message', rv.failure_message
      )
      order by s.sort_order, q.sort_order, qr.evaluation_order
    ) filter (where rv.id is not null), '[]'::jsonb)
  )
  into v_snapshot
  from public.inspections i
  join public.inspection_sections s on s.template_version_id = i.template_version_id
  join public.inspection_questions q on q.section_id = s.id
  left join public.question_rules qr on qr.question_id = q.id
  left join public.compliance_rule_versions rv on rv.id = qr.rule_version_id
  left join public.compliance_rules cr on cr.id = rv.rule_id
  where i.id = p_inspection_id
  group by i.template_version_id;

  update public.inspections
  set rule_snapshot = coalesce(v_snapshot, '{}'::jsonb)
  where id = p_inspection_id;

  return coalesce(v_snapshot, '{}'::jsonb);
end;
$$;

-- ============================================================
-- SUBMISSION VALIDATION
-- ============================================================

create or replace function public.validate_inspection_submission(p_inspection_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_missing_required integer;
  v_missing_evidence integer;
begin
  select count(*)
  into v_missing_required
  from public.inspections i
  join public.inspection_sections s on s.template_version_id = i.template_version_id
  join public.inspection_questions q on q.section_id = s.id
  left join public.inspection_answers a
    on a.inspection_id = i.id and a.question_id = q.id
  where i.id = p_inspection_id
    and q.is_required = true
    and (a.id is null or a.answer is null or a.answer = 'null'::jsonb);

  select count(*)
  into v_missing_evidence
  from public.inspections i
  join public.inspection_sections s on s.template_version_id = i.template_version_id
  join public.inspection_questions q on q.section_id = s.id
  where i.id = p_inspection_id
    and q.evidence_required = true
    and (
      select count(*)
      from public.inspection_evidence e
      where e.inspection_id = i.id and e.question_id = q.id
    ) < greatest(q.min_photos, 1);

  return jsonb_build_object(
    'valid', v_missing_required = 0 and v_missing_evidence = 0,
    'missing_required_answers', v_missing_required,
    'missing_required_evidence', v_missing_evidence
  );
end;
$$;

-- ============================================================
-- OUTCOME AGGREGATION
-- ============================================================

create or replace function public.recalculate_inspection_outcome(p_inspection_id uuid)
returns public.inspection_outcome
language plpgsql
as $$
declare
  v_outcome public.inspection_outcome;
begin
  if exists (
    select 1 from public.inspection_answers
    where inspection_id = p_inspection_id and outcome = 'fail'
  ) then
    v_outcome := 'fail';
  elsif exists (
    select 1 from public.inspection_answers
    where inspection_id = p_inspection_id and outcome = 'conditional'
  ) then
    v_outcome := 'conditional';
  elsif exists (
    select 1 from public.inspection_answers
    where inspection_id = p_inspection_id and outcome = 'pending'
  ) then
    v_outcome := 'pending';
  else
    v_outcome := 'pass';
  end if;

  update public.inspections
  set outcome = v_outcome
  where id = p_inspection_id;

  return v_outcome;
end;
$$;

-- ============================================================
-- DEFECT CREATION FROM FAILED ANSWER
-- ============================================================

create or replace function public.create_defect_from_failed_answer(p_answer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.inspection_answers%rowtype;
  i public.inspections%rowtype;
  q public.inspection_questions%rowtype;
  rv public.compliance_rule_versions%rowtype;
  v_defect_id uuid;
  v_ref text;
begin
  select * into a from public.inspection_answers where id = p_answer_id;
  if not found then
    raise exception 'Inspection answer not found';
  end if;

  if a.outcome <> 'fail' then
    return null;
  end if;

  select * into i from public.inspections where id = a.inspection_id;
  select * into q from public.inspection_questions where id = a.question_id;

  if a.evaluated_rule_version_id is not null then
    select * into rv from public.compliance_rule_versions where id = a.evaluated_rule_version_id;
  end if;

  if exists (
    select 1 from public.defects d
    where d.inspection_answer_id = a.id
      and d.status not in ('closed','cancelled')
  ) then
    select d.id into v_defect_id
    from public.defects d
    where d.inspection_answer_id = a.id
      and d.status not in ('closed','cancelled')
    order by d.created_at desc
    limit 1;
    return v_defect_id;
  end if;

  v_ref := 'D-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.defects(
    company_id,
    property_id,
    asset_id,
    inspection_id,
    inspection_answer_id,
    reference_code,
    title,
    description,
    severity,
    recommended_action,
    created_by
  )
  values(
    i.company_id,
    i.property_id,
    i.asset_id,
    i.id,
    a.id,
    v_ref,
    'Inspection failure: ' || q.prompt,
    coalesce(rv.failure_message, 'Inspection rule failed.'),
    coalesce(rv.severity, 'medium'::public.defect_severity),
    coalesce(rv.failure_message, 'Review and carry out appropriate remedial action.'),
    a.answered_by
  )
  returning id into v_defect_id;

  return v_defect_id;
end;
$$;

-- ============================================================
-- TENANT CONSISTENCY
-- ============================================================

create or replace function public.validate_inspection_tenant_consistency()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.properties p
    where p.id = new.property_id and p.company_id = new.company_id
  ) then
    raise exception 'Inspection property does not belong to company';
  end if;

  if not exists (
    select 1 from public.assets a
    where a.id = new.asset_id
      and a.company_id = new.company_id
      and a.property_id = new.property_id
  ) then
    raise exception 'Inspection asset does not belong to company/property';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_inspection_tenant_consistency on public.inspections;
create trigger trg_validate_inspection_tenant_consistency
before insert or update on public.inspections
for each row execute function public.validate_inspection_tenant_consistency();

-- ============================================================
-- AUDIT TRIGGERS
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'inspection_templates',
    'inspection_template_versions',
    'inspection_sections',
    'inspection_questions',
    'compliance_rules',
    'compliance_rule_versions',
    'question_rules',
    'inspections',
    'inspection_answers',
    'inspection_evidence',
    'defects'
  ]
  loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.compliance_domains enable row level security;
alter table public.standards enable row level security;
alter table public.inspection_templates enable row level security;
alter table public.inspection_template_versions enable row level security;
alter table public.inspection_sections enable row level security;
alter table public.inspection_questions enable row level security;
alter table public.compliance_rules enable row level security;
alter table public.compliance_rule_versions enable row level security;
alter table public.rule_standard_links enable row level security;
alter table public.question_rules enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_answers enable row level security;
alter table public.inspection_evidence enable row level security;
alter table public.defects enable row level security;

-- Global reference tables are readable to authenticated users.
drop policy if exists "authenticated_read_compliance_domains" on public.compliance_domains;
create policy "authenticated_read_compliance_domains"
on public.compliance_domains for select to authenticated using (true);

drop policy if exists "authenticated_read_standards" on public.standards;
create policy "authenticated_read_standards"
on public.standards for select to authenticated using (true);

-- Templates: system/global or tenant-owned.
drop policy if exists "inspection_templates_select" on public.inspection_templates;
create policy "inspection_templates_select"
on public.inspection_templates for select
using (company_id is null or public.is_company_member(company_id));

drop policy if exists "inspection_templates_insert" on public.inspection_templates;
create policy "inspection_templates_insert"
on public.inspection_templates for insert
with check (company_id is not null and public.has_permission(company_id, 'rule.review'));

drop policy if exists "inspection_templates_update" on public.inspection_templates;
create policy "inspection_templates_update"
on public.inspection_templates for update
using (company_id is not null and public.has_permission(company_id, 'rule.review'))
with check (company_id is not null and public.has_permission(company_id, 'rule.review'));

-- Nested template tables inherit visibility via parent template.
drop policy if exists "template_versions_select" on public.inspection_template_versions;
create policy "template_versions_select"
on public.inspection_template_versions for select
using (
  exists (
    select 1 from public.inspection_templates t
    where t.id = template_id
      and (t.company_id is null or public.is_company_member(t.company_id))
  )
);

drop policy if exists "sections_select" on public.inspection_sections;
create policy "sections_select"
on public.inspection_sections for select
using (
  exists (
    select 1
    from public.inspection_template_versions tv
    join public.inspection_templates t on t.id = tv.template_id
    where tv.id = template_version_id
      and (t.company_id is null or public.is_company_member(t.company_id))
  )
);

drop policy if exists "questions_select" on public.inspection_questions;
create policy "questions_select"
on public.inspection_questions for select
using (
  exists (
    select 1
    from public.inspection_sections s
    join public.inspection_template_versions tv on tv.id = s.template_version_id
    join public.inspection_templates t on t.id = tv.template_id
    where s.id = section_id
      and (t.company_id is null or public.is_company_member(t.company_id))
  )
);

-- Compliance rules
drop policy if exists "compliance_rules_select" on public.compliance_rules;
create policy "compliance_rules_select"
on public.compliance_rules for select
using (company_id is null or public.is_company_member(company_id));

drop policy if exists "rule_versions_select" on public.compliance_rule_versions;
create policy "rule_versions_select"
on public.compliance_rule_versions for select
using (
  exists (
    select 1 from public.compliance_rules r
    where r.id = rule_id
      and (r.company_id is null or public.is_company_member(r.company_id))
  )
);

drop policy if exists "question_rules_select" on public.question_rules;
create policy "question_rules_select"
on public.question_rules for select
using (
  exists (
    select 1
    from public.inspection_questions q
    join public.inspection_sections s on s.id = q.section_id
    join public.inspection_template_versions tv on tv.id = s.template_version_id
    join public.inspection_templates t on t.id = tv.template_id
    where q.id = question_id
      and (t.company_id is null or public.is_company_member(t.company_id))
  )
);

drop policy if exists "rule_standard_links_select" on public.rule_standard_links;
create policy "rule_standard_links_select"
on public.rule_standard_links for select to authenticated using (true);

-- Inspection operational tables
drop policy if exists "inspections_select" on public.inspections;
create policy "inspections_select"
on public.inspections for select
using (public.is_company_member(company_id));

drop policy if exists "inspections_insert" on public.inspections;
create policy "inspections_insert"
on public.inspections for insert
with check (
  public.has_permission(company_id, 'inspection.create')
);

drop policy if exists "inspections_update" on public.inspections;
create policy "inspections_update"
on public.inspections for update
using (
  public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.approve')
)
with check (
  public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'inspection.approve')
);

drop policy if exists "answers_select" on public.inspection_answers;
create policy "answers_select"
on public.inspection_answers for select
using (
  exists (
    select 1 from public.inspections i
    where i.id = inspection_id and public.is_company_member(i.company_id)
  )
);

drop policy if exists "answers_insert" on public.inspection_answers;
create policy "answers_insert"
on public.inspection_answers for insert
with check (
  exists (
    select 1 from public.inspections i
    where i.id = inspection_id and public.has_permission(i.company_id, 'inspection.create')
  )
);

drop policy if exists "answers_update" on public.inspection_answers;
create policy "answers_update"
on public.inspection_answers for update
using (
  exists (
    select 1 from public.inspections i
    where i.id = inspection_id and public.has_permission(i.company_id, 'inspection.create')
  )
)
with check (
  exists (
    select 1 from public.inspections i
    where i.id = inspection_id and public.has_permission(i.company_id, 'inspection.create')
  )
);

drop policy if exists "evidence_select" on public.inspection_evidence;
create policy "evidence_select"
on public.inspection_evidence for select
using (public.is_company_member(company_id));

drop policy if exists "evidence_insert" on public.inspection_evidence;
create policy "evidence_insert"
on public.inspection_evidence for insert
with check (public.has_permission(company_id, 'inspection.create'));

drop policy if exists "defects_select" on public.defects;
create policy "defects_select"
on public.defects for select
using (public.is_company_member(company_id));

drop policy if exists "defects_insert" on public.defects;
create policy "defects_insert"
on public.defects for insert
with check (
  public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'asset.edit')
);

drop policy if exists "defects_update" on public.defects;
create policy "defects_update"
on public.defects for update
using (
  public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'asset.edit')
)
with check (
  public.has_permission(company_id, 'inspection.create')
  or public.has_permission(company_id, 'asset.edit')
);
