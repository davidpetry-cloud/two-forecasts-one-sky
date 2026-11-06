// Theme before first paint: the viewer's saved choice, else the device's setting.
(function () {
  var t = null;
  try { t = localStorage.getItem("tf-theme"); } catch (e) {}
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
})();
