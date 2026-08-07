-- ORION Enterprise Phase 5
-- Regulatory Intelligence Engine
-- Requires Phases 1-4.

create extension if not exists pgcrypto;

do $$ begin
  create type public.regulatory_source_type as enum (
    'govuk_search',
    'govuk_content',
    'legislation',
    'rss',
    'web',
    'manual'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.regulatory_trust_tier as enum (
    'tier_1_primary',
    'tier_2_official_guidance',
    'tier_3_professional',
    'tier_4_advisory'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.regulatory_document_status as enum (
    'active',
    'withdrawn',
    'superseded',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.regulatory_change_status as enum (
    'detected',
    'analysing',
    'awaiting_review',
    'approved',
    'rejected',
    'superseded',
    'implemented'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.regulatory_change_type as enum (
    'new_document',
    'content_changed',
    'metadata_changed',
    'withdrawn',
    'superseded',
    'effective_date_changed',
    'manual_review'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.rule_proposal_status as enum (
    'draft',
    'awaiting_review',
    'approved',
    'rejected',
    'implemented'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.impact_status as enum (
    'pending',
    'analysing',
    'completed',
    'reviewed'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- SOURCE REGISTRY
-- ============================================================

create table if not exists public.regulatory_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  organisation text,
  source_type public.regulatory_source_type not null,
  trust_tier public.regulatory_trust_tier not null,
  base_url text not null,
  query_config jsonb not null default '{}'::jsonb,
  polling_interval_minutes integer not null default 1440
    check (polling_interval_minutes >= 60),
  is_enabled boolean not null default true,
  requires_human_verification boolean not null default true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_regulatory_sources_updated_at on public.regulatory_sources;
create trigger trg_regulatory_sources_updated_at
before update on public.regulatory_sources
for each row execute function public.set_updated_at();

-- ============================================================
-- SOURCE CHECK RUNS
-- ============================================================

create table if not exists public.regulatory_source_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.regulatory_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  success boolean,
  http_status integer,
  items_seen integer not null default 0,
  items_new integer not null default 0,
  items_changed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_reg_source_runs_source_started
on public.regulatory_source_runs(source_id, started_at desc);

-- ============================================================
-- REGULATORY DOCUMENTS + IMMUTABLE VERSIONS
-- ============================================================

create table if not exists public.regulatory_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.regulatory_sources(id) on delete restrict,
  external_id text,
  canonical_url text not null,
  title text not null,
  organisation text,
  document_type text,
  status public.regulatory_document_status not null default 'active',
  publication_date date,
  updated_date date,
  effective_date date,
  withdrawn_date date,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  current_version_no integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique(source_id, canonical_url)
);

create index if not exists idx_reg_documents_source on public.regulatory_documents(source_id);
create index if not exists idx_reg_documents_updated on public.regulatory_documents(updated_date desc);
create index if not exists idx_reg_documents_effective on public.regulatory_documents(effective_date);
create index if not exists idx_reg_documents_type on public.regulatory_documents(document_type);

create table if not exists public.regulatory_document_versions (
  id uuid primary key default gen_random_uuid(),
  regulatory_document_id uuid not null references public.regulatory_documents(id) on delete cascade,
  version_no integer not null,
  content_hash text not null,
  raw_content text,
  structured_content jsonb not null default '{}'::jsonb,
  metadata_snapshot jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz not null default now(),
  source_modified_at timestamptz,
  previous_version_id uuid references public.regulatory_document_versions(id),
  unique(regulatory_document_id, version_no),
  unique(regulatory_document_id, content_hash)
);

create index if not exists idx_reg_doc_versions_document
on public.regulatory_document_versions(regulatory_document_id, version_no desc);

-- ============================================================
-- CHANGE EVENTS
-- ============================================================

create table if not exists public.regulatory_changes (
  id uuid primary key default gen_random_uuid(),
  regulatory_document_id uuid not null references public.regulatory_documents(id) on delete cascade,
  from_version_id uuid references public.regulatory_document_versions(id),
  to_version_id uuid references public.regulatory_document_versions(id),
  change_type public.regulatory_change_type not null,
  status public.regulatory_change_status not null default 'detected',
  detected_at timestamptz not null default now(),
  significance_score numeric(5,2) check (significance_score between 0 and 100),
  affected_jurisdictions text[] not null default '{}',
  detected_summary text,
  machine_diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_reg_changes_status
on public.regulatory_changes(status, detected_at desc);

create index if not exists idx_reg_changes_document
on public.regulatory_changes(regulatory_document_id, detected_at desc);

-- ============================================================
-- AI ANALYSIS - ADVISORY ONLY
-- ============================================================

create table if not exists public.regulatory_analyses (
  id uuid primary key default gen_random_uuid(),
  regulatory_change_id uuid not null references public.regulatory_changes(id) on delete cascade,
  analysis_version integer not null default 1,
  model_provider text,
  model_name text,
  prompt_version text,
  summary text not null,
  what_changed text,
  why_it_matters text,
  proposed_effective_date date,
  urgency text check (urgency in ('low','medium','high','critical','unknown')),
  confidence numeric(5,2) check (confidence between 0 and 100),
  affected_compliance_domains text[] not null default '{}',
  affected_asset_type_codes text[] not null default '{}',
  affected_template_codes text[] not null default '{}',
  proposed_actions jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  requires_legal_review boolean not null default true,
  generated_at timestamptz not null default now(),
  unique(regulatory_change_id, analysis_version)
);

-- ============================================================
-- HUMAN REVIEW
-- ============================================================

create table if not exists public.regulatory_reviews (
  id uuid primary key default gen_random_uuid(),
  regulatory_change_id uuid not null references public.regulatory_changes(id) on delete cascade,
  analysis_id uuid references public.regulatory_analyses(id) on delete set null,
  reviewer_user_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approve','reject','request_changes','defer')),
  reviewer_notes text,
  source_verified boolean not null default false,
  applicability_verified boolean not null default false,
  effective_date_verified boolean not null default false,
  reviewed_at timestamptz not null default now()
);

create index if not exists idx_reg_reviews_change
on public.regulatory_reviews(regulatory_change_id, reviewed_at desc);

-- ============================================================
-- RULE CHANGE PROPOSALS
-- Never writes directly to live rule versions.
-- ============================================================

create table if not exists public.rule_change_proposals (
  id uuid primary key default gen_random_uuid(),
  regulatory_change_id uuid not null references public.regulatory_changes(id) on delete cascade,
  existing_rule_id uuid references public.compliance_rules(id) on delete set null,
  existing_rule_version_id uuid references public.compliance_rule_versions(id) on delete set null,
  proposed_rule_code text,
  proposed_rule_name text,
  proposal jsonb not null,
  rationale text,
  source_references jsonb not null default '[]'::jsonb,
  status public.rule_proposal_status not null default 'draft',
  proposed_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  implemented_rule_version_id uuid references public.compliance_rule_versions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_rule_change_proposals_updated_at on public.rule_change_proposals;
create trigger trg_rule_change_proposals_updated_at
before update on public.rule_change_proposals
for each row execute function public.set_updated_at();

-- ============================================================
-- PORTFOLIO IMPACT
-- ============================================================

create table if not exists public.regulatory_impact_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  regulatory_change_id uuid not null references public.regulatory_changes(id) on delete cascade,
  status public.impact_status not null default 'pending',
  affected_property_count integer not null default 0,
  affected_asset_count integer not null default 0,
  affected_inspection_count integer not null default 0,
  high_priority_count integer not null default 0,
  impact_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(company_id, regulatory_change_id)
);

create table if not exists public.regulatory_impact_items (
  id uuid primary key default gen_random_uuid(),
  impact_run_id uuid not null references public.regulatory_impact_runs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  inspection_id uuid references public.inspections(id) on delete set null,
  impact_reason text not null,
  priority text not null check (priority in ('low','medium','high','critical')),
  recommended_action text,
  due_date date,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_reg_impact_items_run on public.regulatory_impact_items(impact_run_id);
create index if not exists idx_reg_impact_items_company_priority
on public.regulatory_impact_items(company_id, priority);

-- ============================================================
-- TOPIC / DOMAIN MAPPING
-- Connect source publications to ORION domains/assets/templates.
-- ============================================================

create table if not exists public.regulatory_topic_mappings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.regulatory_sources(id) on delete cascade,
  keyword text,
  document_type text,
  organisation text,
  compliance_domain_code text,
  asset_type_code text,
  inspection_template_code text,
  weight numeric(5,2) not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- HELPER: RECORD NEW DOCUMENT VERSION
-- ============================================================

create or replace function public.record_regulatory_document_version(
  p_source_id uuid,
  p_external_id text,
  p_canonical_url text,
  p_title text,
  p_organisation text,
  p_document_type text,
  p_publication_date date,
  p_updated_date date,
  p_effective_date date,
  p_content_hash text,
  p_raw_content text,
  p_structured_content jsonb,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.regulatory_documents%rowtype;
  prev_v public.regulatory_document_versions%rowtype;
  v_new_id uuid;
  v_new_no integer;
  v_change_id uuid;
begin
  select * into d
  from public.regulatory_documents
  where source_id = p_source_id and canonical_url = p_canonical_url;

  if not found then
    insert into public.regulatory_documents(
      source_id, external_id, canonical_url, title, organisation, document_type,
      publication_date, updated_date, effective_date, metadata, current_version_no
    ) values(
      p_source_id, p_external_id, p_canonical_url, p_title, p_organisation, p_document_type,
      p_publication_date, p_updated_date, p_effective_date, coalesce(p_metadata,'{}'::jsonb), 1
    )
    returning * into d;

    insert into public.regulatory_document_versions(
      regulatory_document_id, version_no, content_hash, raw_content,
      structured_content, metadata_snapshot
    ) values(
      d.id, 1, p_content_hash, p_raw_content,
      coalesce(p_structured_content,'{}'::jsonb),
      coalesce(p_metadata,'{}'::jsonb)
    )
    returning id into v_new_id;

    insert into public.regulatory_changes(
      regulatory_document_id, to_version_id, change_type, detected_summary
    ) values(
      d.id, v_new_id, 'new_document', 'New regulatory publication detected.'
    )
    returning id into v_change_id;

    return jsonb_build_object(
      'document_id', d.id,
      'version_id', v_new_id,
      'change_id', v_change_id,
      'change_type', 'new_document'
    );
  end if;

  update public.regulatory_documents
  set
    last_seen_at = now(),
    title = p_title,
    organisation = p_organisation,
    document_type = p_document_type,
    publication_date = coalesce(p_publication_date, publication_date),
    updated_date = coalesce(p_updated_date, updated_date),
    effective_date = coalesce(p_effective_date, effective_date),
    metadata = coalesce(p_metadata, metadata)
  where id = d.id;

  select * into prev_v
  from public.regulatory_document_versions
  where regulatory_document_id = d.id
  order by version_no desc
  limit 1;

  if prev_v.content_hash = p_content_hash then
    return jsonb_build_object(
      'document_id', d.id,
      'version_id', prev_v.id,
      'change_id', null,
      'change_type', 'unchanged'
    );
  end if;

  v_new_no := prev_v.version_no + 1;

  insert into public.regulatory_document_versions(
    regulatory_document_id, version_no, content_hash, raw_content,
    structured_content, metadata_snapshot, previous_version_id
  ) values(
    d.id, v_new_no, p_content_hash, p_raw_content,
    coalesce(p_structured_content,'{}'::jsonb),
    coalesce(p_metadata,'{}'::jsonb),
    prev_v.id
  )
  returning id into v_new_id;

  update public.regulatory_documents
  set current_version_no = v_new_no
  where id = d.id;

  insert into public.regulatory_changes(
    regulatory_document_id, from_version_id, to_version_id,
    change_type, detected_summary
  ) values(
    d.id, prev_v.id, v_new_id,
    'content_changed', 'Published regulatory content changed.'
  )
  returning id into v_change_id;

  return jsonb_build_object(
    'document_id', d.id,
    'version_id', v_new_id,
    'change_id', v_change_id,
    'change_type', 'content_changed'
  );
end;
$$;

-- ============================================================
-- HUMAN APPROVAL TRANSITION
-- ============================================================

create or replace function public.review_regulatory_change(
  p_change_id uuid,
  p_decision text,
  p_notes text,
  p_source_verified boolean,
  p_applicability_verified boolean,
  p_effective_date_verified boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review_id uuid;
  v_new_status public.regulatory_change_status;
begin
  if not public.is_platform_admin() then
    -- Phase 5 starts with platform-level review.
    -- Future enterprise delegation can add a dedicated regulatory permission.
    raise exception 'Platform administrator approval required';
  end if;

  if p_decision = 'approve' and not (
    p_source_verified and
    p_applicability_verified and
    p_effective_date_verified
  ) then
    raise exception 'Approval requires source, applicability and effective date verification';
  end if;

  insert into public.regulatory_reviews(
    regulatory_change_id, reviewer_user_id, decision, reviewer_notes,
    source_verified, applicability_verified, effective_date_verified
  ) values(
    p_change_id, auth.uid(), p_decision, p_notes,
    p_source_verified, p_applicability_verified, p_effective_date_verified
  )
  returning id into v_review_id;

  v_new_status := case
    when p_decision = 'approve' then 'approved'
    when p_decision = 'reject' then 'rejected'
    else 'awaiting_review'
  end;

  update public.regulatory_changes
  set status = v_new_status
  where id = p_change_id;

  return v_review_id;
end;
$$;

-- ============================================================
-- IMPACT ANALYSIS FUNCTION
-- Matches approved AI domain/asset/template classifications.
-- ============================================================

create or replace function public.run_regulatory_impact_analysis(
  p_company_id uuid,
  p_change_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_analysis public.regulatory_analyses%rowtype;
  v_change public.regulatory_changes%rowtype;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Not authorised';
  end if;

  select * into v_change
  from public.regulatory_changes
  where id = p_change_id and status = 'approved';

  if not found then
    raise exception 'Regulatory change must be approved before portfolio impact analysis';
  end if;

  select * into v_analysis
  from public.regulatory_analyses
  where regulatory_change_id = p_change_id
  order by analysis_version desc
  limit 1;

  insert into public.regulatory_impact_runs(
    company_id, regulatory_change_id, status, started_at, created_by
  ) values(
    p_company_id, p_change_id, 'analysing', now(), auth.uid()
  )
  on conflict(company_id, regulatory_change_id)
  do update set status='analysing', started_at=now(), completed_at=null
  returning id into v_run_id;

  delete from public.regulatory_impact_items where impact_run_id = v_run_id;

  -- Asset-type impact
  insert into public.regulatory_impact_items(
    impact_run_id, company_id, property_id, asset_id,
    impact_reason, priority, recommended_action, evidence
  )
  select
    v_run_id,
    a.company_id,
    a.property_id,
    a.id,
    'Asset type potentially affected by approved regulatory change.',
    case when v_analysis.urgency in ('critical','high') then 'high' else 'medium' end,
    'Review the approved regulatory change against this asset and its latest inspection.',
    jsonb_build_object(
      'asset_type_code', at.code,
      'regulatory_change_id', p_change_id,
      'analysis_id', v_analysis.id
    )
  from public.assets a
  join public.asset_types at on at.id = a.asset_type_id
  where a.company_id = p_company_id
    and at.code = any(coalesce(v_analysis.affected_asset_type_codes, '{}'::text[]));

  -- Template / historical inspection impact
  insert into public.regulatory_impact_items(
    impact_run_id, company_id, property_id, asset_id, inspection_id,
    impact_reason, priority, recommended_action, evidence
  )
  select
    v_run_id,
    i.company_id,
    i.property_id,
    i.asset_id,
    i.id,
    'Historical inspection used a template identified as potentially affected.',
    case when v_analysis.urgency in ('critical','high') then 'high' else 'medium' end,
    'Review whether reinspection, management action or no action is required.',
    jsonb_build_object(
      'template_code', t.code,
      'template_version_id', i.template_version_id,
      'regulatory_change_id', p_change_id,
      'analysis_id', v_analysis.id
    )
  from public.inspections i
  join public.inspection_templates t on t.id = i.template_id
  where i.company_id = p_company_id
    and t.code = any(coalesce(v_analysis.affected_template_codes, '{}'::text[]));

  update public.regulatory_impact_runs r
  set
    status = 'completed',
    completed_at = now(),
    affected_property_count = (
      select count(distinct property_id)
      from public.regulatory_impact_items where impact_run_id = r.id
    ),
    affected_asset_count = (
      select count(distinct asset_id)
      from public.regulatory_impact_items where impact_run_id = r.id
    ),
    affected_inspection_count = (
      select count(distinct inspection_id)
      from public.regulatory_impact_items
      where impact_run_id = r.id and inspection_id is not null
    ),
    high_priority_count = (
      select count(*)
      from public.regulatory_impact_items
      where impact_run_id = r.id and priority in ('high','critical')
    ),
    impact_summary = jsonb_build_object(
      'change_id', p_change_id,
      'analysis_id', v_analysis.id,
      'completed_at', now()
    )
  where r.id = v_run_id;

  return v_run_id;
end;
$$;

-- ============================================================
-- RLS
-- Global intelligence is platform-managed.
-- Tenant impact data remains tenant-isolated.
-- ============================================================

alter table public.regulatory_sources enable row level security;
alter table public.regulatory_source_runs enable row level security;
alter table public.regulatory_documents enable row level security;
alter table public.regulatory_document_versions enable row level security;
alter table public.regulatory_changes enable row level security;
alter table public.regulatory_analyses enable row level security;
alter table public.regulatory_reviews enable row level security;
alter table public.rule_change_proposals enable row level security;
alter table public.regulatory_impact_runs enable row level security;
alter table public.regulatory_impact_items enable row level security;
alter table public.regulatory_topic_mappings enable row level security;

-- Authenticated users may read approved global intelligence.
drop policy if exists "approved_reg_changes_read" on public.regulatory_changes;
create policy "approved_reg_changes_read"
on public.regulatory_changes for select to authenticated
using (status in ('approved','implemented') or public.is_platform_admin());

drop policy if exists "reg_documents_read" on public.regulatory_documents;
create policy "reg_documents_read"
on public.regulatory_documents for select to authenticated
using (true);

drop policy if exists "reg_doc_versions_read" on public.regulatory_document_versions;
create policy "reg_doc_versions_read"
on public.regulatory_document_versions for select to authenticated
using (true);

drop policy if exists "reg_analyses_read" on public.regulatory_analyses;
create policy "reg_analyses_read"
on public.regulatory_analyses for select to authenticated
using (
  exists (
    select 1 from public.regulatory_changes c
    where c.id = regulatory_change_id
      and (c.status in ('approved','implemented') or public.is_platform_admin())
  )
);

drop policy if exists "impact_runs_tenant_read" on public.regulatory_impact_runs;
create policy "impact_runs_tenant_read"
on public.regulatory_impact_runs for select
using (public.is_company_member(company_id));

drop policy if exists "impact_items_tenant_read" on public.regulatory_impact_items;
create policy "impact_items_tenant_read"
on public.regulatory_impact_items for select
using (public.is_company_member(company_id));

-- ============================================================
-- AUDIT
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'regulatory_sources',
    'regulatory_documents',
    'regulatory_changes',
    'regulatory_analyses',
    'regulatory_reviews',
    'rule_change_proposals',
    'regulatory_impact_runs'
  ]
  loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t, t
    );
  end loop;
end $$;
