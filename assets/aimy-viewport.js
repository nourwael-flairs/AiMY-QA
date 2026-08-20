/* ═══════════════════════════════════════════════════════════════════════════
   AIMY VIEWPORT — PUBLISHES --ui-scale AND --kb, AND NAMES THE RAIL'S ICONS

   Loaded blocking in <head>, after assets/aimy-responsive.css, so --ui-scale is
   set before first paint and a 2560px monitor never flashes the unscaled layout
   on its way to the scaled one. The DOM half waits for DOMContentLoaded.

   There is no circularity to avoid: window.innerWidth is the viewport and is
   NOT affected by a CSS `zoom` on <body> (measured — innerWidth stayed put at
   every zoom factor). Reading it here and writing --ui-scale onto <html>, which
   is outside the zoom, is safe in either order.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* THE VIEWPORT THIS APP IS ACTUALLY VIEWED AT, WHICH IS NOT 1920.

     scale === 1 here exactly, and the whole curve hangs off it — change this
     one number and everything moves.

     It was 1920, and that was wrong. A 1920 panel at Windows' default 125%
     display scaling reports a CSS viewport of 1536, and the anchor has to be
     the CSS width, not the panel width. Anchoring above the real viewport put
     every ordinary session inside the `s < 1` clamp below, and the clamp is
     what breaks zoom invariance:

         apparent size = ui_scale x browser_zoom
         innerWidth    = screen_width / browser_zoom
         => ui_scale   = screen_width / (browser_zoom x ANCHOR)
         => apparent   = screen_width / ANCHOR      <- browser_zoom cancels

     Browser zoom cancels itself out, but only where ui_scale is free. At
     ANCHOR 1920 on a 1536 viewport the raw scale was 0.8, clamped up to 1, so
     100% zoom sat at apparent 1.0 while 50% zoom escaped the clamp at 1.6 and
     landed on apparent 0.8 — measured, and exactly the 20% shrink that was
     reported. With the anchor at the real viewport width the raw scale is
     >= 1 everywhere from 100% zoom outwards, the clamp never engages, and
     apparent size is genuinely constant across every zoom level. */
  var UI_ANCHOR_W = 1536;

  /* THERE IS NO WIDTH CAP, AND THAT IS THE POINT.

     This started at 1.6, which quietly reintroduced the bug it was meant to
     fix: a 3840-wide viewport needs 2.5 to sit at the anchor and a browser
     zoomed to 25% needs 4.0, so capping at 1.6 left them stretched — visibly
     the old unscaled layout, only slightly larger.

     Uncapped, the width term always resolves the effective layout to EXACTLY
     the anchor on any 16:9 or 16:10 screen, which is the whole requirement.
     The ceiling below is a sanity bound against a pathological viewport, not
     a design limit; the real bound is the height guard underneath it. */
  var UI_MAX_SCALE = 8;

  /* Scaling on width alone starves height: a 3440x1080 ultrawide would take
     1.79 and be left with 604 layout px of height, less than an iPad. The
     effective layout height is not allowed below this, so on a very wide,
     very short screen the height term wins and a little width stretch is
     accepted — the alternative is a shell too short to hold the app. */
  var MIN_LAYOUT_H = 720;
  /* Snap to exactly 1 within half a percent of the anchor, so a window that is
     a few pixels off does not ship `zoom: 1.004`. It was 1.04, which was wide
     enough to be its own small version of the clamp bug: at 97% browser zoom
     the raw scale is 1.031, that fell inside the dead zone, and the apparent
     size dropped 3%. At 1.005 the worst-case error is half a percent. */
  var DEADZONE = 1.005;
  /* Below this the soft keyboard is indistinguishable from browser-chrome
     jitter during a scroll, and reacting to that would make the composer
     twitch. */
  var KB_FLOOR = 24;

  var root = document.documentElement;

  /* No `zoom` support means no scaling — and, critically, --ui-scale must then
     stay at 1, because --vp-w/--vp-h divide by it. Publishing a scale the
     engine is going to ignore would shrink every modal by that factor. */
  var CAN_ZOOM = !!(window.CSS && CSS.supports && CSS.supports("zoom", "1.5"));

  function computeScale(vw, vh) {
    if (!CAN_ZOOM) return 1;
    var s = Math.min(vw / UI_ANCHOR_W, vh / MIN_LAYOUT_H);
    if (s < DEADZONE) return 1;
    if (s > UI_MAX_SCALE) s = UI_MAX_SCALE;
    return Math.round(s * 1000) / 1000;
  }

  var lastScale = null;
  var lastKb = null;

  function sync() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var vv = window.visualViewport;

    var s = computeScale(vw, vh);
    if (s !== lastScale) {
      root.style.setProperty("--ui-scale", s);
      lastScale = s;
    }

    /* The soft keyboard, in real px. Self-neutralising: if the UA honours
       interactive-widget=resizes-content then innerHeight shrinks with the
       keyboard and this comes out at 0, so the meta and this listener cannot
       both fire and double-compensate. */
    var kb = vv ? Math.max(0, Math.round(vh - vv.height - vv.offsetTop)) : 0;
    if (kb < KB_FLOOR) kb = 0;
    if (kb !== lastKb) {
      root.style.setProperty("--kb", kb);
      lastKb = kb;
    }
  }

  /* A `resize` event can arrive BEFORE the engine has settled the new metrics —
     measured: a 1920→2560 change fired resize while innerWidth still read 1920,
     so sync() computed 1, memoised it, and no second event ever came. The
     layout then stayed unscaled at 2560 forever. One frame later the metrics
     are correct, so every trigger re-reads on the next frame. */
  var rafPending = false;
  function schedule() {
    sync();
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      sync();
    });
  }

  sync(); /* pre-paint */

  addEventListener("resize", schedule, { passive: true });
  addEventListener("orientationchange", schedule, { passive: true });
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", schedule, { passive: true });
    visualViewport.addEventListener("scroll", schedule, { passive: true });
  }

  /* <html> is `height: 100dvh` and is NOT zoomed — the zoom is on <body> — so
     its box tracks the real viewport and cannot be fed back into by anything
     this file writes. That makes it safe to observe. */
  if (window.ResizeObserver) {
    new ResizeObserver(schedule).observe(root);
  }

  /* AND A POLL, BECAUSE NEITHER OF THE ABOVE IS GUARANTEED TO FIRE.

     Changing the browser's ZOOM level changes the viewport without necessarily
     producing a resize event or a ResizeObserver callback — measured here: the
     viewport went to 7680 wide, --ui-scale stayed at 1, and dispatching a
     synthetic `resize` by hand immediately corrected it. An app whose layout
     depends on the viewport cannot be one event away from being wrong, and
     zooming out to check how the app behaves on a big screen is exactly what
     someone does first.

     This costs two cached property reads every 250ms and calls sync() only
     when a dimension actually changed, so a steady window does no work at
     all beyond the comparison. */
  var lastW = window.innerWidth;
  var lastH = window.innerHeight;
  setInterval(function () {
    if (window.innerWidth === lastW && window.innerHeight === lastH) return;
    lastW = window.innerWidth;
    lastH = window.innerHeight;
    schedule();
  }, 250);

  /* ── THE RAIL'S LABELS ───────────────────────────────────────────────────
     Every .nav-item's label is a BARE TEXT NODE — no span, no title, no
     data-label. CSS can collapse it (font-size: 0, see aimy-responsive.css)
     but cannot read it back out for a tooltip. Lifting it onto the element
     here is what keeps this out of six files' markup. */
  function initRail() {
    var sidebar = document.querySelector(".app-sidebar");
    if (!sidebar) return;
    var items = sidebar.querySelectorAll(".nav-item");
    if (!items.length) return;

    Array.prototype.forEach.call(items, function (a) {
      if (a.hasAttribute("data-label")) return;
      var t = "";
      var c = a.childNodes;
      for (var i = 0; i < c.length; i++) {
        if (c[i].nodeType === 3) t += c[i].textContent;
      }
      t = t.replace(/\s+/g, " ").trim();
      if (t) a.setAttribute("data-label", t);
    });

    var railQ = matchMedia("(max-width: 1099.98px)");

    function show(a) {
      if (!railQ.matches) return;
      var label = a.getAttribute("data-label");
      if (!label) return;
      /* getBoundingClientRect is in VISUAL px; a custom property carrying a
         `px` length is read in LAYOUT px inside the zoom. currentCSSZoom is the
         conversion between them. It is 1 at every width the rail exists at, but
         dividing is what makes that a fact rather than a coincidence. */
      var k = a.currentCSSZoom || 1;
      var ar = a.getBoundingClientRect();
      var sr = sidebar.getBoundingClientRect();
      sidebar.style.setProperty(
        "--tip-y",
        (ar.top - sr.top + ar.height / 2) / k + "px"
      );
      sidebar.setAttribute("data-tip", label);
    }

    function hide() {
      sidebar.removeAttribute("data-tip");
    }

    Array.prototype.forEach.call(items, function (a) {
      a.addEventListener("mouseenter", function () { show(a); });
      a.addEventListener("focus", function () { show(a); });
      a.addEventListener("mouseleave", hide);
      a.addEventListener("blur", hide);
    });
    sidebar.addEventListener("mouseleave", hide);
    railQ.addEventListener("change", hide);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRail);
  } else {
    initRail();
  }
})();
