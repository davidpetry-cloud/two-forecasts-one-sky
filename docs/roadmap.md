# Roadmap: Two Forecasts, One Sky

Everything from David's brainstorming (5–6 November 2026) in one place: what's built,
what's next, and every idea for later. The detail behind most ideas is in
[`protocol.md`](protocol.md) (the "Vision" section). This file is the list; the protocol
is the reasoning and the rules. Nothing here is public until David decides it is
sound and safe.

## Where it started

David asked what GitHub project or app, using NOAA or Department of Commerce data,
is in demand. Five sketches came out of it; this project is Sketch A.

| Sketch | Idea | Status |
|---|---|---|
| **A. Two forecasts, one sky** | NOAA's AI forecast (AIGFS) against its physics forecast (GFS) and what was measured: calibrated trust | **This project** |
| B. Readable warnings | NWS alerts in a clear, accessible structure (screen readers, cognitive accessibility, many languages), never rewritten by AI; an open component others can embed | Idea. NWS's Hazard Simplification already moves to plain words, so the gap is presentation and access |
| C. Tracking vanished datasets | Watch for federal datasets that disappear or change; send dead NOAA links to rescued copies | Idea. dataindex.us and the Data Rescue Project already organise this; join them rather than compete |
| D. Classroom data | NOAA tides, sea level and storms as real data for Grade 6 ratios, rates and graphs | Idea. Fits the Singapore Math curriculum |
| E. When the trusted database stops checking | NIST's National Vulnerability Database moved to risk-based triage (April 2026), with about 29,000 CVEs "Not Scheduled" | Idea: better as a lesson (an Essential) than a tool |

## Built (5–6 November 2026)

- Feasibility spike: 54 cases (6 US stations × 3 evenings × 3, 5 and 7 days ahead), 51 with a reading.
- The prototype: pick a case, guess first, see what happened, the bigger picture, make a scenario (Who, What, Where, When, Why, How).
- Protocol: data governance, law, safety, privacy, accessibility, interagency rules, vision, plain-words glossary.
- Look: in the style of the MIT Media Lab's website (with a thank-you; not affiliated), after a "sea and sky" NOAA theme that replaced Budapest.
- Two audits, all findings fixed: UX/UI (14) and readability and flow (11).
- Licences drafted for a future publish: MIT code, CC BY 4.0 words, CC0 data, OFL fonts.
- Private GitHub repository; the course's unpublished work is in its own private repository.

## Next, in order

1. ✅ **Built 6 November.** **The bigger picture, city by city, with a map** (David, 6 November 2026). Results for all six stations, and a US map drawn to scale (Albers equal-area, with a scale bar), from public-domain Census or Natural Earth outlines, drawn ahead of time and stored with the site. Hover, tap or tab to a city to see its results; a table twin. Confirm the scope with David first.
2. ✅ **Built 6 November.** **A search field** (David, 6 November 2026). One field near the top that finds
   places and stations ("Central Park", "KNYC"), cases ("New York 4 November"), glossary
   words ("bias", "false alarm"), findings and steps, and jumps straight to them; picking
   a place could also highlight it on the map and load its case. Everything is searched
   in the page itself, with no outside service and nothing stored. A labelled field,
   results as a list you can use with the keyboard, a spoken count ("3 results"), and a
   plain "no results" message with suggestions. The course hub's search is a model.
3. **VoiceOver pass** on Mac and iPhone. *Structure checked 6 November (labels, landmarks, live regions, tables, images, focus); listening still needs a person.*
4. *Plan ready: [`user-session-plan.md`](user-session-plan.md).* **A session with three to five people** from the audiences: educators, professionals, students, plus one forecaster or emergency manager.
5. **Windows forced-colours check.** *Rules added 6 November (selection, focus, map, buttons by system colours; shapes carry meaning); still needs a look on Windows.*
6. **Nightly archive.** NOMADS keeps only about 10 days of AIGFS, so the record exists only once something saves it. Once a day, the one variable needed, a User-Agent with contact details David chooses.
7. **Spelling:** David's call, US or British, for a US audience.
8. **Publishing:** only on David's word, after the protocol check.

## Growing the tool

- **Any number of forecasts:** AI, physics, hybrid, ensembles, a human forecaster, local and Indigenous knowledge (with consent and credit), future methods (quantum-assisted, if it ever earns it).
- **Uncertainty as a range:** AIGEFS (31 AI members) and HGEFS (62, hybrid): "a range, not a number".
- **More weather:** rain (AIGFS has it) and wind. Not gusts, visibility or radar: AIGFS doesn't make them yet.
- **Fit for purpose:** each lens says which forecast suits its decision (grid size, variables, lead time), and when the AI model is the wrong tool.
- **Version history:** a timeline of model versions, and whether scores moved after each.
- **Tropical cyclones:** test NOAA's v1.1 claim against a season of storm tracks.
- **Outside the US:** another observation source, checked against the protocol first.
- **Open data out:** publish the archive under CC0, since no public AIGFS archive exists.

## The scenario builder, extended

- **More roles:** fire crew lead, park ranger, utility planner, water manager, harbour master, school district, pilot.
- **Several roles, one forecast:** show how different agencies act on the same forecast (the interagency rule).
- **More hazards** as data allows: rain and floods, wind, heat waves, cold snaps.
- **Forecast → decision → outcome** with real thresholds, such as anticipatory action triggers.
- **Never** scores, streaks, leaderboards or betting framing.

## Lenses: fields the same core can serve

Each lens keeps the core (several forecasts, what happened, the uncertainty, the
decision) and changes the context.

- **Space:** NOAA's Space Weather Prediction Center; "will the aurora show tonight?" for the public, radiation risk for crews on Moon and Mars missions; Mars weather from NASA rovers.
- **Deep sea:** ocean forecasts against Argo float readings; marine heatwaves for reefs and fisheries; livestreamed dives (*Okeanos Explorer*, *Nautilus*).
- **Quantum:** quantum sensing (gravity, magnetism, over oceans and ice) is nearer than quantum forecasting; a quantum-assisted model would be one more forecast, judged by its record.
- **Humanitarian:** anticipatory action (aid released when a forecast crosses a threshold); the UN's *Early Warnings for All*; cheap AI models letting more countries forecast; low bandwidth, many languages.
- **Energy:** wind, solar and hydro forecasts against generation (EIA); space weather and the grid; heat and demand.
- **Desalination:** harmful algal blooms and intake shutdowns; drought and when to run plants; energy use; brine and sea life; Forecast-Informed Reservoir Operations (Lake Mendocino) as a model.
- **Fire and water:** the January 2025 Los Angeles fires (hydrant pressure, grounded aircraft): a good forecast isn't enough, the decision layer matters; wind, fire, water and power shutoffs are linked.
- **Volcanoes:** NOAA's Volcanic Ash Advisory Centers (HYSPLIT), tsunami centres, ashfall advisories; Kīlauea's fountaining episodes; USGS watches the volcano.
- **Yosemite, a long-term testbed:** one place over years. Seasons as the calendar (snowpack, Firefall, floods, heat, fire, smoke, rockfall); many agencies (NPS, NOAA/NWS Hanford, USGS, Forest Service, CAL FIRE, Caltrans, county); the tribes whose homeland it is, including the Southern Sierra Miwuk; offline first. Engaging the park or tribes needs David's approval and their agreement.

## Many agencies, one picture (standing rule)

Always consider how departments share real-time data and pattern-based outcomes
to mobilise quickly. Hurricanes are the model case: NHC, Hurricane Hunters, FEMA, the
Army Corps, USGS, the Coast Guard, states (EMAC), utilities, local responders.

- One record shape with source, time and version; one shared picture that shows where sources disagree.
- Common standards: the Common Alerting Protocol, Incident Command System terms, NIEM-style exchange.
- Offline and low-bandwidth fallbacks.
- People's data kept minimal (Privacy Act); AI is one input, a person decides.
- A teaching lens: the hurricane cone shows where the centre may go, not the storm's size.

## Delivery: how it reaches people

David's point: the experience matters more than the technology (as Jobs put it,
start with the customer experience and work back to the technology).

- **Where people already are:** TV weather segments, radio and NOAA Weather Radio, short videos, podcasts, museums, planetariums, science centres, park visitor centres and ranger talks, classrooms, libraries, text messages.
- **Trusted messengers:** broadcast meteorologists, rangers, teachers, librarians, community and faith leaders.
- **One idea, many forms:** a 30-second clip, a ranger's five-minute talk and a classroom lesson all teach "check a forecast like any source".
- **Two-way:** call and response (David's jazz vision): guess, see, say what you noticed.
- **If NOAA goes mainstream** (auroras, *Twisters*, hurricane memes, data cuts in the news): stay calm and honest. Compare models, never people; no gambling, hype or overtrust.

## The course connection (undecided)

- Keep this as its own tool, and later write a short course lesson or Essential ("Checking an AI Forecast") that links to it or uses a frozen copy of its data.
- The course's rules would apply: objectives first and confirmed by David, the course's own look, every fact in `claims.js` for David to attest.

## Rules that travel with every idea

- **Protocol first:** a governance check for every new data source; real disasters are never content; safety lines on every page.
- **Plain words:** the field's real term, explained the first time.
- **UX standard:** WCAG 2.2 AA, cognitive accessibility, mindful UX, privacy by design, the human–AI themes.
- **Style, never brand:** neither NOAA's nor MIT's.
