# Offline Synchronisation Strategy

ORION field work must remain safe under unreliable connectivity.

## Local stores

IndexedDB contains:

- assignments
- assets
- templates
- drafts
- syncQueue
- blobs

## Mutation approach

Every queued mutation should eventually carry a client-generated UUID.

The database includes `client_mutation_id` for inspection answers and evidence. This allows a retry to be treated as the same operation rather than a new record.

## Conflict principle

Inspection answers are unique by `(inspection_id, question_id)`.

For field answers, the latest successful engineer mutation for the same question may update the draft answer until the inspection is submitted.

After submission, future implementation should lock ordinary engineer edits and require an authorised amendment workflow.

## Evidence

Evidence must not be silently discarded after a failed upload.

The local blob is deleted only after:

1. storage upload succeeds; and
2. the database evidence record is created.

## Submission

Submission must occur server-side using `submit_inspection()`.

This ensures:

- required answers are checked
- required evidence is checked
- rule snapshot is captured
- outcome is recalculated
- status transition is recorded
- assignment is completed
