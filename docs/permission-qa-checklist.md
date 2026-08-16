# ORION Permission QA Execution Checklist

Use this checklist before routine non-admin production accounts are created.

## Test roles

- Platform Admin
- Property Manager
- Engineer

Use a disposable Security Test Tenant and test assets. Do not use live 30 Bath Road records for permission testing.

## Property Manager acceptance

Confirm a Property Manager can, within their own company only:

- view company properties/buildings/units/assets
- create and edit the permitted property hierarchy
- create and edit permitted assets
- create and manage defects/remedial records appropriate to the role
- generate an allowed operational/compliance report

Confirm a Property Manager cannot, unless separately granted:

- view internal commercial pricing/rates
- use platform-administration features
- approve inspections if `inspection.approve` is not granted
- read or write another company's records

## Engineer acceptance

Confirm an Engineer can, within their own company only:

- start a guided inspection
- save and update inspection answers through `orion_save_inspection_answer`
- upload inspection evidence to the private `inspection-evidence` bucket
- submit an inspection through `orion_submit_inspection`
- create/manage inspection-generated defects as intended

Confirm an Engineer cannot:

- approve inspections
- generate restricted reports
- view internal commercial pricing/rates
- read or write another company's records

## Migration 022 regression

Migration `20260815_022_require_inspection_signoff_notes.sql` requires non-empty final engineer notes before submission. Verify:

1. submission with blank final notes fails
2. submission with final notes succeeds when all required items/evidence are complete
3. the final notes persist on `orion_inspection_runs.engineer_notes`
4. failed items that require photographs cannot be submitted without linked evidence

## Permission-key review

The guided inspection RLS/RPC code currently accepts either:

- `inspection.create`
- `inspection.edit`

Migration 022 also accepts either permission on submission.

Before future RBAC expansion, reconcile this with the live permission catalogue. Do not remove `inspection.edit` or add a new permission solely from source inspection; first confirm the deployed permission rows and role mappings.

## Exit criteria

Permission QA passes only when:

- Property Manager own-tenant positive tests pass
- Property Manager cross-tenant negative tests pass
- Engineer Migration 022 regression tests pass
- commercial-pricing restrictions pass
- inspection-approval restrictions pass
- all tests are recorded with role, tenant, action, expected result and actual result

Until then, do not create routine production non-admin accounts.
