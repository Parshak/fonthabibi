/* ============================================================
   "Change the look"
   A small button in the bottom corner of every page. It lets a
   visitor try the whole site in another color and another font,
   which is the same idea the kits are built on. The choice is
   remembered in this browser.

   This file is loaded in <head>, so the chosen look is applied
   before the page is first drawn. The colors and fonts themselves
   are defined in tool.css ([data-look] and [data-type] on <html>);
   this file only picks which one is on.
   ============================================================ */
(function () {
  // The first entry in each list is the site's default.
  var LOOKS = [["saffron", "Saffron", "#FFC72C"], ["coral", "Coral", "#FF8674"], ["rose", "Rose", "#FF9DB8"],
    ["sky", "Sky", "#8CC8FF"], ["mint", "Mint", "#86DDA8"], ["lilac", "Lilac", "#C7B2FF"]];
  var TYPES = [["jakarta", "Jakarta", "'Plus Jakarta Sans'"], ["rubik", "Rubik", "'Rubik'"], ["bricolage", "Bricolage", "'Bricolage Grotesque'"]];
  // Every page already loads Plus Jakarta Sans. The other fonts are fetched
  // only when someone picks one or opens the choices.
  var MORE_FONTS = "https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap";
  var KEY = "fh-look";

  var root = document.documentElement, state = {}, fontsLoaded = false;
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { state = {}; }
  function known(list, value) {
    return list.some(function (item) { return item[0] === value; }) ? value : list[0][0];
  }
  function loadMoreFonts() {
    if (fontsLoaded) return;
    fontsLoaded = true;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MORE_FONTS;
    document.head.appendChild(link);
  }
  function apply() {
    state.look = known(LOOKS, state.look);
    state.type = known(TYPES, state.type);
    if (state.look === LOOKS[0][0]) delete root.dataset.look; else root.dataset.look = state.look;
    if (state.type === TYPES[0][0]) delete root.dataset.type; else root.dataset.type = state.type;
    if (state.type !== TYPES[0][0]) loadMoreFonts();
    try { localStorage.setItem(KEY, JSON.stringify({ look: state.look, type: state.type })); } catch (e) { /* private window: the look lasts for this page only */ }
  }
  apply();

  document.addEventListener("DOMContentLoaded", function () {
    var box = document.createElement("div");
    box.className = "look";
    box.innerHTML =
      '<div class="look-panel" id="look-panel" hidden>' +
        '<div class="look-row" role="group" aria-label="Color"><span>Color</span>' +
          LOOKS.map(function (l) {
            return '<button class="look-dot" type="button" style="--dot:' + l[2] + '" data-key="look" data-val="' + l[0] + '" aria-label="' + l[1] + '" title="' + l[1] + '"></button>';
          }).join("") +
        "</div>" +
        '<div class="look-row" role="group" aria-label="Font"><span>Font</span>' +
          TYPES.map(function (t) {
            return '<button class="look-font" type="button" style="font-family:' + t[2] + ',system-ui,sans-serif" data-key="type" data-val="' + t[0] + '">' + t[1] + "</button>";
          }).join("") +
        "</div>" +
      "</div>" +
      '<button class="look-btn" type="button" aria-expanded="false" aria-controls="look-panel"><i aria-hidden="true"></i>Change the look</button>';
    var panel = box.querySelector(".look-panel"), button = box.querySelector(".look-btn");

    function paint() {
      box.querySelectorAll("[data-key]").forEach(function (b) {
        b.setAttribute("aria-pressed", state[b.dataset.key] === b.dataset.val);
      });
    }
    function open(yes) {
      panel.hidden = !yes;
      button.setAttribute("aria-expanded", yes);
      if (yes) loadMoreFonts(); // so each font's name is shown in that font
    }
    button.addEventListener("click", function () { open(panel.hidden); });
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("[data-key]");
      if (!b) return;
      state[b.dataset.key] = b.dataset.val;
      apply();
      paint();
    });
    document.addEventListener("click", function (e) { if (!panel.hidden && !box.contains(e.target)) open(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { open(false); button.focus(); }
    });

    paint();
    document.body.appendChild(box);
  });
})();
