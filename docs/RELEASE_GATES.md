# ORION v1 Production Release Gates

A gate is green only when objective evidence exists. Do not mark manual controls green from assumption.

## Gate 1 — Functional

- [x] Web application compiles in CI.
- [x] Migration filenames and sequence are automatically checked.
- [ ] Automated end-to-end tests cover authentication, tenant selection, property setup, asset registration, inspection/evidence/submission, defect/remedial closure and report generation.
- [ ] Field workflow verified on representative mobile devices and interrupted connectivity.

## Gate 2 — Control & Security

- [ ] Tenant-isolation/RLS test suite passes for two independent tenants.
- [ ] Supabase security advisor has no unexplained production warnings.
- [ ] SECURITY DEFINER RPC exposure has been reviewed and explicitly allow-listed.
- [ ] Controlled compliance rules/templates have approved owners and versions.
- [ ] Document-control/versioning tests pass.
- [ ] Leaked-password protection enabled for production authentication.
- [ ] Independent security review / penetration test completed with critical and high findings closed.

## Gate 3 — Production Operations

- [x] Production web build configuration is version controlled.
- [x] CI rejects service-role secret references in browser source and committed runtime .env files.
- [ ] Production and non-production environments are separated and documented.
- [ ] Monitoring and alerting are configured and tested.
- [ ] Database/storage backups are configured and a restore drill has succeeded.
- [ ] Incident response and rollback procedures are tested.
- [ ] Regulatory intelligence has completed an observe-only acceptance period.
- [ ] Named release owner signs off the release candidate.

## Current release decision

**HOLD — not yet production-certified.**

The application can be deployed for controlled development/pilot use, but the unchecked controls above are mandatory evidence gates before ORION is represented as production-certified enterprise software.
