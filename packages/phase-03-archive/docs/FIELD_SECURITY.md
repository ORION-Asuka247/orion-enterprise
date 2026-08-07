# Phase 3 Field Security

## Browser trust

The mobile browser is treated as untrusted.

Tenant isolation remains enforced by PostgreSQL Row Level Security.

## Storage

`inspection-evidence` must remain a private Supabase bucket.

Object paths start with `company_id`, allowing storage RLS to verify company membership.

## Secrets

Only the Supabase anon key belongs in the PWA.

Never place:

- service-role key
- database password
- private API keys

inside the frontend bundle.

## Device loss

Production rollout should require:

- short session lifetime appropriate to field operations
- remote account suspension
- device screen lock policy for company devices
- minimal offline personal data
- no persistent service credentials

## Evidence integrity

Future hardening should add:

- SHA-256 file hash
- server timestamp
- optional EXIF retention controls
- evidence amendment history
- explicit annotation copies rather than overwriting originals
