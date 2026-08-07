# ORION Enterprise v1.0

This is the consolidated ORION Enterprise codebase built from Phases 1–10.

## Included

- Unified monorepo
- React enterprise shell
- Supabase multi-tenant data foundation
- Compliance and inspection engine
- Engineer field/offline architecture
- Controlled reporting engine
- Regulatory intelligence engine
- Works and commercial workflow
- Asset lifecycle/predictive layer
- Client portal architecture
- Enterprise AI layer
- API/integration architecture
- All prior database migrations retained in deployment order

## Important

This is a consolidated **development build**, not a finished certified production product.

It now gives ORION one source tree and one deployment authority. The next engineering work should happen in this repository rather than in separate phase ZIPs.

## Database deployment order

Apply migrations in filename order from `supabase/migrations`.

Then apply seed files in `supabase/seed`.

## Web app

```bash
cp .env.example .env
npm install
npm run dev
```

For production:
```bash
npm run build
```

## Security

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

Keep report generation, regulatory workers and privileged integrations server-side.

## Release gate before production

- Resolve migration compatibility against a clean Supabase project
- Run RLS tenant-isolation tests
- Replace demonstration compliance rules with verified approved rules
- Complete field/offline tests
- Complete document-control tests
- Run regulatory intelligence in observe-only mode first
- Complete security review and penetration testing
- Configure monitoring, backups, incident response and recovery

## Implementation status

v1.0 implementation has begun. The web shell now includes Supabase authentication, tenant selection, live dashboard metric queries and Netlify build configuration.
