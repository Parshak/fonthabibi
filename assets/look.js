/* ============================================================
   PREVIEW ONLY: a small bar for trying the other looks.
   It lets Parshak compare three warm color fields and three fonts
   on the real pages. It does nothing on the live site, and this
   file (and the [data-look] / [data-type] rules in tool.css) is
   deleted once a look is chosen.
   ============================================================ */
(function () {
  var LIVE = ["fonthabibi.pages.dev"];
  if (LIVE.indexOf(location.hostname) >= 0) return;

  var LOOKS = [["saffron", "Saffron", "#FFC72C"], ["coral", "Coral", "#FF8674"], ["rose", "Rose", "#FF9DB8"]];
  var TYPES = [["jakarta", "Jakarta"], ["rubik", "Rubik"], ["bricolage", "Bricolage"]];
  var root = document.documentElement, state = {};
  try { state = JSON.parse(localStorage.getItem("fh-look") || "{}") || {}; } catch (e) { state = {}; }
  var known = function (list, v) { return list.some(function (x) { return x[0] === v; }) ? v : list[0][0]; };
  function apply() {
    state.look = known(LOOKS, state.look);
    state.type = known(TYPES, state.type);
    if (state.look === LOOKS[0][0]) delete root.dataset.look; else root.dataset.look = state.look;
    if (state.type === TYPES[0][0]) delete root.dataset.type; else root.dataset.type = state.type;
    try { localStorage.setItem("fh-look", JSON.stringify(state)); } catch (e) { /* private window */ }
  }
  apply(); // before first paint, so pages do not flash the default look

  // The other fonts are only needed here, so they are loaded here.
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);

  document.addEventListener("DOMContentLoaded", function () {
    var bar = document.createElement("div");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Preview: try another look");
    bar.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:200;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;max-width:calc(100vw - 24px);padding:9px 12px;background:#231710;color:#fff;border-radius:14px;font:500 13px/1.2 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)";
    function group(label, list, key) {
      var wrap = document.createElement("span");
      wrap.style.cssText = "display:flex;gap:5px;align-items:center";
      var name = document.createElement("span");
      name.textContent = label;
      name.style.opacity = ".7";
      wrap.appendChild(name);
      list.forEach(function (item) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = item[1];
        b.dataset.key = key;
        b.dataset.val = item[0];
        b.style.cssText = "font:inherit;color:#fff;background:transparent;border:1px solid rgba(255,255,255,.35);border-radius:99px;padding:5px 10px;cursor:pointer";
        if (item[2]) b.style.borderLeft = "10px solid " + item[2];
        wrap.appendChild(b);
      });
      return wrap;
    }
    var tag = document.createElement("span");
    tag.textContent = "Preview only";
    tag.style.cssText = "font-weight:700;color:#FFC72C";
    bar.appendChild(tag);
    bar.appendChild(group("Color", LOOKS, "look"));
    bar.appendChild(group("Font", TYPES, "type"));
    function paint() {
      bar.querySelectorAll("button").forEach(function (b) {
        var on = state[b.dataset.key] === b.dataset.val;
        b.setAttribute("aria-pressed", on);
        b.style.background = on ? "#fff" : "transparent";
        b.style.color = on ? "#231710" : "#fff";
      });
    }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      state[b.dataset.key] = b.dataset.val;
      apply();
      paint();
    });
    paint();
    document.body.appendChild(bar);
  });
})();
