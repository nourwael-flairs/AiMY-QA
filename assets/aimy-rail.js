/* ═══════════════════════════════════════════════════════════════════════════
   THE RAIL — six observations, each with a door inside it

   QA is the only AiMY product with an explicit side-panel navigation, and the
   reason is structural rather than stylistic: it is the only MULTI-PAGE
   product. Knowledge and Sales are single `index.html` apps with modes and
   overlays, so neither has anywhere to navigate to. That is why QA's rail reads
   as a break from the ecosystem — the other products have nothing that looks
   like a menu because they have no menu to draw.

   This rail stops looking like one. There are no rows, no buttons, no icons and
   no section headings above the breakpoint. There are six sentences about what
   the product holds, and in each sentence one phrase is the way there. Reading
   the rail and using it are the same act — you do not read a label and then
   press a control beside it, you read a sentence and the sentence takes you.

   Navigation is still completely intact underneath. Every destination is a real
   `<a href>` with the page's own URL, in source order, in the tab order, and
   the row for the page you are on is marked `aria-current="page"`. It behaves
   like navigation for anything that consumes it as navigation; it just does not
   present itself as a list of places.

   ── THESE ARE FINDINGS, NOT DESCRIPTIONS ────────────────────────────
   An earlier pass wrote these as descriptions of each surface — "every audited
   interaction is scored against the checklist" — on the reasoning that a menu
   carrying live figures reorders and re-tones itself until nobody can learn it.
   That reasoning was wrong about which half matters. A line that is true every
   day is a line nobody reads twice, and a rail nobody reads is not a rail.

   So each one now states what AiMY has actually found on that surface, with the
   number in it, and the way there is the last phrase. "5 agents are failing
   Follow-up Confirmation — open Reviews."

   THE ORDER STILL DOES NOT MOVE. That is the half of the old reasoning worth
   keeping: the findings change, the six positions do not, so the rail can be
   learned as a place even while what it says changes underneath. Nothing here
   ranks, re-sorts or promotes; nothing wears a severity colour. Every card is
   the same AiMY blue whether it is reporting an outage or two pending requests,
   because deciding which of six findings is loudest is the briefing surface's
   job and it already does it, one column to the right.

   ── EVERY FIGURE IS READ OFF THE SURFACE IT DESCRIBES ──────────────────
     Dashboard   SLA 61%, 29pts under the 90% target · index.html:8309
     Reviews     the coaching plan targets "the 5 agents failing it"
                 · agent-scorecards.html
     My Profile  fb-201 is `ack: 'pending'`, reminded 2×, escalates to the
                 Feedback Manager in 3 days · my-profile.html
     Goal Hub    `pendingCount` is 2 in the Governance tab · goal-browser.html
     Data        S3 Voice is `pill-error`, 3 errors in 24h · data-ingestion.html
     Settings    three integrations read "Not connected" · settings.html

   IN A REAL BUILD THESE ARE DERIVED, NOT AUTHORED. They are constants here
   because this is a prototype and the six pages hold their data as fixtures;
   each one names where its number lives so the wiring is a lookup, not a
   rewrite. A figure that drifts from the surface it describes is the defect the
   gap register records as A0.3 — "a canvas that contradicts the card it was
   opened from is its own kind of unbound answer".

   ── THE `.nav-item` ANCHORS ARE KEPT, AND HIDDEN ────────────────────────────
   Each page ships six of them carrying an icon and an href. Above the
   breakpoint they are hidden and the inline link in the sentence does the work.
   Below it they come back and the sentences fold away, because prose has no
   64px form — so at every narrow width the rail is byte-for-byte the icon rail
   that ships today, tooltips and all, and nothing about that width had to be
   redesigned. `display: none` keeps the hidden one out of the accessibility
   tree, so only ever one link per destination is exposed.

   ── THE PAGE YOU ARE ON KEEPS ITS SENTENCE AND LOSES ITS DOOR ───────────────
   The link goes — it is a control that would do nothing — and the phrase says
   "you are here" in words rather than in colour alone. The sentence stays: it
   is the only thing on screen describing the surface you are looking at, and
   removing it would shrink the set from six to five on every navigation.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var RAIL_MQ = "(max-width: 1099.98px)";

  /* One finding per surface. The braces mark the phrase that becomes the link,
     written inline so the line reads as a line while you are editing it.

     FIRST PERSON WHERE AiMY IS THE ACTOR, plain statement where the finding is
     just true. That is the house voice — my-profile.html says "I've tracked you
     at 91% against the 80% target", Knowledge's rail "I can read the goal and
     go looking" — and it is what makes the attribution over these six mean
     something rather than decorate them.

     TWO MARKERS, NEITHER OF THEM HTML: `{...}` is the link, `*...*` is the
     figure. Both are cut out and turned into elements by `sentence()`, which
     builds text nodes rather than assigning innerHTML — see the note there. */
  var PAGES = {
    "index":
      "SLA compliance is running *29 points* under target — {open Dashboard}.",
    "agent-scorecards":
      "*5 agents* are failing Follow-up Confirmation and need coaching — {open Reviews}.",
    "my-profile":
      "Your feedback escalates in *3 days* unless you acknowledge it — {open My Profile}.",
    "goal-browser":
      "*2 goal change requests* are waiting on your decision — {open Goal Hub}.",
    "data-ingestion":
      "S3 Voice has failed *3 times* in 24 hours — {open Data}.",
    "settings":
      "*3 integrations* are still not connected — {open Settings}."
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ══ ONE IDENTITY, DERIVED THE SAME WAY FROM A URL AND FROM AN href ══════
     This is what the page IS, reduced until the address bar and the markup can
     be compared. Reported bug: on every page but the Dashboard the rail claimed
     you were on the Dashboard, which also took the Dashboard's own link away —
     the one page you then could not get back to.

     THE CAUSE WAS THE EXTENSION. The old resolver read
     `location.pathname.split("/").pop()` and returned "index.html" unless it
     found ".html" in it. Cloudflare Workers serves this site from
     `wrangler.jsonc`'s `assets` block, whose default html_handling REDIRECTS
     `/agent-scorecards.html` to `/agent-scorecards` — so on the deployed
     prototype the pathname never contains ".html", every page fell to the
     fallback, and every page thought it was the Dashboard.

     `python -m http.server`, which is what the local preview runs, serves the
     extension verbatim. That is why six passes of local verification never saw
     it: the bug only exists under the URL scheme the real deployment uses.

     So identity is now the basename with any extension and any trailing slash
     removed, lowercased. `/`, `/index.html`, `/index` and `/QA/index.html` all
     resolve to "index"; `/agent-scorecards` and `agent-scorecards.html` both
     resolve to "agent-scorecards". Trailing slashes are stripped BEFORE the
     split, or `/agent-scorecards/` would pop an empty segment and fall back to
     the Dashboard all over again. */
  function pageKey(urlOrHref) {
    var s = String(urlOrHref || "").split("#")[0].split("?")[0].replace(/\/+$/, "");
    var last = s.split("/").pop().replace(/\.[a-z0-9]+$/i, "");
    return last ? last.toLowerCase() : "index";
  }

  /* ═══════════════════════════════════════════════
     THE SENTENCE

     Built as text nodes and one element, never with innerHTML. The copy above
     is authored, but the page NAME comes out of the markup, and a page is free
     to call itself whatever it likes — assembling this as a string would make
     that an injection site for no reason at all.
  ═══════════════════════════════════════════════ */
  /* `*5 agents*` becomes a <b>. Split rather than parsed, because the only
     thing this ever needs to recognise is one marker and a regex over authored
     constants is a parser nobody asked for. Odd segments are the emphasised
     ones — an unclosed marker therefore emphasises the tail rather than
     throwing, which is the right way for a copy typo to fail. */
  function emphasise(parent, text) {
    var parts = String(text).split("*");
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2) {
        var b = document.createElement("b");
        b.appendChild(document.createTextNode(parts[i]));
        parent.appendChild(b);
      } else {
        parent.appendChild(document.createTextNode(parts[i]));
      }
    }
  }

  function sentence(template, href, isCurrent) {
    var p = document.createElement("p");
    p.className = "rail-say";

    var open = template.indexOf("{");
    var close = template.indexOf("}");
    if (open < 0 || close < 0) {
      p.appendChild(document.createTextNode(template));
      return p;
    }

    var before = template.slice(0, open);
    var phrase = template.slice(open + 1, close);
    var after = template.slice(close + 1);

    /* `before` is emitted by each branch rather than shared, because the two
       want different tails: the offer keeps its " — " separator, the
       you-are-here line has to shed it. */
    if (isCurrent) {
      /* THE WHOLE OFFER COMES OFF, NOT JUST THE HREF. An earlier pass rendered
         the phrase as unlinked text, which was fine while it read "Dashboard"
         and absurd once it read "open Dashboard" — the rail telling you to open
         the page you are looking at. The finding is still worth stating, so the
         line keeps it, drops the dash and the offer, and says where you are.

         The trailing separator goes with the phrase: `before` ends in " — "
         and leaving it would hang a dash off the end of the sentence. */
      emphasise(p, before.replace(/[\s—–,;:-]+$/, ""));
      emphasise(p, after);

      var note = document.createElement("span");
      note.className = "rail-here-note";
      /* The marker lives here rather than on a phrase, because there is no
         phrase any more — and it is stated in WORDS as well, since colour alone
         fails 1.4.1 and fails every reader who cannot tell this card from the
         five that still offer something. */
      note.setAttribute("aria-current", "page");
      note.appendChild(document.createTextNode(" You are on this page."));
      p.appendChild(note);
      return p;
    }

    emphasise(p, before);

    var a = document.createElement("a");
    a.className = "rail-link";
    a.setAttribute("href", href);
    a.appendChild(document.createTextNode(phrase));
    p.appendChild(a);
    emphasise(p, after);
    return p;
  }

  /* ═══════════════════════════════════════════════
     BUILD

     In place, one anchor at a time. The anchor is not removed — it is moved
     into a wrapper and hidden above the breakpoint — so the icon element, the
     href and the 64px behaviour survive untouched.
  ═══════════════════════════════════════════════ */
  function build(nav, page) {
    return $$(".nav-item", nav).map(function (a) {
      var key = pageKey(a.getAttribute("href"));

      /* The label is a BARE TEXT NODE — no span, no title, no data-label —
         which is the same fact aimy-responsive.css:201 and aimy-viewport.js:167
         both work around. Lift it onto the element before anything else reads
         it, so the 64px tooltip keeps working whichever file runs first. */
      if (!a.hasAttribute("data-label")) {
        var t = "";
        for (var i = 0; i < a.childNodes.length; i++) {
          if (a.childNodes[i].nodeType === 3) t += a.childNodes[i].textContent;
        }
        t = t.replace(/\s+/g, " ").trim();
        if (t) a.setAttribute("data-label", t);
      }

      var entry = document.createElement("div");
      entry.className = "rail-entry";
      entry.setAttribute("data-page", key);

      /* ══ THE BOTTOM PIN BECOMES A NARROW-ONLY FACT ═══════════════════════
         My Profile carries `order:10; margin-top:auto` inline so it sits at the
         foot of the column — the account-at-the-bottom convention, which is a
         MENU convention and the single loudest one left in the rail. Six
         sentences with one shunted to the floor do not read as a list of
         observations; they read as a nav with a profile item.

         So the pin moves onto the wrapper as an attribute rather than a style,
         and CSS applies it only below the breakpoint, where the rail really is
         an icon menu and the convention is right. An inline style could not
         have been overridden per-breakpoint at all. */
      if (a.style.order || a.style.marginTop) {
        entry.setAttribute("data-pin", "bottom");
        a.style.order = "";
        a.style.marginTop = "";
      }

      a.parentNode.insertBefore(entry, a);

      /* ══ A SURFACE, BECAUSE SIX PARAGRAPHS IN A COLUMN ARE NOT READ ═══════
         Prose set loose in a rail has no edges, so the eye finds no place to
         land and slides past all six. `.ai-insight-panel` (index.html:3188) is
         the shape this product already uses for "AiMY is telling you
         something" — a soft blue ground and a blue hairline — and it is the
         reason these read as six things AiMY said rather than one block of
         small print.

         It is the INSIGHT surface, not the briefing card: no severity tint, no
         work-state chip, no left stripe. Those say "act on this now", which is
         the reading a menu must never carry. */
      if (PAGES[key]) {
        var card = document.createElement("div");
        card.className = "rail-card";
        /* THE ANCHOR'S OWN href, NOT THE DERIVED KEY. The key is an identity —
           "agent-scorecards" — and pointing a link at it would invent a URL
           this deployment may not serve. Every page already links its siblings
           the way its own host expects; the rail borrows that verbatim so it
           can never disagree with the rest of the page about where a
           destination lives. */
        card.appendChild(sentence(PAGES[key], a.getAttribute("href"), key === page));
        entry.appendChild(card);
      }

      entry.appendChild(a);

      if (key === page) {
        /* The card's own settled treatment keys off this rather than off
           `:has(.rail-here)`. `:has` is supported everywhere this runs, but it
           is a selector doing work a class already knows, and the fallback
           would silently paint the page you are on as one of the five you are
           not. */
        entry.classList.add("is-current");
        a.classList.add("active");
        a.setAttribute("aria-current", "page");
      } else {
        a.classList.remove("active");
        a.removeAttribute("aria-current");
      }

      return entry;
    });
  }

  /* ═══════════════════════════════════════════════
     WHO IS TALKING

     Six first-person sentences with nothing above them leave "I" without an
     owner — the reader has to work out that the product is speaking, and most
     will not bother. One attribution at the top does that work for all six, so
     the mark does not have to be repeated on every card. Six marks down a
     272px column would also cost each sentence ~24px of measure, which is the
     one thing the rail cannot spare.

     Shape is `.aimy-intelligence-bar`, already on goal-browser and used exactly
     for this — AiMY announcing itself over a region. Its gradient ground is
     reproduced here; its `.aib-label` is NOT, because that label paints text
     with `-webkit-background-clip: text` and doctrine §11 bans gradient text
     outright. Solid `--ai-text` says the same thing and passes contrast.
  ═══════════════════════════════════════════════ */
  function mountHead(nav) {
    var head = document.createElement("div");
    head.className = "rail-head";
    /* aria-hidden: the marks and the wordmark are decoration over a region that
       already names itself through the sidebar's `aria-label`. Announcing
       "AiMY What is where" before every sentence is noise in a screen reader. */
    head.setAttribute("aria-hidden", "true");
    head.innerHTML =
      '<span class="rail-head-mark">' +
      '<svg viewBox="0 0 18 20" width="14" height="16"><use href="#aimy-logo-small"/></svg>' +
      "</span>" +
      '<span class="rail-head-label">AiMY</span>' +
      '<span class="rail-head-note">What is where</span>';
    nav.insertBefore(head, nav.firstChild);
  }

  /* ═══════════════════════════════════════════════
     THE DRAWER

     Below 1099.98px the rail is 64px of icons and the sentences are not on
     screen. The toggle is how they come back.

     Shape ported from Sales' `makeDrawer` (Sales/assets/sales.js:19434):
     aria-expanded on the button, Escape and outside-click to dismiss, focus
     back to the toggle, and a close on any activation inside the panel.
  ═══════════════════════════════════════════════ */
  function mountDrawer(sidebar, nav) {
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "rail-toggle";
    toggle.id = "railToggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", sidebar.id);
    toggle.setAttribute("aria-label", "Show what is where in QA");
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>' +
      '<line x1="3" y1="18" x2="21" y2="18"/></svg>' +
      '<span class="rail-toggle-label">What is where</span>';
    nav.insertBefore(toggle, nav.firstChild);  /* above the attribution */

    var scrim = document.createElement("div");
    scrim.className = "rail-scrim";
    scrim.id = "railScrim";
    sidebar.parentNode.insertBefore(scrim, sidebar.nextSibling);

    var mq = window.matchMedia(RAIL_MQ);
    var open = false;

    function apply(on) {
      open = on;
      sidebar.classList.toggle("is-open", on);
      scrim.classList.toggle("is-open", on);
      toggle.setAttribute("aria-expanded", on ? "true" : "false");
      toggle.setAttribute("aria-label", on ? "Hide what is where in QA" : "Show what is where in QA");
    }

    function close(returnFocus) {
      if (!open) return;
      apply(false);
      if (returnFocus) toggle.focus();
    }

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!mq.matches) return;
      apply(!open);
    });

    scrim.addEventListener("click", function () { close(true); });

    /* Following a link closes the drawer on the way out, so it is not left
       floating over the page it just navigated to. */
    sidebar.addEventListener("click", function (e) {
      if (!open) return;
      if (e.target.closest && e.target.closest("#railToggle")) return;
      if (e.target.closest && e.target.closest("a[href]")) close(false);
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) { e.stopPropagation(); close(true); }
    });

    /* TWO SOURCES, BECAUSE ONE OF THEM DOES NOT ALWAYS FIRE. Sales measured a
       900 → 1024 widening that crossed its query and produced no `change` event
       at all, leaving aria-expanded="true" on a display:none button
       (Sales/assets/sales.js:19417). assets/aimy-viewport.js:159 already polls
       for exactly this unreliability. Above the breakpoint the CSS is neutral,
       so a stale class cannot leak visually — this keeps the STATE honest. */
    function onChange() { if (!mq.matches) close(false); }
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
    setInterval(onChange, 500);
  }

  /* ═══════════════════════════════════════════════
     BOOT
  ═══════════════════════════════════════════════ */
  function boot() {
    var sidebar = $(".app-sidebar");
    if (!sidebar) return;
    var nav = $(".sidebar-nav", sidebar);
    if (!nav) return;

    /* So the drawer's aria-controls resolves. Five of the six files give the
       sidebar no id at all. */
    if (!sidebar.id) sidebar.id = "appSidebar";

    /* The rail is not a list of places any more, so it does not get a list's
       label. Read by CSS, and by anything auditing what this region claims to
       be. */
    sidebar.setAttribute("aria-label", "What is where in QA");

    mountHead(nav);
    build(nav, pageKey(location.pathname));
    mountDrawer(sidebar, nav);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
