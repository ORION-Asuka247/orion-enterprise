-- ORION Enterprise v1.0
-- Update 020: Release RLS policy coverage
--
-- Purpose: remove policyless-RLS ambiguity while preserving least privilege.
-- Service-role/background jobs continue to bypass RLS. Browser access is granted
-- only where an authenticated tenant/user or platform-admin use case is explicit.

-- Tenant/user AI data
create policy "ai_conversations_own_member_select"
on public.ai_conversations for select to authenticated
using (user_id = auth.uid() and public.is_company_member(company_id));

create policy "ai_conversations_own_member_insert"
on public.ai_conversations for insert to authenticated
with check (user_id = auth.uid() and public.is_company_member(company_id));

create policy "ai_conversations_own_member_update"
on public.ai_conversations for update to authenticated
using (user_id = auth.uid() and public.is_company_member(company_id))
with check (user_id = auth.uid() and public.is_company_member(company_id));

create policy "ai_conversations_own_member_delete"
on public.ai_conversations for delete to authenticated
using (user_id = auth.uid() and public.is_company_member(company_id));

create policy "ai_insights_member_select"
on public.ai_insights for select to authenticated
using (public.is_company_member(company_id));

-- API/integration administration
create policy "api_clients_platform_admin"
on public.api_clients for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "api_audit_log_authorised_select"
on public.api_audit_log for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.api_clients c
    where c.id = api_client_id
      and public.has_permission(c.company_id, 'audit.view')
  )
);

-- Commercial/approval controls
create policy "approval_requests_quote_approver_select"
on public.approval_requests for select to authenticated
using (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_id
      and public.has_permission(q.company_id, 'quote.approve')
  )
  or public.is_platform_admin()
);

create policy "approval_requests_quote_approver_update"
on public.approval_requests for update to authenticated
using (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_id
      and public.has_permission(q.company_id, 'quote.approve')
  )
  or public.is_platform_admin()
)
with check (
  exists (
    select 1 from public.quotations q
    where q.id = quotation_id
      and public.has_permission(q.company_id, 'quote.approve')
  )
  or public.is_platform_admin()
);

create policy "commercial_action_rates_authorised_select"
on public.commercial_action_rates for select to authenticated
using (public.has_permission(company_id, 'commercial.pricing.view') or public.is_platform_admin());

create policy "commercial_rate_profiles_authorised_select"
on public.commercial_rate_profiles for select to authenticated
using (public.has_permission(company_id, 'commercial.pricing.view') or public.is_platform_admin());

create policy "document_sequences_platform_admin"
on public.document_sequences for select to authenticated
using (public.is_platform_admin());

-- Asset/property intelligence: tenant-scoped read only.
create policy "asset_lifecycle_authorised_select"
on public.asset_lifecycle for select to authenticated
using (
  exists (
    select 1 from public.assets a
    where a.id = asset_id
      and public.has_permission(a.company_id, 'asset.view')
  )
  or public.is_platform_admin()
);

create policy "asset_predictions_authorised_select"
on public.asset_predictions for select to authenticated
using (
  exists (
    select 1 from public.assets a
    where a.id = asset_id
      and public.has_permission(a.company_id, 'asset.view')
  )
  or public.is_platform_admin()
);

create policy "building_health_authorised_select"
on public.building_health for select to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_id
      and public.has_permission(p.company_id, 'property.view')
  )
  or public.is_platform_admin()
);

create policy "executive_briefs_member_select"
on public.executive_briefs for select to authenticated
using (public.is_company_member(company_id) or public.is_platform_admin());

-- Global platform configuration/regulatory control remains platform-admin only.
create policy "integration_connectors_platform_admin"
on public.integration_connectors for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "regulatory_reviews_platform_admin"
on public.regulatory_reviews for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "regulatory_source_runs_platform_admin"
on public.regulatory_source_runs for select to authenticated
using (public.is_platform_admin());

create policy "regulatory_topic_mappings_platform_admin"
on public.regulatory_topic_mappings for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "rule_change_proposals_platform_admin"
on public.rule_change_proposals for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- Webhook secrets must never be exposed to ordinary tenant members.
create policy "webhook_subscriptions_platform_admin"
on public.webhook_subscriptions for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- Harden legacy lookup RPC: direct authenticated calls are permitted only for
-- a company the caller belongs to. The current browser resolves assets through
-- tenant-scoped RLS queries, but this keeps the legacy RPC safe if reused.
create or replace function public.lookup_asset(
  p_company_id uuid,
  p_identifier text
)
returns setof public.assets
language sql
stable
security definer
set search_path = public
as $$
  select a.*
  from public.assets a
  where auth.uid() is not null
    and public.is_company_member(p_company_id)
    and a.company_id = p_company_id
    and (
      upper(a.asset_code) = upper(trim(p_identifier))
      or a.qr_token::text = trim(p_identifier)
      or lower(coalesce(a.serial_number,'')) = lower(trim(p_identifier))
    )
  limit 1;
$$;
