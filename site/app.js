// Two forecasts, one sky — visual prototype. Reads saved spike data only (data.js); fetches nothing.
(function () {
  "use strict";
  // ---------- language (audit P14, 19 November 2026): one script for both pages; the page's lang picks the words.
  // Spanish by Claude (neutral US Spanish, "tú", decimal points); not yet reviewed by a fluent person.
  var ES = (document.documentElement.lang || "").slice(0, 2) === "es";
  var tx = function (en, es) { return ES ? es : en; };
  var LOCALE = ES ? "es-US" : "en-GB";
  var ROOT = document.documentElement.getAttribute("data-root") || ""; // "../" on /es/, so shared files load
  var DATA = window.SPIKE || [];
  var CITIES = [
    { name: "Seattle", es: "Seattle", place: "Seattle–Tacoma Airport", placeEs: "Aeropuerto de Seattle-Tacoma", station: "KSEA", tz: "America/Los_Angeles" },
    { name: "Phoenix", es: "Phoenix", place: "Phoenix Sky Harbor Airport", placeEs: "Aeropuerto Phoenix Sky Harbor", station: "KPHX", tz: "America/Phoenix" },
    { name: "Denver", es: "Denver", place: "Denver Airport", placeEs: "Aeropuerto de Denver", station: "KDEN", tz: "America/Denver" },
    { name: "Chicago", es: "Chicago", place: "Chicago O'Hare Airport", placeEs: "Aeropuerto O'Hare de Chicago", station: "KORD", tz: "America/Chicago" },
    { name: "New York", es: "Nueva York", place: "Central Park", placeEs: "Central Park", station: "KNYC", tz: "America/New_York" },
    { name: "Miami", es: "Miami", place: "Miami Airport", placeEs: "Aeropuerto de Miami", station: "KMIA", tz: "America/New_York" }
  ];
  // The data keeps English place names; these give the reader's.
  var cityName = function (n) { var c = CITIES.find(function (x) { return x.name === n; }); return c ? (ES ? c.es : c.name) : n; };
  var placeName = function (c) { return ES ? c.placeEs : c.place; };
  var VALIDS = Array.from(new Set(DATA.map(function (r) { return r.valid; }))).sort();
  var LEADS = [3, 5, 7];
  var META = window.TF_META || {};
  var EVENINGS = VALIDS.length;
  var D_FIRST = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(new Date(VALIDS[0]).getTime() - 86400000));
  var D_LAST = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(new Date(VALIDS[VALIDS.length - 1]).getTime() - 86400000));
  var SPAN = tx("evenings of " + D_FIRST + " to " + D_LAST, "tardes del " + D_FIRST + " al " + D_LAST);
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
  // Compare the two models over a set of cases. A model is "better" only when its average advantage is more
  // than twice its standard error (a common rule of thumb); otherwise it's too close to call. Cases share
  // evenings, so they aren't fully independent: a rough guide, and the methods section says so.
  function compareRows(rows) {
    var ok = rows.filter(function (r) { return r.observed && typeof r.aigfs === "number" && typeof r.gfs === "number"; });
    var n = ok.length, sum = function (xs) { return xs.reduce(function (a, v) { return a + v; }, 0); };
    var ea = ok.map(function (r) { return Math.abs(r.aigfs - r.observed.c); });
    var eg = ok.map(function (r) { return Math.abs(r.gfs - r.observed.c); });
    var d = ea.map(function (v, i) { return v - eg[i]; }); // > 0: the physics model was closer
    var md = n ? sum(d) / n : 0;
    var sd = n > 1 ? Math.sqrt(sum(d.map(function (v) { return (v - md) * (v - md); })) / (n - 1)) : 0;
    var se = n > 1 ? sd / Math.sqrt(n) : Infinity;
    return {
      n: n, ai: n ? sum(ea) / n : 0, ph: n ? sum(eg) / n : 0,
      win: ea.filter(function (v, i) { return v < eg[i]; }).length,
      verdict: n < 5 || Math.abs(md) <= 2 * se ? "even" : md > 0 ? "phys" : "ai"
    };
  }
  var share = function (a, b, noun) { return a + tx(" of ", " de ") + b + (noun ? " " + noun : "") + (b ? " (" + Math.round(a / b * 100) + "%)" : ""); };

  // ---------- rain: the 6 hours ending at the evening (00:00 UTC) ----------
  // "Rain" means at least 0.01 inch, the NWS's measurable amount (0.254 mm; the models' files store it as 0.25).
  var WET = 0.25;
  var hasRainObs = function (r) { return !!(r.rain_obs && typeof r.rain_obs.mm === "number"); };
  var rainCase = function (r) { return hasRainObs(r) && typeof r.aigfs_rain === "number" && typeof r.gfs_rain === "number"; };
  var wetMin = function () { return unit === "F" ? tx("0.01 in", "0.01 pulg.") : "0.25 mm"; };
  // Rain follows the units switch: inches with °F, millimeters with °C, the other in brackets.
  var R = function (mm) {
    var i = (Math.round(mm / 25.4 * 100) / 100).toFixed(2) + tx(" in", " pulg."), m = (Math.round(mm * 10) / 10).toFixed(1) + " mm";
    return unit === "F" ? i + " (" + m + ")" : m + " (" + i + ")";
  };
  var Rshort = function (mm) { return unit === "F" ? (Math.round(mm / 25.4 * 100) / 100).toFixed(2) + tx(" in", " pulg.") : (Math.round(mm * 10) / 10).toFixed(1) + " mm"; };
  var fcRain = function (mm) { return mm >= WET ? tx("Rain, ", "Lluvia, ") + R(mm) : mm > 0 ? tx("Dry (a little, under ", "Seco (un poco, menos de ") + wetMin() + ")" : tx("Dry", "Seco"); };
  var obsRain = function (r) {
    if (!hasRainObs(r)) return tx("No report", "Sin reporte");
    return r.rain_obs.mm >= WET ? tx("Rain, ", "Lluvia, ") + R(r.rain_obs.mm) : r.rain_obs.trace ? tx("Dry (a trace, too little to measure)", "Seco (trazas, muy poca para medir)") : tx("Dry", "Seco");
  };
  var rainOutcome = function (f, o) {
    return f ? (o ? tx("Right: it rained", "Acertó: llovió") : tx("Wrong: a false alarm", "Falló: falsa alarma"))
      : (o ? tx("Wrong: it missed the rain", "Falló: no vio venir la lluvia") : tx("Right: it stayed dry", "Acertó: no llovió"));
  };
  // Compare the two models on rain over the cases where all three are saved. Same 2-standard-error rule as for
  // temperature, on how often each was right. One rainy evening counts up to three times (once per forecast
  // length), so no model is called better until at least 10 rainy place-evenings are in the record.
  var RAIN_EVENTS_MIN = 10;
  function compareRain(rows) {
    var ok = rows.filter(rainCase), n = ok.length;
    var tally = function (key) {
      var t = { hit: 0, miss: 0, fa: 0, quiet: 0 };
      ok.forEach(function (r) { var f = r[key] >= WET, o = r.rain_obs.mm >= WET; t[f ? (o ? "hit" : "fa") : (o ? "miss" : "quiet")]++; });
      t.right = t.hit + t.quiet; return t;
    };
    var right = function (r, key) { return (r[key] >= WET) === (r.rain_obs.mm >= WET) ? 1 : 0; };
    var d = ok.map(function (r) { return right(r, "aigfs_rain") - right(r, "gfs_rain"); }); // > 0: the AI model was right more often
    var sum = function (xs) { return xs.reduce(function (a, v) { return a + v; }, 0); };
    var md = n ? sum(d) / n : 0;
    var sd = n > 1 ? Math.sqrt(sum(d.map(function (v) { return (v - md) * (v - md); })) / (n - 1)) : 0;
    var se = n > 1 ? sd / Math.sqrt(n) : Infinity;
    var wetRows = ok.filter(function (r) { return r.rain_obs.mm >= WET; });
    var events = new Set(wetRows.map(function (r) { return r.city + "|" + r.valid; })).size;
    var leads = LEADS.map(function (L) { return [L, ok.filter(function (r) { return r.lead_days === L; }).length]; });
    return {
      n: n, wet: wetRows.length, events: events, evenings: new Set(ok.map(function (r) { return r.valid; })).size,
      ai: tally("aigfs_rain"), ph: tally("gfs_rain"), leads: leads, rows: ok,
      few: events < RAIN_EVENTS_MIN,
      verdict: events < RAIN_EVENTS_MIN || n < 5 || Math.abs(md) <= 2 * se ? "even" : md > 0 ? "ai" : "phys"
    };
  }
  window.TF_compareRain = compareRain; // for checking in the console
  var dir = function (d) { return Math.abs(d) < 0.05 ? tx("spot on", "exacto") : (d < 0 ? tx("too cold", "más frío") : tx("too warm", "más cálido")); };
  var dayName = function (iso, utcDay) {
    var d = new Date(iso);
    if (!utcDay) d = new Date(d.getTime() - 86400000); // 00:00 UTC is the evening before in the US
    return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", timeZone: "UTC" }).format(d);
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
    announce(tx("New case chosen. Make a guess.", "Elegiste un caso nuevo. Elige tu respuesta."));
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
    var label = tx("Measured " + T1(oc) + ". AI model forecast " + T1(ac) + ", " + D(ac - oc) + " " + dir(ac - oc) +
      ". Physics model forecast " + T1(gc) + ", " + D(gc - oc) + " " + dir(gc - oc) + ".",
      "Medido: " + T1(oc) + ". Pronóstico del modelo de IA: " + T1(ac) + ", " + D(ac - oc) + " " + dir(ac - oc) +
      ". Pronóstico del modelo físico: " + T1(gc) + ", " + D(gc - oc) + " " + dir(gc - oc) + ".");
    var diamond = function (cx, cy) { return '<path class="m-obs" d="M' + cx + " " + (cy - 10) + " L" + (cx + 10) + " " + cy + " L" + cx + " " + (cy + 10) + " L" + (cx - 10) + " " + cy + 'Z"/>'; };
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(label) + '">' +
      lab(tx("AI model", "Modelo de IA"), rows.ai) + lab(tx("Measured", "Medido"), rows.obs) + lab(tx("Physics model", "Modelo físico"), rows.phys) +
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
    '<li><svg viewBox="0 0 22 22"><path d="M11 2 L20 11 L11 20 L2 11Z" fill="var(--obs)"/></svg>' + tx("Measured", "Medido") + '</li>' +
    '<li><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="var(--paper)" stroke="var(--ai-mark)" stroke-width="3"/></svg>' + tx("AI model (AIGFS)", "Modelo de IA (AIGFS)") + '</li>' +
    '<li><svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" fill="var(--paper)" stroke="var(--phys-mark)" stroke-width="3"/></svg>' + tx("Physics model (GFS)", "Modelo físico (GFS)") + '</li></ul>';

  var NEXT_AFTER_RESULT = '<p class="next"><a href="#h-pick">' + tx("Try another case ↑", "Prueba otro caso ↑") + '</a> <span aria-hidden="true">·</span> <a href="#h-bigger">' + tx("Next: the bigger picture ↓", "Sigue: el panorama general ↓") + '</a> <span aria-hidden="true">·</span> <a href="#top">' + tx("Back to top ↑", "Volver arriba ↑") + "</a></p>";
  var PLACEHOLDER = '<p class="placeholder">' + tx("Make a guess in step 02, then choose <b>Show what happened</b>.", "Elige tu respuesta en el paso 02 y luego selecciona <b>Mostrar qué pasó</b>.") + '</p><p class="next"><a href="#top">' + tx("Back to top ↑", "Volver arriba ↑") + "</a></p>";

  // Rain for one case, after the temperature: no guess, just what each model said and what fell.
  var ICON = function (id, cls) { return '<svg class="ico' + (cls ? " " + cls : "") + '" aria-hidden="true" focusable="false"><use href="#i-' + id + '"/></svg>'; };
  function caseRainHtml(r) {
    var head = '<h3 id="h-case-rain">' + ICON("rain") + tx("And rain?", "¿Y la lluvia?") + "</h3>";
    var anyRain = hasRainObs(r) || typeof r.aigfs_rain === "number" || typeof r.gfs_rain === "number";
    if (!anyRain) {
      return head + '<p class="hint">' + tx("Rain wasn't saved for this evening. The archive began saving rain on 19 November 2026, and filled in earlier evenings only where the sources still had them.",
        "No se guardó la lluvia de esta tarde. El archivo empezó a guardar la lluvia el 19 de noviembre de 2026, y completó tardes anteriores solo donde las fuentes aún la tenían.") + "</p>";
    }
    var o = hasRainObs(r) ? r.rain_obs.mm >= WET : null;
    var line = function (key) {
      if (typeof r[key] !== "number") return { said: tx("Not saved", "No guardado"), out: "—" };
      return { said: fcRain(r[key]), out: o === null ? tx("Can't tell", "No se sabe") : rainOutcome(r[key] >= WET, o) };
    };
    var a = line("aigfs_rain"), g = line("gfs_rain");
    var notes = [];
    if (typeof r.aigfs_rain !== "number") notes.push(tx("NOAA keeps the AI model's forecasts for only about 10 days, so its rain from older runs couldn't be saved.",
      "La NOAA guarda los pronósticos del modelo de IA solo unos 10 días, así que no se pudo guardar la lluvia de corridas más antiguas."));
    if (!hasRainObs(r)) notes.push(tx("The station's report for this evening had no usable rain group, so the measurement counts as missing, never as dry.",
      "El reporte de la estación de esta tarde no traía un dato de lluvia válido, así que la medición cuenta como faltante, nunca como seco."));
    return head + '<p class="sense rain-sense">' + tx("Rain in the 6 hours before the evening. At least " + wetMin() + " counts as rain.", "Lluvia en las 6 horas antes de la tarde. Cuenta como lluvia a partir de " + wetMin() + (wetMin().slice(-1) === "." ? "" : ".")) + "</p>" +
      '<div class="wide"><table><caption>' + tx("Rain, ", "Lluvia, ") + esc(cityName(r.city)) + tx(", evening of ", ", tarde del ") + dayName(r.valid) + "</caption>" +
      '<thead><tr><th scope="col">' + tx("Source", "Fuente") + '</th><th scope="col">' + tx("Rain", "Lluvia") + '</th><th scope="col">' + tx("Right?", "¿Acertó?") + "</th></tr></thead><tbody>" +
      '<tr><th scope="row">' + tx("Measured", "Medido") + "</th><td>" + obsRain(r) + "</td><td>—</td></tr>" +
      '<tr><th scope="row" class="ai-text">' + tx("AI model", "Modelo de IA") + "</th><td>" + a.said + "</td><td>" + a.out + "</td></tr>" +
      '<tr><th scope="row" class="phys-text">' + tx("Physics model", "Modelo físico") + "</th><td>" + g.said + "</td><td>" + g.out + "</td></tr></tbody></table>" +
      '<ul class="ref-list"><li><b>' + tx("Measured:", "Medido:") + "</b> " + obsRain(r) + "</li>" +
      '<li><b class="ai-text">' + tx("AI model:", "Modelo de IA:") + "</b> " + a.said + (a.out !== "—" ? ". " + a.out : "") + "</li>" +
      '<li><b class="phys-text">' + tx("Physics model:", "Modelo físico:") + "</b> " + g.said + (g.out !== "—" ? ". " + g.out : "") + "</li></ul></div>" +
      (notes.length ? '<p class="hint">' + notes.join(" ") + "</p>" : "");
  }

  function resultHtml(r) {
    var city = CITIES.find(function (c) { return c.name === r.city; });
    var when = tx("Both forecasts were made " + r.lead_days + " days earlier, on the evening of " + dayName(r.run) + ".",
      "Los dos pronósticos se hicieron " + r.lead_days + " días antes, la tarde del " + dayName(r.run) + ".");
    if (!r.observed || typeof r.aigfs !== "number" || typeof r.gfs !== "number") {
      return '<p class="missing">' + tx("<b>No reading for this evening.</b> The " + esc(city.place) + " station sent no temperature near this time, " +
        "so there is nothing to check the forecasts against. Instruments do miss readings, and an honest tool says so.",
        "<b>No hay medición para esta tarde.</b> La estación " + city.station + " (" + esc(city.placeEs) + ") no envió la temperatura cerca de esta hora, " +
        "así que no hay con qué comparar los pronósticos. Los instrumentos a veces fallan, y una herramienta honesta lo dice.") + "</p>" +
        '<p class="hint">' + tx("The AI model said " + T(r.aigfs) + "; the physics model said " + T(r.gfs) + ". ", "El modelo de IA dijo " + T(r.aigfs) + "; el modelo físico dijo " + T(r.gfs) + ". ") + when + "</p>" + caseRainHtml(r) + NEXT_AFTER_RESULT;
    }
    var o = r.observed.c, ea = r.aigfs - o, eg = r.gfs - o;
    fig.o = o; fig.a = r.aigfs; fig.g = r.gfs;
    var closer = Math.abs(Math.abs(ea) - Math.abs(eg)) < SAME ? "same" : (Math.abs(ea) < Math.abs(eg) ? "ai" : "phys");
    var head = closer === "same" ? tx("The two forecasts did about as well as each other.", "A los dos pronósticos les fue más o menos igual.")
      : closer === "ai" ? tx("The AI model came closer this time.", "Esta vez se acercó más el modelo de IA.") : tx("The physics model came closer this time.", "Esta vez se acercó más el modelo físico.");
    var guessLine = state.guess === closer ? tx("Your guess matched this case.", "Tu respuesta coincidió con este caso.") : tx("This case went the other way from your guess.", "Este caso salió al revés de tu respuesta.");
    var at = new Intl.DateTimeFormat(ES ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: city.tz }).format(new Date(r.observed.at));
    var missed = function (v, d) { return tx(", missed by " + D(d) + " " + dir(d), ", error de " + D(d) + " (" + dir(d) + ")"); };
    return '<p class="verdict"><b>' + head + "</b> " + guessLine + tx(" One case says little on its own, so look at the bigger picture below.", " Un solo caso dice poco, así que mira el panorama general más abajo.") + "</p>" +
      KEY + '<figure class="figure"><div class="lanes"></div>' +
      "<figcaption>" + tx("The dashed line is the measured temperature. Each bar is how far a forecast missed.", "La línea punteada es la temperatura medida. Cada barra muestra cuánto falló un pronóstico.") + "</figcaption></figure>" +
      '<div class="wide"><table><caption>' + esc(cityName(r.city)) + tx(", evening of ", ", tarde del ") + dayName(r.valid) + "</caption>" +
      '<thead><tr><th scope="col">' + tx("Source", "Fuente") + '</th><th scope="col">' + tx("Temperature", "Temperatura") + '</th><th scope="col">' + tx("Miss", "Error") + "</th></tr></thead><tbody>" +
      '<tr><th scope="row">' + tx("Measured", "Medido") + '</th><td class="num">' + T(o) + "</td><td>—</td></tr>" +
      '<tr><th scope="row" class="ai-text">' + tx("AI model", "Modelo de IA") + '</th><td class="num">' + T(r.aigfs) + '</td><td class="num">' + D(ea) + " " + dir(ea) + "</td></tr>" +
      '<tr><th scope="row" class="phys-text">' + tx("Physics model", "Modelo físico") + '</th><td class="num">' + T(r.gfs) + '</td><td class="num">' + D(eg) + " " + dir(eg) + "</td></tr>" +
      "</tbody></table>" +
      '<ul class="ref-list">' +
      "<li><b>" + tx("Measured:", "Medido:") + "</b> " + T(o) + "</li>" +
      '<li><b class="ai-text">' + tx("AI model:", "Modelo de IA:") + "</b> " + T(r.aigfs) + missed(r.aigfs, ea) + "</li>" +
      '<li><b class="phys-text">' + tx("Physics model:", "Modelo físico:") + "</b> " + T(r.gfs) + missed(r.gfs, eg) + "</li></ul></div>" +
      '<p class="hint">' + tx("Forecasts are estimates, so they are shown in whole degrees; the misses come from the exact numbers. " +
      "Measured at " + esc(at) + " local time at " + esc(city.place) + " (station " + city.station + "). ",
      "Los pronósticos son estimaciones, por eso se muestran en grados enteros; los errores salen de los números exactos. " +
      "Medido a las " + esc(at) + ", hora local, en " + esc(city.placeEs) + " (estación " + city.station + "). ") + when + "</p>" + caseRainHtml(r) + NEXT_AFTER_RESULT;
  }

  // Step 03 always shows, so the numbering never jumps (audit 8); the button says whether its content is open (audit 11).
  function showResult(on) {
    state.shown = on;
    $("reveal").textContent = on ? tx("Hide what happened", "Ocultar qué pasó") : tx("Show what happened", "Mostrar qué pasó");
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

  // ---------- charts (audit P9, 19 November 2026) ----------
  // Drawn at the box's real width in CSS pixels, so text never scales below 14px. Each chart has a spoken
  // summary and a table with the same numbers; the hover and keyboard readout adds, it never gates.
  // Shapes carry identity as well as color: circle = AI model, square = physics model.
  var uScale = function (dc) { return dc * (unit === "F" ? 1.8 : 1); }; // a difference in °C, in the viewer's unit
  var fmt1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
  var niceStep = function (span, room, minPx) { return [0.5, 1, 2, 5, 10, 20].find(function (st) { return room / (span / st) >= minPx; }) || 20; };
  var markAI = function (x, y, r) { return '<circle class="m-ai" cx="' + x + '" cy="' + y + '" r="' + r + '"/>'; };
  var markPH = function (x, y, h) { return '<rect class="m-phys" x="' + (x - h) + '" y="' + (y - h) + '" width="' + 2 * h + '" height="' + 2 * h + '"/>'; };
  var KEY_MODELS = '<ul class="key" aria-hidden="true">' +
    '<li><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="7" fill="var(--paper)" stroke="var(--ai-mark)" stroke-width="3"/></svg>' + tx("AI model (AIGFS)", "Modelo de IA (AIGFS)") + '</li>' +
    '<li><svg viewBox="0 0 22 22"><rect x="4" y="4" width="14" height="14" fill="var(--paper)" stroke="var(--phys-mark)" stroke-width="3"/></svg>' + tx("Physics model (GFS)", "Modelo físico (GFS)") + '</li></ul>';

  // 1. Average miss by how far ahead: a dot plot, one row per forecast length, the gap drawn between the dots.
  function leadPlotSvg(rows, W) {
    W = Math.max(260, Math.round(W));
    var LBL = 76, X0 = LBL + 8, X1 = W - 16, ROW = 46, top = 18;
    var vals = []; rows.forEach(function (r) { vals.push(uScale(r.st.ai), uScale(r.st.ph)); });
    var step = niceStep(Math.max.apply(null, vals), X1 - X0, 48);
    var hi = Math.ceil(Math.max.apply(null, vals) / step) * step || step;
    var x = function (v) { return Math.round((X0 + v / hi * (X1 - X0)) * 10) / 10; };
    var axisY = top + rows.length * ROW, H = axisY + 52, g = "";
    for (var t = 0; t <= hi + 1e-9; t += step) {
      g += '<line class="grid" x1="' + x(t) + '" y1="' + (top - 8) + '" x2="' + x(t) + '" y2="' + axisY + '"/>' +
        '<text class="tick" x="' + x(t) + '" y="' + (axisY + 22) + '" text-anchor="middle">' + (step < 1 ? t.toFixed(1) : t) + "°</text>";
    }
    var body = rows.map(function (r, i) {
      var y = top + i * ROW + ROW / 2 - 6, a = uScale(r.st.ai), p = uScale(r.st.ph);
      return '<g><title>' + esc(r.label + ": " + tx("AI model ", "modelo de IA ") + fmt1(a) + " " + sym() + tx(", physics model ", ", modelo físico ") + fmt1(p) + " " + sym()) + "</title>" +
        '<text class="row-label' + (r.total ? " row-label--total" : "") + '" x="0" y="' + (y + 5) + '">' + esc(r.label) + "</text>" +
        '<line class="gap-line" x1="' + x(Math.min(a, p)) + '" y1="' + y + '" x2="' + x(Math.max(a, p)) + '" y2="' + y + '"/>' +
        markAI(x(a), y, 7) + markPH(x(p), y, 6.5) + "</g>";
    }).join("");
    var label = tx("Average miss by how far ahead the forecast was made, in ", "Error promedio según la anticipación del pronóstico, en ") + sym() + ". " + rows.map(function (r) {
      return r.label + ": " + tx("AI model ", "modelo de IA ") + fmt1(uScale(r.st.ai)) + tx(", physics model ", ", modelo físico ") + fmt1(uScale(r.st.ph));
    }).join("; ") + tx(". Smaller is better. The table below has the same numbers.", ". Menos es mejor. La tabla de abajo tiene los mismos números.");
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(label) + '">' + g +
      '<line class="axis" x1="' + X0 + '" y1="' + axisY + '" x2="' + X1 + '" y2="' + axisY + '"/>' + body +
      '<text class="axis-title" x="' + X0 + '" y="' + (H - 4) + '">' + tx("average miss, ", "error promedio, ") + sym() + "</text></svg>";
  }

  // 2. Evening by evening: each evening's average miss for both models, as two lines. Shows the day-to-day ups
  // and downs behind "too close to call". A vertical crosshair and readout follow the pointer or the arrow keys.
  function eveningRows() {
    return VALIDS.map(function (v) {
      var st = compareRows(DATA.filter(function (r) { return r.valid === v; }));
      return { valid: v, st: st };
    }).filter(function (e) { return e.st.n > 0; });
  }
  var evPlot = { pts: [], rows: [] };
  function eveningSvg(rows, W) {
    W = Math.max(260, Math.round(W));
    var X0 = 44, X1 = W - 14, top = 34, H = W < 480 ? 236 : 276, Y1 = H - 32;
    var vals = []; rows.forEach(function (e) { vals.push(uScale(e.st.ai), uScale(e.st.ph)); });
    var step = niceStep(Math.max.apply(null, vals), Y1 - top, 36);
    var hi = Math.ceil(Math.max.apply(null, vals) / step) * step || step;
    var y = function (v) { return Math.round((Y1 - v / hi * (Y1 - top)) * 10) / 10; };
    var n = rows.length, x = function (i) { return Math.round((X0 + 10 + (n > 1 ? i / (n - 1) : 0.5) * (X1 - X0 - 20)) * 10) / 10; };
    var g = "";
    for (var t = 0; t <= hi + 1e-9; t += step) {
      g += '<line class="grid" x1="' + X0 + '" y1="' + y(t) + '" x2="' + X1 + '" y2="' + y(t) + '"/>' +
        '<text class="tick" x="' + (X0 - 8) + '" y="' + (y(t) + 5) + '" text-anchor="end">' + (step < 1 ? t.toFixed(1) : t) + "°</text>";
    }
    var every = Math.max(1, Math.ceil(n * 64 / (X1 - X0)));
    rows.forEach(function (e, i) {
      if (i % every === 0 || i === n - 1 && (n - 1) % every >= every / 2) {
        var d = new Date(new Date(e.valid).getTime() - 86400000);
        g += '<text class="tick" x="' + x(i) + '" y="' + (Y1 + 22) + '" text-anchor="middle">' + d.getUTCDate() + " " + (ES ? ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])[d.getUTCMonth()] + "</text>";
      }
    });
    var line = function (key, cls) { return '<path class="' + cls + '" d="' + rows.map(function (e, i) { return (i ? "L" : "M") + x(i) + " " + y(uScale(e.st[key])); }).join(" ") + '"/>'; };
    var dots = rows.map(function (e, i) { return markAI(x(i), y(uScale(e.st.ai)), 4.5) + markPH(x(i), y(uScale(e.st.ph)), 4); }).join("");
    evPlot.pts = rows.map(function (e, i) { return x(i); }); evPlot.rows = rows; evPlot.W = W;
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-hidden="true" focusable="false">' + g +
      '<line class="axis" x1="' + X0 + '" y1="' + Y1 + '" x2="' + X1 + '" y2="' + Y1 + '"/>' +
      '<line class="crosshair" id="ev-cross" x1="0" y1="' + top + '" x2="0" y2="' + Y1 + '" visibility="hidden"/>' +
      line("ph", "line-phys") + line("ai", "line-ai") + dots +
      '<text class="axis-title" x="0" y="14">' + tx("average miss each evening, ", "error promedio de cada tarde, ") + sym() + "</text></svg>" +
      '<div class="readout" id="ev-readout" hidden></div>';
  }
  function eveningLabel(rows) {
    var aiDays = rows.filter(function (e) { return e.st.ai < e.st.ph; }).length;
    return tx("Each evening's average miss for both models, " + rows.length + " evenings, in " + sym() + ". The AI model had the smaller average miss on " +
      aiDays + " of " + rows.length + " evenings. The gap swings from evening to evening. Use the left and right arrow keys to read each evening; the table below has the same numbers.",
      "Error promedio de cada tarde para los dos modelos, " + rows.length + " tardes, en " + sym() + ". El modelo de IA tuvo el menor error promedio en " +
      aiDays + " de " + rows.length + " tardes. La diferencia cambia de una tarde a otra. Usa las flechas izquierda y derecha para leer cada tarde; la tabla de abajo tiene los mismos números.");
  }
  function showReadout(i) {
    var box = $("ev-chart"), cross = $("ev-cross"), ro = $("ev-readout");
    if (!box || !cross || !ro) return;
    if (i === null) { cross.setAttribute("visibility", "hidden"); ro.hidden = true; evPlot.i = null; return; }
    evPlot.i = i;
    var e = evPlot.rows[i], px = evPlot.pts[i];
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    ro.textContent = "";
    var h = document.createElement("b"); h.textContent = tx("Evening of ", "Tarde del ") + dayName(e.valid); ro.appendChild(h);
    [["ai", tx("AI model", "Modelo de IA"), "k-ai"], ["ph", tx("Physics model", "Modelo físico"), "k-phys"]].forEach(function (m) {
      var row = document.createElement("span"); row.className = "readout__row";
      var k = document.createElement("i"); k.className = "readout__key " + m[2]; k.setAttribute("aria-hidden", "true");
      var v = document.createElement("strong"); v.textContent = fmt1(uScale(e.st[m[0]])) + " " + sym();
      row.appendChild(k); row.appendChild(v); row.appendChild(document.createTextNode(" " + m[1]));
      ro.appendChild(row);
    });
    var c = document.createElement("span"); c.className = "readout__n"; c.textContent = e.st.n + tx(" cases", " casos"); ro.appendChild(c);
    ro.hidden = false;
    var left = Math.min(Math.max(px + 12, 0), box.clientWidth - ro.offsetWidth - 4);
    if (px + 12 + ro.offsetWidth > box.clientWidth) left = Math.max(px - 12 - ro.offsetWidth, 0);
    ro.style.left = left + "px";
  }
  var chartObs = [];
  function fitChart(box, draw, after) {
    if (!box) return;
    var w = box.clientWidth;
    box.innerHTML = draw(w); if (after) after();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { if (box.clientWidth !== w) { w = box.clientWidth; box.innerHTML = draw(w); if (after) after(); } });
      ro.observe(box); chartObs.push(ro);
    }
  }
  function drawCharts() {
    chartObs.forEach(function (o) { o.disconnect(); }); chartObs = [];
    var ok = DATA.filter(function (r) { return r.observed && typeof r.aigfs === "number" && typeof r.gfs === "number"; });
    var leadRows = LEADS.map(function (L) { return { label: L + tx(" days", " días"), st: compareRows(ok.filter(function (r) { return r.lead_days === L; })) }; })
      .concat([{ label: tx("All", "Todos"), total: true, st: compareRows(ok) }]);
    fitChart($("lead-chart"), function (w) { return leadPlotSvg(leadRows, w); });
    var ev = eveningRows(), box = $("ev-chart");
    if (!box) return;
    box.setAttribute("aria-label", eveningLabel(ev));
    fitChart(box, function (w) { return eveningSvg(ev, w); }, function () { if (evPlot.i != null) showReadout(evPlot.i); });
  }
  function eveningTwin() {
    var ev = eveningRows();
    return '<details class="sc-cases twin"><summary>' + tx("See each evening's numbers (", "Ver los números de cada tarde (") + ev.length + ")</summary>" +
      '<table class="hairgrid"><caption>' + tx("Average miss on each evening", "Error promedio de cada tarde") + '</caption><thead><tr><th scope="col" class="grid-mark">' + tx("Evening", "Tarde") + '</th><th scope="col">' + tx("AI model", "Modelo de IA") + '</th><th scope="col">' + tx("Physics model", "Modelo físico") + '</th><th scope="col">' + tx("Cases", "Casos") + "</th></tr></thead><tbody>" +
      ev.map(function (e) { return '<tr><th scope="row" class="grid-mark">' + dayName(e.valid) + '</th><td class="num">' + D(e.st.ai) + '</td><td class="num">' + D(e.st.ph) + '</td><td class="num">' + e.st.n + "</td></tr>"; }).join("") +
      '</tbody></table><ul class="ref-list">' + ev.map(function (e) { return "<li><b>" + dayName(e.valid) + ":</b> " + tx("AI model ", "modelo de IA ") + D(e.st.ai) + tx(", physics model ", ", modelo físico ") + D(e.st.ph) + " (" + e.st.n + tx(" cases)", " casos)") + "</li>"; }).join("") + "</ul></details>";
  }

  // ---------- the bigger picture ----------
  // Rain, as hits, misses and false alarms: the same four outcomes as the scenario, so the words carry over.
  function rainSectionHtml(rs) {
    if (!rs.n) return "";
    var leadsText = rs.leads.filter(function (p) { return p[1]; }).map(function (p) { return p[1] + tx(" at ", " a ") + p[0] + tx(" days", " días"); }).join(", ");
    var row = function (label, cls, t) {
      return '<tr><th scope="row" class="grid-mark"><span class="' + cls + '">' + label + '</span></th><td class="num">' + share(t.hit, rs.wet) + '</td><td class="num">' + t.miss +
        '</td><td class="num">' + t.fa + '</td><td class="num">' + share(t.quiet, rs.n - rs.wet) + "</td></tr>";
    };
    var item = function (label, cls, t) {
      return '<li><b class="' + cls + '">' + label + ":</b> " + tx("caught the rain in " + share(t.hit, rs.wet) + ", missed it " + plural(t.miss, "time", "times") + ", " +
        plural(t.fa, "false alarm", "false alarms") + ", and right that it stayed dry in " + share(t.quiet, rs.n - rs.wet) + ".",
        "acertó la lluvia en " + share(t.hit, rs.wet) + ", no la vio venir " + plural(t.miss, "vez", "veces") + ", " +
        plural(t.fa, "falsa alarma", "falsas alarmas") + ", y acertó que no llovería en " + share(t.quiet, rs.n - rs.wet) + ".") + "</li>";
    };
    var A = tx("AI model", "Modelo de IA"), P = tx("Physics model", "Modelo físico");
    return '<h3 id="h-rain" tabindex="-1">' + ICON("rain") + tx("Rain", "Lluvia") + "</h3>" +
      '<p class="hint">' + tx("Did it rain in the 6 hours before the evening? Counted only where both models' rain and the station's report are saved: " +
      rs.n + " cases from " + plural(rs.evenings, "evening", "evenings") + " (" + leadsText + "). What it means is in the findings below.",
      "¿Llovió en las 6 horas antes de la tarde? Solo cuentan los casos con la lluvia de los dos modelos y el reporte de la estación guardados: " +
      rs.n + " casos de " + plural(rs.evenings, "tarde", "tardes") + " (" + leadsText + "). Lo que significa está en los hallazgos de abajo.") + "</p>" +
      '<table class="hairgrid rain-table"><caption>' + tx("Rain forecasts against what the stations measured, in " + rs.n + " cases (rain in " + rs.wet + ")",
        "Pronósticos de lluvia comparados con lo que midieron las estaciones, en " + rs.n + " casos (llovió en " + rs.wet + ")") + "</caption>" +
      '<thead><tr><th scope="col" class="grid-mark">' + tx("Model", "Modelo") + '</th><th scope="col">' + tx("Caught the rain", "Acertó la lluvia") + '</th><th scope="col">' + tx("Missed it", "No la vio venir") +
      '</th><th scope="col">' + tx("False alarm", "Falsa alarma") + '</th><th scope="col">' + tx("Right that it stayed dry", "Acertó que no llovería") + "</th></tr></thead><tbody>" +
      row(A, "ai-text", rs.ai) + row(P, "phys-text", rs.ph) + "</tbody></table>" +
      '<ul class="ref-list">' + item(A, "ai-text", rs.ai) + item(P, "phys-text", rs.ph) + "</ul>";
  }
  function biggerHtml() {
    var ok = DATA.filter(function (r) { return r.observed && typeof r.aigfs === "number" && typeof r.gfs === "number"; });
    var mean = function (xs) { return xs.reduce(function (s, v) { return s + v; }, 0) / xs.length; };
    var stat = compareRows;
    var byLead = LEADS.map(function (L) { return [L, stat(ok.filter(function (r) { return r.lead_days === L; }))]; });
    var all = stat(ok);
    var bias = mean(ok.map(function (r) { return r.aigfs - r.observed.c; }));
    var ny = ok.filter(function (r) { return r.city === "New York"; });
    var nyBias = mean(ny.map(function (r) { return r.aigfs - r.observed.c; }));
    var lost = DATA.length - ok.length;
    var pct = function (a, b) { return Math.round(a / b * 100); };
    var overall = {
      title: all.verdict === "even" ? tx("Too close to call so far", "Empate técnico por ahora") : all.verdict === "phys" ? tx("The physics model has done better", "Al modelo físico le ha ido mejor") : tx("The AI model has done better", "Al modelo de IA le ha ido mejor"),
      dek: tx("The AI model came closer in " + share(all.win, all.n, "cases") + ". Its average miss was " + D(all.ai) + ", against the physics model's " + D(all.ph) + ". ",
        "El modelo de IA se acercó más en " + share(all.win, all.n, "casos") + ". Su error promedio fue de " + D(all.ai) + ", frente a " + D(all.ph) + " del modelo físico. ") +
        (all.verdict === "even" ? tx("That gap is smaller than the day-to-day ups and downs, so neither model is ahead yet.", "Esa diferencia es menor que los altibajos de un día a otro, así que ningún modelo va adelante todavía.")
          : tx("That gap is bigger than the day-to-day ups and downs.", "Esa diferencia es mayor que los altibajos de un día a otro."))
    };
    var leadKind = function (st) { return st.verdict; };
    var LEAD_WORD = ES ? { even: "empate técnico", ai: "le fue mejor al modelo de IA", phys: "le fue mejor al modelo físico" } : { even: "too close to call", ai: "the AI model did better", phys: "the physics model did better" };
    var leadWords = byLead.map(function (p, i) { return ES ? (i ? "a " : "A ") + p[0] + " días, " + LEAD_WORD[leadKind(p[1])] : p[0] + " days ahead, " + LEAD_WORD[leadKind(p[1])]; });
    var sameEverywhere = byLead.every(function (p) { return leadKind(p[1]) === leadKind(byLead[0][1]); });
    var leadsF = {
      title: sameEverywhere ? tx("The same at every distance", "Igual con cualquier anticipación") : tx("It depends how far ahead", "Depende de la anticipación"),
      dek: leadWords.join("; ") + ". " + (EVENINGS < 30 ? tx(plural(EVENINGS, "evening", "evenings") + " is still too few to call this a rule.", plural(EVENINGS, "tarde", "tardes") + " todavía son muy pocas para llamarlo una regla.")
        : tx("Watch whether this holds as the record grows.", "Observa si se mantiene a medida que crece el registro."))
    };
    var nyCold = ny.filter(function (r) { return r.aigfs < r.observed.c; }).length;
    var leanF = {
      title: bias < -0.3 ? tx("The AI model ran cold", "El modelo de IA tendió a pronosticar más frío") : bias > 0.3 ? tx("The AI model ran warm", "El modelo de IA tendió a pronosticar más calor") : tx("No clear lean overall", "Sin una tendencia clara en general"),
      dek: tx("On average " + D(bias) + (bias < 0 ? " below" : " above") + " the measurement. At Central Park it ran about " + D(nyBias) + (nyBias < 0 ? " cold" : " warm") +
        " on average, colder than measured in " + nyCold + " of " + ny.length + " cases. Why isn't known yet.",
        "En promedio, " + D(bias) + (bias < 0 ? " por debajo" : " por encima") + " de la medición. En Central Park quedó en promedio unos " + D(nyBias) + (nyBias < 0 ? " por debajo" : " por encima") +
        ", y pronosticó menos de lo medido en " + nyCold + " de " + ny.length + " casos. Todavía no se sabe por qué.")
    };
    var missed = DATA.filter(function (r) { return !r.observed; }).map(function (r) {
      var c = CITIES.find(function (x) { return x.name === r.city; }); return c.station + ", " + dayName(r.valid);
    }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var missedSource = tx("Missed: ", "Faltan: ") + missed.slice(0, 3).join("; ") + (missed.length > 3 ? tx("; and ", "; y ") + (missed.length - 3) + tx(" more", " más") : "");
    var rows = byLead.map(function (p) {
      return '<tr><th scope="row" class="grid-mark">' + p[0] + tx(" days", " días") + '</th><td class="num">' + D(p[1].ai) + '</td><td class="num">' + D(p[1].ph) + '</td><td class="num">' + share(p[1].win, p[1].n) + "</td></tr>";
    }).join("");
    var items = byLead.map(function (p) {
      return "<li>" + tx("<b>" + p[0] + " days ahead:</b> AI model missed by " + D(p[1].ai) + " on average, physics model by " + D(p[1].ph) + ". The AI model came closer in " + share(p[1].win, p[1].n) + ".",
        "<b>A " + p[0] + " días:</b> el modelo de IA falló por " + D(p[1].ai) + " en promedio y el modelo físico por " + D(p[1].ph) + ". El modelo de IA se acercó más en " + share(p[1].win, p[1].n) + ".") + "</li>";
    }).join("");
    // Findings as cards, after the Media Lab's research cards: a glyph, a title, one line, and where it comes from.
    var finding = function (glyph, title, dek, source, id, tryIt) {
      return '<li class="finding"' + (id ? ' id="' + id + '" tabindex="-1"' : "") + '><span class="finding__glyph" aria-hidden="true">' + glyph + "</span>" +
        '<h4 class="finding__title">' + title + '</h4><p class="finding__dek">' + dek + "</p>" +
        (tryIt ? '<button type="button" class="btn quiet try" data-city="' + tryIt.city + '" data-valid="' + tryIt.valid + '" data-lead="' + tryIt.lead + '">' + tx("Try it: ", "Pruébalo: ") + tryIt.label + "</button>" : "") +
        '<p class="finding__source">' + source + "</p></li>";
    };
    var G = {
      both: '<svg viewBox="0 0 48 24"><circle cx="12" cy="12" r="8" fill="none" stroke="var(--ai-mark)" stroke-width="3"/><rect x="28" y="4" width="16" height="16" fill="none" stroke="var(--phys-mark)" stroke-width="3"/></svg>',
      leads: '<svg viewBox="0 0 48 24"><path d="M4 20V14M18 20V9M32 20V4" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/></svg>',
      cold: '<svg viewBox="0 0 48 24"><circle cx="12" cy="12" r="8" fill="none" stroke="var(--ai-mark)" stroke-width="3"/><path d="M30 6v12m-6-6 6 6 6-6" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      grid: '<svg viewBox="0 0 48 24"><path d="M3 3h30v18H3zM13 3v18M23 3v18M3 12h30" fill="none" stroke="var(--ink)" stroke-width="2"/><circle cx="40" cy="12" r="3" fill="var(--ai-mark)"/></svg>',
      version: '<svg viewBox="0 0 48 24"><rect x="3" y="4" width="34" height="16" rx="8" fill="none" stroke="var(--ink)" stroke-width="2.5"/><circle cx="12" cy="12" r="3" fill="var(--ink)"/></svg>',
      missing: '<svg viewBox="0 0 48 24"><path d="M12 2 22 12 12 22 2 12Z" fill="none" stroke="var(--obs)" stroke-width="2.5" stroke-dasharray="4 3"/></svg>',
      rain: '<svg viewBox="0 0 48 24"><path d="M12 2C12 2 5.5 9.5 5.5 15a6.5 6.5 0 0 0 13 0C18.5 9.5 12 2 12 2Z" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="12" r="6" fill="none" stroke="var(--ai-mark)" stroke-width="2.5"/><rect x="40" y="7" width="6" height="10" fill="none" stroke="var(--phys-mark)" stroke-width="2"/></svg>'
    };
    var rs = compareRain(DATA);
    var rainF = { title: "", dek: "", tryIt: null };
    if (rs.n) {
      rainF.title = rs.verdict === "ai" ? tx("The AI model has done better at rain", "Al modelo de IA le ha ido mejor con la lluvia") : rs.verdict === "phys" ? tx("The physics model has done better at rain", "Al modelo físico le ha ido mejor con la lluvia")
        : rs.few ? tx("Rain: too early to call", "Lluvia: aún es pronto para decir") : tx("Rain: too close to call", "Lluvia: empate técnico");
      rainF.dek = tx("It rained in " + plural(rs.wet, "case", "cases") + ". The AI model caught the rain in " + share(rs.ai.hit, rs.wet) + ", the physics model in " + share(rs.ph.hit, rs.wet) + ". " +
        "False alarms: " + rs.ai.fa + " for the AI model, " + rs.ph.fa + " for the physics model. ",
        "Llovió en " + plural(rs.wet, "caso", "casos") + ". El modelo de IA acertó la lluvia en " + share(rs.ai.hit, rs.wet) + "; el modelo físico, en " + share(rs.ph.hit, rs.wet) + ". " +
        "Falsas alarmas: " + rs.ai.fa + " del modelo de IA y " + rs.ph.fa + " del modelo físico. ") +
        (rs.few ? tx("These come from only " + plural(rs.events, "rainy place-evening", "rainy place-evenings") + ", and one rainy evening counts up to three times, so this is an early sign, not a finding.",
          "Vienen de solo " + plural(rs.events, "combinación de lugar y tarde con lluvia", "combinaciones de lugar y tarde con lluvia") + ", y una tarde lluviosa cuenta hasta tres veces, así que es una señal temprana, no un hallazgo.")
          : rs.verdict === "even" ? tx("That gap is smaller than the day-to-day ups and downs.", "Esa diferencia es menor que los altibajos de un día a otro.") : tx("That gap is bigger than the day-to-day ups and downs.", "Esa diferencia es mayor que los altibajos de un día a otro."));
      var split = rs.rows.filter(function (r) { return r.rain_obs.mm >= WET && (r.aigfs_rain >= WET) !== (r.gfs_rain >= WET); });
      var pickR = (split.length ? split : rs.rows.filter(function (r) { return r.rain_obs.mm >= WET; })).slice().sort(function (a, b) { return a.valid < b.valid ? 1 : -1; })[0];
      if (pickR) rainF.tryIt = { city: pickR.city, valid: pickR.valid, lead: pickR.lead_days, label: cityName(pickR.city) + ", " + dayName(pickR.valid) };
    }
    var SCN = '<a href="https://www.weather.gov/media/notification/pdf_2026/scn26-68_AIGFS_v1.1.pdf"' + (ES ? ' hreflang="en"' : "") + ">" + tx("NWS Service Change Notice 26-68", "Aviso de cambio de servicio 26-68 del NWS (en inglés)") + "</a>";
    var evs = eveningRows(), aiDays = evs.filter(function (e) { return e.st.ai < e.st.ph; }).length;
    return KEY_MODELS + '<figure class="figure chart-fig"><div class="chart" id="lead-chart"></div>' +
      "<figcaption>" + tx("Average miss by how far ahead the forecast was made. Smaller is better; the line between the shapes is the gap.", "Error promedio según la anticipación del pronóstico. Menos es mejor; la línea entre las figuras es la diferencia.") + "</figcaption></figure>" +
      '<table class="hairgrid"><caption>' + tx("Average miss, by how far ahead the forecast was made", "Error promedio, según la anticipación del pronóstico") + "</caption>" +
      '<thead><tr><th scope="col" class="grid-mark">' + tx("How far ahead", "Anticipación") + '</th><th scope="col"><span class="glyph" aria-hidden="true"><svg viewBox="0 0 48 24"><circle cx="12" cy="12" r="8" fill="none" stroke="var(--ai-mark)" stroke-width="3"/></svg></span><span class="ai-text">' + tx("AI model", "Modelo de IA") + "</span></th>" +
      '<th scope="col"><span class="glyph" aria-hidden="true"><svg viewBox="0 0 48 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="var(--phys-mark)" stroke-width="3"/></svg></span><span class="phys-text">' + tx("Physics model", "Modelo físico") + '</span></th><th scope="col">' + tx("AI model closer", "Más cerca el modelo de IA") + "</th></tr></thead>" +
      "<tbody>" + rows + '<tr class="total"><th scope="row" class="grid-mark">' + tx("All", "Todos") + '</th><td class="num">' + D(all.ai) + '</td><td class="num">' + D(all.ph) + '</td><td class="num">' + share(all.win, all.n) + "</td></tr></tbody></table>" +
      '<ul class="ref-list">' + items + "<li>" + tx("<b>All:</b> " + D(all.ai) + " against " + D(all.ph) + "; the AI model came closer in " + share(all.win, all.n) + ".",
        "<b>Todos:</b> " + D(all.ai) + " frente a " + D(all.ph) + "; el modelo de IA se acercó más en " + share(all.win, all.n) + ".") + "</li></ul>" +
      '<h3 id="h-evenings">' + tx("Evening by evening", "Tarde por tarde") + "</h3>" +
      '<p class="hint">' + tx("Each evening's average miss, across the six places and three forecast lengths. The AI model had the smaller miss on " + aiDays + " of " + evs.length +
      " evenings. Single evenings swing a lot, which is why one case, or one evening, says little.",
      "El error promedio de cada tarde, en los seis lugares y las tres anticipaciones. El modelo de IA tuvo el menor error en " + aiDays + " de " + evs.length +
      " tardes. Cada tarde cambia mucho; por eso un caso, o una tarde, dice poco.") + "</p>" +
      KEY_MODELS + '<figure class="figure chart-fig"><div class="chart chart--ev" id="ev-chart" tabindex="0" role="img"></div>' +
      "<figcaption>" + tx("Point at the chart, or select it and use the arrow keys, to read each evening.", "Señala la gráfica, o selecciónala y usa las flechas, para leer cada tarde.") + "</figcaption></figure>" + eveningTwin() +
      '<div id="places"></div>' + rainSectionHtml(rs) +
      "<h3>" + tx("What this does and doesn't show", "Lo que esto muestra y lo que no") + '</h3><ul class="findings">' +
      finding(G.both, overall.title, overall.dek, tx("From ", "De ") + all.n + tx(" cases, ", " casos, ") + SPAN) +
      finding(G.leads, leadsF.title, leadsF.dek, tx("From the table above", "De la tabla de arriba")) +
      finding(G.cold, leanF.title, leanF.dek, tx("From " + all.n + " cases; Central Park from " + ny.length, "De " + all.n + " casos; Central Park, de " + ny.length), null,
        { city: "New York", valid: "2026-11-05T00:00:00+00:00", lead: 5, label: cityName("New York") + ", " + dayName("2026-11-05T00:00:00+00:00") }) +
      finding(G.grid, tx("What the AI model can't do yet", "Lo que el modelo de IA aún no puede hacer"),
        tx("It works on a grid of points about 28 km (17 miles) apart, so it can't see a single park, valley or stretch of coast. It doesn't forecast wind gusts, visibility or radar.",
          "Trabaja con una cuadrícula de puntos separados unos 28 km (17 millas), así que no ve un parque, un valle o un tramo de costa en particular. No pronostica ráfagas de viento, visibilidad ni radar."),
        tx("Checked in the AIGFS v1.1 files on NOMADS, 4 November 2026", "Comprobado en los archivos de AIGFS v1.1 en NOMADS, 4 de noviembre de 2026"), "f-limits") +
      finding(G.version, tx("A new version", "Una versión nueva"), tx("NOAA updated the AI model to version 1.1 and says some forecasts improved. A claim like that needs checking over many months.",
        "La NOAA actualizó el modelo de IA a la versión 1.1 y dice que algunos pronósticos mejoraron. Una afirmación así hay que comprobarla durante muchos meses.") +
        (META.versions && META.versions.length ? tx(" Every forecast in the nightly archive is version ", " Todos los pronósticos del archivo nocturno son de la versión ") + META.versions.join(", ").replace(/v/g, "") + "." : ""), SCN + tx(", 27 July 2026", ", 27 de julio de 2026")) +
      (rs.n ? finding(G.rain, rainF.title, rainF.dek, tx("From " + rs.n + " cases with rain saved for both models and the station", "De " + rs.n + " casos con la lluvia guardada para los dos modelos y la estación"), "f-rain", rainF.tryIt) : "") +
      (lost ? finding(G.missing, lost === 1 ? tx("A missed reading", "Una medición faltante") : tx("Missed readings", "Mediciones faltantes"),
        tx(plural(lost, "case has", "cases have") + " no measurement, because a station missed a reading. So there are " + all.n + " cases, not " + DATA.length + ".",
          plural(lost, "caso no tiene", "casos no tienen") + " medición porque una estación no envió el dato. Por eso hay " + all.n + " casos, no " + DATA.length + "."), missedSource) : "") +
      "</ul>";
  }

  // ---------- by place: every station, on a map drawn to scale ----------
  // Map: contiguous US in an Albers equal-area projection (map.js, built from public-domain Census outlines).
  // The map (map.js, about 37 KB) loads only when the reader comes near it (audit P12); until then, and if it
  // fails, the place list, the panel and the table give the same information.
  var MAP = window.TF_MAP, mapState = MAP ? "ready" : "waiting";
  function loadMap() {
    if (mapState !== "waiting") return;
    mapState = "loading";
    var sc = document.createElement("script");
    sc.src = ROOT + "map.js?v=2026-11-19"; // change the date when the map is rebuilt, so browsers fetch the new one
    sc.onload = function () { MAP = window.TF_MAP; mapState = MAP ? "ready" : "failed"; renderPlaces(); };
    sc.onerror = function () { mapState = "failed"; renderPlaces(); };
    document.body.appendChild(sc);
  }
  var PIN_SIDE = { Seattle: "right", Phoenix: "right", Denver: "right", Chicago: "above", "New York": "below", Miami: "left" };
  var placeSel = null;
  function cityStats(name) {
    var rows = DATA.filter(function (r) { return r.city === name && r.observed && typeof r.aigfs === "number"; });
    var mean = function (xs) { return xs.reduce(function (s, v) { return s + v; }, 0) / xs.length; };
    var c = compareRows(rows);
    c.aiLean = mean(rows.map(function (r) { return r.aigfs - r.observed.c; }));
    c.phLean = mean(rows.map(function (r) { return r.gfs - r.observed.c; }));
    c.better = c.verdict;
    c.rows = rows;
    return c;
  }
  var BETTER = ES ? { ai: "Al modelo de IA le fue mejor aquí", phys: "Al modelo físico le fue mejor aquí", even: "Empate técnico aquí" }
    : { ai: "The AI model did better here", phys: "The physics model did better here", even: "Too close to call here" };
  var lean = function (d) {
    return Math.abs(d) < 0.3 ? tx("no clear lean", "sin tendencia clara") : (d < 0 ? tx("ran " + D(d) + " cold", "quedó " + D(d) + " más frío") : tx("ran " + D(d) + " warm", "quedó " + D(d) + " más cálido"));
  };
  var pinShape = function (b) {
    return b === "ai" ? '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="var(--paper)" stroke="var(--ai-mark)" stroke-width="3"/></svg>'
      : b === "phys" ? '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" fill="var(--paper)" stroke="var(--phys-mark)" stroke-width="3"/></svg>'
        : '<svg viewBox="0 0 20 20"><path d="M10 2 18 10 10 18 2 10Z" fill="var(--paper)" stroke="var(--ink)" stroke-width="2.5"/></svg>';
  };
  function placePanel(name) {
    if (!name) return '<p class="hint">' + tx("Choose a place on the map or in the list to see how each model did there.", "Elige un lugar en el mapa o en la lista para ver cómo le fue a cada modelo allí.") + "</p>";
    var st = cityStats(name), c = CITIES.find(function (x) { return x.name === name; });
    var tryRow = st.rows.find(function (r) { return r.lead_days === 3; }) || st.rows[0];
    var missedBy = function (v, l) { return tx("missed by " + D(v) + " on average, " + l, "falló por " + D(v) + " en promedio; " + l); };
    var noRead = EVENINGS * LEADS.length - st.n;
    return '<h4 class="place__h">' + esc(cityName(name)) + ' <span class="place__st">' + esc(placeName(c)) + " · " + c.station + "</span></h4>" +
      '<p class="place__better"><span aria-hidden="true">' + pinShape(st.better) + "</span> " + BETTER[st.better] + ".</p>" +
      '<dl class="place__dl"><dt>' + tx("AI model", "Modelo de IA") + "</dt><dd>" + missedBy(st.ai, lean(st.aiLean)) + "</dd>" +
      "<dt>" + tx("Physics model", "Modelo físico") + "</dt><dd>" + missedBy(st.ph, lean(st.phLean)) + "</dd>" +
      "<dt>" + tx("Closer", "Más cerca") + "</dt><dd>" + tx("the AI model in ", "el modelo de IA en ") + share(st.win, st.n, tx("cases", "casos")) + "</dd></dl>" +
      (noRead > 0 ? '<p class="hint">' + tx(plural(noRead, "case has", "cases have") + " no reading here.", plural(noRead, "caso no tiene", "casos no tienen") + " medición aquí.") + "</p>" : "") +
      '<button type="button" class="btn quiet try" data-city="' + esc(name) + '" data-valid="' + tryRow.valid + '" data-lead="' + tryRow.lead_days + '">' + tx("Try a case: ", "Prueba un caso: ") + esc(cityName(name)) + ", " + dayName(tryRow.valid) + "</button>";
  }
  function mapFigure() {
    if (!MAP) {
      return '<figure class="map"><div class="map__canvas map__canvas--wait">' +
        '<p class="hint">' + (mapState === "failed" ? tx("The map couldn't load. The list and the table below have the same information.", "El mapa no pudo cargarse. La lista y la tabla de abajo tienen la misma información.")
          : tx("Loading the map…", "Cargando el mapa…")) + "</p>" +
        "</div></figure>";
    }
    var pins = MAP.stations.map(function (s) {
      var st = cityStats(s.name), side = PIN_SIDE[s.name] || "right";
      return '<button type="button" class="pin pin--' + side + '" data-place="' + esc(s.name) + '" tabindex="-1" aria-hidden="true" data-on="' + (placeSel === s.name) + '" ' +
        'style="left:' + (s.x / MAP.width * 100).toFixed(2) + "%;top:" + (s.y / MAP.height * 100).toFixed(2) + '%">' +
        '<span class="pin__mark" aria-hidden="true">' + pinShape(st.better) + "</span>" +
        '<span class="pin__label">' + esc(cityName(s.name)) + "</span></button>";
    }).join("");
    var km = 500, mi = 300;
    var pct = function (units) { return (units / MAP.width * 100).toFixed(2) + "%"; };
    return '<figure class="map"><div class="map__canvas">' +
      '<svg class="map__svg" viewBox="0 0 ' + MAP.width + " " + MAP.height + '" aria-hidden="true" focusable="false">' +
      '<path class="map__land" d="' + MAP.outline + '"/><path class="map__borders" d="' + MAP.borders + '"/><path class="map__outline" d="' + MAP.outline + '"/></svg>' +
      pins + "</div>" +
      '<figcaption><span class="scalebar" aria-hidden="true"><span class="scalebar__bar" style="width:' + pct(km * MAP.unitsPerKm) + '"></span><span>' + km + ' km</span>' +
      '<span class="scalebar__bar" style="width:' + pct(mi * 1.609344 * MAP.unitsPerKm) + '"></span><span>' + mi + " mi</span></span>" +
      '<span class="map__note">' + tx("Contiguous United States, Albers equal-area projection, drawn to scale (the scale bar holds near the middle of the map). Alaska and Hawaii aren't shown: no stations there yet. Outlines: US Census Bureau, 2017, simplified for the web.",
        "Estados Unidos contiguos, proyección cónica equivalente de Albers, a escala (la barra de escala vale cerca del centro del mapa). No se muestran Alaska ni Hawái: aún no hay estaciones allí. Contornos: Oficina del Censo de EE. UU., 2017, simplificados para la web.") + "</span>" +
      '<span class="map__key" aria-hidden="true"><span>' + pinShape("ai") + " " + tx("AI model did better", "Mejor el modelo de IA") + "</span><span>" + pinShape("phys") + " " + tx("Physics model did better", "Mejor el modelo físico") + "</span><span>" + pinShape("even") + " " + tx("Too close to call", "Empate técnico") + "</span></span></figcaption></figure>";
  }
  function placesHtml() {
    var rows = CITIES.map(function (c) {
      var st = cityStats(c.name);
      return '<tr><th scope="row" class="grid-mark">' + esc(cityName(c.name)) + '</th><td class="num">' + D(st.ai) + '</td><td class="num">' + D(st.ph) + '</td><td class="num">' + share(st.win, st.n) + "</td><td>" + lean(st.aiLean) + "</td></tr>";
    }).join("");
    var items = CITIES.map(function (c) {
      var st = cityStats(c.name);
      return "<li><b>" + esc(cityName(c.name)) + ":</b> " + tx("AI model " + D(st.ai) + ", physics model " + D(st.ph) + " average miss; the AI model came closer in " + share(st.win, st.n) + "; it " + lean(st.aiLean) + ".",
        "error promedio del modelo de IA " + D(st.ai) + " y del modelo físico " + D(st.ph) + "; el modelo de IA se acercó más en " + share(st.win, st.n) + "; " + lean(st.aiLean) + ".") + "</li>";
    }).join("");
    return '<h3 id="h-places">' + tx("By place", "Por lugar") + "</h3>" +
      '<p class="hint">' + tx("Six weather stations, on a map drawn to scale. Choose one to see how each model did there.", "Seis estaciones meteorológicas en un mapa a escala. Elige una para ver cómo le fue a cada modelo allí.") + "</p>" +
      '<div class="places">' + mapFigure() +
      '<div class="place-col"><div class="place-list" role="group" aria-label="' + tx("Places", "Lugares") + '">' + CITIES.map(function (c) {
        var b = cityStats(c.name).better;
        return '<button type="button" class="place-btn" data-place="' + esc(c.name) + '" aria-pressed="' + (placeSel === c.name) + '">' +
          '<span aria-hidden="true">' + pinShape(b) + "</span>" + esc(cityName(c.name)) + '<span class="sr">: ' + BETTER[b] + "</span></button>";
      }).join("") + "</div>" +
      '<div class="place" id="place-panel" aria-live="polite">' + placePanel(placeSel) + "</div></div></div>" +
      '<table class="hairgrid places__table"><caption>' + tx("Results by place, all " + EVENINGS + " evenings and 3 forecast lengths", "Resultados por lugar, las " + EVENINGS + " tardes y las 3 anticipaciones") + "</caption>" +
      '<thead><tr><th scope="col" class="grid-mark">' + tx("Place", "Lugar") + '</th><th scope="col">' + tx("AI model, average miss", "Modelo de IA, error promedio") + '</th><th scope="col">' + tx("Physics model, average miss", "Modelo físico, error promedio") +
      '</th><th scope="col">' + tx("AI model closer", "Más cerca el modelo de IA") + '</th><th scope="col">' + tx("AI model's lean", "Tendencia del modelo de IA") + "</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      '<ul class="ref-list">' + items + "</ul>";
  }
  function renderPlaces() { var box = $("places"); if (box) box.innerHTML = placesHtml(); }
  function choosePlace(name) {
    placeSel = name;
    document.querySelectorAll(".pin").forEach(function (b) { b.dataset.on = b.dataset.place === name ? "true" : "false"; });
    document.querySelectorAll(".place-btn").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.place === name ? "true" : "false"); });
    $("place-panel").innerHTML = placePanel(name);
  }

  // ---------- make a scenario: who, what, where, when, why, how ----------
  // Forecast -> decision -> outcome, on the saved cases only. Practice, not advice; it never scores the person.
  var SC = {
    who: [
      { value: "manager", label: tx("An emergency manager", "Responsable de emergencias"), cold: tx("open a warming center", "abrir un centro de calentamiento"), warm: tx("open a cooling center", "abrir un centro de enfriamiento"), rain: tx("put road crews on standby", "poner en alerta a las cuadrillas de carreteras") },
      { value: "farmer", label: tx("A farmer", "Agricultor o agricultora"), cold: tx("cover the crops", "cubrir los cultivos"), warm: tx("water the seedlings early", "regar temprano las plantas jóvenes"), rain: tx("hold off spraying", "posponer la fumigación") },
      { value: "teacher", label: tx("A teacher planning a trip", "Docente que planea una excursión"), cold: tx("move the trip indoors", "pasar la excursión a un lugar techado"), warm: tx("plan shade and water", "prever sombra y agua"), rain: tx("book the indoor backup", "reservar el plan B bajo techo") },
      { value: "organizer", label: tx("An event organizer", "Quien organiza un evento"), cold: tx("book heaters", "reservar calentadores"), warm: tx("add shade and water stations", "poner sombra y puntos de agua"), rain: tx("put up tents", "armar carpas") }
    ],
    // Thresholds are set in °C (the data's unit) and shown in the viewer's unit.
    what: [
      { value: "lt10", cold: true, t: 10 },
      { value: "lt15", cold: true, t: 15 },
      { value: "gt20", cold: false, t: 20 },
      { value: "gt25", cold: false, t: 25 },
      { value: "rain", rain: true }
    ],
    why: [
      { value: "caught", label: tx("Being caught off guard", "Que me tome por sorpresa") },
      { value: "alarm", label: tx("A false alarm", "Una falsa alarma") },
      { value: "same", label: tx("Both are about as bad", "Las dos cosas son igual de malas") }
    ],
    how: [
      { value: "ai", label: tx("Act if the AI model says so", "Actuar si lo dice el modelo de IA") },
      { value: "phys", label: tx("Act if the physics model says so", "Actuar si lo dice el modelo físico") },
      { value: "both", label: tx("Act only if both agree", "Actuar solo si los dos coinciden") },
      { value: "either", label: tx("Act if either one says so", "Actuar si lo dice cualquiera de los dos") }
    ]
  };
  var whatLabel = function (w) {
    if (w.rain) return { label: tx("Rain", "Lluvia"), small: tx("at least ", "al menos ") + wetMin(), name: tx("rain", "lluvia") };
    var word = w.cold ? tx("Colder than ", "Más frío que ") : tx("Warmer than ", "Más cálido que ");
    // In Spanish the sentence is about "la temperatura", so its words agree with it: "más baja que", "más alta que".
    var nameWord = ES ? (w.cold ? "más baja que " : "más alta que ") : word.toLowerCase();
    var f = Math.round(toF(w.t));
    return unit === "F" ? { label: word + f + " °F", small: w.t + " °C", name: nameWord + f + " °F (" + w.t + " °C)" }
      : { label: word + w.t + " °C", small: f + " °F", name: nameWord + w.t + " °C (" + f + " °F)" };
  };
  // "Why" starts unanswered: it's a values question, so the page doesn't answer it for you (audit 9).
  var sc = { who: "manager", what: "lt10", where: "all", when: 3, why: null, how: "either" };
  var find = function (list, v) { return list.find(function (x) { return x.value === v; }); };

  // The whole judgment, kept pure so it can be checked by hand.
  // Rain uses each model's 6-hour total and the station's measured rain; the rest use temperature.
  function judge(rows, what, how) {
    var hit = what.rain ? function (mm) { return mm >= WET; } : function (c) { return what.cold ? c < what.t : c > what.t; };
    var out = { inTime: [], falseAlarm: [], caught: [], quiet: [], noReading: [] };
    rows.forEach(function (r) {
      var v = what.rain ? [r.aigfs_rain, r.gfs_rain, hasRainObs(r) ? r.rain_obs.mm : null] : [r.aigfs, r.gfs, r.observed ? r.observed.c : null];
      if (!v.every(function (x) { return typeof x === "number"; })) { out.noReading.push(r); return; }
      var a = hit(v[0]), g = hit(v[1]);
      var act = how === "ai" ? a : how === "phys" ? g : how === "both" ? (a && g) : (a || g);
      var came = hit(v[2]);
      (act ? (came ? out.inTime : out.falseAlarm) : (came ? out.caught : out.quiet)).push(r);
    });
    return out;
  }
  window.TF_judge = judge; // for checking in the console

  function scenarioRows() {
    return DATA.filter(function (r) { return r.lead_days === sc.when && (sc.where === "all" || r.city === sc.where); });
  }

  var OUTCOME = ES ? {
    inTime: { label: "A tiempo", line: "Actuaste, y ese clima llegó." },
    falseAlarm: { label: "Falsa alarma", line: "Actuaste, y no llegó." },
    caught: { label: "Te tomó por sorpresa", line: "Llegó, y no habías actuado." },
    quiet: { label: "Calma acertada", line: "No actuaste, y no llegó." }
  } : {
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
    var place = sc.where === "all" ? tx("in any of the six places", "en cualquiera de los seis lugares") : tx("in ", "en ") + cityName(sc.where);
    var action = what.rain ? who.rain : what.cold ? who.cold : who.warm;
    var lower = how.label.charAt(0).toLowerCase() + how.label.slice(1);
    var summary = ES
      ? who.label + ": vas a " + action + (what.rain ? " si va a llover (al menos " + wetMin() + ") en las 6 horas antes de la tarde, " : " si la temperatura de la tarde va a ser " + wl.name + ", ") + place +
        ". Decides con " + sc.when + " días de anticipación y vas a " + lower + "."
      : who.label + ": you'll " + action + (what.rain ? " if it will rain (at least " + wetMin() + ") in the 6 hours before the evening, " : " if the evening will be " + wl.name + " ") + place +
        ". You decide " + sc.when + " days ahead, and " + lower + ".";
    var whyLine = sc.why === "caught"
      ? tx("You said being caught off guard is worse. The weather came " + plural(came, "time", "times") + ", and this rule caught you off guard in " + o.caught.length + " of them.",
        "Dijiste que es peor que te tome por sorpresa. Ese clima llegó " + plural(came, "vez", "veces") + ", y esta regla te tomó por sorpresa en " + o.caught.length + " de ellas.")
      : sc.why === "alarm"
        ? tx("You said a false alarm is worse. This rule had you act " + plural(acted, "time", "times") + ", and " + o.falseAlarm.length + " of them were false alarms.",
          "Dijiste que es peor una falsa alarma. Esta regla te hizo actuar " + plural(acted, "vez", "veces") + ", y " + o.falseAlarm.length + " fueron falsas alarmas.")
        : sc.why === "same"
          ? tx("You said both are about as bad. This rule was right " + (o.inTime.length + o.quiet.length) + " of " + counted + " times.",
            "Dijiste que las dos cosas son igual de malas. Esta regla acertó " + (o.inTime.length + o.quiet.length) + " de " + counted + " veces.")
          : tx("Which is worse for you: being caught off guard, or a false alarm? Answer question 5 (Why) to see how this rule does on what matters to you.",
            "¿Qué es peor para ti: que te tome por sorpresa o una falsa alarma? Responde la pregunta 5 (Por qué) para ver cómo le va a esta regla en lo que te importa.");
    if (!came) whyLine += tx(" In these cases the weather you chose never came, so try another place, threshold or lead time.", " En estos casos nunca llegó el clima que elegiste; prueba otro lugar, otro umbral u otra anticipación.");

    var cell = function (k) {
      return '<td><span class="sc-n">' + o[k].length + '</span><span class="sc-k">' + OUTCOME[k].label + '</span><span class="sc-line">' + OUTCOME[k].line + "</span></td>";
    };
    var grid = '<table class="hairgrid sc-grid"><caption>' + tx("What this rule would have done, in " + counted + " cases", "Lo que habría hecho esta regla, en " + counted + " casos") + "</caption>" +
      '<thead><tr><td></td><th scope="col">' + tx("The weather came", "Ese clima llegó") + '</th><th scope="col">' + tx("It didn't come", "No llegó") + "</th></tr></thead><tbody>" +
      '<tr><th scope="row" class="grid-mark">' + tx("You acted", "Actuaste") + "</th>" + cell("inTime") + cell("falseAlarm") + "</tr>" +
      '<tr><th scope="row" class="grid-mark">' + tx("You didn't", "No actuaste") + "</th>" + cell("caught") + cell("quiet") + "</tr></tbody></table>" +
      '<ul class="ref-list">' + ["inTime", "falseAlarm", "caught", "quiet"].map(function (k) {
        return "<li><b>" + OUTCOME[k].label + ": " + o[k].length + ".</b> " + OUTCOME[k].line + "</li>";
      }).join("") + "</ul>";

    // Every rule on the same cases, so the trade-off shows.
    var compare = '<table class="hairgrid sc-compare"><caption>' + tx("Every rule, on the same cases", "Todas las reglas, con los mismos casos") + '</caption><thead><tr><th scope="col" class="grid-mark">' + tx("Rule", "Regla") +
      '</th><th scope="col">' + OUTCOME.inTime.label + '</th><th scope="col">' + OUTCOME.falseAlarm.label + '</th><th scope="col">' + OUTCOME.caught.label + "</th></tr></thead><tbody>" +
      SC.how.map(function (h) {
        var j = judge(rows, what, h.value), mine = h.value === sc.how;
        return "<tr" + (mine ? ' class="mine"' : "") + '><th scope="row" class="grid-mark">' + h.label + (mine ? ' <span class="tagline">' + tx("your rule", "tu regla") + "</span>" : "") + '</th><td class="num">' + j.inTime.length + '</td><td class="num">' + j.falseAlarm.length + '</td><td class="num">' + j.caught.length + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<ul class="ref-list">' + SC.how.map(function (h) {
        var j = judge(rows, what, h.value);
        return "<li><b>" + h.label + (h.value === sc.how ? tx(" (your rule)", " (tu regla)") : "") + ":</b> " + tx(j.inTime.length + " in time, " + j.falseAlarm.length + " false alarms, " + j.caught.length + " caught off guard.",
          j.inTime.length + " a tiempo, " + j.falseAlarm.length + " falsas alarmas, " + j.caught.length + " por sorpresa.") + "</li>";
      }).join("") + "</ul>";

    var caseLine = function (r) {
      var key = ["inTime", "falseAlarm", "caught", "quiet"].find(function (k) { return o[k].indexOf(r) !== -1; });
      var who = "<b>" + esc(cityName(r.city)) + tx(", evening of ", ", tarde del ") + dayName(r.valid) + ":</b> ";
      if (!key) return "<li>" + who + (what.rain ? tx("no rain record", "sin registro de lluvia") : tx("no reading", "sin medición")) + tx(", so not counted.", ", así que no cuenta.") + "</li>";
      var said = what.rain ? function (mm) { return mm >= WET ? Rshort(mm) : tx("dry", "seco"); } : T1;
      return "<li>" + who + tx("AI model ", "modelo de IA ") + said(what.rain ? r.aigfs_rain : r.aigfs) + tx(", physics model ", ", modelo físico ") + said(what.rain ? r.gfs_rain : r.gfs) +
        tx(", measured ", ", medido ") + said(what.rain ? r.rain_obs.mm : r.observed.c) + '. <span class="sc-tag">' + OUTCOME[key].label + "</span></li>";
    };
    var wasOpen = document.querySelector(".sc-cases") && document.querySelector(".sc-cases").open;
    $("sc-out").innerHTML =
      '<h3 id="sc-h" tabindex="-1">' + tx("Your scenario", "Tu escenario") + '</h3><p class="sc-summary">' + esc(summary) + "</p>" + grid +
      '<p class="sc-why">' + esc(whyLine) + "</p>" +
      "<h3>" + tx("Other rules", "Otras reglas") + '</h3><p class="hint">' + tx("Same cases, same threshold. Each rule trades false alarms against being caught off guard.", "Mismos casos, mismo umbral. Cada regla equilibra de otra manera las falsas alarmas y las sorpresas.") + "</p>" + compare +
      '<details class="sc-cases"' + (wasOpen ? " open" : "") + "><summary>" + tx("See each case (", "Ver cada caso (") + rows.length + ")</summary><ul>" + rows.map(caseLine).join("") + "</ul></details>" +
      (o.noReading.length ? '<p class="hint">' + (ES
        ? plural(o.noReading.length, "caso no tiene", "casos no tienen") + (what.rain ? " registro de lluvia" : " medición") + " y no " + (o.noReading.length === 1 ? "cuenta" : "cuentan") + "." +
          (what.rain ? " La lluvia se guarda desde el 19 de noviembre de 2026; las tardes anteriores se completaron solo donde las fuentes aún la tenían, y la NOAA guarda los pronósticos del modelo de IA unos 10 días." : "")
        : plural(o.noReading.length, "case has", "cases have") + (what.rain ? " no rain record" : " no reading") + " and " + (o.noReading.length === 1 ? "isn't" : "aren't") + " counted." +
          (what.rain ? " Rain has been saved since 19 November 2026; earlier evenings were filled in only where the sources still had them, and NOAA keeps the AI model's forecasts for about 10 days." : "")) + "</p>" : "") +
      '<p class="hint">' + tx("Same forecast, different decisions: change <i>Who</i> to see how another role would use it.", "Mismo pronóstico, decisiones distintas: cambia <i>Quién</i> para ver cómo lo usaría otro papel.") + "</p>";
    // A short summary that stays in view while answering, so every change shows a result (audit 1).
    var tally = ES ? o.inTime.length + " a tiempo · " + plural(o.falseAlarm.length, "falsa alarma", "falsas alarmas") + " · " + o.caught.length + " por sorpresa"
      : o.inTime.length + " in time · " + plural(o.falseAlarm.length, "false alarm", "false alarms") + " · " + o.caught.length + " caught off guard";
    $("sc-live").innerHTML = '<span class="sc-live__k">' + tx("Your rule so far", "Tu regla hasta ahora") + '</span> <span class="sc-live__v">' + tally + '</span> <span class="sc-live__go">' + tx("See the results ↓", "Ver los resultados ↓") + "</span>";
    if (announceIt) {
      clearTimeout(renderScenario.t);
      renderScenario.t = setTimeout(function () {
        announce(tx("Results updated: ", "Resultados actualizados: ") + tally.replace(/ · /g, ", ") + ".");
      }, 700);
    }
  }

  function loadCase(city, valid, lead) {
    state.city = city; state.valid = valid; state.lead = lead;
    radios("cities", "city", CITIES.map(function (c) { return { value: c.name, label: cityName(c.name) }; }), state.city);
    radios("days", "day", VALIDS.map(function (v) { return { value: v, label: dayName(v) }; }), state.valid);
    radios("leads", "lead", LEADS.map(function (L) { return { value: L, label: L + tx(" days", " días") }; }), state.lead);
    newCase();
    $("h-guess").scrollIntoView({ block: "start" });
    var first = document.querySelector('input[name="guess"]');
    if (first) first.focus({ preventScroll: true });
    announce(tx("Case loaded: " + city + ", evening of " + dayName(valid) + ", " + lead + " days ahead. Make a guess.",
      "Caso cargado: " + cityName(city) + ", tarde del " + dayName(valid) + ", a " + lead + " días. Elige tu respuesta."));
  }

  // ---------- search this page ----------
  // Everything is searched here in the page: no outside service, nothing stored or sent.
  var SEARCH_LIMIT = 8;
  var norm = function (t) { return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  var words = function (q) { return norm(q).split(/[^a-z0-9°]+/).filter(function (w) { return w.length >= 2 || /^\d$/.test(w); }); };
  function searchIndex() {
    var idx = [];
    var steps = ES ? [["h-pick", "01 Elige un caso", "elegir lugar tarde anticipacion"], ["h-guess", "02 Adivina primero", "que pronostico se acerco respuesta adivinar"],
      ["h-result", "03 Qué pasó", "resultado medido dibujo"], ["h-bigger", "El panorama general", "todos los casos error promedio lugar mapa hallazgos"],
      ["h-places", "Por lugar", "mapa estaciones ciudades escala"], ["h-evenings", "Tarde por tarde", "grafica linea cada tarde registro altibajos"], ["h-rain", "Lluvia", "lluvia precipitacion seco acerto falsa alarma"], ["h-scen", "04 Arma un escenario", "quien que donde cuando por que como decision regla"], ["h-words", "Palabras usadas aquí", "glosario"],
      ["h-reflect", "Antes de irte", "reflexion pregunta confianza pausa pensar"], ["h-outcomes", "Lo que podrás hacer", "objetivos metas aprender"], ["h-about", "Acerca de y métodos", "acerca metodos como funciona datos noaa"], ["m-winner", "Cómo decidimos quién ganó", "empate tecnico error estandar ruido estadistica"],
      ["m-rain", "Lluvia", "lluvia precipitacion 6 horas medible"], ["m-access", "Accesibilidad", "accesibilidad wcag voiceover lector de pantalla"],
      ["m-privacy", "Privacidad", "privacidad cookies rastreo datos guardados"], ["m-sources", "Descargar los datos", "descargar datos csv json datos abiertos cc0 codigo github"],
      ["m-cite", "Cómo citar", "citar cita referencia apa"], ["m-sources", "Plan de clase para docentes", "maestro maestra docente plan de clase aula imprimir"], ["m-translation", "Sobre esta traducción", "traduccion espanol ia claude revision"]]
      : [["h-pick", "01 Pick a case", "choose a place evening how far ahead"], ["h-guess", "02 Guess first", "which forecast came closer guess"],
      ["h-result", "03 What happened", "result measured drawing"], ["h-bigger", "The bigger picture", "all cases average miss by place map findings"],
      ["h-places", "By place", "map stations cities scale"], ["h-evenings", "Evening by evening", "chart line each evening running record ups and downs"], ["h-rain", "Rain", "rain precipitation wet dry caught missed false alarm"], ["h-scen", "04 Make a scenario", "who what where when why how decision rule"], ["h-words", "Words used here", "glossary"],
      ["h-reflect", "Before you go", "reflect reflection question trust pause think"], ["h-outcomes", "What you'll be able to do", "outcomes goals learn objectives"], ["h-about", "About and methods", "about methods how it works data noaa"], ["m-winner", "How we call a winner", "too close to call standard error noise statistics"],
      ["m-rain", "Rain", "rain precipitation 6 hours measurable"], ["m-access", "Accessibility", "accessibility wcag voiceover screen reader"],
      ["m-privacy", "Privacy", "privacy cookies tracking data stored"], ["m-sources", "Download the data", "download data csv json open data cc0 code github"],
      ["m-cite", "How to cite", "cite citation reference apa"], ["m-sources", "Lesson plan for educators", "teacher educator lesson plan classroom print"]];
    steps.forEach(function (st) { idx.push({ kind: "Step", title: st[1], text: st[2], go: { to: st[0] } }); });
    CITIES.forEach(function (c) {
      idx.push({ kind: "Place", title: cityName(c.name), text: c.name + " " + placeName(c) + " " + c.station + (c.name === "New York" ? " nyc manhattan" : ""), go: { place: c.name } });
    });
    DATA.forEach(function (r) {
      var day = dayName(r.valid);
      var cc = CITIES.find(function (c) { return c.name === r.city; });
      idx.push({ kind: "Case", title: cityName(r.city) + ", " + day + tx(", " + r.lead_days + " days ahead", ", a " + r.lead_days + " días"),
        text: tx(day.replace("November", "nov") + " evening ", day.replace("noviembre", "nov") + " tarde ") + placeName(cc) + " " + cc.station + (r.city === "New York" ? " nyc" : "") + (r.observed ? "" : tx(" no reading", " sin medicion")),
        go: { city: r.city, valid: r.valid, lead: r.lead_days } });
    });
    document.querySelectorAll("#h-words ~ dl dt, dl dt").forEach(function (dt) {
      if (!dt.id) return;
      idx.push({ kind: "Word", title: dt.textContent, text: (dt.nextElementSibling || {}).textContent || "", go: { to: dt.id } });
    });
    document.querySelectorAll(".finding").forEach(function (f, i) {
      if (!f.id) f.id = "f-" + (i + 1);
      idx.push({ kind: "Finding", title: f.querySelector(".finding__title").textContent, text: f.querySelector(".finding__dek").textContent, go: { to: f.id } });
    });
    SC.who.forEach(function (w) { idx.push({ kind: "Scenario role", title: w.label, text: tx("who ", "quien ") + w.cold + " " + w.warm + " " + w.rain, go: { who: w.value } }); });
    return idx;
  }
  function searchPage(q) {
    var ws = words(q);
    if (!ws.length) return [];
    return searchIndex().map(function (e) {
      var title = norm(e.title), all = title + " " + norm(e.text);
      if (!ws.every(function (w) { return all.indexOf(w) !== -1; })) return null;
      var score = ws.filter(function (w) { return title.indexOf(w) !== -1; }).length * 2 + ({ Place: 2, Step: 1 }[e.kind] || 0);
      e.score = score; return e;
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
  }
  // Escape first, then mark the matches, so a query can never inject markup.
  function mark(text, q) {
    var ws = words(q).sort(function (a, b) { return b.length - a.length; });
    var t = String(text);
    if (!ws.length) return esc(t);
    var re = new RegExp("(" + ws.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");
    return t.split(re).map(function (part, i) { return i % 2 ? "<mark>" + esc(part) + "</mark>" : esc(part); }).join("");
  }
  function renderSearch() {
    var q = $("q").value, res = searchPage(q), status;
    var trimmed = q.trim();
    if (!trimmed) status = tx('Try "Central Park", "4 November", "bias" or "farmer".', 'Prueba "Central Park", "4 de noviembre", "sesgo" o "agricultor".');
    else if (!words(q).length) status = tx("Type at least two letters.", "Escribe al menos dos letras.");
    else if (!res.length) status = tx('No results for "' + trimmed + '". Try fewer words, a place name or a date like "3 November".', 'No hay resultados para "' + trimmed + '". Prueba con menos palabras, un lugar o una fecha como "3 de noviembre".');
    else status = res.length > SEARCH_LIMIT ? tx(res.length + ' results for "' + trimmed + '". Showing the first ' + SEARCH_LIMIT + "; add a word to narrow them down.",
        res.length + ' resultados para "' + trimmed + '". Se muestran los primeros ' + SEARCH_LIMIT + "; agrega una palabra para afinar la búsqueda.")
      : tx(res.length + " result" + (res.length === 1 ? "" : "s") + ' for "' + trimmed + '".', res.length + " resultado" + (res.length === 1 ? "" : "s") + ' para "' + trimmed + '".');
    $("q-status").textContent = status;
    $("q-results").innerHTML = res.slice(0, SEARCH_LIMIT).map(function (e, i) {
      var KIND = ES ? { Step: "Paso", Place: "Lugar", Case: "Caso", Word: "Palabra", Finding: "Hallazgo", "Scenario role": "Papel" } : {};
      return '<li><button type="button" class="search__hit" data-i="' + i + '"><span class="search__kind">' + esc(KIND[e.kind] || e.kind) + "</span> " + mark(e.title, q) + "</button></li>";
    }).join("");
    renderSearch.res = res;
  }
  function goTo(go) {
    if (go.to) {
      var el = $(go.to);
      if (el) { el.scrollIntoView({ block: "start" }); if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true }); }
      return;
    }
    if (go.place) {
      choosePlace(go.place);
      $("h-places").scrollIntoView({ block: "start" });
      var btn = document.querySelector('.place-btn[data-place="' + go.place + '"]'); if (btn) btn.focus({ preventScroll: true });
      return;
    }
    if (go.city) { loadCase(go.city, go.valid, go.lead); return; }
    if (go.who) {
      sc.who = go.who;
      var input = document.querySelector('input[name="sc-who"][value="' + go.who + '"]');
      if (input) { input.checked = true; renderScenario(true); $("h-scen").scrollIntoView({ block: "start" }); input.focus({ preventScroll: true }); }
    }
  }

  // ---------- theme ----------
  function themeNow() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  // The button says what it does (audit 13).
  function themeLabel() { $("theme").textContent = themeNow() === "dark" ? tx("Switch to light theme", "Cambiar a tema claro") : tx("Switch to dark theme", "Cambiar a tema oscuro"); }

  // ---------- everything that shows a temperature ----------
  function renderUnits() {
    document.querySelectorAll(".unit-btn").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.unit === unit ? "true" : "false"); });
    radios("guesses", "guess", [
      { value: "ai", label: tx("The AI model (AIGFS)", "El modelo de IA (AIGFS)") },
      { value: "phys", label: tx("The physics model (GFS)", "El modelo físico (GFS)") },
      { value: "same", label: tx("About the same", "Más o menos igual"), small: unit === "F" ? tx("within about 1 °F", "1 °F de diferencia o menos") : tx("within 0.5 °C", "0.5 °C de diferencia o menos") }
    ], state.guess, function (v) { state.guess = v; $("hint").textContent = ""; });
    radios("sc-what", "sc-what", SC.what.map(function (w) { var l = whatLabel(w); return { value: w.value, label: l.label, small: l.small }; }), sc.what, scPick("what"));
    $("bigger").innerHTML = biggerHtml();
    drawCharts();
    var okN = DATA.filter(function (r) { return r.observed && typeof r.aigfs === "number" && typeof r.gfs === "number"; }).length;
    $("bigger-sense").textContent = tx("One case says little. Here are all " + okN + " cases with a measurement: 6 places, " + EVENINGS + " evenings, from " + D_FIRST + " to " + D_LAST +
      ", and 3 forecast lengths. A new evening is added each day.",
      "Un solo caso dice poco. Aquí están los " + okN + " casos con medición: 6 lugares, " + EVENINGS + " tardes, del " + D_FIRST + " al " + D_LAST +
      ", y 3 anticipaciones. Cada día se agrega una tarde nueva.");
    renderPlaces();
    if (state.shown) showResult(true);
    renderScenario(false);
  }

  // ---------- wire up ----------
  var scPick = function (key, cast) { return function (v) { sc[key] = cast ? cast(v) : v; renderScenario(true); }; };
  radios("cities", "city", CITIES.map(function (c) { return { value: c.name, label: cityName(c.name) }; }), state.city, function (v) { state.city = v; newCase(); });
  radios("days", "day", VALIDS.map(function (v) { return { value: v, label: dayName(v) }; }), state.valid, function (v) { state.valid = v; newCase(); });
  radios("leads", "lead", LEADS.map(function (L) { return { value: L, label: L + tx(" days", " días") }; }), state.lead, function (v) { state.lead = Number(v); newCase(); });
  radios("sc-who", "sc-who", SC.who, sc.who, scPick("who"));
  radios("sc-where", "sc-where", [{ value: "all", label: tx("All six places", "Los seis lugares") }].concat(CITIES.map(function (c) { return { value: c.name, label: cityName(c.name) }; })), sc.where, scPick("where"));
  radios("sc-when", "sc-when", LEADS.map(function (L) { return { value: L, label: L + tx(" days ahead", " días antes") }; }), sc.when, scPick("when", Number));
  radios("sc-why", "sc-why", SC.why, sc.why, scPick("why"));
  radios("sc-how", "sc-how", SC.how, sc.how, scPick("how"));

  $("reveal").addEventListener("click", function () {
    if (state.shown) { showResult(false); announce(tx("Result hidden.", "Resultado oculto.")); return; }
    if (!state.guess) {
      $("hint").textContent = tx("Make a guess first. It helps you notice what you expected.", "Elige tu respuesta primero. Te ayuda a notar lo que esperabas.");
      var first = document.querySelector('input[name="guess"]');
      if (first) first.focus();
      return;
    }
    showResult(true);
    $("h-result").focus();
    announce(tx("Result shown.", "Resultado visible."));
  });
  $("bigger").addEventListener("click", function (e) {
    var pin = e.target.closest(".pin, .place-btn");
    if (pin) { choosePlace(pin.dataset.place); return; }
    var b = e.target.closest(".try");
    if (b) loadCase(b.dataset.city, b.dataset.valid, Number(b.dataset.lead));
  });
  // The evening chart's readout: pointer and arrow keys, on the box (it survives redraws).
  $("bigger").addEventListener("pointermove", function (e) {
    var box = e.target.closest("#ev-chart"); if (!box || !evPlot.pts.length) return;
    var px = e.clientX - box.getBoundingClientRect().left, best = 0;
    evPlot.pts.forEach(function (p, i) { if (Math.abs(p - px) < Math.abs(evPlot.pts[best] - px)) best = i; });
    showReadout(best);
  });
  $("bigger").addEventListener("pointerleave", function () { if (document.activeElement !== $("ev-chart")) showReadout(null); }, true);
  $("bigger").addEventListener("keydown", function (e) {
    if (e.target.id !== "ev-chart") return;
    var n = evPlot.pts.length, i = evPlot.i == null ? -1 : evPlot.i;
    if (e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
    else if (e.key === "ArrowLeft") i = i < 0 ? n - 1 : Math.max(0, i - 1);
    else if (e.key === "Home") i = 0; else if (e.key === "End") i = n - 1;
    else if (e.key === "Escape") { showReadout(null); return; } else return;
    e.preventDefault(); showReadout(i);
    var r = evPlot.rows[i];
    announce(tx("Evening of ", "Tarde del ") + dayName(r.valid) + tx(": AI model ", ": modelo de IA ") + fmt1(uScale(r.st.ai)) + tx(", physics model ", ", modelo físico ") + fmt1(uScale(r.st.ph)) + " " +
      (unit === "F" ? tx("degrees Fahrenheit", "grados Fahrenheit") : tx("degrees Celsius", "grados Celsius")) + ".");
  });
  $("bigger").addEventListener("focusout", function (e) { if (e.target.id === "ev-chart") showReadout(null); });
  // Load the map when the bigger picture comes within about a screen of view (audit P12).
  (function () {
    var box = $("bigger");
    if (mapState !== "waiting" || !box) return;
    if (!("IntersectionObserver" in window)) { loadMap(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); loadMap(); }
    }, { rootMargin: "800px 0px" });
    io.observe(box);
    window.addEventListener("beforeprint", loadMap); // so a printout has the map when the reader didn't scroll to it
  })();
  // What's in the record so far (audit P8): counts only, no winner, so the guess stays a real guess.
  (function () {
    var el = $("kpis"); if (!el || !VALIDS.length) return;
    var okN = DATA.filter(function (r) { return r.observed && typeof r.aigfs === "number" && typeof r.gfs === "number"; }).length;
    var last = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(new Date(VALIDS[VALIDS.length - 1]).getTime() - 86400000));
    el.innerHTML = [[tx("Evenings saved", "Tardes guardadas"), EVENINGS], [tx("Cases checked", "Casos revisados"), okN], [tx("Weather stations", "Estaciones meteorológicas"), CITIES.length], [tx("Latest evening", "Última tarde"), last]].map(function (k) {
      return '<div class="kpi"><dt>' + k[0] + "</dt><dd>" + esc(k[1]) + "</dd></div>";
    }).join("");
  })();
  $("again").addEventListener("click", function () { newCase(); announce(tx("Started again. Make a guess.", "Empezamos de nuevo. Elige tu respuesta.")); });
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
      announce(unit === "F" ? tx("Now in Fahrenheit, with rain in inches.", "Ahora en Fahrenheit, con la lluvia en pulgadas.") : tx("Now in Celsius, with rain in millimeters.", "Ahora en Celsius, con la lluvia en milímetros."));
    });
  });
  $("q").addEventListener("input", renderSearch);
  $("q").addEventListener("keydown", function (e) { if (e.key === "Escape") { $("q").value = ""; renderSearch(); } });
  $("q-results").addEventListener("click", function (e) {
    var b = e.target.closest(".search__hit");
    if (b && renderSearch.res) goTo(renderSearch.res[Number(b.dataset.i)].go);
  });
  // How fresh the data is, so a stalled archive shows on the page itself.
  (function () {
    var el = $("data-status"); if (!el || !VALIDS.length) return;
    var lastValid = new Date(VALIDS[VALIDS.length - 1]);
    var lastName = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(lastValid.getTime() - 86400000));
    var daysOld = Math.floor((Date.now() - lastValid.getTime()) / 86400000);
    el.textContent = tx("Saved through the evening of " + lastName + ". A new evening is added each night.", "Guardado hasta la tarde del " + lastName + ". Cada noche se agrega una tarde nueva.") +
      (daysOld > 2 ? tx(" No evening has been added for " + daysOld + " days, so the nightly archive may need a look.", " No se ha agregado ninguna tarde en " + daysOld + " días, así que quizá haya que revisar el archivo nocturno.") : "");
  })();
  themeLabel();
  showResult(false);
  renderUnits();
})();
