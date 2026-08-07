-- ORION Enterprise Phase 1
-- Foundation schema: multi-tenant identity, roles/permissions,
-- property hierarchy, assets, and immutable audit logging.

create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type public.membership_status as enum ('invited','active','suspended','revoked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.asset_status as enum ('planned','installed','active','defective','under_repair','retired');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- GENERIC TIMESTAMP FUNCTION
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- COMPANIES / TENANTS
-- ============================================================

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  slug text not null unique,
  company_number text,
  vat_number text,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- ============================================================
-- USER PROFILES
-- auth.users remains the authentication authority.
-- ============================================================

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  job_title text,
  phone text,
  avatar_path text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ============================================================
-- RBAC
-- ============================================================

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  status public.membership_status not null default 'active',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, user_id)
);

create index if not exists idx_company_memberships_company on public.company_memberships(company_id);
create index if not exists idx_company_memberships_user on public.company_memberships(user_id);

drop trigger if exists trg_company_memberships_updated_at on public.company_memberships;
create trigger trg_company_memberships_updated_at
before update on public.company_memberships
for each row execute function public.set_updated_at();

-- ============================================================
-- TENANT HELPER FUNCTIONS
-- ============================================================

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where user_id = auth.uid()),
    false
  );
$$;

create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = target_company
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ) or public.is_platform_admin();
$$;

create or replace function public.has_permission(target_company uuid, permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
  or exists (
    select 1
    from public.company_memberships cm
    join public.role_permissions rp on rp.role_id = cm.role_id
    join public.permissions p on p.id = rp.permission_id
    where cm.company_id = target_company
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and p.code = permission_code
  );
$$;

-- ============================================================
-- PROPERTY HIERARCHY
-- ============================================================

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  reference_code text,
  address_line1 text,
  address_line2 text,
  town_city text,
  county text,
  postcode text,
  country_code char(2) not null default 'GB',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, reference_code)
);

create index if not exists idx_properties_company on public.properties(company_id);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  code text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id, code)
);

create index if not exists idx_blocks_company on public.blocks(company_id);
create index if not exists idx_blocks_property on public.blocks(property_id);

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  block_id uuid not null references public.blocks(id) on delete cascade,
  name text not null,
  level_number integer,
  code text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(block_id, code)
);

create index if not exists idx_floors_company on public.floors(company_id);
create index if not exists idx_floors_block on public.floors(block_id);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  name text not null,
  code text,
  area_type text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(floor_id, code)
);

create index if not exists idx_areas_company on public.areas(company_id);
create index if not exists idx_areas_floor on public.areas(floor_id);

-- Add update triggers for property hierarchy
do $$
declare
  t text;
begin
  foreach t in array array['properties','blocks','floors','areas']
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- ASSETS
-- ============================================================

create table if not exists public.asset_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  compliance_domain text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  block_id uuid references public.blocks(id) on delete set null,
  floor_id uuid references public.floors(id) on delete set null,
  area_id uuid references public.areas(id) on delete set null,
  asset_type_id uuid not null references public.asset_types(id),
  asset_code text not null,
  qr_token uuid not null default gen_random_uuid() unique,
  name text,
  manufacturer text,
  model text,
  serial_number text,
  install_date date,
  status public.asset_status not null default 'active',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, asset_code)
);

create index if not exists idx_assets_company on public.assets(company_id);
create index if not exists idx_assets_property on public.assets(property_id);
create index if not exists idx_assets_qr_token on public.assets(qr_token);
create index if not exists idx_assets_asset_code on public.assets(asset_code);
create index if not exists idx_assets_type on public.assets(asset_type_id);

drop trigger if exists trg_assets_updated_at on public.assets;
create trigger trg_assets_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

create table if not exists public.asset_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  from_status public.asset_status,
  to_status public.asset_status not null,
  reason text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists idx_asset_status_history_asset on public.asset_status_history(asset_id);

-- ============================================================
-- AUDIT
-- ============================================================

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  reason text,
  request_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_company_created on public.audit_log(company_id, created_at desc);
create index if not exists idx_audit_log_entity on public.audit_log(entity_table, entity_id);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_entity_id text;
begin
  if tg_op = 'DELETE' then
    v_company := nullif(to_jsonb(old)->>'company_id','')::uuid;
    v_entity_id := to_jsonb(old)->>'id';
    insert into public.audit_log(company_id, actor_user_id, action, entity_table, entity_id, old_data, new_data)
    values(v_company, auth.uid(), tg_op, tg_table_name, v_entity_id, to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    v_company := nullif(to_jsonb(new)->>'company_id','')::uuid;
    v_entity_id := to_jsonb(new)->>'id';
    insert into public.audit_log(company_id, actor_user_id, action, entity_table, entity_id, old_data, new_data)
    values(v_company, auth.uid(), tg_op, tg_table_name, v_entity_id, to_jsonb(old), to_jsonb(new));
    return new;
  else
    v_company := nullif(to_jsonb(new)->>'company_id','')::uuid;
    v_entity_id := to_jsonb(new)->>'id';
    insert into public.audit_log(company_id, actor_user_id, action, entity_table, entity_id, old_data, new_data)
    values(v_company, auth.uid(), tg_op, tg_table_name, v_entity_id, null, to_jsonb(new));
    return new;
  end if;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies',
    'company_memberships',
    'properties',
    'blocks',
    'floors',
    'areas',
    'asset_types',
    'assets',
    'asset_status_history'
  ]
  loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t, t);
  end loop;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.company_memberships enable row level security;
alter table public.properties enable row level security;
alter table public.blocks enable row level security;
alter table public.floors enable row level security;
alter table public.areas enable row level security;
alter table public.asset_types enable row level security;
alter table public.assets enable row level security;
alter table public.asset_status_history enable row level security;
alter table public.audit_log enable row level security;

-- Companies
drop policy if exists "company_members_can_view_company" on public.companies;
create policy "company_members_can_view_company"
on public.companies for select
using (public.is_company_member(id));

-- Profiles
drop policy if exists "users_view_own_profile" on public.profiles;
create policy "users_view_own_profile"
on public.profiles for select
using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists "users_update_own_profile" on public.profiles;
create policy "users_update_own_profile"
on public.profiles for update
using (user_id = auth.uid() or public.is_platform_admin())
with check (user_id = auth.uid() or public.is_platform_admin());

-- RBAC reference data readable by authenticated users.
drop policy if exists "authenticated_read_roles" on public.roles;
create policy "authenticated_read_roles"
on public.roles for select
to authenticated
using (true);

drop policy if exists "authenticated_read_permissions" on public.permissions;
create policy "authenticated_read_permissions"
on public.permissions for select
to authenticated
using (true);

drop policy if exists "authenticated_read_role_permissions" on public.role_permissions;
create policy "authenticated_read_role_permissions"
on public.role_permissions for select
to authenticated
using (true);

-- Memberships
drop policy if exists "members_view_company_memberships" on public.company_memberships;
create policy "members_view_company_memberships"
on public.company_memberships for select
using (public.is_company_member(company_id));

-- Property hierarchy
do $$
declare
  t text;
begin
  foreach t in array array['properties','blocks','floors','areas','assets','asset_status_history']
  loop
    execute format('drop policy if exists "%s_select" on public.%I', t, t);
    execute format(
      'create policy "%s_select" on public.%I for select using (public.is_company_member(company_id))',
      t, t
    );

    execute format('drop policy if exists "%s_insert" on public.%I', t, t);
    execute format(
      'create policy "%s_insert" on public.%I for insert with check (public.has_permission(company_id, ''%s.create''))',
      t, t,
      case when t in ('assets','asset_status_history') then 'asset' else 'property' end
    );

    execute format('drop policy if exists "%s_update" on public.%I', t, t);
    execute format(
      'create policy "%s_update" on public.%I for update using (public.has_permission(company_id, ''%s.edit'')) with check (public.has_permission(company_id, ''%s.edit''))',
      t, t,
      case when t in ('assets','asset_status_history') then 'asset' else 'property' end,
      case when t in ('assets','asset_status_history') then 'asset' else 'property' end
    );
  end loop;
end $$;

-- Asset types: system types (company_id null) plus tenant-owned.
drop policy if exists "asset_types_select" on public.asset_types;
create policy "asset_types_select"
on public.asset_types for select
using (company_id is null or public.is_company_member(company_id));

drop policy if exists "asset_types_insert" on public.asset_types;
create policy "asset_types_insert"
on public.asset_types for insert
with check (company_id is not null and public.has_permission(company_id, 'asset.create'));

drop policy if exists "asset_types_update" on public.asset_types;
create policy "asset_types_update"
on public.asset_types for update
using (company_id is not null and public.has_permission(company_id, 'asset.edit'))
with check (company_id is not null and public.has_permission(company_id, 'asset.edit'));

-- Audit log read is permission-controlled; application users never insert directly.
drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select"
on public.audit_log for select
using (
  company_id is not null
  and (
    public.has_permission(company_id, 'audit.view')
    or public.is_platform_admin()
  )
);

-- ============================================================
-- CONSISTENCY CHECKS
-- Prevent cross-tenant foreign-key mixing.
-- ============================================================

create or replace function public.validate_asset_tenant_consistency()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.properties p
    where p.id = new.property_id and p.company_id = new.company_id
  ) then
    raise exception 'Asset property does not belong to asset company';
  end if;

  if new.block_id is not null and not exists (
    select 1 from public.blocks b
    where b.id = new.block_id and b.company_id = new.company_id
  ) then
    raise exception 'Asset block does not belong to asset company';
  end if;

  if new.floor_id is not null and not exists (
    select 1 from public.floors f
    where f.id = new.floor_id and f.company_id = new.company_id
  ) then
    raise exception 'Asset floor does not belong to asset company';
  end if;

  if new.area_id is not null and not exists (
    select 1 from public.areas a
    where a.id = new.area_id and a.company_id = new.company_id
  ) then
    raise exception 'Asset area does not belong to asset company';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_asset_tenant_consistency on public.assets;
create trigger trg_validate_asset_tenant_consistency
before insert or update on public.assets
for each row execute function public.validate_asset_tenant_consistency();
