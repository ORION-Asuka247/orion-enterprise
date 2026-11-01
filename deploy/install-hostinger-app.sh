#!/usr/bin/env bash
set -euo pipefail
umask 077
release_dir="$(cd "$(dirname "$0")" && pwd)"
deploy_home="${ORION_DEPLOY_HOME:-$HOME}"
site_root="$deploy_home/domains/asuka247.eu/public_html"
test -d "$site_root/app" || { echo 'The existing asuka247.eu/app directory was not found. Nothing changed.'; exit 1; }
test -f "$release_dir/app/index.html"
test -f "$release_dir/app/.htaccess"
grep -q '/app/assets/' "$release_dir/app/index.html"
(cd "$release_dir" && sha256sum --check SHA256SUMS)
backup_dir="$deploy_home/orion-backups/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$backup_dir"
tar -czf "$backup_dir/app.tar.gz" -C "$site_root" app
if test -f "$site_root/.htaccess"; then cp -p "$site_root/.htaccess" "$backup_dir/root.htaccess"; fi
pending_rules="$(mktemp "$site_root/.htaccess.orion.XXXXXX")"
trap 'rm -f "$pending_rules"' EXIT
{
  printf '%s\n' '# BEGIN ORION APP ROUTES' 'RewriteEngine On' \
    'RewriteRule ^app/assets/?$ /app/index.html [L]' \
    'RewriteCond %{REQUEST_FILENAME} !-f' 'RewriteCond %{REQUEST_FILENAME} !-d' \
    'RewriteRule ^app/ /app/index.html [L]' '# END ORION APP ROUTES' ''
  if test -f "$site_root/.htaccess"; then
    awk '/^# BEGIN ORION APP ROUTES$/{skip=1;next} /^# END ORION APP ROUTES$/{skip=0;next} !skip{print}' "$site_root/.htaccess"
  fi
} > "$pending_rules"
# Copy bundles before index.html so the previous page remains usable during upload.
cp -a "$release_dir/app/assets/." "$site_root/app/assets/"
# ZIP extraction can create private files; public bundles must be readable.
find "$site_root/app/assets" -type d -exec chmod 755 {} +
find "$site_root/app/assets" -type f -exec chmod 644 {} +
cp "$release_dir/app/.htaccess" "$site_root/app/.htaccess"
cp "$release_dir/app/index.html" "$site_root/app/index.html"
chmod 644 "$pending_rules" "$site_root/app/.htaccess" "$site_root/app/index.html"
mv "$pending_rules" "$site_root/.htaccess"
printf 'ORION update installed. Backup: %s\n' "$backup_dir"
