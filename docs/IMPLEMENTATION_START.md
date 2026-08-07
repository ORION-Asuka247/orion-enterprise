# ORION Enterprise v1.0 Implementation Start

This build is now Netlify-ready at the frontend level.

## Do not drag-and-drop the repository ZIP into Netlify yet.

Use a connected Git repository or Netlify CLI/build deployment so Netlify runs the React build.

## Immediate commissioning sequence

1. Create a fresh Supabase project dedicated to ORION Enterprise Development.
2. Apply migrations `001` through `010` in filename order.
3. Apply available seed files.
4. Create the first Supabase Auth administrator user.
5. Insert a matching `profiles` row.
6. Create the first `companies` row.
7. Add `company_memberships` assigning the administrator role.
8. Copy the Supabase project URL and anon key into Netlify environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
9. Deploy the repository with:
   - Base directory: `apps/web`
   - Build command: `npm run build`
   - Publish directory: `apps/web/dist` when deploying from repository root, or `dist` if Netlify honours `base`.
10. Sign in and verify tenant-isolated dashboard metrics.

## Server-only variables

Do not add these to the browser build:
- `SUPABASE_SERVICE_ROLE_KEY`

Reporting, regulatory workers and privileged integrations must run server-side.
