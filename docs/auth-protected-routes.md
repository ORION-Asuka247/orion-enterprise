# ORION authentication and protected routes

ORION uses the existing **ORION Enterprise Development** Supabase project
(`ddkynpshqekkqtvphogr`). Email/password login is enabled and public signup is
disabled. Users and workspace assignments are provisioned by ASUKA247.

## Browser configuration

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend build
environment. Existing `VITE_SUPABASE_ANON_KEY` builds remain compatible. Never
put a secret or service role key into a `VITE_` variable. For Hostinger use
`VITE_APP_BASE_PATH=/app/`. Frontend environment values are embedded at build time.

## Access boundaries

- `AuthGate` wraps the entire router, including direct links, report detail,
  asset inspection, QR routes and the client portal. Unauthenticated requests
  show the sign-in form at the requested URL; successful login resumes that URL.
- Stored sessions and Auth events are verified with `auth.getUser(access_token)`
  before any protected page mounts. Failed verification closes access and shows
  a retry/sign-in message. Sign-out and newer Auth events invalidate pending
  verification results. Listeners and pending callbacks are cleaned up on unmount.
- `Shell` waits for an active workspace before mounting a route. Customer
  accounts can use only assets, reports and the client portal; staff routes
  redirect to the portal. These UI checks supplement the database policies.
- Database RLS and RPC permission checks remain the authority for tenant,
  property, report and expiry restrictions. This patch does not change those
  policies, report sharing, existing memberships or the seven-day demo scope.
- Password recovery redirects to `/app/setup-password` on Hostinger. Keep that
  exact URL in Supabase Auth's allowed redirect URLs. An authenticated user sees
  password setup before the main router; failed/expired links remain at login.
- Sign-out failures are reported rather than silently implying logout succeeded.

## Verification

Run `node --test tests/*.test.mjs` and `npm run build`. The Auth tests cover stored
session verification, missing/rejected sessions, identity mismatches, network
failure, sign-out races, stale initialization, recovery and listener cleanup.

Before releasing, browser-check direct protected links without a session,
an invalid stored session, successful staff login, customer route restrictions
and sign-out. Use a dedicated test account for a real email/password and recovery
round trip; no user passwords or reset emails are needed for mocked route checks.

The hosted project already has RLS enabled on all public tables and restrictive
customer policies. Supabase's security advisor also flags existing callable
`SECURITY DEFINER` RPCs; they require individual authorization review and are not
automatically changed by this frontend patch.
