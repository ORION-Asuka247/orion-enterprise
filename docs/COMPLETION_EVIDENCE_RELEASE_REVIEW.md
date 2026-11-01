# ORION Job Completion & Evidence — 1 November 2026

## Change

The existing authenticated workflow gains separate wide/detail completion photographs, work notes, pending/accepted/rejected review, and independent review before resolving work. Reopening invalidates the previous completion cycle. Inspection photographs are supported for satisfactory findings as well as failures. Reports display private inspection and accepted-completion photographs using short-lived signed URLs. Guest submissions and generic non-defect jobs are not part of this increment.

## Deployment status

Development branch only. The migration has been executed in a transaction for validation and rolled back. No persistent live schema change or web deployment has been performed. Do not deploy only the frontend: apply the matching migration and web build as one controlled pilot release. Root hosting is the default; Hostinger subdirectory builds require `VITE_APP_BASE_PATH=/app/`.

## Completed verification

- Root and `/app/` production builds compiled.
- Migration manifest passed.
- Four completion file/note boundary tests passed (`node --test tests/completion-rules.test.mjs`).
- 34 transactional database checks passed; results and two report snapshots are in `tests/dummy-run-result.json`.
- The dummy run uses an isolated QA tenant, temporary role memberships, simulated request claims and synthetic evidence/Storage metadata. Records and proposed schema were rolled back. PostgreSQL sequences can consume report numbers even when rolled back.
- Two dummy assets tested pass/fail outcomes, missing answers/photos/sign-off, restricted engineer pricing, completion rejection/resubmission/review, closure/reopening controls, accepted-evidence snapshots, report versioning and issue status. Database issue status is not email delivery.
- Anonymous submit/review denied; completion bucket remains private.

## Material limits / customer release blockers

1. Browser sign-in succeeded using a securely supplied existing authorised account. Tenant selection, a labelled dummy property, two dummy asset registrations and manual lookup were verified. The operations account itself still has no active membership; no privileges were added to it. The browser inspection stopped because the Security Test Tenant has no active FIRE_DOOR template. A request to create an isolated demonstration template expired without applying changes.
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

## Browser continuation

The two browser-created records remain labelled `QA-BROWSER-001` and `QA-BROWSER-002` under `ORION DUMMY RUN 01NOV2026 — NOT A CUSTOMER` in `ORION Security Test Tenant`. They are not the rolled-back `QA-DOOR-001/002` database fixtures. No browser inspection, binary upload, browser-generated PDF or delivery has passed yet. Camera detection was unavailable in this cloud browser; the manual fallback successfully opened QA-BROWSER-002. The regulatory module loaded and reported no commissioned sources in the test tenant.

GitHub Actions release checks and Netlify's PR deployment-preview build passed for commit 4267cf14f0f1a7a449cd88bf62b5a37659f0f90a. A successful preview build does not prove the new database migration or browser workflow has been deployed/tested. The production branch is unchanged.

## Fix continuation — 1 November 2026

The isolated demonstration template `QA-BROWSER-20261101` is now active only in ORION Security Test Tenant. QA-BROWSER-001 completed the actual signed-in browser inspection with a simulated 3 mm gap and satisfactory closer answer. Blank final notes were rejected. Its browser-generated FRAEW report is `FR-2026-00011`, report ID `aef65fbc-5384-4027-9359-7bf973c9680b`, left generated, not issued or emailed.

QA-BROWSER-002 recorded a simulated 6 mm gap, generated a defect, and correctly refused submission without a photograph. The cloud browser's file chooser twice returned without attaching a file, although the shared synthetic PNG exists. No Storage upload request was proved; this is an unresolved attachment limitation in this browser, not established evidence that the application's Storage API is broken. The failing inspection remains in progress rather than bypassing its evidence requirement.

Additional fixes remove forced camera capture, show selected filenames, style uninspected property-report entries neutrally, avoid claiming photos exist in empty evidence snapshots, block certificates for failed/non-submitted inspections, and revoke Data API mutation of report-version snapshots. The revised transactional suite passed 34 checks; four file/note boundary tests and the web build passed. These application/database changes remain in draft PR #8, not production.

The earlier missing-template blocker is resolved for the isolated test tenant. Remaining gates include a real binary upload and private-photo display/print, review by separate authorised users in the staged UI, customer/property restrictions, and confirmed delivery. No customer launch date is claimed.

Dependency follow-up: React Router DOM is pinned to 7.18.5, compatible with the existing React 18 / Node 20+ setup. `npm audit --omit=dev` now reports zero known vulnerabilities; the earlier two routing advisories are resolved in this branch. Build and four completion-input tests passed after the upgrade. Signed-in preview navigation still requires its own browser verification before merging.

Refresh regression found in signed-in browser testing: reloading a test-tenant inspection reset the active company to the first membership, then displayed a raw single-row error. The fix stores the selection per user and restores it only if present in the current authorised membership list. A revoked/unknown saved ID cannot select a workspace. Five frontend boundary tests now pass, including workspace restoration/revocation handling. Browser confirmation of the new preview remains outstanding.
