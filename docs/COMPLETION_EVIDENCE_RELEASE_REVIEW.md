# ORION Job Completion & Evidence — 1 November 2026

## Change

The existing authenticated workflow gains separate wide/detail completion photographs, work notes, pending/accepted/rejected review, and independent review before resolving work. Reopening invalidates the previous completion cycle. Inspection photographs are supported for satisfactory findings as well as failures. Reports display private inspection and accepted-completion photographs using short-lived signed URLs. Guest submissions and generic non-defect jobs are not part of this increment.

## Deployment status

Development branch only. The migration has been executed in a transaction for validation and rolled back. No persistent live schema change or web deployment has been performed. Do not deploy only the frontend: apply the matching migration and web build as one controlled pilot release. Root hosting is the default; Hostinger subdirectory builds require `VITE_APP_BASE_PATH=/app/`.

## Completed verification

- Root and `/app/` production builds compiled.
- Migration manifest passed.
- Four completion file/note boundary tests passed (`node --test tests/completion-rules.test.mjs`).
- 31 transactional database checks passed; results and two report snapshots are in `tests/dummy-run-result.json`.
- The dummy run uses an isolated QA tenant, temporary role memberships, simulated request claims and synthetic evidence/Storage metadata. Records and proposed schema were rolled back. PostgreSQL sequences can consume report numbers even when rolled back.
- Two dummy assets tested pass/fail outcomes, missing answers/photos/sign-off, restricted engineer pricing, completion rejection/resubmission/review, closure/reopening controls, accepted-evidence snapshots, report versioning and issue status. Database issue status is not email delivery.
- Anonymous submit/review denied; completion bucket remains private.

## Material limits / customer release blockers

1. Browser authentication and active tenant membership: the existing operations account is present but has no active membership for ASUKA247. No privileges have been added to it.
2. Real binary uploads, image download/signing, camera behaviour, reloads and print output still need signed-in browser/mobile verification. The database run used metadata fixtures, not real uploaded images.
3. Test actual customer property restrictions and the portal's document-download journey. The current portal lists documents but lacks a completed customer download flow. A denied helper call or query against an empty foreign tenant is not a complete tenant-isolation suite.
4. No guest upload-link or QR-request flow is deployed.
5. Source/live schema drift exists: the live remedial RPC has transition checks absent from the earlier source migration. This migration enforces transitions at trigger level for every write path. Reconcile remaining drift before reproducible clean-environment deployment.
6. `npm audit --omit=dev` reports two moderate React Router advisories; review/update before customer launch.
7. Report delivery is untested; recipient text “nonfiction” is unresolved. No outbound email was sent.
8. Existing release gates for backups/restore, mobile interruption, approved compliance templates and customer isolation remain open. Do not infer certification from passing a demonstration rule.

## Pilot release sequence

Use an authorised existing account; stage the combined migration and web build; repeat the two-asset run with real test photographs and reviewer accounts; inspect both generated reports and mobile behaviour; test delivery to the confirmed internal recipient; then approve a limited customer pilot. Do not claim a full public launch date until this run is complete.

## Database reproduction

In a trusted Supabase SQL test connection, execute `BEGIN`, the new migration, `tests/completion-dummy-run.sql`, and `ROLLBACK` as one transaction. The test requires the pre-existing operations account referenced in the fixture. Use non-production whenever available; never omit rollback against a live project. Capture the final `dummy_run` JSON before rollback. No secret keys or passwords are required or present in the test.
