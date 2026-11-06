// Two forecasts, one sky — visual prototype. Reads saved spike data only (data.js); fetches nothing.
(function () {
  "use strict";
  var DATA = window.SPIKE || [];
  var CITIES = [
    { name: "Seattle", place: "Seattle–Tacoma Airport", station: "KSEA", tz: "America/Los_Angeles" },
    { name: "Phoenix", place: "Phoenix Sky Harbor Airport", station: "KPHX", tz: "America/Phoenix" },
    { name: "Denver", place: "Denver Airport", station: "KDEN", tz: "America/Denver" },
    { name: "Chicago", place: "Chicago O'Hare Airport", station: "KORD", tz: "America/Chicago" },
    { name: "New York", place: "Central Park", station: "KNYC", tz: "America/New_York" },
    { name: "Miami", place: "Miami Airport", station: "KMIA", tz: "America/New_York" }
  ];
  var VALIDS = Array.from(new Set(DATA.map(function (r) { return r.valid; }))).sort();
  var LEADS = [3, 5, 7];
  var SAME = 0.5; // misses within 0.5 °C (about 1 °F) of each other count as "about the same"
  var state = { city: "Seattle", valid: VALIDS[1] || VALIDS[0], lead: 3, guess: null, shown: false };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // ---------- units: °F first for these US places (audit 5); the viewer's choice is remembered in this browser only ----------
  var unit = store.get("tf-unit") === "C" ? "C" : "F";
  var toF = function (c) { return c * 9 / 5 + 32; };
  var inU = function (c) { return unit === "F" ? toF(c) : c; };
  var sym = function () { return unit === "F" ? "°F" : "°C"; };
  // Forecasts and readings in whole degrees: a forecast is an estimate, not an exact number (audit 2).
  var T = function (c) {
    return unit === "F" ? Math.round(toF(c)) + " °F (" + Math.round(c) + " °C)" : Math.round(c) + " °C (" + Math.round(toF(c)) + " °F)";
  };
  var T1 = function (c) { return Math.round(inU(c)) + " " + sym(); };
  // Differences and averages keep one decimal: they are measured quantities, not forecasts.
  var D = function (dc) { return (Math.round(Math.abs(dc) * (unit === "F" ? 1.8 : 1) * 10) / 10).toFixed(1) + " " + sym(); };
  var dir = function (d) { return Math.abs(d) < 0.05 ? "spot on" : (d < 0 ? "too cold" : "too warm"); };
  var dayName = function (iso, utcDay) {
    var d = new Date(iso);
    if (!utcDay) d = new Date(d.getTime() - 86400000); // 00:00 UTC is the evening before in the US
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(d);
  };
  var announce = function (t) { var a = $("announce"); a.textContent = ""; setTimeout(function () { a.textContent = t; }, 30); };
  var rowFor = function () {
    return DATA.find(function (r) { return r.city === state.city && r.valid === state.valid && r.lead_days === state.lead; });
  };

  // Radio pills. Re-rendering (for a unit change) replaces the markup but keeps one change handler.
  function radios(id, name, items, current, onPick) {
    var box = $(id);
    box.innerHTML = items.map(function (it) {
      return '<label class="choice"><input type="radio" name="' + name + '" value="' + esc(it.value) + '"' + (current !== null && String(it.value) === String(current) ? " checked" : "") + ">" +
        "<span>" + esc(it.label) + (it.small ? " <small>(" + esc(it.small) + ")</small>" : "") + "</span></label>";
    }).join("");
    if (onPick) box.onchange = function (e) { onPick(e.target.value); };
  }

  function newCase() {
    state.guess = null;
    document.querySelectorAll('input[name="guess"]').forEach(function (i) { i.checked = false; });
    showResult(false);
    $("hint").textContent = "";
    announce("New case chosen. Make a guess.");
  }

  // ---------- the result ----------
  // Drawn at the figure's real width in CSS pixels, so its text is always 16px (ticks 14px), never scaled
  // below the 12.8px floor. Wide: labels beside the lanes. Narrow: labels above them. Plotted in the viewer's unit.
  function lanesSvg(oc, ac, gc, W) {
    var o = inU(oc), a = inU(ac), g = inU(gc);
    W = Math.max(240, Math.round(W || 560));
    var side = W >= 440;
    var vals = [o, a, g];
    var lo = Math.floor(Math.min.apply(null, vals)) - 1, hi = Math.ceil(Math.max.apply(null, vals)) + 1;
    while (hi - lo < 4) { lo -= 1; hi += 1; }
    var span = hi - lo, room = side ? W - 150 : W - 24;
    var step = [1, 2, 5, 10].find(function (s) { return room / (span / s) >= 34; }) || 10;
    var X0 = side ? 136 : 12, X1 = W - 14;
    var x = function (v) { return Math.round((X0 + (v - lo) / span * (X1 - X0)) * 10) / 10; };
    var rows = side ? { ai: 26, obs: 74, phys: 122 } : { ai: 40, obs: 106, phys: 172 };
    var axisY = rows.phys + 30, H = axisY + 34;
    var ticks = "";
    for (var t = Math.ceil(lo / step) * step; t <= hi; t += step) {
      ticks += '<line class="axis" x1="' + x(t) + '" y1="' + axisY + '" x2="' + x(t) + '" y2="' + (axisY + 6) + '"/>' +
        '<text class="tick" x="' + x(t) + '" y="' + (axisY + 24) + '" text-anchor="middle">' + t + "°</text>";
    }
    var lab = function (txt, row) {
      return side ? '<text class="lane-label" x="0" y="' + (row + 5) + '">' + txt + "</text>"
        : '<text class="lane-label" x="0" y="' + (row - 18) + '">' + txt + "</text>";
    };
    var label = "Measured " + T1(oc) + ". AI model forecast " + T1(ac) + ", " + D(ac - oc) + " " + dir(ac - oc) +
      ". Physics model forecast " + T1(gc) + ", " + D(gc - oc) + " " + dir(gc - oc) + ".";
    var diamond = function (cx, cy) { return '<path class="m-obs" d="M' + cx + " " + (cy - 10) + " L" + (cx + 10) + " " + cy + " L" + cx + " " + (cy + 10) + " L" + (cx - 10) + " " + cy + 'Z"/>'; };
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(label) + '">' +
      lab("AI model", rows.ai) + lab("Measured", rows.obs) + lab("Physics model", rows.phys) +
      '<line class="measure-line" x1="' + x(o) + '" y1="' + (rows.ai - 14) + '" x2="' + x(o) + '" y2="' + (axisY - 4) + '"/>' +
      '<line class="gap-ai" x1="' + x(o) + '" y1="' + rows.ai + '" x2="' + x(a) + '" y2="' + rows.ai + '"/>' +
      '<line class="gap-phys" x1="' + x(o) + '" y1="' + rows.phys + '" x2="' + x(g) + '" y2="' + rows.phys + '"/>' +
      '<circle class="m-ai" cx="' + x(a) + '" cy="' + rows.ai + '" r="8"/>' +
      diamond(x(o), rows.obs) +
      '<rect class="m-phys" x="' + (x(g) - 7.5) + '" y="' + (rows.phys - 7.5) + '" width="15" height="15"/>' +
      '<line class="axis" x1="' + X0 + '" y1="' + axisY + '" x2="' + X1 + '" y2="' + axisY + '"/>' + ticks + "</svg>";
  }
  var fig = { o: null, a: null, g: null, ro: null };
  function drawFigure() {
    var box = document.querySelector("#result .lanes");
    if (!box || fig.o === null) return;
    box.innerHTML = lanesSvg(fig.o, fig.a, fig.g, box.clientWidth);
  }

  var KEY = '<ul class="key" aria-hidden="true">' +
    '<li><svg viewBox="0 0 22 22"><path d="M11 2 L20 11 L11 20 L2 11Z" fill="var(--obs)"/></svg>Measured</li>' +
    '<li><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="var(--paper)" stroke="var(--ai)" stroke-width="3"/></svg>AI model (AIGFS)</li>' +
    '<li><svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" fill="var(--paper)" stroke="var(--phys)" stroke-width="3"/></svg>Physics model (GFS)</li></ul>';

  var NEXT_AFTER_RESULT = '<p class="next"><a href="#h-pick">Try another case ↑</a> <span aria-hidden="true">·</span> <a href="#h-bigger">Next: the bigger picture ↓</a></p>';
  var PLACEHOLDER = '<p class="placeholder">Make a guess in step 02, then choose <b>Show what happened</b>.</p>';

  function resultHtml(r) {
    var city = CITIES.find(function (c) { return c.name === r.city; });
    var when = "Both forecasts were made " + r.lead_days + " days earlier, on the evening of " + dayName(r.run) + ".";
    if (!r.observed || typeof r.aigfs !== "number" || typeof r.gfs !== "number") {
      return '<p class="missing"><b>No reading for this evening.</b> The ' + esc(city.place) + " station sent no temperature near this time, " +
        "so there is nothing to check the forecasts against. Instruments do miss readings, and an honest tool says so.</p>" +
        '<p class="hint">The AI model said ' + T(r.aigfs) + "; the physics model said " + T(r.gfs) + ". " + when + "</p>" + NEXT_AFTER_RESULT;
    }
    var o = r.observed.c, ea = r.aigfs - o, eg = r.gfs - o;
    fig.o = o; fig.a = r.aigfs; fig.g = r.gfs;
    var closer = Math.abs(Math.abs(ea) - Math.abs(eg)) < SAME ? "same" : (Math.abs(ea) < Math.abs(eg) ? "ai" : "phys");
    var head = closer === "same" ? "The two forecasts did about as well as each other."
      : closer === "ai" ? "The AI model came closer this time." : "The physics model came closer this time.";
    var guessLine = state.guess === closer ? "Your guess matched this case." : "This case went the other way from your guess.";
    var at = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: city.tz }).format(new Date(r.observed.at));
    return '<p class="verdict"><b>' + head + "</b> " + guessLine + " One case says little on its own, so look at the bigger picture below.</p>" +
      KEY + '<figure class="figure"><div class="lanes"></div>' +
      "<figcaption>The dashed line is the measured temperature. Each bar is how far a forecast missed.</figcaption></figure>" +
      '<div class="wide"><table><caption>' + esc(r.city) + ", evening of " + dayName(r.valid) + "</caption>" +
      '<thead><tr><th scope="col">Source</th><th scope="col">Temperature</th><th scope="col">Miss</th></tr></thead><tbody>' +
      '<tr><th scope="row">Measured</th><td class="num">' + T(o) + "</td><td>—</td></tr>" +
      '<tr><th scope="row" class="ai-text">AI model</th><td class="num">' + T(r.aigfs) + '</td><td class="num">' + D(ea) + " " + dir(ea) + "</td></tr>" +
      '<tr><th scope="row" class="phys-text">Physics model</th><td class="num">' + T(r.gfs) + '</td><td class="num">' + D(eg) + " " + dir(eg) + "</td></tr>" +
      "</tbody></table>" +
      '<ul class="ref-list">' +
      "<li><b>Measured:</b> " + T(o) + "</li>" +
      '<li><b class="ai-text">AI model:</b> ' + T(r.aigfs) + ", missed by " + D(ea) + " " + dir(ea) + "</li>" +
      '<li><b class="phys-text">Physics model:</b> ' + T(r.gfs) + ", missed by " + D(eg) + " " + dir(eg) + "</li></ul></div>" +
      '<p class="hint">Forecasts are estimates, so they are shown in whole degrees; the misses come from the exact numbers. ' +
      "Measured at " + esc(at) + " local time at " + esc(city.place) + " (station " + city.station + "). " + when + "</p>" + NEXT_AFTER_RESULT;
  }

  // Step 03 always shows, so the numbering never jumps (audit 8); the button says whether its content is open (audit 11).
  function showResult(on) {
    state.shown = on;
    $("reveal").textContent = on ? "Hide what happened" : "Show what happened";
    $("reveal").setAttribute("aria-expanded", on ? "true" : "false");
    fig.o = null;
    if (fig.ro) { fig.ro.disconnect(); fig.ro = null; }
    var body = $("result-body");
    body.classList.toggle("is-open", on);
    if (!on) { body.innerHTML = PLACEHOLDER; return; }
    body.innerHTML = resultHtml(rowFor());
    drawFigure();
    var box = document.querySelector("#result .lanes");
    if (box && window.ResizeObserver) {
      var lastW = box.clientWidth;
      fig.ro = new ResizeObserver(function () { if (box.clientWidth !== lastW) { lastW = box.clientWidth; drawFigure(); } });
      fig.ro.observe(box);
    }
  }

  // ---------- the bigger picture ----------
  function biggerHtml() {
    var ok = DATA.filter(function (r) { return r.observed && typeof r.aigfs === "number" && typeof r.gfs === "number"; });
    var mean = function (xs) { return xs.reduce(function (s, v) { return s + v; }, 0) / xs.length; };
    var stat = function (rows) {
      return {
        n: rows.length,
        ai: mean(rows.map(function (r) { return Math.abs(r.aigfs - r.observed.c); })),
        ph: mean(rows.map(function (r) { return Math.abs(r.gfs - r.observed.c); })),
        win: rows.filter(function (r) { return Math.abs(r.aigfs - r.observed.c) < Math.abs(r.gfs - r.observed.c); }).length
      };
    };
    var byLead = LEADS.map(function (L) { return [L, stat(ok.filter(function (r) { return r.lead_days === L; }))]; });
    var all = stat(ok);
    var bias = mean(ok.map(function (r) { return r.aigfs - r.observed.c; }));
    var ny = ok.filter(function (r) { return r.city === "New York"; });
    var nyBias = mean(ny.map(function (r) { return r.aigfs - r.observed.c; }));
    var lost = DATA.length - ok.length;
    var rows = byLead.map(function (p) {
      return '<tr><th scope="row" class="grid-mark">' + p[0] + ' days</th><td class="num">' + D(p[1].ai) + '</td><td class="num">' + D(p[1].ph) + '</td><td class="num">' + p[1].win + " of " + p[1].n + "</td></tr>";
    }).join("");
    var items = byLead.map(function (p) {
      return "<li><b>" + p[0] + " days ahead:</b> AI model missed by " + D(p[1].ai) + " on average, physics model by " + D(p[1].ph) + ". The AI model came closer in " + p[1].win + " of " + p[1].n + ".</li>";
    }).join("");
    // Findings as cards, after the Media Lab's research cards: a glyph, a title, one line, and where it comes from.
    var finding = function (glyph, title, dek, source, id, tryIt) {
      return '<li class="finding"' + (id ? ' id="' + id + '" tabindex="-1"' : "") + '><span class="finding__glyph" aria-hidden="true">' + glyph + "</span>" +
        '<h4 class="finding__title">' + title + '</h4><p class="finding__dek">' + dek + "</p>" +
        (tryIt ? '<button type="button" class="btn quiet try" data-city="' + tryIt.city + '" data-valid="' + tryIt.valid + '" data-lead="' + tryIt.lead + '">Try it: ' + tryIt.label + "</button>" : "") +
        '<p class="finding__source">' + source + "</p></li>";
    };
    var G = {
      both: '<svg viewBox="0 0 48 24"><circle cx="12" cy="12" r="8" fill="none" stroke="var(--ai)" stroke-width="3"/><rect x="28" y="4" width="16" height="16" fill="none" stroke="var(--phys)" stroke-width="3"/></svg>',
      leads: '<svg viewBox="0 0 48 24"><path d="M4 20V14M18 20V9M32 20V4" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/></svg>',
      cold: '<svg viewBox="0 0 48 24"><circle cx="12" cy="12" r="8" fill="none" stroke="var(--ai)" stroke-width="3"/><path d="M30 6v12m-6-6 6 6 6-6" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      grid: '<svg viewBox="0 0 48 24"><path d="M3 3h30v18H3zM13 3v18M23 3v18M3 12h30" fill="none" stroke="var(--ink)" stroke-width="2"/><circle cx="40" cy="12" r="3" fill="var(--ai)"/></svg>',
      version: '<svg viewBox="0 0 48 24"><rect x="3" y="4" width="34" height="16" rx="8" fill="none" stroke="var(--ink)" stroke-width="2.5"/><circle cx="12" cy="12" r="3" fill="var(--ink)"/></svg>',
      missing: '<svg viewBox="0 0 48 24"><path d="M12 2 22 12 12 22 2 12Z" fill="none" stroke="var(--obs)" stroke-width="2.5" stroke-dasharray="4 3"/></svg>'
    };
    var SCN = '<a href="https://www.weather.gov/media/notification/pdf_2026/scn26-68_AIGFS_v1.1.pdf">NWS Service Change Notice 26-68</a>';
    return '<table class="hairgrid"><caption>Average miss, by how far ahead the forecast was made</caption>' +
      '<thead><tr><th scope="col" class="grid-mark">How far ahead</th><th scope="col"><span class="glyph" aria-hidden="true"><svg viewBox="0 0 48 24"><circle cx="12" cy="12" r="8" fill="none" stroke="var(--ai)" stroke-width="3"/></svg></span><span class="ai-text">AI model</span></th>' +
      '<th scope="col"><span class="glyph" aria-hidden="true"><svg viewBox="0 0 48 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="var(--phys)" stroke-width="3"/></svg></span><span class="phys-text">Physics model</span></th><th scope="col">AI model closer</th></tr></thead>' +
      "<tbody>" + rows + '<tr class="total"><th scope="row" class="grid-mark">All</th><td class="num">' + D(all.ai) + '</td><td class="num">' + D(all.ph) + '</td><td class="num">' + all.win + " of " + all.n + "</td></tr></tbody></table>" +
      '<ul class="ref-list">' + items + "<li><b>All:</b> " + D(all.ai) + " against " + D(all.ph) + "; the AI model came closer in " + all.win + " of " + all.n + ".</li></ul>" +
      "<h3>What this does and doesn't show</h3><ul class=\"findings\">" +
      finding(G.both, "Close to a coin toss", "Overall the AI model came closer in " + all.win + " of " + all.n + " cases.", "From " + all.n + " cases, evenings of 2 to 4 November 2026") +
      finding(G.leads, "Too few days to tell", "The physics model did better 3 days ahead; the AI model did better 5 and 7 days ahead. Three evenings can't show that this holds.", "From the table above") +
      finding(G.cold, "The AI model ran cold", "On average " + D(bias) + " below the measurement. At Central Park, about " + D(nyBias) + " cold every time. Why isn't known yet.", "From " + all.n + " cases; Central Park from " + ny.length, null,
        { city: "New York", valid: "2026-11-05T00:00:00+00:00", lead: 5, label: "New York, 4 November" }) +
      finding(G.grid, "What the AI model can't do yet", "It works on a grid of points about 28 km (17 miles) apart, so it can't see a single park, valley or stretch of coast. It doesn't forecast wind gusts, visibility or radar.", "Checked in the AIGFS v1.1 files on NOMADS, 4 November 2026", "f-limits") +
      finding(G.version, "A new version", "NOAA updated the AI model to version 1.1 and says some forecasts improved. A claim like that needs checking over many months.", SCN + ", 27 July 2026") +
      finding(G.missing, "A missed reading", lost + " cases have no measurement, because one station missed a reading. So there are " + all.n + " cases, not " + DATA.length + ".", "Station KNYC, Central Park, evening of 3 November") +
      "</ul>";
  }

  // ---------- make a scenario: who, what, where, when, why, how ----------
  // Forecast -> decision -> outcome, on the saved cases only. Practice, not advice; it never scores the person.
  var SC = {
    who: [
      { value: "manager", label: "An emergency manager", cold: "open a warming centre", warm: "open a cooling centre" },
      { value: "farmer", label: "A farmer", cold: "cover the crops", warm: "water the seedlings early" },
      { value: "teacher", label: "A teacher planning a trip", cold: "move the trip indoors", warm: "plan shade and water" },
      { value: "organiser", label: "An event organiser", cold: "book heaters", warm: "add shade and water stations" }
    ],
    // Thresholds are set in °C (the data's unit) and shown in the viewer's unit.
    what: [
      { value: "lt10", cold: true, t: 10 },
      { value: "lt15", cold: true, t: 15 },
      { value: "gt20", cold: false, t: 20 },
      { value: "gt25", cold: false, t: 25 }
    ],
    why: [
      { value: "caught", label: "Being caught off guard" },
      { value: "alarm", label: "A false alarm" },
      { value: "same", label: "Both are about as bad" }
    ],
    how: [
      { value: "ai", label: "Act if the AI model says so" },
      { value: "phys", label: "Act if the physics model says so" },
      { value: "both", label: "Act only if both agree" },
      { value: "either", label: "Act if either one says so" }
    ]
  };
  var whatLabel = function (w) {
    var word = w.cold ? "Colder than " : "Warmer than ";
    var f = Math.round(toF(w.t));
    return unit === "F" ? { label: word + f + " °F", small: w.t + " °C", name: word.toLowerCase() + f + " °F (" + w.t + " °C)" }
      : { label: word + w.t + " °C", small: f + " °F", name: word.toLowerCase() + w.t + " °C (" + f + " °F)" };
  };
  // "Why" starts unanswered: it's a values question, so the page doesn't answer it for you (audit 9).
  var sc = { who: "manager", what: "lt10", where: "all", when: 3, why: null, how: "either" };
  var find = function (list, v) { return list.find(function (x) { return x.value === v; }); };

  // The whole judgement, kept pure so it can be checked by hand.
  function judge(rows, what, how) {
    var hit = function (c) { return what.cold ? c < what.t : c > what.t; };
    var out = { inTime: [], falseAlarm: [], caught: [], quiet: [], noReading: [] };
    rows.forEach(function (r) {
      if (!r.observed || typeof r.aigfs !== "number" || typeof r.gfs !== "number") { out.noReading.push(r); return; }
      var a = hit(r.aigfs), g = hit(r.gfs);
      var act = how === "ai" ? a : how === "phys" ? g : how === "both" ? (a && g) : (a || g);
      var came = hit(r.observed.c);
      (act ? (came ? out.inTime : out.falseAlarm) : (came ? out.caught : out.quiet)).push(r);
    });
    return out;
  }
  window.TF_judge = judge; // for checking in the console

  function scenarioRows() {
    return DATA.filter(function (r) { return r.lead_days === sc.when && (sc.where === "all" || r.city === sc.where); });
  }

  var OUTCOME = {
    inTime: { label: "In time", line: "You acted, and the weather came." },
    falseAlarm: { label: "False alarm", line: "You acted, and it didn't come." },
    caught: { label: "Caught off guard", line: "It came, and you hadn't acted." },
    quiet: { label: "Rightly quiet", line: "You didn't act, and it didn't come." }
  };
  var plural = function (n, one, many) { return n + " " + (n === 1 ? one : many); };

  function renderScenario(announceIt) {
    var who = find(SC.who, sc.who), what = find(SC.what, sc.what), how = find(SC.how, sc.how), wl = whatLabel(what);
    var rows = scenarioRows();
    var o = judge(rows, what, sc.how);
    var counted = rows.length - o.noReading.length;
    var came = o.inTime.length + o.caught.length, acted = o.inTime.length + o.falseAlarm.length;
    var place = sc.where === "all" ? "in any of the six places" : "in " + sc.where;
    var action = what.cold ? who.cold : who.warm;
    var summary = who.label + ": you'll " + action + " if the evening will be " + wl.name + " " + place +
      ". You decide " + sc.when + " days ahead, and " + how.label.charAt(0).toLowerCase() + how.label.slice(1) + ".";
    var whyLine = sc.why === "caught"
      ? "You said being caught off guard is worse. The weather came " + plural(came, "time", "times") + ", and this rule caught you off guard in " + o.caught.length + " of them."
      : sc.why === "alarm"
        ? "You said a false alarm is worse. This rule had you act " + plural(acted, "time", "times") + ", and " + o.falseAlarm.length + " of them were false alarms."
        : sc.why === "same"
          ? "You said both are about as bad. This rule was right " + (o.inTime.length + o.quiet.length) + " of " + counted + " times."
          : "Which is worse for you: being caught off guard, or a false alarm? Answer question 5 (Why) to see how this rule does on what matters to you.";
    if (!came) whyLine += " In these cases the weather you chose never came, so try another place, threshold or lead time.";

    var cell = function (k) {
      return '<td><span class="sc-n">' + o[k].length + '</span><span class="sc-k">' + OUTCOME[k].label + '</span><span class="sc-line">' + OUTCOME[k].line + "</span></td>";
    };
    var grid = '<table class="hairgrid sc-grid"><caption>What this rule would have done, in ' + counted + " cases</caption>" +
      '<thead><tr><td></td><th scope="col">The weather came</th><th scope="col">It didn\'t come</th></tr></thead><tbody>' +
      '<tr><th scope="row" class="grid-mark">You acted</th>' + cell("inTime") + cell("falseAlarm") + "</tr>" +
      '<tr><th scope="row" class="grid-mark">You didn\'t</th>' + cell("caught") + cell("quiet") + "</tr></tbody></table>" +
      '<ul class="ref-list">' + ["inTime", "falseAlarm", "caught", "quiet"].map(function (k) {
        return "<li><b>" + OUTCOME[k].label + ": " + o[k].length + ".</b> " + OUTCOME[k].line + "</li>";
      }).join("") + "</ul>";

    // Every rule on the same cases, so the trade-off shows.
    var compare = '<table class="hairgrid sc-compare"><caption>Every rule, on the same cases</caption><thead><tr><th scope="col" class="grid-mark">Rule</th><th scope="col">In time</th><th scope="col">False alarm</th><th scope="col">Caught off guard</th></tr></thead><tbody>' +
      SC.how.map(function (h) {
        var j = judge(rows, what, h.value), mine = h.value === sc.how;
        return "<tr" + (mine ? ' class="mine"' : "") + '><th scope="row" class="grid-mark">' + h.label + (mine ? ' <span class="tagline">your rule</span>' : "") + '</th><td class="num">' + j.inTime.length + '</td><td class="num">' + j.falseAlarm.length + '</td><td class="num">' + j.caught.length + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<ul class="ref-list">' + SC.how.map(function (h) {
        var j = judge(rows, what, h.value);
        return "<li><b>" + h.label + (h.value === sc.how ? " (your rule)" : "") + ":</b> " + j.inTime.length + " in time, " + j.falseAlarm.length + " false alarms, " + j.caught.length + " caught off guard.</li>";
      }).join("") + "</ul>";

    var caseLine = function (r) {
      var key = ["inTime", "falseAlarm", "caught", "quiet"].find(function (k) { return o[k].indexOf(r) !== -1; });
      if (!key) return "<li><b>" + esc(r.city) + ", evening of " + dayName(r.valid) + ":</b> no reading, so not counted.</li>";
      return "<li><b>" + esc(r.city) + ", evening of " + dayName(r.valid) + ":</b> AI model " + T1(r.aigfs) + ", physics model " + T1(r.gfs) + ", measured " + T1(r.observed.c) + ". <span class=\"sc-tag\">" + OUTCOME[key].label + "</span></li>";
    };
    var wasOpen = document.querySelector(".sc-cases") && document.querySelector(".sc-cases").open;
    $("sc-out").innerHTML =
      '<h3 id="sc-h" tabindex="-1">Your scenario</h3><p class="sc-summary">' + esc(summary) + "</p>" + grid +
      '<p class="sc-why">' + esc(whyLine) + "</p>" +
      "<h3>Other rules</h3><p class=\"hint\">Same cases, same threshold. Each rule trades false alarms against being caught off guard.</p>" + compare +
      '<details class="sc-cases"' + (wasOpen ? " open" : "") + "><summary>See each case (" + rows.length + ")</summary><ul>" + rows.map(caseLine).join("") + "</ul></details>" +
      (o.noReading.length ? '<p class="hint">' + plural(o.noReading.length, "case has", "cases have") + " no reading and " + (o.noReading.length === 1 ? "isn't" : "aren't") + " counted.</p>" : "") +
      '<p class="hint">Same forecast, different decisions: change <i>Who</i> to see how another role would use it.</p>';
    // A short summary that stays in view while answering, so every change shows a result (audit 1).
    $("sc-live").innerHTML = '<span class="sc-live__k">Your rule so far</span> <span class="sc-live__v">' + o.inTime.length + " in time · " +
      plural(o.falseAlarm.length, "false alarm", "false alarms") + " · " + o.caught.length + " caught off guard</span> <span class=\"sc-live__go\">See the results ↓</span>";
    if (announceIt) {
      clearTimeout(renderScenario.t);
      renderScenario.t = setTimeout(function () {
        announce("Results updated: " + o.inTime.length + " in time, " + plural(o.falseAlarm.length, "false alarm", "false alarms") + ", " + o.caught.length + " caught off guard.");
      }, 700);
    }
  }

  function loadCase(city, valid, lead) {
    state.city = city; state.valid = valid; state.lead = lead;
    radios("cities", "city", CITIES.map(function (c) { return { value: c.name, label: c.name }; }), state.city);
    radios("days", "day", VALIDS.map(function (v) { return { value: v, label: dayName(v) }; }), state.valid);
    radios("leads", "lead", LEADS.map(function (L) { return { value: L, label: L + " days" }; }), state.lead);
    newCase();
    $("h-guess").scrollIntoView({ block: "start" });
    var first = document.querySelector('input[name="guess"]');
    if (first) first.focus({ preventScroll: true });
    announce("Case loaded: " + city + ", evening of " + dayName(valid) + ", " + lead + " days ahead. Make a guess.");
  }

  // ---------- theme ----------
  function themeNow() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  // The button says what it does (audit 13).
  function themeLabel() { $("theme").textContent = themeNow() === "dark" ? "Switch to light theme" : "Switch to dark theme"; }

  // ---------- everything that shows a temperature ----------
  function renderUnits() {
    document.querySelectorAll(".unit-btn").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.unit === unit ? "true" : "false"); });
    radios("guesses", "guess", [
      { value: "ai", label: "The AI model (AIGFS)" },
      { value: "phys", label: "The physics model (GFS)" },
      { value: "same", label: "About the same", small: unit === "F" ? "within about 1 °F" : "within 0.5 °C" }
    ], state.guess, function (v) { state.guess = v; $("hint").textContent = ""; });
    radios("sc-what", "sc-what", SC.what.map(function (w) { var l = whatLabel(w); return { value: w.value, label: l.label, small: l.small }; }), sc.what, scPick("what"));
    $("bigger").innerHTML = biggerHtml();
    if (state.shown) showResult(true);
    renderScenario(false);
  }

  // ---------- wire up ----------
  var scPick = function (key, cast) { return function (v) { sc[key] = cast ? cast(v) : v; renderScenario(true); }; };
  radios("cities", "city", CITIES.map(function (c) { return { value: c.name, label: c.name }; }), state.city, function (v) { state.city = v; newCase(); });
  radios("days", "day", VALIDS.map(function (v) { return { value: v, label: dayName(v) }; }), state.valid, function (v) { state.valid = v; newCase(); });
  radios("leads", "lead", LEADS.map(function (L) { return { value: L, label: L + " days" }; }), state.lead, function (v) { state.lead = Number(v); newCase(); });
  radios("sc-who", "sc-who", SC.who, sc.who, scPick("who"));
  radios("sc-where", "sc-where", [{ value: "all", label: "All six places" }].concat(CITIES.map(function (c) { return { value: c.name, label: c.name }; })), sc.where, scPick("where"));
  radios("sc-when", "sc-when", LEADS.map(function (L) { return { value: L, label: L + " days ahead" }; }), sc.when, scPick("when", Number));
  radios("sc-why", "sc-why", SC.why, sc.why, scPick("why"));
  radios("sc-how", "sc-how", SC.how, sc.how, scPick("how"));

  $("reveal").addEventListener("click", function () {
    if (state.shown) { showResult(false); announce("Result hidden."); return; }
    if (!state.guess) {
      $("hint").textContent = "Make a guess first. It helps you notice what you expected.";
      var first = document.querySelector('input[name="guess"]');
      if (first) first.focus();
      return;
    }
    showResult(true);
    $("h-result").focus();
    announce("Result shown.");
  });
  $("bigger").addEventListener("click", function (e) {
    var b = e.target.closest(".try");
    if (b) loadCase(b.dataset.city, b.dataset.valid, Number(b.dataset.lead));
  });
  $("again").addEventListener("click", function () { newCase(); announce("Started again. Make a guess."); });
  $("theme").addEventListener("click", function () {
    var next = themeNow() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    store.set("tf-theme", next);
    themeLabel();
  });
  document.querySelectorAll(".unit-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      if (unit === b.dataset.unit) return;
      unit = b.dataset.unit;
      store.set("tf-unit", unit);
      renderUnits();
      announce("Temperatures now in " + (unit === "F" ? "Fahrenheit" : "Celsius") + ".");
    });
  });
  themeLabel();
  showResult(false);
  renderUnits();
})();
