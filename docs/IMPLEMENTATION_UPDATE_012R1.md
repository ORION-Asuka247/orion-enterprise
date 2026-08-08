# ORION Update 012R.1 - Asset Type Taxonomy Fix

This fix removes duplicate asset types from the database and also de-duplicates them defensively in the front end.

Release order:
1. Run `20260808_012R1_asset_type_taxonomy_fix.sql` in Supabase SQL Editor.
2. Install the patch.
3. Commit and push.
4. Confirm each asset type appears once in Assets -> Register asset.
