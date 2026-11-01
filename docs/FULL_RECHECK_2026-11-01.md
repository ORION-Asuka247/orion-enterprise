# ORION full recheck — 1 November 2026

## Decision

Controlled pilot only. A successful test suite is not evidence of 100% production readiness. Frontend corrections in this change must be installed on Hostinger before they are described as live there.

## Verified

- 22 Node tests passed: completion input validation, workspace selection, Hostinger backup/checksum/permissions, AI authentication/audit/quotas, QR bases, pass-rate calculation and quotation safeguards.
- 72 database assertions passed in a single rolled-back transaction: building/asset setup, pass/fail inspection, mandatory evidence and sign-off, report generation/versioning/issue, immutable snapshots, completion acceptance and independent review, cross-tenant/customer/property/storage isolation, AI staff access/cooldown/daily cap.
- Actual PDF rendering regression passed: report text and test watermark visible; staff controls absent; QR label prints without unrelated asset history. The previous stylesheet rendered the captured report blank; corrected output contains its report number and findings.
- Root and /app/ production builds passed; 25 migration files match the approved manifest; production npm audit found zero vulnerabilities.
- 13 public Hostinger routes/resources returned HTTP 200 with correct HTML/JS/CSS types, nosniff and SAMEORIGIN headers. HTTPS requests validated normally.
- All 74 public base tables have RLS enabled. Inspection, completion and generated-document buckets are private.
- A real OpenAI test completed at 16:11:32 London time: 4.3 seconds, 260 input / 358 output tokens, estimated US$0.001806. Result and audit survived a reload. Earlier failed commissioning attempts remain accurately recorded.
- Fresh browser run on Hostinger created test property QA-AZ-20261101 (two blocks, four floors), registered QA-AZ-001, saved two synthetic passing answers, enforced Other/comment and final-note requirements, submitted inspection eec1d6b1-17e6-4d66-9f52-015e75e2853e, generated report IR-2026-00037 (d3065c3a-6718-4f84-ad65-0961dba3825e), issued it and observed it in the portal.
- Dummy portal message persisted. A synthetic PDF was uploaded privately, published to the dummy property's vault and downloaded through ORION; SHA256 matched the uploaded bytes and its text/watermark remained readable.
- Existing wide/detail completion photographs loaded. A dummy defect advanced to In Progress. Pending independent review stayed pending; no real repair or compliance completion was asserted.

All browser mutations were in ORION Security Test Tenant. No customer email, invitation, quotation, commercial commitment or automatic completion was sent/performed. The uploaded PDF is a synthetic QA print specimen, not a customer certificate.

## Corrections

- Scope QR-only print hiding to pages containing a QR label; keep reports printable, preserve dummy watermark, hide staff controls, avoid splitting individual findings.
- Add PDF/QR render regression to CI.
- Clear and remount workspace/route state; handle workspace-loading failure; avoid stale initial-auth results and stale searches; show loading rather than invented empty dashboards/registers.
- Client-role navigation is restricted to portal/reports; database authorization remains authoritative.
- Reject invalid, nonfinite, zero-hourly or incomplete pricing configuration before a quotation is marked ready. Unreviewed packages are excluded from totals. No VAT is added by the calculator.
- Lazy-load route modules. Configured /app/ entry JavaScript decreased from 608.44 kB to 474.08 kB before compression (about 22%); this is a bundle-size measurement, not a real-device speed claim.
- Report safe provider error classes and status without logging keys or upstream messages.
- Clearly state when automatic regulatory monitoring is not active.

## Still open — cannot honestly count as passed

1. **Hostinger frontend install:** this environment has no working authorized file-transfer connection; the user-operated SSH path works. A checksum/backup release archive is provided. Netlify deployment does not update Hostinger.
2. **Customer account lifecycle:** invitation/activation, password recovery and a separate customer's full browser session have not been demonstrated. SQL role-isolation tests passed; they are not a substitute for this acceptance run. The application has no self-service invitation or recovery screens.
3. **Production authentication/recovery:** organization is Free; leaked-password protection is disabled and requires Pro or above. No paid upgrade was purchased. Database/storage off-site backup and a full restore drill are not evidenced; database backups alone do not contain stored file bytes.
4. **Regulatory service:** zero enabled sources; scheduled collection and an observe-only acceptance period are not commissioned. Working portfolio AI does not activate regulatory monitoring.
5. **Field acceptance:** real mobile camera, interrupted connectivity/offline synchronization and representative multi-user load are not demonstrated. This frontend does not implement an offline save/sync queue.
6. **Production governance:** separate production/nonproduction backend, approved competent-person rule/template ownership, independent security review and release-owner sign-off remain open.
7. **Email delivery:** report emailing is not implemented/verified. Issuing makes the report available to authorized portal users; it does not send an email.

Security advisor retains 24 expected authenticated SECURITY DEFINER warnings on deliberately guarded RPCs plus the password-protection warning. Performance advisor reports four AI-conversation auth-initplan warnings, nine overlapping-policy warnings and informational index findings. No permission was widened or warning suppressed to improve a score.

## Reproduce checks

```sh
node --test tests/*.test.mjs
python3 tests/check_report_print.py  # WeasyPrint 70.0, pypdf 6.10.0
npm run build
python3 scripts/check_migrations.py
npm audit --omit=dev
```

Database fixture suites: completion-dummy-run.sql, customer-property-scope.sql, intelligence-ai-access.sql, in that order inside BEGIN/ROLLBACK. Never apply their fixture data persistently. Customer tests use synthetic database roles, not customer passwords.
