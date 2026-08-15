from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
migrations = root / "supabase/migrations"
manifest = root / "scripts/migration_manifest.txt"

files = sorted(p.name for p in migrations.glob("*.sql"))
approved = [line.strip() for line in manifest.read_text().splitlines() if line.strip() and not line.lstrip().startswith("#")]

print("Migration count:", len(files))
print("Approved manifest count:", len(approved))

bad = False
if len(approved) != len(set(approved)):
    print("DUPLICATE ENTRY IN MANIFEST")
    bad = True

missing = [name for name in approved if name not in files]
unapproved = [name for name in files if name not in approved]

for name in missing:
    print("MISSING APPROVED MIGRATION:", name)
    bad = True
for name in unapproved:
    print("UNAPPROVED MIGRATION:", name)
    bad = True

if not bad:
    for name in approved:
        print("OK ", name)

sys.exit(1 if bad else 0)
