"""Nightly archive: saves one evening's forecasts and readings for the six stations.

For the evening that has just passed (00:00 UTC today), it saves:
  - AIGFS and GFS 2 m temperature forecasts made 3, 5 and 7 days earlier, at each
    station's nearest grid point (AIGFS from NOMADS, which keeps only about 10 days;
    GFS from NOAA's open-data bucket on AWS);
  - the station reading nearest 00:00 UTC, from the NWS API;
  - rain (from 19 November 2026): each model's 6-hour rain total ending at 00:00 UTC (the
    "N-6 to N hour" accumulation, in mm), and what fell at each station in the same 6 hours,
    decoded from the 6-hour rain group of its 00:00 UTC report (NOAA Aviation Weather Center);
  - the AI model's version, as NOMADS names it (for example "v1.1").

Writes data/archive/YYYY/MM/YYYY-MM-DD.json (skipping an evening already saved), then re-checks the
last 14 evenings for missing readings, rain or forecasts and fills any the sources still hold.

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


def forecast_rain(model, run, fxx, cache):
    """The 6-hour rain total ending at the forecast hour, in mm (kg per square metre), per station."""
    from herbie import Herbie
    kw = dict(model=model, fxx=fxx, save_dir=cache, verbose=False)
    if model == "aigfs":
        kw.update(product="sfc", priority=["nomads"])
    else:
        kw.update(product="pgrb2.0p25", priority=["aws", "nomads"])
    H = Herbie(run.replace(tzinfo=None), **kw)
    ds = H.xarray(f":APCP:surface:{fxx - 6}-{fxx} hour acc", remove_grib=True)
    if isinstance(ds, list):
        ds = ds[0]
    var = list(ds.data_vars)[0]
    return {name: max(0.0, round(float(ds[var].sel(latitude=lat, longitude=lon % 360, method="nearest")), 2))
            for name, (_, lat, lon) in CITIES.items()}


def rain_from_metar(raw):
    """Decode the 6-hour rain group of a US 00/06/12/18 UTC report (FAA/NWS METAR remarks).
    6RRRR = hundredths of an inch; 60000 = a trace; no group from an automated station with a
    rain gauge (AO2) = no rain; PNO (gauge not operating) or 6//// = unknown, never zero."""
    rmk = raw.split(" RMK ", 1)[1] if " RMK " in raw else ""
    if re.search(r"(?<!\S)PNO(?!\S)", rmk) or re.search(r"(?<!\S)6////(?!\S)", rmk):
        return None
    m = re.search(r"(?<!\S)6(\d{4})(?!\S)", rmk)
    if m:
        v = int(m.group(1))
        return {"mm": round(v * 0.254, 1), "trace": v == 0}
    if re.search(r"(?<!\S)AO2(?!\S)", rmk):
        return {"mm": 0.0, "trace": False}
    return None


def rain_reports(valid):
    """One request to NOAA's Aviation Weather Center for all six stations' reports at 00:00 UTC."""
    ids = ",".join(st for st, _, _ in CITIES.values())
    url = f"https://aviationweather.gov/api/data/metar?ids={ids}&format=json&date={valid:%Y-%m-%dT%H:%M:%SZ}&hours=1"
    reports = json.loads(get(url, "application/json") or b"[]")
    out = {}
    for name, (st, _, _) in CITIES.items():
        mine = [m for m in reports if m.get("icaoId") == st and str(m.get("reportTime", "")).startswith(f"{valid:%Y-%m-%dT%H:00}")
                and m.get("metarType", "METAR") == "METAR"]
        out[name] = (dict(rain_from_metar(mine[0]["rawOb"]), report=mine[0]["rawOb"])
                     if mine and rain_from_metar(mine[0]["rawOb"]) is not None else None)
    return out


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


def save_evening(day, force, cache):
    valid = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    out = ROOT / "data" / "archive" / f"{day:%Y}" / f"{day:%m}" / f"{day:%Y-%m-%d}.json"
    if out.exists() and not force:
        print(f"{out.relative_to(ROOT)} exists; nothing new to save.")
        return
    # A station that can't be reached costs only its own reading, never the night: the forecasts
    # are the part NOAA deletes, so they are always saved. Missing readings are filled in later.
    obs = {}
    for n, (st, _, _) in CITIES.items():
        try:
            obs[n] = with_retries(f"reading {st}", lambda st=st: observed(st, valid))
        except Exception as e:
            obs[n] = None
            print(f"  reading {st}: gave up for now: {e}", file=sys.stderr)
    try:
        rain_obs = with_retries("rain reports", lambda: rain_reports(valid))
    except Exception as e:
        rain_obs = {}
        print(f"  rain reports: gave up for now: {e}", file=sys.stderr)
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
        for model in ("aigfs", "gfs"):
            try:
                got[model + "_rain"] = with_retries(f"{model} rain {run:%Y%m%d%H} f{fxx}", lambda m=model: forecast_rain(m, run, fxx, cache))
            except Exception as e:
                got[model + "_rain"] = {}
                print(f"  {model} rain {run:%Y%m%d%H} f{fxx}: gave up: {e}", file=sys.stderr)
        try:
            versions[f"{run:%Y-%m-%d}"] = with_retries("AIGFS version", lambda: aigfs_version(run))
        except Exception:
            versions[f"{run:%Y-%m-%d}"] = "unknown"
        for name in CITIES:
            rows.append({
                "city": name, "valid": valid.isoformat(), "lead_days": lead, "run": run.isoformat(),
                "aigfs": got["aigfs"].get(name), "gfs": got["gfs"].get(name), "observed": obs[name],
                "aigfs_rain": got["aigfs_rain"].get(name), "gfs_rain": got["gfs_rain"].get(name),
                "rain_obs": rain_obs.get(name),
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


def fill_recent(today, days, cache):
    """Try once more for anything missing in the last few evenings, while the sources still hold it:
    station readings (the NWS API keeps about a week) and forecasts (NOMADS keeps AIGFS about 10 days).
    One try each, no waiting, so a bad night heals itself the next night without extra load."""
    for back in range(0, days + 1):  # 0 = today, in case it was saved before a field existed
        day = today - timedelta(days=back)
        path = ROOT / "data" / "archive" / f"{day:%Y}" / f"{day:%m}" / f"{day:%Y-%m-%d}.json"
        if not path.exists():
            print(f"  {day}: no file (a missed night; re-run with --date {day} while NOAA still holds it)", file=sys.stderr)
            continue
        doc = json.loads(path.read_text())
        rows, changed = doc["rows"], 0
        valid = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        for name, (st, _, _) in CITIES.items():
            if any(r["city"] == name and r["observed"] is None for r in rows):
                try:
                    got = observed(st, valid)
                except Exception as e:
                    print(f"  fill {day} {st}: still unavailable ({e})", file=sys.stderr)
                    continue
                if got:
                    for r in rows:
                        if r["city"] == name and r["observed"] is None:
                            r["observed"] = got; changed += 1
        for lead in LEADS:
            run = valid - timedelta(days=lead)
            if (datetime.now(timezone.utc) - run).days > 9:
                continue
            for model in ("aigfs", "gfs"):
                if any(r["lead_days"] == lead and r[model] is None for r in rows):
                    try:
                        got = forecast(model, run, lead * 24, cache)
                    except Exception as e:
                        print(f"  fill {day} {model} f{lead*24}: still unavailable ({e})", file=sys.stderr)
                        continue
                    for r in rows:
                        if r["lead_days"] == lead and r[model] is None and got.get(r["city"]) is not None:
                            r[model] = got[r["city"]]; changed += 1
        # Rain: added to the archive on 19 November 2026, so earlier evenings are filled while the
        # sources still hold them (AIGFS about 10 days, GFS on AWS for years, AWC reports about 14 days).
        age = (datetime.now(timezone.utc) - valid).days
        if age <= 14 and any(r.get("rain_obs") is None for r in rows):
            try:
                ro = rain_reports(valid)
                for r in rows:
                    if r.get("rain_obs") is None and ro.get(r["city"]) is not None:
                        r["rain_obs"] = ro[r["city"]]; changed += 1
            except Exception as e:
                print(f"  fill {day} rain reports: still unavailable ({e})", file=sys.stderr)
        for lead in LEADS:
            run = valid - timedelta(days=lead)
            for model in ("aigfs", "gfs"):
                key = model + "_rain"
                if model == "aigfs" and (datetime.now(timezone.utc) - run).days > 9:
                    continue
                if any(r["lead_days"] == lead and r.get(key) is None for r in rows):
                    try:
                        got = forecast_rain(model, run, lead * 24, cache)
                    except Exception as e:
                        print(f"  fill {day} {key} f{lead*24}: still unavailable ({e})", file=sys.stderr)
                        continue
                    for r in rows:
                        if r["lead_days"] == lead and r.get(key) is None and got.get(r["city"]) is not None:
                            r[key] = got[r["city"]]; changed += 1
        if changed:
            doc.setdefault("filled", []).append(datetime.now(timezone.utc).isoformat(timespec="seconds"))
            path.write_text(json.dumps(doc, indent=1) + "\n")
            print(f"filled {path.relative_to(ROOT)}: {changed} values")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="the UTC date whose 00:00 UTC to save (default: today)")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file")
    ap.add_argument("--fill-days", type=int, default=14, help="how many earlier evenings to re-check for gaps (0 to skip)")
    a = ap.parse_args()
    day = datetime.strptime(a.date, "%Y-%m-%d").date() if a.date else datetime.now(timezone.utc).date()
    cache = Path(tempfile.mkdtemp(prefix="tf-archive-"))
    try:
        save_evening(day, a.force, cache)
        if a.fill_days and not a.date:
            fill_recent(day, a.fill_days, cache)
    finally:
        shutil.rmtree(cache, ignore_errors=True)


if __name__ == "__main__":
    main()
