# Two Forecasts, One Sky

A learning prototype by David Petry (started 5 November 2026). NOAA now runs an AI
weather model (AIGFS) beside its physics model (GFS). Learners pick a place and a
day, guess which forecast came closer, then see what a weather station actually
measured. The point is calibrated trust: an AI model is a source, so check it like one.

Then **make a scenario** (step 04): answer Who, What, Where, When, Why and How (your
role, the weather that matters, the place, how far ahead you must decide, which mistake
is worse for you, and your rule for using the two forecasts). The page runs your rule
on the saved cases at once and shows forecast → decision → outcome: in time, false
alarm, caught off guard, rightly quiet. Every rule is shown side by side on the same
cases, so the trade-off is visible. Practice only: it uses saved data, makes no live
calls, gives no advice for real decisions, and never scores the person. Temperature
is the only variable so far.

**Status: prototype.** Not a forecast service, and not published anywhere.

## What's here

| Folder | What it holds |
|---|---|
| `site/` | The visual prototype: a static page that reads saved data only and fetches nothing |
| `data/` | Saved results: `spike-2026-11-05.json` holds 54 cases (6 US stations × 3 evenings × 3, 5 and 7 days ahead), 51 with a measurement |
| `scripts/` | `pull_spike.py`, the script that made the data (run by hand only) |

## See it

The page uses separate script files, so open it through a local web server rather
than from disk:

```bash
python3 -m http.server 8096 --bind 127.0.0.1 --directory site
```

Then go to http://localhost:8096.

## The protocol comes first

The full data governance and legal protocol, the spike findings, the vision and a
plain-words glossary are in the AI literacy course repository:
`ai-literacy-module/docs/two-forecasts-protocol.md`. Anything built here follows it.
In short:

- **NOAA / NWS terms:** data is public domain. Never imply NOAA endorsement, never
  use the NOAA emblem or NWS logo, label our own analysis as ours, and include the
  17 U.S.C. § 403 notice.
- **Rules for fetching:** once a day at most, only the variable needed (2 m
  temperature via `.idx` byte ranges), retries a minute apart. The NWS API needs a
  User-Agent; NWS asks for contact details in it, and David chooses which.
- **Licence:** we use NOAA's output files only, never model weights. Before any
  commercial use, ask NOAA (nodd@noaa.gov).
- **Privacy:** collect nothing. No accounts, location, cookies, analytics or
  third-party requests.
- **Accessibility:** WCAG 2.2 AA in both themes and at 320px wide.
- **Safety:** not a warning system. Real forecasts and warnings are at weather.gov.

## What the data showed (5 November 2026)

- AIGFS is published only on NOMADS, about 10 days at a time, so a record exists
  only if someone saves it. A nightly archive is the next step.
- AIGFS v1.1 has been live since 27 July 2026.
- In 51 cases the AI model came closer 27 times: close to a coin toss. It ran about
  0.9 °C cold overall, and about 3 °C cold at Central Park every time (cause not
  known). Too few days to say which model is better, which is the lesson.

## Credits

Data: NOAA / National Weather Service. Not affiliated with or endorsed by NOAA.
NWS material is not under copyright (17 U.S.C. § 403).

Fonts (self-hosted, SIL Open Font License 1.1; licences in `site/fonts/`):
Instrument Sans for headings, Atkinson Hyperlegible Next for text, Atkinson
Hyperlegible Mono for readings. Downloaded 5 November 2026 from the Fontsource
packages (v5.3.0), Latin subsets only.

**Look: in the style of the MIT Media Lab's site** (David, 5 November 2026, after
media.mit.edu's about, funding and research pages). Its style, never its brand: no MIT
name or logo, nothing that suggests MIT made this. Near-black and off-white rather than
pure black and white, flat surfaces, hairline rules, a tall opening with big type,
sections as bands with a mark column, a hairline-grid table and finding cards with
sources. Colour is kept for the data: blue for the AI model, ochre for the physics
model, always with a shape too. The light theme stays warm paper, never white.
Earlier the same day the project wore a "sea and sky" theme (isobars, a horizon swell,
depth contours); those drawings are kept, unused, in `site/textures/`.
