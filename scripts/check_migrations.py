from pathlib import Path
import re, sys
p=Path(__file__).resolve().parents[1]/"supabase/migrations"
files=sorted(p.glob("*.sql"))
print("Migration count:",len(files))
seen=set()
bad=False
expected=1
for f in files:
    m=re.match(r"\d{8}_(\d{3})_",f.name)
    if not m:
        print("INVALID NAME:",f.name); bad=True; continue
    seq=int(m.group(1))
    if seq in seen:
        print("DUPLICATE SEQUENCE:",f.name); bad=True
    if seq != expected:
        print(f"SEQUENCE GAP: expected {expected:03d}, found {seq:03d} in {f.name}"); bad=True
        expected=seq
    seen.add(seq)
    expected += 1
    print(f"{seq:03d} OK  {f.name}")
sys.exit(1 if bad else 0)
