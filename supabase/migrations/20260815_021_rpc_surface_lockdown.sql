-- ORION Enterprise v1.0
-- Update 021: RPC surface lockdown
--
-- Keep browser-required SECURITY DEFINER RPCs explicitly callable by authenticated
-- users, but remove direct Data API access to internal/legacy helpers and opt out
-- of automatic EXECUTE grants for future functions.

-- Future functions are private by default; migrations must explicitly grant API access.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Internal numbering helper; called by controlled report generators, not the browser.
revoke execute on function public.next_document_number(uuid, public.document_type)
  from public, anon, authenticated;
grant execute on function public.next_document_number(uuid, public.document_type)
  to service_role;

-- Legacy asset lookup is superseded by tenant-scoped RLS queries in the web client.
revoke execute on function public.lookup_asset(uuid, text)
  from public, anon, authenticated;
grant execute on function public.lookup_asset(uuid, text)
  to service_role;

-- Regulatory ingestion/control functions are background/admin operations only.
revoke execute on function public.record_regulatory_document_version(uuid, text, text, text, text, text, date, date, date, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_regulatory_document_version(uuid, text, text, text, text, text, date, date, date, text, text, jsonb, jsonb)
  to service_role;

revoke execute on function public.run_regulatory_impact_analysis(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.run_regulatory_impact_analysis(uuid, uuid)
  to service_role;

revoke execute on function public.review_regulatory_change(uuid, text, text, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.review_regulatory_change(uuid, text, text, boolean, boolean, boolean)
  to service_role;

-- Document binary/version registration belongs to trusted document-generation jobs.
revoke execute on function public.register_document_version(uuid, uuid, text, bigint, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.register_document_version(uuid, uuid, text, bigint, text, jsonb, text)
  to service_role;

-- Legacy inspection submission endpoint; current application uses orion_submit_inspection.
revoke execute on function public.submit_inspection(uuid)
  from public, anon, authenticated;
grant execute on function public.submit_inspection(uuid)
  to service_role;

-- Browser-required privileged RPCs remain intentionally exposed to authenticated.
-- Their function bodies perform authentication, tenant and/or permission checks.
-- This list is reviewed as part of the release gate:
--   commercial_get_pricing_config
--   commercial_is_company_admin
--   commercial_update_action_rate
--   commercial_update_rate_profile
--   create_asset_record
--   create_building_setup
--   has_permission
--   is_company_member
--   is_platform_admin
--   orion_generate_property_fire_door_report
--   orion_generate_report
--   orion_issue_report
--   orion_save_inspection_answer
--   orion_start_asset_inspection
--   orion_submit_inspection
--   orion_update_defect
