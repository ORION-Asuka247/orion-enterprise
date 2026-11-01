# ORION Intelligence AI connection

The Intelligence screen uses the authenticated `orion-intelligence` Supabase Edge Function. It sends only a server-generated aggregate count snapshot to OpenAI's Responses API, using the pinned `gpt-5.4-mini-2026-03-17` model. No user free-text, names, addresses, photographs or internal rates are sent in this version. It cannot mutate inspections, works, reports or customer assignments.

## Activation

The project administrator must add `OPENAI_API_KEY` under Supabase Dashboard > Edge Functions > Secrets for project ddkynpshqekkqtvphogr. Enter the key privately in the dashboard; never paste it into chat, commit it, or add it as a VITE variable. The key needs access to the Responses API/model, with provider billing/credits configured by the account owner. Creating an API key or enabling billing is a separate account action. Do not buy credits without the owner's approval.

The function reads the key at request time. No redeploy is needed after adding the secret. Its public GET health response reports only key presence and the pinned model; it does not prove the key is valid or that billing/model access works. The UI distinguishes configuration from a completed model response.

## Access and measurement

POST validates the caller through Supabase Auth's `/auth/v1/user`, then obtains data through the caller's RLS and the staff-only context RPC. `verify_jwt=false` is intentional because the handler validates bearer tokens itself; only the no-data health check is public. Callers need `report.generate` and cannot be customer-role members. The service key exists only inside the Edge Function and writes the usage log.

Every reserved request records workspace, actor ID, model, prompt version, exact input counts, status, result or error code, provider-reported token counts, elapsed time and estimated USD cost. Clients cannot forge or change the audit. Cost estimates use the checked 1 November 2026 rates: $0.75/M normal input, $0.075/M cached input and $4.50/M output tokens. The provider bill is authoritative; unknown token/cost data is not displayed as zero.

The initial pilot limits each workspace to 20 reserved requests per UTC day and a 15-second actor cooldown, enforced in a serialized database reservation. Output is capped at 1,200 tokens. The screen loads only the latest 20 runs and labels its averages and totals accordingly. A pending entry can mean an interrupted function, so do not assume it was free or retry automatically. No background AI calls run on page load.

## Deployment and checks

Apply `20261101144255_intelligence_ai_audit.sql`, deploy `supabase/functions/orion-intelligence/index.ts` plus handler.ts, and publish the frontend. Hostinger uses `/app/` and the existing checksum/backup installer. The API key is not part of that archive.

Run `node --test tests/*.test.mjs`, TypeScript checking of the portable handler, frontend builds for `/` and `/app/`, and migration-manifest validation. Database access tests combine the existing completion/customer fixtures with `tests/intelligence-ai-access.sql` inside BEGIN/ROLLBACK. These simulations do not count as a successful external AI request.

After activation, generate one briefing in the test workspace and verify: completed provider response, correct counts, log entry, token counts, duration and priced estimate. Then test a permitted staff user, denied customer, foreign workspace, failure path and cap. Customer browsers must never receive the service key or provider key.

Official references:
- https://developers.openai.com/api/docs/models/gpt-5.4-mini
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/functions/auth-legacy-jwt
