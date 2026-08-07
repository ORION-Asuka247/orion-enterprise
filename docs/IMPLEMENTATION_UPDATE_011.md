# ORION v1.0 Implementation Update — Building Setup Wizard

This update adds the first operational commissioning workflow.

## What it adds

- `/setup` first-run Building Setup Wizard
- Property creation
- Multi-block creation
- Basement / Ground / upper-floor creation
- Optional Ground Floor Lobby area
- Transactional database RPC
- Live Properties hierarchy page
- Dashboard commissioning banner
- Dashboard automatically recognises when the first property exists

## Database

Apply migration:

`20260807_011_building_setup_wizard.sql`

after migrations 001–010.

The RPC runs the complete building setup inside one PostgreSQL transaction. If any part fails, the entire operation is rolled back.

## Release sequence

1. Apply migration 011 in Supabase SQL Editor.
2. Overlay patch files into the local `orion-enterprise-v1-implementation` repository.
3. Commit.
4. Push.
5. Netlify auto-deploys.
6. Sign in and select **Start building setup**.
