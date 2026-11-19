# Two forecasts, one sky: data governance and legal protocol

Status: **draft for future reference**, written 5 November 2026 after a feasibility
spike, first in the AI literacy course's `docs/` folder and moved here the same day
(David: keep it in the project's own repository, private until the 19 November 2026 protocol check, then public). A visual prototype and a scenario builder
are now built in `site/`. Whether a course lesson or Essential follows later is not
decided. Whatever is built must follow this protocol, and the protocol grows as we learn.

Not legal advice. A school district or company that adopts the tool should have
its own counsel check it.

## The idea

Learners compare NOAA's AI global forecast (AIGFS) and its physics forecast (GFS)
with what was actually observed. First they guess which was closer. The point is
calibrated trust: an AI model is a source, so check it like one.

## What the spike found (5 November 2026)

- **Where the data is.** AIGFS is published on NOMADS
  (`nomads.ncep.noaa.gov/pub/data/nccf/com/aigfs/prod/`), which keeps about
  10 days of runs. No cloud archive of operational AIGFS was found. The older,
  experimental GraphCast-GFS bucket on AWS (`noaa-nws-graphcastgfs-pds`) stopped on
  5 May 2026. GFS has a long archive on AWS (`noaa-gfs-bdp-pds`).
- **So history starts when we start.** A nightly job must save the few point values
  it needs from the day it is switched on. Past forecasts can't be fetched later.
- **The model changes.** AIGFS v1.1 went live on 27 July 2026 (NWS Service Change
  Notice 26-68). NOAA says it improves tropical cyclone intensity, rainfall and the
  blurring at long lead times. Limits quoted for v1.0 are already out of date.
- **Tools.** Herbie (2026.10) reads AIGFS from NOMADS. With curl, NOMADS needs
  `--http1.1` (it sends a malformed HTTP/2 header).
- **First numbers** (6 US stations × 3 days × leads of 3, 5 and 7 days; 51 pairs):
  roughly a coin flip. AIGFS was closer in 27 of 51. AIGFS ran about 0.9 °C cold
  overall and about 3 °C cold at Central Park every time (cause not checked).
  Too few days to say which model is better, which is itself the lesson.
- **Observations have gaps.** Central Park had no reading near 00 UTC on one night.

## Protocol

### 1. NOAA and NWS terms (from weather.gov/disclaimer, read 5 Nov 2026)

- NWS information is public domain unless marked otherwise. Never claim copyright
  over it.
- Never imply endorsement or affiliation with NOAA or NWS. Every page says:
  "Data: NOAA / National Weather Service. Not affiliated with or endorsed by NOAA."
- Never alter NWS content and present it as official. Our error scores and charts are
  our own analysis, and the page labels them that way.
- Never present our own information as official government information.
- **No NOAA emblem and no NWS logo.** Both are trademarks and need permission.
  Text attribution ("Data source: NOAA") needs none.
- 17 U.S.C. § 403: a copyrighted work made mostly of NWS material must say which
  material is NWS's and that it isn't under copyright. Add that notice.
- NWS gives the data "as is". The page says it is a learning tool, not a forecast,
  and sends people to weather.gov for real forecasts and warnings.

### 2. Being a good user of NOAA's servers

- Request no more often than the data changes: **once a day**, after the run is
  complete. If a request fails, wait at least one minute before retrying, and retry
  only a few times.
- Download only what's needed: one variable (2 m temperature), using the `.idx`
  byte ranges, not whole files.
- NWS API: a User-Agent is required. NWS asks for contact details (a website or
  email) so it can reach you if something goes wrong. **David chooses which
  contact to use.** The spike used a generic name with none.
- No user's browser ever calls NOAA. The site serves files saved in advance (static,
  no live calls), as in this course.

**In practice (6 November 2026):** the nightly archive (`scripts/archive.py`, run by a
GitHub Action in this repository at 06:30 UTC) follows these rules. Its
User-Agent is `two-forecasts-one-sky/0.1 (github.com/davidpetry-cloud/two-forecasts-one-sky)`,
David's choice of contact.

### 3. License of the AI model's output

- NOAA's GraphCast-GFS output (AIGFS's experimental precursor) is released under
  CC0, according to NOAA's AWS registry entry. That entry says the files hold only
  NOAA's products, not GraphCast code or training data.
- Google DeepMind's GraphCast weights are CC BY-NC-SA 4.0 (non-commercial,
  share-alike). We never use or share weights; we use only NOAA's output files.
- No license statement specific to AIGFS was found. Non-commercial educational use
  is covered under either reading. **Before any commercial use, ask NOAA**
  (nodd@noaa.gov, or EMC: emc.products.feedback@noaa.gov).

### 4. Privacy (federal and state)

- Collect nothing. Learners pick a city from a list: no geolocation, no account, no
  cookies, no analytics, no third-party requests (the course's existing rule).
- Because nothing is collected, COPPA (children under 13), FERPA (student records)
  and state privacy laws (such as California's CCPA) have nothing to apply to.
  Keep it that way. Any new feature that would collect data needs a fresh review
  first, with the students' track getting the most care
  (`docs/student-safety.md`).

### 5. Accessibility law

- ADA Title II: public schools and colleges must meet WCAG 2.1 AA for web content.
  A DOJ interim final rule (20 April 2026) moved the date for larger public bodies
  to 26 April 2027. The date for smaller ones isn't confirmed yet; check the
  Federal Register (91 FR 20902) before quoting it.
- Section 508 applies if a federal agency uses the tool.
- Our own standard, WCAG 2.2 AA (`docs/ux-foundations.md`), goes beyond both. Every
  chart is also given as a table and an `aria-label`. Color is never the only cue.

### 6. Honesty about claims (the course's own governance)

- Every factual claim (the v1.1 date, the 0.3% computing figure, NOAA's stated
  improvements) goes into `claims.js` as a model proposal for David to attest.
- Each claim carries its date, and is re-checked before teaching. AI-tool claims go
  stale within months (the course's three-year rule, and v1.1 proves it).
- Record the model version with every saved run (the NOMADS path shows it, e.g.
  `aigfs/v1.1/`), so a version change shows on the page instead of hiding in the
  numbers.
- Never declare a winner from a short record. Show how many days the scores are
  based on, and say when that's too few to decide.

### 7. Safety

- This is not a warning system. Never show alerts, and never phrase a forecast as
  advice to act. Point to weather.gov, Wireless Emergency Alerts and NOAA Weather
  Radio.
- When data is missing or late, say so plainly ("No reading for this night"), never
  fill the gap or hide it.

### 8. A governance check for every data source

Each new source gets its own check before use: its terms, license, rate limits,
privacy and who to credit. NOAA's rules don't cover anyone else's data. Sources likely
later: USGS (Interior), the Energy Information Administration (Energy), the Forest
Service (Agriculture), FEMA (Homeland Security), CAL FIRE and other state agencies,
local water and power utilities. Record each check in this doc, with the date.

**Check, 6 November 2026: map outlines.** US Census Bureau cartographic boundary files
(2017), public domain; via us-atlas 3.0.1 (ISC). Drawn once into a file stored with the
site, so the page loads no map tiles and contacts no map service. State lines haven't
changed since 2017. Credit in NOTICE.md.

**Check, 19 November 2026: station rain.** NOAA's Aviation Weather Center
(aviationweather.gov, part of the National Weather Service): public domain, no key, one
request per evening for all six stations, with the project's User-Agent. Rain is decoded
from the 6-hour group of each station's 00:00 UTC report, by the FAA/NWS remarks rules:
a number is hundredths of an inch; 60000 is a trace; no group from an automated station
with a rain gauge (AO2) is no rain; a gauge marked not operating (PNO) or an unreadable
group (6////) is recorded as missing, never as zero. "Did it rain?" uses the NWS definition
of measurable rain, 0.01 inch (0.25 mm). Forecasts: each model's own 6-hour total ending at
00:00 UTC. The page's credits name the Aviation Weather Center once rain is shown.

### 9. Real disasters are never content

- People die in the events this tool may show (the January 2025 Los Angeles fires,
  hurricanes, eruptions). No disaster is entertainment, a game or a spectacle,
  even in the popular lens.
- Never score, rank or blame responders or agencies. Where reports disagree about
  what went wrong, say they disagree; don't settle it on the page.
- The affected communities' own accounts come first. Ask before using a local story.

### 10. Data shared between agencies

Applies to any design for several agencies sharing one picture (see
"Many agencies, one picture" below). This tool is a learning tool, never an operational
system; it teaches patterns that would transfer.

- **Weather and hazard data, not people's data.** Data about survivors and
  households is personal. The Privacy Act of 1974 governs federal records about
  people; collect and share only what each purpose needs, and say who sees it.
- **Every value carries its source, time and version,** so agencies can see whether
  they're looking at the same number.
- **Use the standards responders already use** (to check before relying on them):
  the Common Alerting Protocol (CAP), which NWS alerts and FEMA's IPAWS use; the
  Incident Command System's terms (NIMS); and NIEM-style data exchange.
- **A person makes the call.** AI output is one input with its uncertainty shown,
  never an automatic trigger for mobilizing people or resources.

## Future design possibilities

- **Where it lives:** a small data repository running the nightly archive, plus
  either a standalone page or a lesson or Essential in this course (backward
  design first: objectives, then evidence, then activities).
- **More variables:** rain (AIGFS has 3-hourly and accumulated precipitation) and
  wind. Not gusts, visibility or radar: AIGFS doesn't produce them.
- **Ensembles:** AIGEFS (AI, 31 members) and HGEFS (hybrid, 62 members) for teaching
  uncertainty ("a range, not a number").
- **Tropical cyclones:** test NOAA's v1.1 claim against storm tracks once a season
  has been archived.
- **Outside the US:** observations here come from the NWS API (US only). Other
  countries need another observation source, checked against this protocol first.
- **Version history:** a timeline showing when the model changed and whether scores
  moved afterwards.

## Vision (David, 5 November 2026)

Brainstormed with David, not designed. Facts marked *(check)* are from memory and
must be checked before any of this becomes lesson material.

### One core, many lenses

The core never changes: several forecasts of one thing, what actually happened, the
uncertainty, and (for decisions) **forecast → decision → outcome**. Only the lens
changes, as in the course's "one core, three tracks".

Build in now, so the future stays cheap:

1. Any number of forecasts (AI, physics, hybrid, ensemble, human forecaster, local
   and Indigenous knowledge with consent and credit, future methods).
2. One record shape for any field. A forecast: source, version, issued, valid, place,
   quantity, value, uncertainty. An observation: instrument, reading, quality flag.
3. Uncertainty shown as a range, always.
4. Source and version on everything (the attestation ledger's habit).
5. **Fit for purpose:** each lens says which forecast suits its decision, and when the
   AI model is the wrong tool (AIGFS has no wind gusts, and a 25 km grid can't
   see a canyon wind).
6. Calm by design at any scale: compare models, never people; no streaks,
   rankings or betting framing.
7. Low bandwidth, many languages, WCAG 2.2 AA.
8. Open data out: publish the archive (CC0) as a public good, after a protocol check.

### Who uses this data now

Forecasters, emergency managers, farmers, fishers, mariners and pilots, utilities and
insurers, researchers, teachers and students, hobbyists (storm chasers, aurora hunters,
sailors, ham radio operators), and journalists. No public AIGFS archive exists, so
ours would serve all of them.

### If NOAA goes mainstream

Signs already: the May 2024 aurora, *Twisters* (2024), hurricane "spaghetti model"
memes, the 2025 dataset cuts in the news *(check)*. Routes into pop culture:
spectacle, story, stakes, sharing. Risks: gambling (weather is already sold as
betting markets *(check)*), hype, overtrust in emergencies. The calm rules above
and protocol items 7 and 9 hold the line.

### Delivery: how it reaches people matters most (David, 5 November 2026)

What David meant by "pop culture" and "the general public": the way the learning
reaches people matters more than the data or the technology behind it. His comparison:
in early personal computers the experience, not the memory, was what counted for
people. Steve Jobs's documented version (WWDC, 1997): "You've got to start with the
customer experience and work backwards to the technology."

So **delivery is designed first, not bolted on.** One core, many lenses, and now
**many channels**:

- **Go where people already are:** TV weather segments, radio and NOAA Weather
  Radio, short videos, podcasts, museums, planetariums and science centers, park
  visitor centers and ranger talks (Yosemite), classrooms, libraries, text messages.
- **Work through trusted messengers:** broadcast meteorologists, park rangers,
  teachers, librarians, community and faith leaders. People act on warnings from
  someone they trust.
- **Shape the message to the channel, keep the core the same:** a 30-second clip, a
  ranger's five-minute talk and a classroom lesson all teach the same idea (check a
  forecast like any source) in different forms.
- **Make it two-way:** call and response (David's jazz vision): people guess, see
  what happened, and say what they noticed.
- **Mayer's principles for each format:** narration with pictures rather than text
  read aloud; short, learner-paced segments; cut what doesn't serve the idea; cues
  that mark what matters.
- **Accessible in every channel:** captions and transcripts, audio description,
  plain language, many languages.
- **Calm, even on noisy platforms:** our content can travel into social media, but
  our own pages stay free of autoplay, infinite scroll and engagement bait.
- **Privacy:** don't embed third-party players or trackers; link out instead. Find
  out what worked by asking people (Kirkpatrick), not by tracking them.

### Other fields (lenses to explore)

- **Space:** NOAA's Space Weather Prediction Center; aurora tonight (public),
  radiation risk (crews on Moon and Mars missions); Mars weather from NASA rovers.
- **Deep sea:** NOAA ocean models against Argo float readings; marine heatwaves for
  reefs and fisheries; livestreamed dives (*Okeanos Explorer*, *Nautilus*).
- **Quantum:** no shown advantage for forecasting yet; quantum sensing is nearer.
  A future quantum-assisted model is just another forecast, judged by its record.
- **Humanitarian:** anticipatory action (aid released when a forecast crosses a
  threshold; Red Cross Red Crescent Climate Centre); the UN's *Early Warnings for
  All* by 2027 *(check)*; cheap AI models letting more countries forecast.
- **Energy:** wind, solar and hydropower forecasts against generation figures (EIA);
  space weather and the grid; heat and demand.
- **Desalination:** harmful algal bloom forecasts (intake shutdowns), drought
  forecasts (when to run), energy use, brine and sea life (NOAA Fisheries).
  Model to learn from: Forecast-Informed Reservoir Operations at Lake Mendocino *(check)*.
- **Fire and water:** the January 2025 Los Angeles fires. Water failed to reach
  about 200 of roughly 1,000 hydrants in the Palisades hills (LADWP), a pressure and
  demand problem, and wind grounded aircraft. The lesson: a good forecast isn't
  enough; the decision layer (reservoirs, pressure, tankers, staging) matters.
  Wind, fire, water demand and power shutoffs are linked.
- **Volcanoes:** NOAA's Volcanic Ash Advisory Centers (HYSPLIT ash forecasts for
  aviation), tsunami centers, ashfall advisories; USGS watches the volcano itself.
  Kīlauea's fountaining episodes (a 48th reported by June 2026) are forecasts to
  check.
- **Yosemite as a long-term testbed** (David, 5 November 2026). A *testbed* is a real
  place where new methods are tried and checked before wider use; NOAA uses the
  word for its own testbeds. Yosemite isn't one event: the project returns to it
  year after year, to show how forecasts, hazards and agencies work in one real
  place over time.
  - **Seasons as the calendar:** snowpack and snowmelt, waterfall flow (the February
    Horsetail Fall "Firefall" needs snowmelt and a clear sunset), spring floods,
    summer heat and visitor peaks, fire season and smoke, rockfall, winter storms.
  - **Many agencies in one place** *(check each)*: the National Park Service
    (Interior), NOAA and the NWS Hanford office, USGS, the Forest Service, CAL FIRE,
    Caltrans (roads), county emergency services, and the tribes whose homeland it is,
    including the Southern Sierra Miwuk. A natural test of "Many agencies, one
    picture".
  - **Over years:** the archive must last (protocol item 6: record each model
    version); seasons repeat, so "how did the forecasts do last spring?" becomes a
    fair question; and the tool must survive data cuts and site changes.
  - **Place-based care:** weak phone signal in the park (offline first), visitors
    from many countries (many languages), and Indigenous knowledge of the place
    credited and used only with consent.
  - **Governance:** each source here (NPS, CAL FIRE, Caltrans, the county, tribal
    sources) gets its own protocol check (item 8). Engaging the park or tribes
    directly needs David's approval and their agreement first.

### Many agencies, one picture (standing rule, David)

Always consider how several departments share real-time, accurate data and
pattern-based outcomes, so agencies can mobilize quickly. Hurricanes are the model
case.

- **Who's involved in a hurricane** *(check details)*: NOAA's National Hurricane
  Center (forecasts, the cone), Hurricane Hunter flights (NOAA and Air Force
  Reserve), FEMA (mobilizing under the National Response Framework), the Army Corps
  of Engineers, USGS (storm-surge and stream sensors), the Coast Guard, states
  (mutual aid between states through EMAC), utilities and local responders. NWS
  incident meteorologists and "impact-based decision support" sit inside the
  response.
- **Pattern-based outcomes:** past storms as analogues (NOAA's HURDAT2 record),
  storm-surge odds, inland flooding (NOAA's National Water Model). Hurricane Helene
  (2024) showed that inland rain and flooding can do the most harm, far from the
  coast *(check)*.
- **Where it breaks:** agencies holding different numbers for the same thing;
  phone and power networks failing; warnings that don't reach people in their
  language or format; good forecasts that don't turn into early action.
- **What our design does about it:** one record shape with source, time and
  version; a single shared picture showing where sources disagree; common
  standards (protocol item 10); offline and low-bandwidth fallbacks; and AI as one
  input, with a person deciding.
- **A teaching lens:** the hurricane "cone" is widely misread as the storm's size;
  it shows where the center may go *(check)*. That's a natural warm-up misconception.

## Words used here, in plain terms

The rule (David, 5 November 2026): use the field's real term, and explain it in
plain words the first time a reader meets it.

- **Testbed:** a real place where new methods are tried and checked before wider use.
- **Model:** a computer program that works out what the weather will do next.
  AIGFS is NOAA's AI model; GFS is its physics model, built from the laws of motion,
  heat and moisture.
- **Forecast run:** one complete forecast made at one time (NOAA runs these four
  times a day).
- **Lead time:** how far ahead a forecast looks ("a 3-day forecast").
- **Observation:** what an instrument actually measured, such as a weather station's
  thermometer.
- **Error:** how far a forecast was from what was measured. **Average error** is the
  typical miss over many forecasts.
- **Bias:** a lean in one direction, like a forecast that keeps running cold.
- **Uncertainty:** how sure a forecast is, shown as a range rather than one number.
- **Ensemble:** many forecasts of the same thing, each started slightly differently,
  so their spread shows the uncertainty.
- **Analogue:** a past event that looks like the present one, used as a guide.
- **Grid:** the net of points a model works on. AIGFS's points are about 25 km
  apart, so it can't see anything smaller, like a wind racing down one canyon.
- **Variable:** one measured or forecast quantity, such as temperature or wind gusts.
- **Model version:** an update to a model (AIGFS v1.1). A new version can forecast
  differently, so every saved run records which version made it.
- **Archive:** our own saved copy of past forecasts, because NOAA keeps only about
  10 days.
- **GRIB:** the file format weather models use.
- **Public domain** and **CC0:** free for anyone to use, with no copyright.
- **Anticipatory action:** acting on a forecast before a disaster strikes, such as
  sending supplies ahead of a storm.
- **Incident:** emergency managers' word for an emergency. They use *event* for a
  planned occasion.

## Sources consulted (5 November 2026)

- NWS, Disclaimer and appropriate use: https://www.weather.gov/disclaimer
- NWS API documentation: https://www.weather.gov/documentation/services-web-api
- NWS Service Change Notice 26-68, AIGFS v1.1:
  https://www.weather.gov/media/notification/pdf_2026/scn26-68_AIGFS_v1.1.pdf
- AWS Open Data Registry, NOAA GraphCast GFS (license):
  https://registry.opendata.aws/noaa-nws-graphcastgfs-pds
- NWS logo request FAQ: https://www.weather.gov/logorequest-faq
- NOAA emblem usage and licensing: https://www.noaa.gov/noaa-emblem-usage-and-licensing
- Federal Register, ADA Title II compliance dates (20 April 2026):
  https://www.govinfo.gov/content/pkg/FR-2026-04-20/html/2026-07663.htm
- Herbie AIGFS gallery: https://herbie.readthedocs.io/en/latest/gallery/noaa_models/aigfs.html
