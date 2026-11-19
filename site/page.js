// Small pages (the lesson plan): the theme switch and the print button. Nothing is sent anywhere.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var ES = (document.documentElement.lang || "").slice(0, 2) === "es";
  function themeNow() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function themeLabel() {
    var dark = themeNow() === "dark";
    $("theme").textContent = ES ? (dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro") : (dark ? "Switch to light theme" : "Switch to dark theme");
  }
  $("theme").addEventListener("click", function () {
    var next = themeNow() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("tf-theme", next); } catch (e) {}
    themeLabel();
  });
  var p = $("print");
  if (p) p.addEventListener("click", function () { window.print(); });
  themeLabel();
})();
