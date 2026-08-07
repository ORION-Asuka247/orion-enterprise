# Phase 1 Deployment Checklist

## Before deployment

- [ ] Create separate ORION Enterprise Development Supabase project
- [ ] Enable MFA for administrator accounts where available
- [ ] Record project URL securely
- [ ] Never commit service-role keys
- [ ] Confirm production ORION remains untouched

## Database

- [ ] Apply Phase 1 migration
- [ ] Apply baseline seed
- [ ] Confirm all listed tables exist
- [ ] Confirm RLS is enabled
- [ ] Confirm policies exist
- [ ] Confirm baseline roles exist
- [ ] Confirm baseline permissions exist
- [ ] Confirm system asset types exist

## First tenant

- [ ] Create first Auth user
- [ ] Insert matching profile
- [ ] Create first company
- [ ] Assign company_admin membership
- [ ] Sign in as that user
- [ ] Confirm own tenant is visible
- [ ] Confirm unrelated tenant data is not visible

## Security tests

- [ ] Attempt cross-tenant property SELECT
- [ ] Attempt cross-tenant asset SELECT
- [ ] Attempt cross-tenant asset INSERT
- [ ] Attempt asset insert linking another tenant's property
- [ ] Verify each attempt is denied

## Functional tests

- [ ] Create property
- [ ] Create block
- [ ] Create floor
- [ ] Create area
- [ ] Create asset using manual asset code
- [ ] Resolve same asset using QR token
- [ ] Update asset status
- [ ] Confirm status history
- [ ] Confirm audit entry generated

## Release gate

Phase 2 should not begin until tenant-isolation and audit tests pass.
