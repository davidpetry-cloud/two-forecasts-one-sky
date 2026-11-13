"""Builds site/data.js from every saved case: the first spike plus the nightly archive.

Where both hold the same case (place, evening, lead time), the archive's copy wins.
No network; it only reads files in data/. Run after scripts/archive.py, or by hand:
    python3 scripts/build_data.py
"""
import glob, json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIELDS = ("city", "valid", "lead_days", "run", "aigfs", "gfs", "observed", "aigfs_version")


def main():
    cases = {}
    for f in sorted(glob.glob(str(ROOT / "data" / "spike-*.json"))):
        for r in json.load(open(f)):
            cases[(r["city"], r["valid"], r["lead_days"])] = {k: r.get(k) for k in FIELDS}
    for f in sorted(glob.glob(str(ROOT / "data" / "archive" / "*" / "*" / "*.json"))):
        for r in json.load(open(f))["rows"]:
            cases[(r["city"], r["valid"], r["lead_days"])] = {k: r.get(k) for k in FIELDS}
    rows = sorted(cases.values(), key=lambda r: (r["valid"], r["lead_days"], r["city"]))
    evenings = sorted({r["valid"] for r in rows})
    meta = {
        "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "evenings": len(evenings), "first": evenings[0], "last": evenings[-1],
        "cases": len(rows),
        "versions": sorted({r["aigfs_version"] for r in rows if r.get("aigfs_version")}),
    }
    js = ("// Built by scripts/build_data.py from data/spike-*.json and data/archive/ (NOAA / NWS data, public domain).\n"
          "// AIGFS and GFS 2 m temperature (deg C) at each station's nearest grid point, and the station reading nearest 00 UTC.\n"
          "window.TF_META = " + json.dumps(meta) + ";\n"
          "window.SPIKE = " + json.dumps(rows, separators=(",", ":")) + ";\n")
    (ROOT / "site" / "data.js").write_text(js)
    print(f"site/data.js: {meta['cases']} cases, {meta['evenings']} evenings ({meta['first'][:10]} to {meta['last'][:10]})")


if __name__ == "__main__":
    main()
