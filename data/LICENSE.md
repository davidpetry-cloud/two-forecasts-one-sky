# Data licence: CC0 1.0 (no rights reserved)

Applies to `data/spike-*.json` and `site/data.js`: the forecasts and station
readings this project saved, and the way they are arranged.

**The underlying data** comes from NOAA's National Weather Service: AIGFS and
GFS forecasts from NOMADS, and station observations from the NWS API. It is a
work of the United States Government and in the public domain in the United
States (17 U.S.C. § 105). NOAA released the output of AIGFS's experimental
forerunner (GraphCast GFS) under CC0 as well.

**This project's selection and arrangement** of that data is dedicated to the
public domain under CC0 1.0 Universal, by David Petry, to the extent possible
under law:
https://creativecommons.org/publicdomain/zero/1.0/legalcode

So anyone, including other agencies, schools and researchers, can use it for any
purpose without asking.

## Notices that still apply

These come from the National Weather Service's terms
(https://www.weather.gov/disclaimer), not from CC0:

- **Credit the source:** "Data: NOAA / National Weather Service."
- **No endorsement:** don't imply NOAA or the NWS made, checked or endorses your
  work, and don't use their names or logos to suggest it.
- **Not official:** don't present changed or derived data as official government
  information.
- **17 U.S.C. § 403:** a copyrighted work made mostly of NWS material must say
  which material is the NWS's and that it isn't under copyright.

NOAA provides the data "as is", and so does this project: no warranty, and not
for decisions about safety. Real forecasts and warnings are at weather.gov.

## What the data is not

The forecasts are AIGFS and GFS output only. No model weights are included. The
GraphCast weights that AIGFS builds on are Google DeepMind's, under CC BY-NC-SA
4.0, and are not part of this project.
