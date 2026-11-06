# Notices and credits

*Two Forecasts, One Sky*: copyright (c) 2026 David Petry. Code under the MIT
License ([LICENSE](LICENSE)); words and drawings under CC BY 4.0
([LICENSE-CONTENT.md](LICENSE-CONTENT.md)); data under CC0 1.0
([data/LICENSE.md](data/LICENSE.md)).

## Data

- **NOAA / National Weather Service.** AIGFS v1.1 and GFS forecasts (NOMADS) and
  station observations (NWS API). Public domain (17 U.S.C. § 105). This project
  is not affiliated with or endorsed by NOAA or the NWS. "NOAA" and "National
  Weather Service" are used only to name the source of the data.

## Map

- **US Census Bureau cartographic boundary files, 2017 edition**: public domain.
  Redistributed as **us-atlas 3.0.1** (ISC License, Mike Bostock). Drawn ahead of time
  into `site/map.js` by `scripts/map/build.mjs`, using **d3-geo** and **topojson-client**
  (both ISC). Those tools aren't shipped with the site.

## Fonts (included, SIL Open Font License 1.1)

- **Instrument Sans**: The Instrument Sans Project Authors.
- **Atkinson Hyperlegible Next** and **Atkinson Hyperlegible Mono**: the Atkinson
  Hyperlegible Next Project Authors (Braille Institute of America).
- Latin subsets from the Fontsource packages, version 5.3.0. Each font's licence
  is in `site/fonts/OFL-*.txt`. The fonts may be used, changed and redistributed
  under the OFL, but not sold on their own.

## Tools used to make the data (not included)

`scripts/pull_spike.py` uses Herbie (MIT License), xarray, cfgrib and ecCodes
(Apache License 2.0), and certifi (MPL 2.0). They are installed separately and
not distributed with this project.

## Inspiration

A shout-out to the MIT Media Lab (https://www.media.mit.edu/): its website's
layouts and use of space inspired this page. Thank you. The project isn't
affiliated with or endorsed by MIT, and uses no MIT text, images, logos or code.

## Not legal advice

These licences were chosen to match the Human-Centered AI Literacy course (MIT
for code, CC BY 4.0 for content) and NOAA's own practice for its data (public
domain, CC0). A school, agency or company that adopts the project should have
its own counsel check them.
