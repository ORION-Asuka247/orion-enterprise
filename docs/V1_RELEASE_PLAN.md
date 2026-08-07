# v1.0 Release Plan

## Gate 1 — Database
- Apply all migrations to a fresh development Supabase project.
- Resolve any conflicts from early phase scaffolding.
- Consolidate duplicate tables/permissions where required.
- Verify RLS.

## Gate 2 — Web shell
- Connect authenticated tenant context.
- Replace placeholder module screens with live queries.
- Implement route-level permissions.

## Gate 3 — Field workflow
- Merge Phase 3 engineer components into `/inspections`.
- Complete QR/manual lookup.
- Complete offline sync and evidence upload.

## Gate 4 — Reporting
- Deploy reporting worker.
- Connect inspection submit → report generation.
- Validate document hashes and versions.

## Gate 5 — Regulatory intelligence
- Deploy GOV.UK/legislation adapters in observe-only mode.
- Review false positives.
- Activate human review console.

## Gate 6 — Commercial
- Complete defect → work order → quote → approval → completion flow.
- Add VAT, rate cards and client-specific pricing.

## Gate 7 — Pilot
- Pilot with a single managed property portfolio.
- Measure engineer usability, reporting accuracy, sync failures and admin workload.

## Gate 8 — Production
- Security review
- Backup/recovery test
- Monitoring/alerting
- Privacy and retention controls
- Release sign-off
