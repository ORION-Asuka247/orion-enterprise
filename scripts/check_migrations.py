from pathlib import Path
import re
import sys

p = Path(__file__).resolve().parents[1] / "supabase/migrations"
files = sorted(p.glob("*.sql"))
print("Migration count:", len(files))

# ORION permits an optional uppercase revision suffix (for example 012R)
# when a schema-aligned replacement of a numbered migration is required.
name_re = re.compile(r"^(\d{8})_(\d{3})([A-Z]?)_(.+)\.sql$")
entries = []
bad = False
seen_names = set()

for f in files:
    m = name_re.match(f.name)
    if not m:
        print("INVALID NAME:", f.name)
        bad = True
        continue
    date, seq_text, revision, description = m.groups()
    key = (int(seq_text), revision)
    if key in seen_names:
        print("DUPLICATE MIGRATION KEY:", f.name)
        bad = True
    seen_names.add(key)
    entries.append((int(seq_text), revision, f.name))

base_sequences = sorted({seq for seq, revision, _ in entries if revision == ""})
if base_sequences:
    expected = list(range(base_sequences[0], base_sequences[-1] + 1))
    if base_sequences != expected:
        missing = sorted(set(expected) - set(base_sequences))
        print("BASE SEQUENCE GAPS:", ", ".join(f"{n:03d}" for n in missing))
        bad = True
    if base_sequences[0] != 1:
        print(f"BASE SEQUENCE MUST START AT 001, found {base_sequences[0]:03d}")
        bad = True

for seq, revision, name in entries:
    if revision and seq not in base_sequences:
        print(f"ORPHAN REVISION: {name} has no base migration {seq:03d}")
        bad = True
    print(f"{seq:03d}{revision or ''} OK  {name}")

sys.exit(1 if bad else 0)
