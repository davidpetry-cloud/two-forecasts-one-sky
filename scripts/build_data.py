"""Builds site/data.js from every saved case: the first spike plus the nightly archive.

Where both hold the same case (place, evening, lead time), the archive's copy wins.
No network; it only reads files in data/. Run after scripts/archive.py, or by hand:
    python3 scripts/build_data.py
"""
import glob, json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIELDS = ("city", "valid", "lead_days", "run", "aigfs", "gfs", "observed", "aigfs_version", "aigfs_rain", "gfs_rain", "rain_obs")


def main():
    cases = {}
    for f in sorted(glob.glob(str(ROOT / "data" / "spike-*.json"))):
        for r in json.load(open(f)):
            cases[(r["city"], r["valid"], r["lead_days"])] = {k: r.get(k) for k in FIELDS}
    for f in sorted(glob.glob(str(ROOT / "data" / "archive" / "*" / "*" / "*.json"))):
        for r in json.load(open(f))["rows"]:
            cases[(r["city"], r["valid"], r["lead_days"])] = {k: r.get(k) for k in FIELDS}
    rows = sorted(cases.values(), key=lambda r: (r["valid"], r["lead_days"], r["city"]))
    for r in rows:  # the raw report stays in the archive as evidence; the page and downloads need only the amount
        if isinstance(r.get("rain_obs"), dict):
            r["rain_obs"] = {k: v for k, v in r["rain_obs"].items() if k != "report"}
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
    write_downloads(rows, meta)
    print(f"site/data.js: {meta['cases']} cases, {meta['evenings']} evenings ({meta['first'][:10]} to {meta['last'][:10]})")


STATIONS = {"Seattle": "KSEA", "Phoenix": "KPHX", "Denver": "KDEN", "Chicago": "KORD", "New York": "KNYC", "Miami": "KMIA"}
COLUMNS = ["city", "station", "evening_utc", "lead_days", "forecast_made_utc", "aigfs_version",
           "aigfs_temp_c", "gfs_temp_c", "measured_temp_c", "measured_at_utc",
           "aigfs_rain_6h_mm", "gfs_rain_6h_mm", "measured_rain_6h_mm", "measured_rain_trace"]


def flat(r):
    obs, rain = r.get("observed") or {}, r.get("rain_obs") or {}
    return {
        "city": r["city"], "station": STATIONS.get(r["city"], ""), "evening_utc": r["valid"], "lead_days": r["lead_days"],
        "forecast_made_utc": r.get("run"), "aigfs_version": r.get("aigfs_version"),
        "aigfs_temp_c": r.get("aigfs"), "gfs_temp_c": r.get("gfs"), "measured_temp_c": obs.get("c"), "measured_at_utc": obs.get("at"),
        "aigfs_rain_6h_mm": r.get("aigfs_rain"), "gfs_rain_6h_mm": r.get("gfs_rain"),
        "measured_rain_6h_mm": rain.get("mm"), "measured_rain_trace": rain.get("trace"),
    }


def write_downloads(rows, meta):
    """The open data, for anyone to take: site/data/cases.csv and cases.json (CC0)."""
    import csv
    out = ROOT / "site" / "data"
    out.mkdir(exist_ok=True)
    flats = [flat(r) for r in rows]
    with open(out / "cases.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for row in flats:
            w.writerow({k: ("" if v is None else v) for k, v in row.items()})
    (out / "cases.json").write_text(json.dumps({
        "title": "Two Forecasts, One Sky: AIGFS and GFS forecasts against station measurements",
        "license": "CC0-1.0 (https://creativecommons.org/publicdomain/zero/1.0/); underlying NOAA/NWS data is public domain",
        "source": "NOAA / National Weather Service: AIGFS (NOMADS), GFS (NOAA open data on AWS), station readings (NWS API), "
                  "station rain (NOAA Aviation Weather Center). Not affiliated with or endorsed by NOAA.",
        "notes": "Temperatures in deg C at 2 m, at each station's nearest grid point. Rain: 6-hour totals in mm ending at the evening "
                 "(00:00 UTC); measured rain from the 6-hour group of each station's 00:00 UTC report (trace = less than 0.01 in). "
                 "Empty values are missing, never zero. Methods: https://github.com/davidpetry-cloud/two-forecasts-one-sky/blob/main/docs/protocol.md",
        "built": meta["built"], "cases": flats,
    }, indent=1) + "\n")
    print(f"site/data/cases.csv and cases.json: {len(flats)} cases")


if __name__ == "__main__":
    main()
