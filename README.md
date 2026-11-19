# Two Forecasts, One Sky (prototype)

A learning prototype by David Petry (started 5 November 2026). NOAA now runs an AI
weather model (AIGFS) beside its physics model (GFS). Learners pick a place and a
day, guess which forecast came closer, then see what a weather station actually
measured. The point is calibrated trust: an AI model is a source, so check it like one.

The bigger picture also goes **by place**: every station's results, on a map of the
contiguous United States drawn to scale (Albers equal-area, with a scale bar). A
**search field** at the top finds places, stations, cases, words, findings and roles,
and jumps straight to them.

Then **make a scenario** (step 04): answer Who, What, Where, When, Why and How (your
role, the weather that matters, the place, how far ahead you must decide, which mistake
is worse for you, and your rule for using the two forecasts). The page runs your rule
on the saved cases at once and shows forecast → decision → outcome: in time, false
alarm, caught off guard, rightly quiet. Every rule is shown side by side on the same
cases, so the trade-off is visible. Practice only: it uses saved data, makes no live
calls, gives no advice for real decisions, and never scores the person. Temperature
is the only variable so far.

**Status: prototype, public since 19 November 2026.** Try it at https://davidpetry-cloud.github.io/two-forecasts-one-sky/. Not a forecast service: for real forecasts and warnings, go to weather.gov.

**Version 0.9, a prototype**, in English and [Spanish](https://davidpetry-cloud.github.io/two-forecasts-one-sky/es/) ([what's new](CHANGELOG.md)). Download the data from the page's "About and methods"
section (CSV or JSON, CC0). To cite it, use GitHub's "Cite this repository" button
([CITATION.cff](CITATION.cff)). Teaching with it? There's a printable [lesson plan](https://davidpetry-cloud.github.io/two-forecasts-one-sky/educators.html)
(`site/educators.html`, 30 to 45 minutes, CC BY 4.0). Problems and ideas: [open an issue](https://github.com/davidpetry-cloud/two-forecasts-one-sky/issues/new/choose).

## What's here

| Folder | What it holds |
|---|---|
| `site/` | The visual prototype: a static page that reads saved data only and fetches nothing |
| `data/` | `archive/`: one file per evening, saved daily by the nightly archive (from 6 November 2026). Saved results: `spike-2026-11-05.json` holds 54 cases (6 US stations × 3 evenings × 3, 5 and 7 days ahead), 51 with a measurement |
| `scripts/` | `pull_spike.py`, the script that made the data (run by hand only); `palette.py`, the contrast checker; `map/`, the recipe for `site/map.js` |
| `docs/` | `roadmap.md` (every idea, built and next), `protocol.md` (governance, law, vision, glossary), `ux-audit-2026-11-05.md` and `user-session-plan.md` |

## The nightly archive

NOAA keeps the AI model's forecasts only about 10 days, so a record exists only if
someone saves it. A GitHub Action in this repository
(`.github/workflows/archive.yml`) runs `scripts/archive.py` at 06:30 UTC every day and
commits one small file per evening to `data/archive/`: both models' forecasts made 3,
5 and 7 days ahead, each station's reading, and the AI model's version. Since 19 November
2026 it also saves rain: each model's 6-hour total ending at 00:00 UTC, and what each
station measured in the same 6 hours (from NOAA's Aviation Weather Center). The page shows
rain under each case, in the bigger picture and in the scenario. It follows the
protocol's rules for NOAA's servers, and identifies itself by this repository's address.
Each night the Action also rebuilds `site/data.js` from the spike and the archive (`scripts/build_data.py`), so the page grows by one evening a day, and its findings are worded from the data, not fixed sentences.

## See it

The page uses separate script files, so open it through a local web server rather
than from disk:

```bash
python3 -m http.server 8096 --bind 127.0.0.1 --directory site
```

Then go to http://localhost:8096.

## The protocol comes first

The full data governance and legal protocol, the spike findings, the vision and a
plain-words glossary are in [`docs/protocol.md`](docs/protocol.md). Anything built here
follows it.
In short:

- **NOAA / NWS terms:** data is public domain. Never imply NOAA endorsement, never
  use the NOAA emblem or NWS logo, label our own analysis as ours, and include the
  17 U.S.C. § 403 notice.
- **Rules for fetching:** once a day at most, only the variable needed (2 m
  temperature via `.idx` byte ranges), retries a minute apart. The NWS API needs a
  User-Agent; NWS asks for contact details in it, and David chooses which.
- **License:** we use NOAA's output files only, never model weights. Before any
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

## License

Public since 19 November 2026, after a protocol check.

| Part | License | File |
|---|---|---|
| Code (HTML structure, styles, scripts, page logic) | MIT | [LICENSE](LICENSE) |
| Words and drawings (page text, docs, README prose, textures) | CC BY 4.0 | [LICENSE-CONTENT.md](LICENSE-CONTENT.md) |
| Saved data (`data/`, `site/data.js`) | CC0 1.0; the NOAA data underneath is public domain | [data/LICENSE.md](data/LICENSE.md) |
| Fonts | SIL Open Font License 1.1 | `site/fonts/OFL-*.txt` |

The same scheme as the Human-Centered AI Literacy course (MIT + CC BY 4.0), plus
CC0 for data, matching NOAA's own practice. Credits, trademarks and tools are in
[NOTICE.md](NOTICE.md). Not legal advice.

## Credits

Data: NOAA / National Weather Service. Not affiliated with or endorsed by NOAA.
NWS material is not under copyright (17 U.S.C. § 403).

Fonts (self-hosted, SIL Open Font License 1.1; licenses in `site/fonts/`):
Instrument Sans for headings, Atkinson Hyperlegible Next for text, Atkinson
Hyperlegible Mono for readings. Downloaded 5 November 2026 from the Fontsource
packages (v5.3.0), Latin subsets only.

**A shout-out to the [MIT Media Lab](https://www.media.mit.edu/)**, whose website
inspired this page's layouts and its generous use of space. Thank you. (The project
isn't affiliated with or endorsed by MIT; no MIT text, images, logos or code are used.)

The look in brief: near-black and off-white, flat surfaces, hairline rules, a tall
opening with big type, and sections as bands with a mark column, alternating one
shade lighter (dark) or deeper (light) so steps stay apart while scrolling. Color is kept for
the data: blue for the AI model, ochre for the physics model, always with a shape
too. The light theme stays warm paper, never white. Earlier drawings from a "sea and
sky" theme (isobars, a horizon swell, depth contours) are kept, unused, in
`site/textures/`.
