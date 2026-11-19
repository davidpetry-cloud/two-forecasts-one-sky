"""Nightly archive: saves one evening's forecasts and readings for the six stations.

For the evening that has just passed (00:00 UTC today), it saves:
  - AIGFS and GFS 2 m temperature forecasts made 3, 5 and 7 days earlier, at each
    station's nearest grid point (AIGFS from NOMADS, which keeps only about 10 days;
    GFS from NOAA's open-data bucket on AWS);
  - the station reading nearest 00:00 UTC, from the NWS API;
  - the AI model's version, as NOMADS names it (for example "v1.1").

Writes data/archive/YYYY/MM/YYYY-MM-DD.json and stops if that file already exists.

Follows docs/protocol.md, "Being a good user of NOAA's servers": run once a day; fetch
only 2 m temperature through the .idx byte ranges; at most 3 tries, a minute apart.
The User-Agent names the project and its repository (David's choice, 6 November 2026).

Usage:  python scripts/archive.py [--date YYYY-MM-DD] [--force]
Needs:  pip install herbie-data xarray cfgrib eccodes certifi
"""
import argparse, json, re, shutil, ssl, sys, tempfile, time, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import certifi

ROOT = Path(__file__).resolve().parent.parent
UA = "two-forecasts-one-sky/0.1 (github.com/davidpetry-cloud/two-forecasts-one-sky)"
CTX = ssl.create_default_context(cafile=certifi.where())
CITIES = {
    "Seattle": ("KSEA", 47.45, -122.31),
    "Phoenix": ("KPHX", 33.43, -112.01),
    "Denver": ("KDEN", 39.85, -104.66),
    "Chicago": ("KORD", 41.98, -87.90),
    "New York": ("KNYC", 40.78, -73.97),
    "Miami": ("KMIA", 25.79, -80.29),
}
LEADS = [3, 5, 7]
TRIES, WAIT = 3, 60


def with_retries(what, fn):
    for attempt in range(1, TRIES + 1):
        try:
            return fn()
        except Exception as e:  # network or server trouble: wait a minute, then try again
            print(f"  {what}: try {attempt} failed: {e}", file=sys.stderr)
            if attempt == TRIES:
                raise
            time.sleep(WAIT)


def get(url, accept="*/*"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
        return r.read()


def aigfs_version(run):
    """NOMADS serves prod/ from a versioned folder; its directory listing names it."""
    url = f"https://nomads.ncep.noaa.gov/pub/data/nccf/com/aigfs/prod/aigfs.{run:%Y%m%d/%H}/model/atmos/grib2/"
    html = get(url).decode("utf-8", "replace")
    m = re.search(r"/aigfs/(v[\d.]+)/", html)
    return m.group(1) if m else "unknown"


def forecast(model, run, fxx, cache):
    from herbie import Herbie
    kw = dict(model=model, fxx=fxx, save_dir=cache, verbose=False)
    if model == "aigfs":
        kw.update(product="sfc", priority=["nomads"])
    else:
        kw.update(product="pgrb2.0p25", priority=["aws", "nomads"])
    H = Herbie(run.replace(tzinfo=None), **kw)
    ds = H.xarray(":TMP:2 m above ground", remove_grib=True)
    if isinstance(ds, list):
        ds = ds[0]
    return {name: round(float(ds["t2m"].sel(latitude=lat, longitude=lon % 360, method="nearest")) - 273.15, 2)
            for name, (_, lat, lon) in CITIES.items()}


def observed(station, when):
    start = (when - timedelta(minutes=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end = (when + timedelta(minutes=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
    url = f"https://api.weather.gov/stations/{station}/observations?start={start}&end={end}"
    feats = json.loads(get(url, "application/geo+json"))["features"]
    best = None
    for f in feats:
        p = f["properties"]
        t = p["temperature"]["value"]
        if t is None:
            continue
        gap = abs((datetime.fromisoformat(p["timestamp"]) - when).total_seconds())
        if best is None or gap < best[0]:
            best = (gap, t, p["timestamp"])
    return None if best is None else {"c": round(best[1], 2), "at": best[2]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="the UTC date whose 00:00 UTC to save (default: today)")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file")
    a = ap.parse_args()
    day = datetime.strptime(a.date, "%Y-%m-%d").date() if a.date else datetime.now(timezone.utc).date()
    valid = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    out = ROOT / "data" / "archive" / f"{day:%Y}" / f"{day:%m}" / f"{day:%Y-%m-%d}.json"
    if out.exists() and not a.force:
        print(f"{out.relative_to(ROOT)} exists; nothing to do.")
        return
    cache = Path(tempfile.mkdtemp(prefix="tf-archive-"))
    try:
        # A station that can't be reached costs only its own reading, never the night: the forecasts
        # are the part NOAA deletes, so they are always saved. Missing readings are filled in later.
        obs = {}
        for n, (st, _, _) in CITIES.items():
            try:
                obs[n] = with_retries(f"reading {st}", lambda st=st: observed(st, valid))
            except Exception as e:
                obs[n] = None
                print(f"  reading {st}: gave up for now: {e}", file=sys.stderr)
        rows, versions = [], {}
        for lead in LEADS:
            run = valid - timedelta(days=lead)
            fxx = lead * 24
            got = {}
            for model in ("aigfs", "gfs"):
                try:
                    got[model] = with_retries(f"{model} {run:%Y%m%d%H} f{fxx}", lambda m=model: forecast(m, run, fxx, cache))
                except Exception as e:
                    got[model] = {}
                    print(f"  {model} {run:%Y%m%d%H} f{fxx}: gave up: {e}", file=sys.stderr)
            try:
                versions[f"{run:%Y-%m-%d}"] = with_retries("AIGFS version", lambda: aigfs_version(run))
            except Exception:
                versions[f"{run:%Y-%m-%d}"] = "unknown"
            for name in CITIES:
                rows.append({
                    "city": name, "valid": valid.isoformat(), "lead_days": lead, "run": run.isoformat(),
                    "aigfs": got["aigfs"].get(name), "gfs": got["gfs"].get(name), "observed": obs[name],
                    "aigfs_version": versions[f"{run:%Y-%m-%d}"],
                })
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({
            "saved": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": "NOAA / National Weather Service: AIGFS (NOMADS), GFS (AWS open data), station readings (NWS API). Public domain.",
            "rows": rows,
        }, indent=1) + "\n")
        missing = sum(1 for r in rows if r["aigfs"] is None or r["gfs"] is None or r["observed"] is None)
        print(f"saved {out.relative_to(ROOT)}: {len(rows)} rows, {missing} incomplete")
    finally:
        shutil.rmtree(cache, ignore_errors=True)


if __name__ == "__main__":
    main()
