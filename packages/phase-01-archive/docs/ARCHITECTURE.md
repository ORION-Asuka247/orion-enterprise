# ORION Enterprise Phase 1 — Architecture Notes

## Trust boundary

The browser is not trusted to enforce tenant separation. RLS is the primary data-isolation boundary.

## Authentication

Supabase Auth owns credentials and sessions. `public.profiles` stores application profile information only.

## Authorisation

Users join companies through `company_memberships`.

Roles contain permissions. Application features should call permission-aware backend operations or rely on RLS policies using `has_permission()`.

## Tenant isolation

Operational tables contain `company_id`. RLS policies require authenticated membership in that company.

Asset inserts also validate that linked property/block/floor/area records belong to the same tenant.

## Audit

Database triggers capture inserts, updates and deletes for critical Phase 1 tables.

For future high-assurance actions, server-side functions should additionally provide request IDs and explicit reasons.

## QR + manual access

`assets.qr_token` is deliberately separate from `asset_code`.

- QR resolves the UUID token.
- Manual workflows search or type the human-readable `asset_code`.
- Both routes resolve the same asset record.

## Phase boundary

Inspection/compliance tables are intentionally excluded from Phase 1 so the universal engine can be built cleanly in Phase 2.
