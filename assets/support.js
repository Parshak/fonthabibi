/* ============================================================
   Support (tips)
   The one place the tip page address is set.

   The "Support" link in the top bar and the card on the home page
   are in the HTML of every page but stay hidden. This file switches
   them on and points them at the tip page.

   - SUPPORT_URL empty: nothing about support shows on the live site.
     Branch previews (name.fonthabibi.pages.dev) and a copy running on
     your own computer still show the spots, marked as not active, so
     the wording and placement can be checked first.
   - SUPPORT_URL set: the spots show everywhere and open that page.

   Loaded in <head>, so each page is drawn once, with or without them.
   ============================================================ */
(function () {
  var SUPPORT_URL = "https://ko-fi.com/parshakdahal"; // set to "" to switch the Support spots off

  var host = location.hostname;
  var preview = /\.fonthabibi\.pages\.dev$/.test(host) || host === "localhost" || host === "127.0.0.1";
  if (!SUPPORT_URL && !preview) return;
  document.documentElement.dataset.support = SUPPORT_URL ? "on" : "preview";

  // Name the service the button opens, so a new tab is no surprise.
  var SERVICES = [["ko-fi.com", "Ko-fi"], ["buymeacoffee.com", "Buy Me a Coffee"], ["stripe.com", "Stripe"], ["paypal.", "PayPal"], ["github.com", "GitHub Sponsors"]];
  var where = "a secure payment page";
  SERVICES.forEach(function (s) { if (SUPPORT_URL.indexOf(s[0]) !== -1) where = s[1]; });

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-support-link]").forEach(function (a) {
      if (SUPPORT_URL) {
        a.href = SUPPORT_URL;
        a.target = "_blank";
        a.rel = "noopener";
        if (!a.closest(".support-card")) a.title = "Opens " + where + " in a new tab";
        return;
      }
      // Preview: the top bar link jumps to the card, and the card's button is off.
      if (a.closest(".support-card")) a.setAttribute("aria-disabled", "true");
      else a.href = "/#support";
    });
    document.querySelectorAll("[data-support-note]").forEach(function (el) {
      el.textContent = SUPPORT_URL
        ? "Opens " + where + " in a new tab."
        : "Preview only. This button will open the tip page once its link is added.";
    });
  });
})();
