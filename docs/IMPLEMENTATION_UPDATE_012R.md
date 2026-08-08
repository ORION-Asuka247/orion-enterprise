# ORION Update 012R — Live Asset Register

This revision supersedes the earlier Update 012 package.

## Why revised
ORION Phase 1 already contained the core asset table and fields:
- asset_code
- qr_token
- manufacturer
- model
- serial_number
- install_date
- status
- asset_status_history

012R preserves that original schema and extends it rather than creating duplicate concepts.

## Adds
- inspection frequency and expected life to asset types
- asset condition
- eight practical starter asset types
- secure create_asset_record RPC
- asset creation audit entry
- initial asset status-history entry
- lookup_asset RPC
- live searchable Asset Register UI
- manual lookup preserved alongside QR identity

## Release
Run migration `20260807_012R_live_asset_register.sql`, then install this patch, commit and push.

Do not run the superseded `20260807_012_live_asset_register.sql`.
