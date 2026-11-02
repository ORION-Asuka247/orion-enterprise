-- Time-limited memberships are checked against server time, including existing JWT sessions.
alter table public.company_memberships add column access_expires_at timestamptz;

create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_platform_admin() or exists(select 1 from public.company_memberships cm
 where cm.company_id=target_company and cm.user_id=auth.uid() and cm.status='active'
 and (cm.access_expires_at is null or cm.access_expires_at>now()));
$$;
create or replace function public.has_permission(target_company uuid,permission_code text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_platform_admin() or exists(select 1 from public.company_memberships cm
 join public.role_permissions rp on rp.role_id=cm.role_id join public.permissions p on p.id=rp.permission_id
 where cm.company_id=target_company and cm.user_id=auth.uid() and cm.status='active'
 and (cm.access_expires_at is null or cm.access_expires_at>now()) and p.code=permission_code);
$$;
create or replace function public.orion_can_access_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.properties p where p.id=p_property_id
 and public.is_company_member(p.company_id) and (public.is_platform_admin() or exists(
 select 1 from public.company_memberships m join public.roles r on r.id=m.role_id
 where m.company_id=p.company_id and m.user_id=auth.uid() and m.status='active'
 and (m.access_expires_at is null or m.access_expires_at>now()) and (
 r.code in ('company_admin','compliance_manager','property_manager','engineer','auditor','read_only','subcontractor')
 or (r.code='client' and exists(select 1 from public.orion_customer_properties cp where cp.user_id=auth.uid() and cp.property_id=p.id))))));
$$;
-- Retain customer classification even after expiry so restrictive customer boundaries never relax.
create policy membership_expiry_boundary on public.company_memberships as restrictive for select to authenticated
using(user_id<>(select auth.uid()) or access_expires_at is null or access_expires_at>now());
revoke all on function public.is_company_member(uuid) from public,anon;
revoke all on function public.has_permission(uuid,text) from public,anon;
revoke all on function public.orion_can_access_property(uuid) from public,anon;
grant execute on function public.is_company_member(uuid),public.has_permission(uuid,text),public.orion_can_access_property(uuid) to authenticated;
