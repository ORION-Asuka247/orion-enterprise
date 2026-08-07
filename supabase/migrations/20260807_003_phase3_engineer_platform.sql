-- ORION Enterprise Phase 3
-- Engineer field platform support
-- Requires Phase 1 and Phase 2.

create extension if not exists pgcrypto;

do $$ begin
  create type public.assignment_status as enum (
    'assigned',
    'accepted',
    'in_progress',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.engineer_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  engineer_user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_for timestamptz,
  status public.assignment_status not null default 'assigned',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(inspection_id, engineer_user_id)
);

create index if not exists idx_engineer_assignments_company on public.engineer_assignments(company_id);
create index if not exists idx_engineer_assignments_engineer on public.engineer_assignments(engineer_user_id);
create index if not exists idx_engineer_assignments_schedule on public.engineer_assignments(scheduled_for);

drop trigger if exists trg_engineer_assignments_updated_at on public.engineer_assignments;
create trigger trg_engineer_assignments_updated_at
before update on public.engineer_assignments
for each row execute function public.set_updated_at();

-- Client-generated idempotency key for safe offline synchronisation.
alter table public.inspection_answers
  add column if not exists client_mutation_id uuid;

create unique index if not exists uq_inspection_answers_client_mutation
on public.inspection_answers(client_mutation_id)
where client_mutation_id is not null;

alter table public.inspection_evidence
  add column if not exists client_mutation_id uuid;

create unique index if not exists uq_inspection_evidence_client_mutation
on public.inspection_evidence(client_mutation_id)
where client_mutation_id is not null;

-- Evidence bucket should be private. Create only if storage schema is available.
insert into storage.buckets (id, name, public)
values ('inspection-evidence', 'inspection-evidence', false)
on conflict (id) do update set public = excluded.public;

-- Storage RLS: authenticated users can operate only within a company folder
-- they belong to. Path format: company_id/inspection_id/filename.
drop policy if exists "inspection evidence select" on storage.objects;
create policy "inspection evidence select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'inspection-evidence'
  and public.is_company_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "inspection evidence insert" on storage.objects;
create policy "inspection evidence insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'inspection-evidence'
  and public.has_permission((storage.foldername(name))[1]::uuid, 'inspection.create')
);

-- Engineer assignments RLS
alter table public.engineer_assignments enable row level security;

drop policy if exists "engineer_assignments_select" on public.engineer_assignments;
create policy "engineer_assignments_select"
on public.engineer_assignments for select
using (
  engineer_user_id = auth.uid()
  or public.is_company_member(company_id)
);

drop policy if exists "engineer_assignments_insert" on public.engineer_assignments;
create policy "engineer_assignments_insert"
on public.engineer_assignments for insert
with check (
  public.has_permission(company_id, 'inspection.approve')
  or public.has_permission(company_id, 'user.manage')
);

drop policy if exists "engineer_assignments_update" on public.engineer_assignments;
create policy "engineer_assignments_update"
on public.engineer_assignments for update
using (
  engineer_user_id = auth.uid()
  or public.has_permission(company_id, 'inspection.approve')
)
with check (
  engineer_user_id = auth.uid()
  or public.has_permission(company_id, 'inspection.approve')
);

drop trigger if exists audit_engineer_assignments on public.engineer_assignments;
create trigger audit_engineer_assignments
after insert or update or delete on public.engineer_assignments
for each row execute function public.audit_row_change();

-- RPC for engineer dashboard assignments.
create or replace function public.get_my_engineer_assignments()
returns table(
  assignment_id uuid,
  inspection_id uuid,
  company_id uuid,
  scheduled_for timestamptz,
  assignment_status public.assignment_status,
  inspection_status public.inspection_status,
  inspection_outcome public.inspection_outcome,
  asset_id uuid,
  asset_code text,
  asset_name text,
  property_id uuid,
  property_name text,
  block_name text,
  floor_name text,
  area_name text
)
language sql
stable
security invoker
as $$
  select
    ea.id,
    i.id,
    ea.company_id,
    ea.scheduled_for,
    ea.status,
    i.status,
    i.outcome,
    a.id,
    a.asset_code,
    a.name,
    p.id,
    p.name,
    b.name,
    f.name,
    ar.name
  from public.engineer_assignments ea
  join public.inspections i on i.id = ea.inspection_id
  join public.assets a on a.id = i.asset_id
  join public.properties p on p.id = i.property_id
  left join public.blocks b on b.id = a.block_id
  left join public.floors f on f.id = a.floor_id
  left join public.areas ar on ar.id = a.area_id
  where ea.engineer_user_id = auth.uid()
    and ea.status <> 'cancelled'
  order by ea.scheduled_for nulls last, p.name, a.asset_code;
$$;

-- Submission RPC keeps validation and status transition in one protected function.
create or replace function public.submit_inspection(p_inspection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.inspections%rowtype;
  validation jsonb;
  final_outcome public.inspection_outcome;
begin
  select * into i from public.inspections where id = p_inspection_id;
  if not found then raise exception 'Inspection not found'; end if;

  if not (
    public.has_permission(i.company_id, 'inspection.create')
    or public.has_permission(i.company_id, 'inspection.approve')
  ) then
    raise exception 'Not authorised';
  end if;

  validation := public.validate_inspection_submission(p_inspection_id);

  if coalesce((validation->>'valid')::boolean, false) = false then
    return jsonb_build_object(
      'submitted', false,
      'validation', validation
    );
  end if;

  perform public.capture_inspection_rule_snapshot(p_inspection_id);
  final_outcome := public.recalculate_inspection_outcome(p_inspection_id);

  update public.inspections
  set
    status = 'submitted',
    outcome = final_outcome,
    submitted_at = now()
  where id = p_inspection_id;

  update public.engineer_assignments
  set status = 'completed'
  where inspection_id = p_inspection_id
    and engineer_user_id = auth.uid();

  return jsonb_build_object(
    'submitted', true,
    'outcome', final_outcome,
    'validation', validation
  );
end;
$$;
