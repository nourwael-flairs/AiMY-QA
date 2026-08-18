/* ═══════════════════════════════════════════════════════════════════════════
   AIMY CANVAS — SESSIONS, AND THE SURFACE EACH ONE CARRIES

   Ported from AiMY Sales (assets/sales.js:4962-5249, 13554-13802, 15219-15259).

   The claim this file exists to make: a conversation is not a transcript, it
   is a PLACE YOU WERE. Picking one out of the column restores the thread AND
   the surface it was had on — the filters that were set, the view that was
   open, the scenario that was detected. Restoring one without the other gives
   back the half that was already there.

   Sales can do this in one line because in Sales the surface IS the query
   string. QA had no such representation, so the first half of this file
   builds one: each page registers the keys it can change and how to read and
   write them, and everything else here is the same machinery Sales uses.

   LOAD ORDER: this is the last <script> before </body>, so every page IIFE has
   already run and `window.AIMY_SURFACE` is in place.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* Which of the six pages this is. `location.pathname` ends in '/' when the
     server serves a directory index, which is the same page as index.html. */
  var PAGE = (location.pathname.split("/").pop() || "index.html");
  if (PAGE.indexOf(".html") < 0) PAGE = "index.html";

  /* What a page thread is called in the column. A page names itself, the same
     way a record does in Sales — a name taken from the thing is better than
     anything the first question would have produced. */
  var PAGE_NAME = {
    "index.html": "The QA dashboard",
    "agent-scorecards.html": "Agent scorecards",
    "goal-browser.html": "The goal browser",
    "data-ingestion.html": "Data ingestion",
    "settings.html": "Settings",
    "my-profile.html": "My profile"
  };

  /* The page's contract with this file. Every field is optional: a page that
     registers nothing still gets the column, the threads and the search — it
     simply has no surface state to carry.

       MULTI     keys whose value is a list, serialised comma-joined
       SCALAR    keys whose value is a string
       DEFAULTS  values that are omitted from the query string
       read()    → the surface right now, as a flat object
       apply(v)  ← put this surface on. v IS THE WHOLE SURFACE: anything the
                   page can change and that v does not name must be CLEARED,
                   because a restore that merges lands you on a surface that
                   was never anywhere.
       initials  the two letters in the user avatar on this page
       aiBubbleStyle  inline style for an AiMY bubble, where the page widens it
       aiPrefix(turn) → HTML to sit above a rehydrated answer, e.g. a basis row
       open()    a quiet opener, where `window.aimyOpenCanvas()` would ask
                   something rather than just opening */
  var CFG = window.AIMY_SURFACE || {};
  var MULTI = CFG.MULTI || [];
  var DEFAULTS = CFG.DEFAULTS || {};
  var INITIALS = CFG.initials || "NW";

  /* ── Local helpers. Deliberately not reaching into the page's own IIFE:
        every page has an `escHtml` and none of them is on window. ── */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function $(sel) { return document.querySelector(sel); }
  function isMulti(k) { return MULTI.indexOf(k) >= 0; }

  /* ═══════════════════════════════════════════════
     THE SURFACE, AS A QUERY STRING

     `qs` freezes it, `parse` thaws it, `go` is the single choke point that
     writes history and repaints. One place each, because two functions
     computing one surface is two functions that disagree about it.
  ═══════════════════════════════════════════════ */

  /* The live surface plus the chat that is open. `chat` is owned here rather
     than by the page: which conversation you are in is chrome, and no page
     should have to know about it to register its filters. */
  function readAll() {
    var out = (CFG.read ? CFG.read() : null) || {};
    var copy = {};
    Object.keys(out).forEach(function (k) { copy[k] = out[k]; });
    copy.chat = CUR_CHAT;
    return copy;
  }

  function qs(over) {
    var next = readAll();
    if (over) Object.keys(over).forEach(function (k) { next[k] = over[k]; });
    var parts = [];
    Object.keys(next).sort().forEach(function (k) {
      var v = next[k];
      if (v == null || v === "" || v === false) return;
      if (Object.prototype.toString.call(v) === "[object Array]") {
        if (v.length) parts.push(k + "=" + v.map(encodeURIComponent).join(","));
        return;
      }
      if (v === DEFAULTS[k]) return;
      parts.push(k + "=" + encodeURIComponent(String(v)));
    });
    return parts.length ? "?" + parts.join("&") : location.pathname;
  }

  /* Every declared key back to its default, then the URL laid over it. The
     clearing half is the point: a partial parse would leave whatever the page
     happened to be showing, and the whole job is to PUT BACK a surface rather
     than to merge with it. */
  function parse() {
    var out = {};
    (CFG.SCALAR || []).forEach(function (k) { out[k] = DEFAULTS[k] || ""; });
    MULTI.forEach(function (k) { out[k] = []; });
    new URLSearchParams(location.search).forEach(function (v, k) {
      out[k] = isMulti(k) ? v.split(",").filter(Boolean).map(decodeURIComponent) : v;
    });
    return out;
  }

  function refresh() {
    var vals = parse();
    CUR_CHAT = vals.chat || "";
    /* A page that cannot repaint must not take the column down with it — but
       it must not fail quietly either, or a surface that stopped restoring
       looks identical to one that has nothing to restore. */
    if (CFG.apply) { try { CFG.apply(vals); } catch (e) { console.warn("AiMY canvas: this page could not apply a stored surface.", e); } }
    paintChats();
  }

  /* One way in. Every surface change goes through here, so there is exactly
     one place that writes history and one place that repaints. */
  function go(over, replace) {
    var url = qs(over);
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    refresh();
  }

  /* THE TOTAL RESTORE, and why it is not `go`.

     `go(over)` merges its argument over what is on screen NOW, which is right
     for changing one filter and wrong for landing on a stored surface: a
     filter set now and absent from the snapshot would survive the switch. So
     a session's state is written to the URL LITERALLY, and `parse` clears
     everything it does not mention. */
  function goTo(stateStr, extra) {
    var p = new URLSearchParams(String(stateStr || "").replace(/^\?/, ""));
    Object.keys(extra || {}).forEach(function (k) {
      if (extra[k]) p.set(k, extra[k]); else p.delete(k);
    });
    var s = p.toString();
    history.pushState(null, "", s ? "?" + s : location.pathname);
    refresh();
  }

  /* For the page to call after it changes its own surface, so the URL keeps
     naming what is on screen. `replaceState`, not `push`: setting a filter is
     not a navigation and should not cost a press of Back. */
  function sync() { history.replaceState(null, "", qs()); }

  /* ═══════════════════════════════════════════════
     THREADS, SESSIONS, AND THE COLUMN THAT LISTS THEM

     A thread belongs to its SUBJECT, which is what makes asking the same
     question twice land in one place. QA's subjects are its pages, so every
     page has a thread of its own that comes back when you return to it; a
     session is the second kind — free-standing, started deliberately, named
     after its first question, and found by name rather than by being open.
  ═══════════════════════════════════════════════ */

  var LS_KEY = "aimy-qa-chats";

  /* `{key: {title, at, page, state, blank}}` — one record per thread, page
     threads included. Sales keeps page-equivalent threads out of its session
     map because a record names itself; here they are in, because a page
     thread has a surface to carry too and one store is one sort order. */
  var SESSIONS = Object.create(null);
  var THREADS = Object.create(null);
  var THREAD_AT = Object.create(null);
  var seq = 0;
  var threadSeq = 0;
  var CUR_CHAT = "";

  /* What the search box holds. Deliberately NOT surface state: it narrows a
     list of conversations rather than the page, and a pasted link carrying
     somebody's half-typed search would restore a filtered column nobody
     asked for. */
  var CHAT_Q = "";

  function subjectKey() { return "page:" + PAGE; }
  function threadKey() { return CUR_CHAT || subjectKey(); }

  function ensure(key) {
    if (!SESSIONS[key]) {
      SESSIONS[key] = { title: "", at: new Date().toISOString().slice(0, 10),
        page: key.indexOf("page:") === 0 ? key.slice(5) : PAGE, state: "" };
    }
    if (!THREADS[key]) THREADS[key] = [];
    return SESSIONS[key];
  }

  function threadName(key) {
    var s = SESSIONS[key];
    if (s && s.title) return s.title;
    if (key.indexOf("page:") === 0) return PAGE_NAME[key.slice(5)] || key.slice(5);
    return key;
  }

  /* ══ READING A THREAD IS NOT TOUCHING IT ═══════════════════════════════

     Two accessors, and the difference between them is the whole of the
     column's stability.

     Sales stamps recency inside its single accessor, so opening a
     conversation counts as touching it. That is right for a list you return
     to and wrong for a list you are CHOOSING FROM: the row you clicked jumps
     to the top the instant you click it, every other row shifts down by one,
     and the next thing you wanted is no longer where you just saw it. A
     column you have to re-read after every click is a column you cannot
     browse — and browsing is what it is for.

     So `turns$` reads and `thread$` touches. Only saying something moves a
     conversation up the list, because saying something is the only thing that
     makes it more recent. */
  function turns$(key) {
    var k = key || threadKey();
    ensure(k);
    return THREADS[k];
  }
  function thread$() {
    var k = threadKey();
    THREAD_AT[k] = ++threadSeq;
    return turns$(k);
  }

  function trimTitle(t) {
    var s = String(t || "").trim().replace(/\s+/g, " ");
    return s.length > 42 ? s.slice(0, 41) + "…" : s;
  }

  /* ── Persistence, which Sales does not need and QA cannot do without ──

     Sales is one page: in-memory is the whole lifetime of a session. QA is
     six, and moving between them is a full page load — so without this a
     session would die the first time it was used.

     TURNS ARE DATA, NEVER RENDERED HTML FOR ANYTHING INTERACTIVE.
     agent-scorecards.html:15926 records why, in-tree: `saveCanvasState` /
     `restoreCanvasState` snapshotted `thread.innerHTML` and were removed
     because re-injecting it destroyed the event listeners on every rendered
     card. So a turn carrying a card stores the RENDERER'S NAME and is rebuilt
     by calling it — fresh node, listeners intact. Prose replies store their
     own string, which has nothing to lose. */
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        v: 1, seq: seq, sessions: SESSIONS, threads: THREADS, at: THREAD_AT, tick: threadSeq
      }));
    } catch (e) { /* private mode, or full. The column still works this session. */ }
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) { return false; }
    if (!raw) return false;
    try {
      var d = JSON.parse(raw);
      if (!d || d.v !== 1) return false;
      Object.keys(d.sessions || {}).forEach(function (k) { SESSIONS[k] = d.sessions[k]; });
      Object.keys(d.threads || {}).forEach(function (k) { THREADS[k] = d.threads[k]; });
      Object.keys(d.at || {}).forEach(function (k) { THREAD_AT[k] = d.at[k]; });
      seq = d.seq || 0;
      threadSeq = d.tick || 0;
      return true;
    } catch (e) { return false; }
  }

  /* ── The one call a page makes when something is said ──
     Two lines inside the page's own `appendUserMsg` / `appendAiMsg`, because
     those are IIFE-private and monkey-patching what you cannot see is how a
     turn goes missing silently. */
  function record(who, text, meta) {
    /* AN ANSWER THAT IS ONLY TRUE RIGHT NOW IS NOT A TURN.
       The outage and error states are drawn from what the product can reach
       at that second. Persisted, they would be replayed tomorrow as though
       they still held — a thread asserting an outage that ended is the one
       thing a record of a conversation must never do. */
    if (meta && meta.transient) return;
    var k = threadKey();
    var t = { who: who, text: String(text == null ? "" : text) };
    if (meta && meta.render) { t.render = meta.render; t.text = meta.label || ""; }
    if (meta && meta.topic) t.topic = meta.topic;
    thread$().push(t);

    /* THE SESSION FOLLOWS YOU. Ask something, narrow the surface, ask again —
       coming back should land where the conversation ENDED rather than where
       it started, because that is the state the last answer is about. */
    var s = ensure(k);
    /* Said in, so no longer a fixture. */
    if (s.seeded) delete s.seeded;
    s.state = qs();
    s.page = PAGE;
    s.at = new Date().toISOString().slice(0, 10);
    /* A blank session is named by the first thing said in it. */
    if (s.blank && who === "you" && t.text) { s.title = trimTitle(t.text); s.blank = false; }
    save();
    paintChats();
  }

  /* ═══ THE THREAD PANE, REBUILT FROM THE THREAD THAT IS CURRENT ═══
     Called when the canvas opens and when you switch. Appends still go
     through the page's own append functions, which are cheaper and keep the
     scroll behaviour they argue for. */
  var SUGGESTIONS = null;

  function turnHtml(t) {
    if (t.who === "you") {
      return '<div class="chat-msg user">'
        + '<div class="msg-avatar user-av">' + esc(INITIALS) + "</div>"
        + '<div class="msg-bubble">' + esc(t.text) + "</div></div>";
    }
    var body = "";
    if (t.render && typeof window[t.render] === "function") {
      try { body = window[t.render](); } catch (e) { body = esc(t.text); }
    } else {
      body = t.text;
    }
    /* Doctrine §6.3, the canvas shows its basis. A page that draws a basis
       row over its answers hands the builder over here, so a rehydrated turn
       still says what it was standing on rather than quietly losing it. */
    if (t.topic && CFG.aiPrefix) { try { body = (CFG.aiPrefix(t) || "") + body; } catch (e) {} }
    return '<div class="chat-msg aimy">'
      + '<div class="msg-avatar aimy-av">'
      + '<svg width="23" height="25" viewBox="0 0 18 20"><use href="#aimy-logo-small"/></svg>'
      + "</div>"
      + '<div class="msg-bubble"' + (CFG.aiBubbleStyle ? ' style="' + CFG.aiBubbleStyle + '"' : "")
      + ">" + body + "</div></div>";
  }

  function paintThread() {
    var th = $("#overlayThread");
    if (!th) return;
    /* `turns$`, not `thread$`: painting a thread is reading it. */
    var turns = turns$();
    th.innerHTML = turns.map(turnHtml).join("");
    /* The suggestion chips are a child of the thread on every page, so a
       rebuild takes them with it. They come back only when there is nothing
       said yet — which is the one state they are for. */
    if (SUGGESTIONS) {
      if (!turns.length) { SUGGESTIONS.classList.remove("hidden"); th.insertBefore(SUGGESTIONS, th.firstChild); }
      else SUGGESTIONS.classList.add("hidden");
    }
    th.scrollTop = th.scrollHeight;
    markEnd(th);
  }

  /* The bottom fade is off only while you are actually at the bottom. Sales
     adds this class once and never removes it, so the fade never returns
     after the first message; here it is a scroll handler and works both ways. */
  function markEnd(th) {
    var atEnd = th.scrollHeight - th.scrollTop - th.clientHeight < 4;
    th.classList.toggle("is-at-end", atEnd);
  }

  /* ═══ THE COLUMN ═══ (sales.js:13710-13802, copied) */
  function paintChats() {
    var host = $("#overlayChats");
    if (!host) return;
    var here = threadKey();
    var subj = subjectKey();

    /* A THREAD YOU CANNOT FIND MAY AS WELL NOT HAVE PERSISTED — and a title
       taken from the first question is a poor handle on the twentieth. So it
       searches the TURNS as well: the word you remember is usually one from
       inside the conversation rather than from whatever you opened with. */
    var q = CHAT_Q.trim().toLowerCase();
    function hits(key) {
      if (!q) return true;
      if (threadName(key).toLowerCase().indexOf(q) >= 0) return true;
      return (THREADS[key] || []).some(function (t) {
        return String(t.text || "").toLowerCase().indexOf(q) >= 0;
      });
    }

    /* ONE LIST. There were two groups in an earlier version of this — the one
       you have open, and the rest — and the split asked the reader to know
       which kind of thing a conversation was before they could look for it.
       Nobody knows that. A conversation is a conversation; where it is
       attached is a property of it, not a category to file it under.

       What is in the list: everything with something in it, plus whatever is
       open now — an empty thread on the page in front of you is still the
       place the next thing goes, and hiding it until it has content makes the
       column change shape as you talk. */
    var keys = Object.create(null);
    Object.keys(THREADS).forEach(function (k) { if ((THREADS[k] || []).length) keys[k] = 1; });
    Object.keys(SESSIONS).forEach(function (k) { if (SESSIONS[k].title || (THREADS[k] || []).length) keys[k] = 1; });
    keys[subj] = 1;
    keys[here] = 1;

    /* Most recently touched first, and "touched" means SAID SOMETHING IN.
       Live stamps count up from 1; a seeded conversation carries a negative
       stamp derived from its age, so it sorts among the others by when it
       happened while still sitting below anything said in this browser. A
       thread nobody has spoken in yet has no stamp and goes last, which is
       where an empty conversation belongs. */
    function at(k) { return THREAD_AT[k] || -1e9; }
    var recent = Object.keys(keys).sort(function (a, b) { return at(b) - at(a); });

    function row(key) {
      var n = (THREADS[key] || []).length;
      return '<button class="ov-chat' + (key === here ? " is-here" : "") + '" type="button"'
        + ' data-chat="' + esc(key) + '"' + (key === here ? ' aria-current="true"' : "") + ">"
        + '<span class="ov-chat-name">' + esc(threadName(key)) + "</span>"
        + (n ? '<span class="ov-chat-n">' + n + "</span>" : "")
        + "</button>";
    }

    /* WHAT YOU HAVE OPEN IS NEVER FILTERED OUT. A search that could hide the
       conversation in front of you would be answering a different question
       from the one being asked. */
    var found = recent.filter(function (k) { return k === here || hits(k); });

    host.innerHTML =
      '<button class="btn btn-brand btn-sm ov-chat-new" type="button" data-newchat>'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
      + "New conversation</button>"
      + '<label class="ov-chat-find">'
      + '<span class="s-sr">Find a conversation</span>'
      + '<input class="ov-chat-input" type="search" id="chatFind" placeholder="Find a conversation&hellip;"'
      + ' spellcheck="false" autocomplete="off" value="' + esc(CHAT_Q) + '" /></label>'
      + (found.length
        ? '<div class="ov-chat-group"><div class="ov-chat-cap">' + (q ? "Found" : "Recent") + "</div>"
          + found.map(row).join("") + "</div>"
        : "")
      + (q && !found.length
        ? '<p class="ov-chat-none">Nothing matches “' + esc(CHAT_Q) + "” — in a title or in anything said.</p>"
        : (!found.length
          ? '<p class="ov-chat-none">Nothing asked yet. What you ask on a page stays with that page.</p>' : ""));

    /* The caret goes back where it was: repainting the column on every
       keystroke would otherwise send it to the end of the word. */
    var box = $("#chatFind");
    if (box && document.activeElement !== box && CHAT_Q) {
      box.focus(); box.setSelectionRange(CHAT_Q.length, CHAT_Q.length);
    }
  }

  /* OPENING WITHOUT ASKING ANYTHING, THROUGH THE PAGE'S OWN DOOR.

     Adding `.open` to the overlay looks like it opens the canvas and is not
     enough: five of the six pages gate their Escape handler on a PRIVATE
     `overlayOpen` flag, so a canvas opened from the outside could not be
     closed with the key that says it closes things. The class is the symptom
     of being open, not the cause.

     `window.aimyOpenCanvas()` with no argument is the door every page already
     exposes, and on five of them it means exactly "open, ask nothing". The
     sixth has no `openOverlay` to reach and would ask a default question
     instead, so it hands over its own opener through `CFG.open`. */
  function openCanvasQuiet() {
    if (CFG.open) { try { CFG.open(); return; }
      catch (e) { console.warn("AiMY canvas: this page's opener failed; falling back.", e); } }
    if (typeof window.aimyOpenCanvas === "function") { window.aimyOpenCanvas(); return; }
    var ov = $("#aimyOverlay");
    if (ov) ov.classList.add("open");
    var fb = $("#aimyFloatBar");
    if (fb) fb.classList.add("hidden");
    var pill = $("#overlayResume");
    if (pill) pill.classList.remove("is-visible");
  }

  /* ═══════════════════════════════════════════════
     SESSIONS THAT ALREADY EXIST

     The column could only ever show what you had asked in this tab, so it
     opened empty on every load and the one thing it is for — going back to a
     conversation — could not be demonstrated or used. A workbench somebody
     has been working in has a history; starting from none is the state a
     product is in for its first five minutes and never again.

     EACH ONE CARRIES ITS SURFACE. `state` is the query string the session was
     had on and `page` is where, so picking one moves the product to what that
     conversation was about.
  ═══════════════════════════════════════════════ */
  function ago(days) {
    var d = new Date(); d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }
  function seed(key, title, days, page, state, turns) {
    /* A SEED IS A FIXTURE UNTIL SOMEBODY SPEAKS IN IT.

       Seeded once on the first visit was not enough: the fixture set changes
       as the product does, and a browser that had already stored the old one
       kept it forever — titles, pages and surfaces that no longer match
       anything. Wiping storage instead would take the reader's own
       conversations with it.

       So `seeded` marks a fixture, `record` drops the mark the moment a turn
       is added, and boot refreshes only what is still marked. Fixtures stay
       current; anything anyone actually said is never touched. */
    if (SESSIONS[key] && !SESSIONS[key].seeded) return;
    SESSIONS[key] = { title: title, at: ago(days), page: page, state: state, seeded: true };
    THREADS[key] = turns;
    /* Ordered by its own age rather than by the order these calls happen to
       be written in. Negative, so anything said in this browser outranks
       every one of them however old the seed claims to be. */
    THREAD_AT[key] = -days;
  }
  function seedSessions() {
    /* Each one names a surface this product actually has, so switching to it
       lands somewhere that exists: two carry filters or a view on the
       dashboard, two are on other pages entirely. Between them they
       demonstrate the whole claim — the conversation and the place. */
    seed("s-seed-1", "Why is first response SLA at 61%?", 1, "index.html",
      "?f_company=Upland&f_time-period=This%20week", [
        { who: "you", text: "Why is first response SLA at 61%?" },
        { who: "aimy", text: "The billing queue took 3× its normal volume between 09:00 and 11:00 and nothing rebalanced against it. Eight agents are carrying the gap. I moved two onto billing for the rest of the shift and pulled the breached tickets; first response is already easing back toward target." },
        { who: "you", text: "Will it recover today?" },
        { who: "aimy", text: "On the current arrival rate, yes — late afternoon. What it will not do is stay recovered: the same spike landed on Tuesday and last Thursday, so this is a rota question rather than a today question." }
      ]);
    seed("s-seed-2", "How are the six portfolios tracking?", 2, "index.html",
      "?view=director", [
        { who: "you", text: "How are the six portfolios tracking?" },
        { who: "aimy", text: "Four are inside target and two are not. Objectif Lune has been under for five weeks and the gap is widening; RightAnswers dipped once, in the week its two most experienced agents were both on leave, and has recovered since. Only one of those is a problem." },
        { who: "you", text: "What is different about Objectif Lune?" },
        { who: "aimy", text: "Ticket volume per agent is 40% above the portfolio average and has been since the June migration. The quality gap tracks the load almost exactly, which makes it a staffing answer rather than a coaching one." }
      ]);
    seed("s-seed-3", "What is holding up the two overdue justifys?", 6, "index.html",
      "?scenario=justify", [
        { who: "you", text: "What is holding up the two overdue justifys?" },
        { who: "aimy", text: "DISP-0441 and DISP-0438 are both past the SLA window and both are waiting on the same reviewer, who has been out since Monday. Nothing reassigned them because the queue has no fallback owner." }
      ]);
    seed("s-seed-4", "Is Omar’s coaching plan working?", 11, "agent-scorecards.html",
      "?view=agent", [
        { who: "you", text: "Is Omar’s coaching plan working?" },
        { who: "aimy", text: "Not yet. He acknowledged it on the 3rd and has had four consecutive negatives on Follow-up Confirmation since, which crossed the repeated-goal-fail threshold this morning. That is why the HR meeting is sitting in your reviews rather than being scheduled outright." },
        { who: "you", text: "Was the plan the right one?" },
        { who: "aimy", text: "It named the right checklist item and the wrong cause. The plan coaches phrasing; the transcripts show he is confirming follow-ups at the end of calls that have already run over, so the failure is where it sits in the call rather than how it is said." }
      ]);
    seed("s-seed-5", "Which goals have been off track longest?", 18, "goal-browser.html",
      "", [
        { who: "you", text: "Which goals have been off track longest?" },
        { who: "aimy", text: "Three, and one of them for eleven weeks: Follow-up Confirmation has not met target since the checklist changed in June. The other two turned in the last fortnight and are still inside the window where a coaching plan usually recovers them." }
      ]);
  }

  /* ═══ EVENTS ═══ */

  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "chatFind") { CHAT_Q = e.target.value; paintChats(); }
  });

  document.addEventListener("click", function (e) {
    var el;

    /* A BLANK SESSION, NAMED WHEN IT HAS SOMETHING TO NAME IT. A thread is
       titled from its first question, which is the right rule and needs a
       question — so this makes the key, leaves a placeholder the column can
       show, and `record` renames it on the first thing said. The surface
       stays where it is: a new conversation is a new subject, not a new
       place. */
    if (e.target.closest && e.target.closest("[data-newchat]")) {
      var key = "sess-" + (++seq);
      SESSIONS[key] = { title: "New conversation", at: new Date().toISOString().slice(0, 10),
        page: PAGE, state: qs(), blank: true };
      THREADS[key] = [];
      /* Stamped here rather than left to the first thing said in it. Opening
         a conversation no longer counts as touching it, and STARTING one is
         not opening it — a conversation you just made must be at the top of
         the list you made it from, or the button appears to have done
         nothing. */
      THREAD_AT[key] = ++threadSeq;
      go({ chat: key });
      openCanvasQuiet();
      paintThread();
      var box = $("#overlayInput");
      if (box) box.focus();
      save();
      return;
    }

    /* BOTH, FROM ONE CLICK. The thread and the surface it was had on.
       Restoring one without the other is the half that was already there:
       the conversation, without the thing it was about. */
    el = e.target.closest && e.target.closest("[data-chat]");
    if (el) {
      var ck = el.getAttribute("data-chat");
      var sess = SESSIONS[ck];
      var onPage = sess && sess.page ? sess.page : PAGE;

      /* A SESSION IS A PLACE, AND QA'S PLACES ARE SEPARATE DOCUMENTS.
         Sales can restore any surface without leaving the page because it
         only has one. Here the page is part of the snapshot, so a
         conversation had somewhere else is a navigation — carrying its state
         and its key so it lands mid-motion rather than on a fresh surface. */
      if (onPage !== PAGE) {
        var st = String((sess && sess.state) || "").replace(/^\?/, "");
        location.href = onPage + "?" + (st ? st + "&" : "") + "chat=" + encodeURIComponent(ck);
        return;
      }
      if (sess && sess.state) goTo(sess.state, { chat: ck === subjectKey() ? "" : ck });
      else go({ chat: ck === subjectKey() ? "" : ck });
      openCanvasQuiet();
      paintThread();
      return;
    }
  });

  /* The canvas can be opened by any of the six pages' own entry points, and
     none of them knows this file exists. Watching the class is what keeps the
     thread and the column right whichever door was used. */
  function watchCanvas() {
    var ov = $("#aimyOverlay");
    if (!ov) return;
    var was = ov.classList.contains("open");
    new MutationObserver(function () {
      var now = ov.classList.contains("open");
      if (now === was) return;
      was = now;
      if (now) { paintChats(); }
    }).observe(ov, { attributes: true, attributeFilter: ["class"] });
  }

  window.addEventListener("popstate", refresh);

  /* ═══ BOOT ═══ */
  function boot() {
    var th = $("#overlayThread");
    SUGGESTIONS = $("#overlaySuggestions");
    if (th) th.addEventListener("scroll", function () { markEnd(th); });

    /* Stored first, then every untouched fixture cleared and the current set
       laid down. Overwriting in place is not enough on its own: a fixture the
       product has RETIRED would have nothing to overwrite it and would outlive
       the release that dropped it. Anything spoken in has lost the mark by
       then, so this never reaches a real conversation. */
    load();
    Object.keys(SESSIONS).forEach(function (k) {
      if (SESSIONS[k] && SESSIONS[k].seeded) { delete SESSIONS[k]; delete THREADS[k]; delete THREAD_AT[k]; }
    });
    seedSessions();
    save();

    ensure(subjectKey());
    refresh();

    /* Arriving on `?chat=` — which is how a cross-page switch lands — opens
       the canvas on that thread. Without this the navigation would put the
       surface back and leave the conversation closed, which is the half this
       whole file exists to stop happening. */
    var arrived = new URLSearchParams(location.search).get("chat");
    if (arrived && SESSIONS[arrived]) { openCanvasQuiet(); paintThread(); }

    watchCanvas();
  }

  /* ═══ WHAT THE PAGES CALL ═══
     `record` and `sync` are the contract: one says something was said, the
     other says the surface moved. The rest is exposed for the console while
     this is a prototype — none of it is a second source of truth, every one
     reads SESSIONS and THREADS. */
  window.AimyChat = {
    record: record,
    paintThread: paintThread,
    paintChats: paintChats,
    threadKey: threadKey,
    sync: sync,
    go: go,
    qs: qs
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
