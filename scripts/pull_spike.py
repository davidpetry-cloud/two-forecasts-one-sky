"""Spike: AIGFS vs GFS 2 m temperature at a few US stations, against what was observed.

Valid times: 00 UTC on 3, 4 and 5 November 2026. Lead times: 3, 5 and 7 days.
Writes data/spike-<date>.json. Run by hand only; see README "Rules for fetching" before running.
Needs: pip install herbie-data xarray cfgrib eccodes certifi
"""
import json, ssl, sys, urllib.request

import certifi
from datetime import datetime, timedelta, timezone
from pathlib import Path

from herbie import Herbie

HERE = Path(__file__).parent
ROOT = HERE.parent
DATA = ROOT / "cache"  # downloaded GRIB subsets; not kept in git
# NWS asks for contact details in the User-Agent; David chooses which (see README).
UA = "two-forecasts-spike/0.1 (research prototype)"

CITIES = {
    "Seattle": ("KSEA", 47.45, -122.31),
    "Phoenix": ("KPHX", 33.43, -112.01),
    "Denver": ("KDEN", 39.85, -104.66),
    "Chicago": ("KORD", 41.98, -87.90),
    "New York": ("KNYC", 40.78, -73.97),
    "Miami": ("KMIA", 25.79, -80.29),
}
VALID = [datetime(2026, 11, d, 0, tzinfo=timezone.utc) for d in (3, 4, 5)]
LEADS = [3, 5, 7]


def point_values(ds, var):
    out = {}
    for name, (_, lat, lon) in CITIES.items():
        v = ds[var].sel(latitude=lat, longitude=lon % 360, method="nearest")
        out[name] = round(float(v) - 273.15, 2)
    return out


def forecast(model, run, fxx):
    kw = dict(model=model, fxx=fxx, save_dir=DATA, verbose=False)
    if model == "aigfs":
        kw["product"] = "sfc"
        kw["priority"] = ["nomads"]
    else:
        kw["product"] = "pgrb2.0p25"
        kw["priority"] = ["aws", "nomads"]
    H = Herbie(run.replace(tzinfo=None), **kw)
    ds = H.xarray(":TMP:2 m above ground", remove_grib=False)
    if isinstance(ds, list):
        ds = ds[0]
    return point_values(ds, "t2m")


def observed(station, when):
    start = (when - timedelta(minutes=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end = (when + timedelta(minutes=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
    url = f"https://api.weather.gov/stations/{station}/observations?start={start}&end={end}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/geo+json"})
    with urllib.request.urlopen(req, timeout=30, context=ssl.create_default_context(cafile=certifi.where())) as r:
        feats = json.load(r)["features"]
    best = None
    for f in feats:
        p = f["properties"]
        t = p["temperature"]["value"]
        if t is None:
            continue
        ts = datetime.fromisoformat(p["timestamp"])
        gap = abs((ts - when).total_seconds())
        if best is None or gap < best[0]:
            best = (gap, t, p["timestamp"])
    return None if best is None else {"c": round(best[1], 2), "at": best[2]}


def main():
    rows = []
    for valid in VALID:
        obs = {n: observed(s, valid) for n, (s, _, _) in CITIES.items()}
        for lead in LEADS:
            run = valid - timedelta(days=lead)
            fxx = lead * 24
            got = {}
            for model in ("aigfs", "gfs"):
                try:
                    got[model] = forecast(model, run, fxx)
                except Exception as e:  # keep going; record the failure
                    got[model] = {"error": repr(e)[:200]}
                    print(f"FAIL {model} {run:%Y%m%d%H} f{fxx}: {e}", file=sys.stderr)
            for name in CITIES:
                rows.append({
                    "city": name,
                    "valid": valid.isoformat(),
                    "lead_days": lead,
                    "run": run.isoformat(),
                    "aigfs": got["aigfs"].get(name),
                    "gfs": got["gfs"].get(name),
                    "observed": obs[name],
                })
            print(f"done valid {valid:%m-%d} lead {lead}", file=sys.stderr)
    (ROOT / "data" / f"spike-{datetime.now(timezone.utc):%Y-%m-%d}.json").write_text(json.dumps(rows, indent=1))
    print(f"{len(rows)} rows")


if __name__ == "__main__":
    main()
