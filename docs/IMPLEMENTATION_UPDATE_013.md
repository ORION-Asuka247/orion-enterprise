# ORION Enterprise Update 013 - QR Identity and Asset History

## Adds

- QR code rendering for every asset using its existing `qr_token`.
- Secure QR URL: `/q/<qr_token>`.
- Authenticated QR resolver; QR codes do not bypass tenant permissions.
- Camera QR scanning using the browser BarcodeDetector API when available.
- Permanent manual lookup fallback by asset code or serial number.
- Permanent Asset Detail page.
- Asset identity, property/block/floor/area, condition and lifecycle data.
- Inspection, defect and asset-status timeline.
- Printable QR asset label.
- Asset Register rows now open the permanent Asset Detail page.
- Newly registered assets open their Asset Detail page immediately.

## Database

No new database migration is required for Update 013.

ORION already has:
- `assets.qr_token`
- `asset_status_history`
- `inspections`
- `defects`
- tenant RLS policies

Update 013 deliberately reuses those controlled structures.

## Dependency

Adds:

`qrcode.react` version `^4.2.0`

to `apps/web/package.json`.

Netlify will install the dependency during the normal GitHub build.

## Release sequence

1. Extract the Update 013 package.
2. Run `./install.sh`.
3. Return to `~/Downloads/orion-enterprise-v1-implementation`.
4. Review `git status`.
5. Commit and push.
6. Allow Netlify to auto-deploy.
7. Register a test asset.
8. Open its Asset Detail page and confirm QR rendering.
9. Test manual lookup.
10. Test camera scan on a supported phone/browser.

## Acceptance criteria

- QR renders on Asset Detail page.
- QR opens `/q/<token>`.
- Authenticated authorised user is routed to the correct asset.
- Unauthorised user cannot obtain the asset through the QR route.
- Manual lookup works independently of QR scanning.
- Asset timeline loads without errors.
- Existing Asset Register remains operational.
