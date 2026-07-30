# QA v2 remediation — gap register

Doctrine §11: *"Never silently fix a pre-existing bug or shell artifact — flag it."*

Everything below was found while implementing the *AiMY QA v2 Prototype — Briefing-to-Canvas Design Review* (25 July 2026). Items marked **FIXED** were repaired because a Phase-1 deliverable could not function otherwise; the reason is stated in each case. Everything else is left in place and recorded.

Scope of the remediation: `index.html` (Dashboard), `agent-scorecards.html` (Reviews) and — added after an alignment check — `my-profile.html` (My Profile).

---

## A0. Two findings from the post-implementation sweep

### A0.1 The matcher covered only 10 of 16 topics — **FIXED**

`agent-scorecards.html`. The response table grew as renderers were added (heatmap, evaluation table, coaching rollout, pending evaluations) but `TOPIC_RULES` did not. Those answers were reachable only by clicking a control that declared the topic; typing the same question — which is the entire point of the float bar — fell through to the unbound state.

Reported from the product: typing *"Remind me to submit feedback for Karim Adel"* returned "I don't have a grounded answer for that", even though the coverage strip on the same page counts exactly those three pending agents.

**An answer the product can give but the user cannot ask for is a dead end wearing a designed state's clothes** — arguably worse than an obvious failure, because the honest-looking panel implies the data isn't there.

Fixed: rules added for `kpi-heatmap`, `eval-table`, `coaching-rollout`, `coaching-brief`, plus two new topics — `pending-evals` (who still owes an evaluation) and `scorecard-by-name` (an agent named with no other intent). Matcher now passes 20/20 including the regression set.

### A0.2 My Profile reproduced the original review bug verbatim — **FIXED**

`my-profile.html` had received none of the remediation, and its `aiReply` was a four-branch keyword cascade whose first branch matched the bare word `improve` and then answered about **Follow-up Confirmation regardless of the goal asked about**. Three of the four "how do I improve" buttons returned an answer about a goal the agent had not asked about, naming a score that was not the one on screen.

This is the review's §4 failure on a third surface, and more damaging than the original: the answer is addressed to the individual being evaluated, and it tells them their Survey Promotion problem is a Follow-up Confirmation problem.

Fixed alongside the rest of the page — see the "My Profile" section below.

### A0.3 The canvas quoted different numbers than the card — **FIXED**

While rebuilding the profile router I had restated each goal's score in the canvas data. `Issue Resolution` is **82%** on the card and I had written 76%. Rather than correct the constant, the canvas narrative now **joins to `MY_goalS`**, the array the cards themselves render from, so a score can only be stated once. A canvas that contradicts the card it was opened from is its own kind of unbound answer.

---

## A. Found during implementation — not in the review

These are the ones worth reading first. Three of them are more serious than the review recorded.

### A1. `appendAlertDetailCard` and eight sibling renderers were dead, not degraded — **FIXED**

`agent-scorecards.html`, IIFE beginning line ~14429.

The review recorded the alert-detail path as a silent no-op for unmatched ids. It was worse: that IIFE contains **ten references to a bare `thread`** and never declares it. The only declaration is `const thread` inside the canvas IIFE (~13235), which does not reach it. Under `"use strict"` every reference threw `ReferenceError`, so the following never rendered **for any id, matched or not**:

- `appendAlertDetailCard` · `appendNotifAlertCard` · `openAlertsInCanvas`
- the coaching card, the scorecard render, the history entry
- `window.showAiError`

**Fixed** — one `const thread = document.getElementById("overlayThread")` at the top of the IIFE. Phase-1 items 1.1d (alert binding) and 1.5 (error state) both depend on it.

### A2. `ALERT_DATA` and `ALERT_DETAIL_DATA` had *zero* key overlap — **FIXED**

`ALERT_DATA` (~14705) ships ids `score-drop`, `goal-compliance`, `coaching-overdue`, `justify-spike`.
`ALERT_DETAIL_DATA` (~15308) was keyed `sla-breach`, `sentiment`, `quality`.

Not "4 of 7 dead" — **the overlap was zero**. Only `goal-compliance` escaped, via the unrelated `coachingAction:true` branch. Every other notification CTA printed *"Loading … details…"* and then hit `if (!data) return`, leaving whatever card was already on screen reading as the answer. Same failure class as the thread-binding bug, different code path.

**Fixed** — the four real ids are now derived from `ALERT_DATA` itself (summary and evidence read straight off it, so the two surfaces cannot drift), and the unknown-id branch renders the `.ai-unavailable` panel instead of returning silently.

### A3. The keyword router was off by one in two places — **FIXED**

`routeCanvasResponse` (deleted): `isEvalList` returned `STUB_RESPONSES[6]`, which is the **goal bar chart**; `isgoalBar` returned `[7]`, which is the **reviewer calibration table**. So "show me the failed evaluations" answered with a goal breakdown, and "show me the goal breakdown" answered with reviewer calibration — two more mis-bindings on top of the SLA/Quality collision the review reported. Corrected in the topic table.

### A4. A question asked while an answer was rendering was dropped — **FIXED**

`simulateAiResponse` opened with `if (isTyping) return;`. The user's turn stayed in the thread with no reply, ever. That is a dead end (§1.2, "no dead ends") and the same user-visible symptom as an unbound thread, so it is now queued and drained rather than discarded.

### A4b. Queued answers claimed the wrong turn — **FIXED**

Found in final verification, and worth recording because it would have read as a *fixed* binding. Once questions could queue (A4), `env.turn` was still read at render time rather than at ask time, so a queued reply carried whatever `msgCount` had reached by then. Three questions asked in quick succession produced two replies both marked `data-answers="turn-4"` and one turn with no reply pointing at it.

The visible answers were correct — but the attribute a reviewer would use to *verify* the binding was wrong, which is the worse failure of the two. The turn id is now captured when the question is asked and carried through the queue.

### A5. A CSS comment terminated early and swallowed a declaration — **FIXED (mine)**

Introduced by this work and caught in verification: a token-bridge comment containing `--elev-*/` closed the comment at the `*/`, and the parser then discarded the following `--d200` declaration. Worth recording because the failure is invisible in source review — the declaration is right there on the next line — and only shows up as an undefined custom property at runtime.

### A6. `#viewTeam` cannot be deleted without restructuring a guard first — **NOT DONE, deliberately**

The plan called for deleting `#viewTeam` outright: its content is fully superseded by `#supBoard`, and leaving ~7,000 lines of markup alive behind a CSS rule is the artifact that made this review necessary.

It is still hidden rather than deleted, for a specific reason. The view-toggle IIFE opens with:

```js
if (!btnTeam || !paneTeam || !paneEvals) return;
```

and **that same IIFE now owns** `appendAlertDetailCard`, `appendNotifAlertCard`, `openAlertsInCanvas`, the coaching card, the scorecard render and `window.showAiError` — everything repaired in A1 and A2. Removing `#viewTeam` makes `paneTeam` null, the guard returns, and all of it silently stops existing again.

**To finish this properly:** split that IIFE so the toggle logic and the canvas renderers do not share a guard, then delete `#viewTeam`, `#viewAgent`'s dead panels, and the remaining kill-switch selector. Roughly a 7,000-line deletion, and worth doing — but not blind, and not in the same pass that repaired the functions it would have disabled.

What *was* resolved in this pass:

| Region | Outcome |
|---|---|
| `#viewEvals` | **Revived** as a structured destination, off the briefing, reachable from a canvas handoff. Its eight filters now actually filter, with a result count and a real empty state. |
| morning brief + `.mb-since` | **Deleted** (68 lines). Two components named "Since your last visit" was a Level 3 fail; `.slv` is the survivor. The `.morning-brief` CSS is kept because `#agentBrief` reuses the class. |
| 12-week heatmap | **Moved to the canvas.** 72 hand-written `<td>`s became a data array drawn on request. |
| `#viewTeam`, dead `#viewAgent` panels | **Still hidden.** See above. |

### A7. Unterminated comment header — **NOT FIXED**

`agent-scorecards.html:4274`. `/* ══ BLOCK 1: CONFIDENCE INDICATOR COMPONENT ══` has no closing `*/` and merges into the next comment block, absorbing the "MEMORY VISUALIZATION" header. Nothing is lost at runtime — `.memory-panel` still parses — so it is left alone. It sits inside the dead `#viewAgent` region.

---

## A8. Prompt-mode icon diverges from the library — **NEEDS FOLDING BACK**

The library's `#entry-modes` specifies four mode icons: check (direct), magnifier (investigate), **speech bubble (prompt)**, scales (review). On the product surfaces the prompt mode *is* "ask AiMY", so the three pages now render the **AiMY mark** there instead of the bubble — a generic chat glyph on an AiMY surface says less than the mark does, and doctrine §11 already requires `#aimy-logo-small` for the AiMY mark.

Implemented once, by redefining the `#em-ico-prompt` symbol to `<use href="#aimy-logo-small">`, so no call site hardcodes it and a future change is one edit per file.

**This is a divergence from the design system, not a local preference.** Per §11 ("never invent a component that should exist in the design system — flag it"), `#entry-modes` in `design-strategy/index.html` should be updated to match, or the products should be told to revert. Three files currently disagree with the library. Flagged rather than silently left.

## A9. The feedback-loop card left a large void — **FIXED**

`index.html`. Reported from the product: the loop card was mostly empty space.

Cause was mine. `.floop-grid` was `1.7fr 1fr` with the funnel filling the left column; when the funnel moved to the canvas (§1 of the review) the card was left holding a single sentence, and grid items stretch by default, so it grew to match the much taller right column.

Rebalanced rather than just shrunk — `align-items: start` alone would have relocated the void, not removed it. A single sentence should not own 63% of the width *and* a full column:

- loop health became a **full-width horizontal strip** (score, sentence, chips, action on one line — 154px tall)
- "Needs attention" and "Recent loop activity" became **two separate cards** in the columns below. They answer different questions — "what needs me" vs "what moved" — and stacking them in one card is what made it twice the height of its neighbour.

Section height fell from roughly 900px to 610px; largest remaining slack inside any card is 22px. Stacks to one column under 1080px with no horizontal overflow.

## A10. Two toast components for one job — **FIXED**

`agent-scorecards.html` shipped **both** `.aimy-toast` (the design system's `#canvas-toast` — AiMY mark, title, sub, undo, countdown) and a bespoke `#fbToast` bar with a green tick and none of that. Eleven call sites used the bespoke one.

Doctrine §6.2 binds "reversible / completed work" to `.aimy-toast` specifically, and §11 forbids parallel components. `fbToast(msg)` now renders through `showToast`, splitting the message on the existing ` · ` / ` — ` convention into title and sub — a structure those strings already had. The signature is unchanged so all eleven call sites keep working. `#fbToast` markup and CSS retired.

### A10.1 The toast's Undo was decorative on every path but one — **FIXED**

Found while porting. `undoToast()` reverted `lastDismissed`, which is only ever set by the dismiss-a-suggestion flow. Every other toast rendered an Undo button that hid the toast and **did nothing else** — an affordance implying a capability it did not have, which is the same failure class as an unbound answer.

`showToast` now takes an optional `onUndo`. When a caller supplies one the toast offers a real revert; when it does not, the Undo control and its divider are **hidden** rather than left showing.

### A10.2 The first change offered no undo — **FIXED**

Caught in verification. `FEEDBACK_CONFIG` initialised to `{}`, so the first cadence edit had no previous value to revert to and rendered without an Undo, while every later edit had one. Inconsistent in exactly the way that teaches people not to trust the control. The baseline is now seeded from the DOM at init.

## A11. "Save cadence" replaced with autosave — **DONE**

`agent-scorecards.html`, Feedback Manager pane. These are reversible, single-entity settings, which §3.1 puts on **rung 1: act, then toast with Undo** — not an explicit commit step. The button also gave no indication whether anything was unsaved, so the only way to be certain was to press it again.

Now: saves on every change (stepper, dropdown, toggle), debounced at 350ms so dragging a stepper produces one commit and one toast rather than ten; an inline "Saved" confirmation next to the heading; and a toast that **names the field that changed and its new value** ("Acknowledgement nudge updated · Now 4"), with a working Undo that puts the control itself back.

## A12. Section descriptions removed — **DONE**

The six `.fbp-head .sub` lines restated their own headings ("Reminders & escalation limits · you own the cadence for the whole feedback loop"). Removed at the user's direction; the headings carry it.

## A13. A surplus `</div>` pushed the canvas out of the content area — **FIXED**

Reported from the product: the chat input sat in a different place on the Dashboard than on Reviews.

**Mine, introduced by the Director-chart excision.** The cut left one extra `</div>`, which closed `.app-main` about 150 lines early. The browser then reparented both `.aimy-float-wrap` and `.aimy-overlay` onto `.app-body`, so they sized against the whole window instead of the content area.

Two consequences, only one of which was visible:

- the float bar centred on the window rather than the content, **off by 110px** — exactly half the 220px sidebar. That is what was reported.
- **the canvas overlay started at x=0, covering the sidebar.** Doctrine §6.1 is explicit: *"The canvas is a non-blocking overlay inside the agent surface — not a generic modal… The product shell (sidebar, topbar) remains interactive."* The overlay was blocking navigation, which no one had noticed because it looks intentional.

Confirmed against `git show HEAD:index.html` that the original nesting was correct, so this was a regression rather than a pre-existing artifact. One line removed; the float bar and overlay both return to `.app-main`.

**All seven pages verified identical afterwards** — `offBy: 0`, overlay left edge 220px, wrap and overlay both inside `.app-main` on `index`, `agent-scorecards`, `my-profile`, `disputes`, `goal-browser`, `settings`, `data-ingestion`.

**Worth a lint rule.** A stray closing tag produces no console error and no obviously broken layout — the browser silently reparents and the page still looks plausible. This one shifted a primary control and disabled a doctrine guarantee, and was only caught by eye.

## A14. Light mode — **BUILT**, and it forced the token migration

Ported from `design-strategy/index.html:177` per design-system.md §4: token-level overrides only, dark stays default, light is opt-in via `<html data-theme="light">`, persisted to `localStorage['aimy-ds-theme']` and applied **pre-paint** so there is no flash. A toggle sits in the topnav on all three pages.

**The token layer alone was not enough, and that is the finding.** These prototypes were never token-pure, so a `:root[data-theme="light"]` block flipped the tokens and left most of the page dark. Three sweeps were needed:

| Sweep | Count | What it was |
|---|---|---|
| `rgba(255,255,255,α)` → `--wash-1..12` | **801** | Borders, hovers and fills that assumed a dark background. Invisible on white. Bucketed into 12 steps; light values run ~1.25× the dark alpha, the same ratio the design system uses for `--card-border` (white .07 → ink .10). |
| Hex literals → tokens | **156** | Exact matches on a token's dark value — `#8b9aaa` → `var(--d400)`, `#f79009` → `var(--warn)`, etc. A no-op in dark, the whole fix in light. Token definitions, the AiMY logo symbol and gradient stops were excluded. |
| Hardcoded white text → `--text-strong` | **26** | White text that assumed a dark surface. 36 others were **kept white deliberately** — they sit on brand/accent/gradient fills where white is correct in both themes. |

This is the migration excluded from the original scope (register item B1). Light mode could not be built without it, so it was done — but only the mechanically safe part: exact-value matches with protected regions. The remaining literals are ones with no exact token equivalent.

**Contrast audited against the design system's own bar** (§7: ≥3:1 all text, ≥4.5:1 body copy), compositing alpha against the effective background:

| | Light | Dark |
|---|---|---|
| Dashboard (both roles) | **0** | 4 |
| Reviews (both personas) | **0** | — |
| My Profile | **0** | — |

The 4 dark failures are pre-existing (`.sidebar-section-label` 2.51, `.nav-item` on accent 3.77, `.overlay-context-label` 2.51) and were not introduced by this work — worth a separate pass.

**Verification note.** The preview pane caches aggressively and returned stale computed styles after `setAttribute('data-theme')`, which produced three misleading audits before I noticed. The trustworthy method is to set `localStorage` and do a full reload so the pre-paint script applies the theme to a fresh render.

## A15. Light-mode audit and chrome corrections

### A15.1 The wash tokens were self-referential — **FIXED (mine, serious)**

The light-mode pass inserted the twelve dark `--wash-*` definitions **before** running the `rgba(255,255,255,α)` → `var(--wash-N)` swap, so the swap rewrote its own definitions into `--wash-1: var(--wash-1);` — circular, therefore invalid, therefore undefined.

**807 usages across three files resolved to nothing in dark mode.** Every `border`, `background` and `box-shadow` shorthand that referenced one became invalid and was dropped. The visible symptom was the float bar losing its border and elevation; the actual blast radius was every card border and hover wash on all three pages.

Caught only because the border loss was noticed by eye. A classic ordering bug — the transform consumed its own output.

### A15.2 Token audit against the design system — **25/25 exact**

Every light value now matches design-system.md §1 verbatim: the full inverted neutral ramp, `--brand` `--accent` `--teal` `--ai-text`, all four semantic hues, `--body-bg` `--card-bg` `--card-bg-raised`, `--text-strong`. Five tokens the design system defines but the prototypes never had — `--card-border-focus`, `--panel-bg`, `--glass-bg`, `--glass-border`, `--code-bg` — are now declared, with `--code-bg` staying dark in both themes per §4.

### A15.3 Chrome was two floating panels instead of one surface — **FIXED**

The first light pass gave `.app-topnav` and `.app-sidebar` `var(--card-bg)`, which turned them into white panels with visible seams. **Dark keeps both transparent** so the shell reads as one surface with the app. Light now does the same — only the hairline separates them.

### A15.4 Avatars and solid fills lost their white text — **FIXED**

The `#fff` → `--text-strong` sweep kept white only where the *CSS rule* set a brand/gradient background. Avatars set their gradient **inline** (`style="background:{grad}"`), so the heuristic could not see it and swapped their text to near-black on a dark gradient. Eight avatar and chip classes restored, plus the inline-styled ones in `renderSupBoard`.

### A15.5 Dark text on green — **FIXED**

`.ag-act.yes` is `color:#06210f` on `var(--ok)`. That reads well on dark's bright `#17b26a` (6.6:1) but light darkens `--ok` to `#0e9257` for text legibility, dropping it to 3.5:1. The **text** inverts to white in light (3.99:1) rather than the fill changing, so the chip keeps its colour and meaning.

**And a bug in that fix:** the first version also inverted `.ag-act.no` / `.fbt-act.no`, which are *ghost* buttons on a 5% wash — white text made them invisible (1.11:1). Only genuinely solid fills are inverted now. All 13 interactive chips and buttons on Reviews pass.

### A15.6 Other items

- **Phone/calls button removed** from all seven pages, markup and CSS.
- **Tab strip visually centred.** It was `flex:1; justify-content:center`, which centred it in the space *left over* between the logo and the user chip — two different widths, so it never looked centred. Now absolutely positioned at 50% of the bar: measured offset 0.
- **Float bar restored** to its full treatment in light — surface, visible border, elevation and the accent focus ring — rather than the flat white of the first pass.
- **Both-theme contrast fixes:** `.sidebar-section-label` and `.overlay-context-label` used `--d600` (2.51:1), the design system's "faint labels/separators" step, which is not meant to carry 10px text — moved to `--d500`. `.nav-item.active` used `--accent` on an accent tint (3.77 dark / 4.29 light) — moved to `--d50`; the tint and marker still carry "active".

### A15.7 A note on the verification itself

Two things repeatedly produced false readings and are worth knowing before re-running any of this:

1. **The preview pane returns stale computed styles** after `setAttribute('data-theme', …)` in the same call. Every theme measurement must be taken in a *separate* tool call, or after a fresh navigation.
2. **A naive contrast auditor over-reports.** Compositing a decorative full-page gradient blob as the effective background produced 64 phantom failures on a page that has none. Sampling each element against its own resolved background gives the true numbers.

## A16. Buttons inside canvas answers never fired — **FIXED (mine, the worst one)**

`index.html`. The entry-mode listener was bound to `.dashboard-scroll` and guarded with `root.contains(el)`. **The canvas overlay is a sibling of that element, not a descendant** — so every control the canvas *rendered* was outside the listener entirely.

Nothing in an answer worked: "Show the 45 who didn't improve", "Nudge the 21 awaiting", "Break down the two behind", "Approve both sets of fixes", the portfolio-trend switchers, the disambiguation buttons. They looked live, had the right cursor and hover, and did nothing.

It went unnoticed because **the briefing surface worked perfectly** — every audit I ran walked the page, and every page control is inside `.dashboard-scroll`. The gap only shows if you click a button that the canvas drew.

Listener rebound to `document`. Reviews and My Profile were already bound correctly.

### A16.1 Three follow-up topics were never registered — **FIXED**

Same blind spot, different symptom. `loop-stalled`, `loop-nudge` and `csat-negative` are referenced only by buttons the renderers emit, so the dead-end audit — which walked the DOM — never saw them. Even with the listener fixed they would have fallen to the unbound state.

All three now resolve; `loop-nudge` is a proper reviewed action with Accept · Edit · Reject, since nudging 21 people is a write with consequence.

**The lesson for the audit:** walking the DOM is not enough on a surface that renders its own follow-ups. The dead-end check now has to execute each renderer and inspect its output too.

## A17. Filter strip design changed — **REVERTED**

The light-contrast pass replaced two deliberately-muted values with full-strength tokens:

| | Original (dark) | What I changed it to |
|---|---|---|
| `.filter-chip` text | `rgba(255,255,255,0.55)` | `var(--d300)` — brighter, heavier |
| `.filter-tray-label` | `rgba(99,169,255,0.45)` | `var(--ai-text)` — a much stronger blue |

Both were muted on purpose; raising them changed the strip's character. Dark is restored byte-for-byte (chip `rgba(255,255,255,0.55)` on `0.04` fill with `0.08` border, label `rgba(99,169,255,0.45)`), and light gets its own muted equivalents as scoped overrides instead of the dark values being altered.

**General rule this cost me:** when a value is a low alpha, that is usually a design decision, not an oversight. Give the other theme its own muted value; do not raise the original.

## A18. Dark text on green — the second instance — **FIXED**

The earlier fix targeted `.ag-act.yes`. The card in the report was `.fbt-fb.yes` — a different class with the same `color:#06210f` on `var(--ok)` pattern. Fixed the same way (white text in light only). All seven action buttons across both classes now pass: `fbt-fb.yes` 3.99, `ag-act.yes` 3.99, `ag-act.primary` 4.64, the ghost variants 10.9–11.3.

**Note on a false report:** the phone icon appears in the reported screenshot but is absent from all seven files (`grep -c 'topnav-calls'` → 0). That screenshot was a cached render.

## A19. Shell chrome and gradients matched to the design system

### A19.1 Sidebar and topbar — **OVERREACHED, THEN REVERTED**

I read "match the sidebar to the design system" as licence to give the chrome the DS's *surfaces* — `.ds-topbar` (index.html:391) and `.ds-sidebar` (464) are translucent and backdrop-blurred, and the prototypes had them fully transparent. So I applied `rgba(15,18,21,0.88)` + `blur(24px)` to the topnav and `rgba(10,13,17,0.7)` + `blur(12px)` to the sidebar, added a border-right, widened `--sidebar-width` 220→240px, and gave light its own chrome overrides.

**That was not what was asked**, and it was reverted on all seven pages. The ask was the *active-item treatment*, not the panels. What is in place now:

| | State |
|---|---|
| `.app-topnav`, `.app-sidebar` | `background: transparent`, no `backdrop-filter` — the original |
| sidebar `border-right` | removed |
| light-mode chrome overrides | removed |
| `--sidebar-width` | back to `220px` |

Verified computing to `rgba(0, 0, 0, 0)` with `backdrop-filter: none` on all seven pages.

**Nav items only** were aligned to `.ds-nav-link` (design-strategy/index.html:483) — active colour `var(--qa-accent)` on `--qa-accent-dim` with a `0.22` border, and `0.12em` label tracking on `.ds-nav-label`. Consistent across all seven pages.

The lesson is the narrower one: "match X to the design system" is an instruction about the thing named, not permission to re-derive everything the DS says about its neighbourhood.

### A19.2 Background gradients

The design system ships `--grad-avatar`, `--grad-ellipse-1` and `--grad-ellipse-2` (index.html:84-86). The prototypes hand-rolled their own ellipses at different alphas (`0.24/0.15/0.09` vs the DS `0.18/0.1`). Now tokenised and pointed at the DS values verbatim.

**Light has no DS variant** — at dark alphas the ellipses read as coloured haze on `#f4f6f9`. Same hues at roughly a third of the alpha; marked in the code as derived, not quoted.

### A19.3 Float-bar mark in light

`.aimy-float-icon` is a dark navy-to-purple puck (`#3d1f6b → #1a3a6e → #163b5e`) built for a dark bar. On a white bar it reads as a heavy hole punched in the input. Light gets a pale accent wash instead, and the brand-gradient logo carries the colour.

### A19.4 The toast had no light treatment — **FIXED**

Found by the audit after the chrome change. `.aimy-toast` is dark glass (`rgba(22,30,42,0.82)`), so in light its title, sub and Undo all sat at 1.6–1.9:1. Given a light surface with the design system's own border and elevation.

### A19.5 Same missing-definition trap, caught this time

The ellipse tokenisation initially wrote `var(--grad-ellipse-*)` into all seven pages but only *defined* the tokens on the three with light mode — the other four would have lost their background entirely. Caught by a definitions-vs-uses check before it shipped. **This is the third time in this workstream that a token was referenced before it was defined** (`--wash-*` circular, `--wash-*` missing on four pages, now the gradients). Worth a build-time check: every `var(--x)` must have a matching definition.

### A19.6 One knowingly-left contrast item

`.filter-tray-label` sits at 2.49:1 in dark. That is the **original design value** (`rgba(99,169,255,0.45)`), restored deliberately at your request after I had raised it. Left as-is; noting it so it is a decision on record rather than an oversight.

---

## A20. Nine "Approve…" buttons that never offered a decision — **FIXED (the biggest one left)**

Found while re-verifying after the chrome revert. Of the **11** review-mode actions on the Dashboard, only **2** (the HR meeting and its reschedule) rendered a decision zone. The other nine — every one labelled *Approve…*, *Confirm…* or *Rebalance…* — opened the canvas and returned **prose asserting the work was already done**:

> "SLA compliance is at 61%… **I've already applied the response-time fix** across the 8 affected agents… **Undo it below** if you'd rather I hold."

Three separate failures in one reply:

1. **This is review item 3 all over again**, inside the canvas rather than on the briefing. The card underneath read `staged · awaiting you`; the button asked for approval; the answer said it was finished. Three surfaces, three different truths.
2. **A rung-1 reply behind a rung-3 label.** "Undo it below" is act-then-undo (§3.1 rung 1). Applying a fix to 8 agents is multi-entity and cross-team — rung 3, explicit accept plus audit.
3. **"Undo it below" pointed at nothing.** There was no undo control in the message. A dead reference in copy is a §1.2 dead end.

**Fixed** by keeping the diagnosis — which is genuinely what makes the decision informed — and replacing the completion claim with a real decision zone. Same markup, same `[data-hr-decision]` handler as the HR meeting, so there is one reviewed-action pattern on the page rather than two.

To do that the handler had to stop being about Omar. Its copy (accepted wording, audit line, reject-reason label, edit fields, undo wording) now comes off the zone as `data-dz-*`, and **every default is the existing HR string** — the HR zone carries none of those attributes and behaves exactly as before. Verified: 0 `data-dz` attributes on it, prompt and buttons unchanged.

Each `.dz-consequence` answers the three questions §1.3 requires — *when it takes effect · what it does not touch · how reversible*:

> Takes effect on their next ticket: first-response target moves to **30 minutes** and the 23 breached tickets are re-queued by wait time. Does not change their scores, their evaluations or their coaching plans. Reversible for 24 hours; after that, reverting needs a new request.

**Result: 11/11 review-mode actions now land on a decision, 0 on prose.**

### A20.1 Two Accept buttons — **FIXED**

Pre-existing in the HR flow, but it only showed once so it went unnoticed; with ten more zones it would have shipped ten times. Clicking **Edit** turned the Edit button into "Accept with these changes" and left the original **Accept** sitting next to it — one of which silently discards the edits just made. The plain Accept is now removed on entering edit mode, and Undo restores it.

### A20.2 Accepting changed the canvas but not the briefing — **FIXED**

`applyOutcome` finds the owning card by `[data-aimy-item="<topic>"]`, because a reviewed action resolves *inside* the canvas and has no element to walk up from. **Eight of the nine cards were never tagged**, so accepting left the briefing still asking for a decision the user had just made — precisely the failure §1.4 exists to prevent.

Rather than hand-place nine attributes that can drift, the tag is now derived at boot from the review buttons themselves, so a new reviewed action cannot be added without its card being wired. The opener's signal chips are excluded deliberately — they point *at* the cards below, they are not the card that owns the work.

### A20.3 An accepted decision walked the ladder instead of landing — **FIXED**

`NEXT_STATE` advances one rung, which is right for a direct action but wrong for a settled decision. Accepting the 6 coaching plans moved the card `drafted → staged` while the canvas said "6 coaching plans sent" — the same contradiction one layer down. An accepted or edited reviewed action now lands on `completed` whatever rung it started from; direct actions keep the one-step advance.

### A20.4 The billing card claimed *Completed* and then asked permission — **FIXED**

`index.html` action row read `Completed · 26 tickets reassigned` above a button reading **"Confirm the 26 reassignments"**. Moving 26 tickets across teams is multi-entity and cross-team — rung 3 — so the honest state before the decision is `staged`. Now `Staged · 26 tickets ready to reassign · protocol reviewed`.

---

## A20.5 The canvas render CSS was never ported to the Dashboard — **FIXED**

Reported from a screenshot: the AiMY mark inside `Reviewed action · HR meeting` looked wrong sitting next to the message avatar.

Two causes, and the second was the real one:

1. **The mark was stated twice.** The message already carries the AiMY avatar beside the bubble; the type label repeated the same mark ~40px later. Removed from the label in both files — **5 in `index.html`, 12 in `agent-scorecards.html`**. The avatar is the thing that says who is speaking; the label says what kind of answer it is.

2. **`index.html` had no canvas CSS at all.** `.canvas-render`, `.canvas-type-label` and `.canvas-action-row` are defined in `agent-scorecards.html` (4415 / 4499 / 4507) and **none of them existed on the Dashboard**. So the label — designed as a 9px uppercase 700-weight badge — rendered as full-size mixed-case body text, and the 14×15 mark drew at its raw attribute size next to it. That is what the screenshot showed. Every canvas render added to the Dashboard in this workstream was affected: all 9 new decision zones and all 12 chart renders, **25 labels in total**.

Ported verbatim. Verified: 25/25 labels compute to `9px / 700 / uppercase`, 0 marks inside labels, 0 empty labels, `.canvas-render` at its 720px max-width, one AiMY mark per message, consoles clean on both pages.

The `.canvas-type-label svg` sizing rule was kept even though nothing uses it now — it is the guard that would have prevented this, and it costs one line.

**This is the same class of bug as A19.5**: markup shipped to a page that never had the CSS it depends on. Third occurrence counting the token cases. A definitions-vs-uses check would catch all of them — for classes as well as tokens.

---

## A22. The theme toggle and the navbar, on all seven pages — **DONE**

The toggle existed on three pages. Putting it on the other four meant porting the light theme with it — a toggle that sets `data-theme="light"` on a page with no light rules is a broken button, not a feature. Everything is lifted verbatim from `index.html` rather than retyped, so the seven cannot drift.

Ported to `disputes.html`, `goal-browser.html`, `settings.html`, `data-ingestion.html`: pre-paint boot script, the light token block, the toggle's markup / CSS / behaviour, the centred tab strip and its spacers, and the 2–3 tokens the toggle needs in dark (`--wash-3`, `--wash-6`, `--t-fast`).

**The navbar now matches across all seven**: same tab strip absolutely centred on the bar (all seven measure 0px off centre), same toggle in the same position at the head of the right-hand cluster, same `.ds-nav-link` active treatment, no phone icon.

### A22.1 The toggle revealed that light was only token-deep

Light mode worked at token level immediately, and every page's own components were still built for a dark card. `goal-browser.html` measured **18 failing classes, the worst at 1.05:1** — text and surface collapsed onto each other.

Three causes, in the order they were found, each fixed by generating **light-only overrides** so dark comes out byte-identical:

| Pass | What it found | Rules |
|---|---|---|
| Text | Hardcoded white/near-white text, restated at the same weight from the ramp | 29 |
| **Surfaces** | **Hardcoded dark panels** that never inverted — the dominant cause | **557** |
| Brand hues | A token's *dark* value hardcoded as text (mostly `#61adf1`, the dark `--ai-text`) | 75 |
| By hand | 9 items needing a judgement the rules could not make | 9 |

The first pass barely moved the numbers, which was the useful signal: the text was mostly *right*, and it was the surfaces underneath that stayed dark. Worth remembering — the obvious reading of "white text is invisible on white" was the wrong end of the problem.

The surface mapping goes by luminance rank rather than flattening everything to white, so a page's panel depth ordering survives the inversion. The hue mapping works by value identity — a colour that *equals* a dark token's value is restated as `var(--that-token)`, inheriting whatever the design system already decided that token becomes under light rather than inventing a second opinion.

**Result — light, fresh load per page:** disputes **0** failures, settings **1**, data-ingestion **1**, goal-browser **1** — and the one is `.nav-item.active`, the design system's own `--accent`, which clears the DS's ≥3:1 UI bar (A19.6).

**Dark is provably untouched:** all **670** generated rules are `:root[data-theme="light"]`-scoped, verified mechanically. The only unscoped changes are the boot script, three new token definitions with no prior uses, the tab centring and the toggle element itself.

### A22.2 Pre-existing dark contrast on goal-browser — **FLAGGED, not fixed**

A fresh dark load of `goal-browser.html` shows **12 failing classes**, worst 1.96 (`.goal-dropdown-trigger span`), the rest muted labels at 2.35–2.61 (`.tpl-updated`, `.kdo-section-label`, `.template-section-label`, `.editor-section-title`, `.sidebar-section-label`). These predate this work and are not reachable by a light-scoped rule. Fixing them means editing dark, which is a separate decision.

### A22.3 Two silent failures in my own tooling

Both caught by verifying content instead of trusting a script's log — worth recording because both would have shipped:

1. **`settings.html` closes its `<style>` with no indentation**, so the insert matched nothing and did nothing, while the script still printed success. The page had a toggle and no light theme.
2. **The boot snippet was extracted from its leading comment**, which sits *inside* the `<script>` element — so the opening tag was left behind and the JS landed as raw text in `<head>`, with a stray `</script>` after it. The toggle worked, but the theme silently failed to persist across navigation. Found by testing the actual crossing rather than the button.

Both are the same lesson as A19.5/A20.5: **a log line is not verification.** Every check in this pass now asserts on file content and on computed style.

### A22.4 `--ease-out` was used and never defined — **FIXED**

Turned up by the definitions-vs-uses check while sizing this work. `index.html` referenced `var(--ease-out)` in two animations (`snapBarGrow`, `adcBarGrow`) without defining it, so both silently fell back to the default `ease`. Restored from `agent-scorecards.html:69` / `settings.html:96`, which both define it identically.

The check now runs across all seven pages: **0 undefined tokens**.

---

## A23. Descriptions, light contrast, icons, shadows — **DONE**

### A23.1 Descriptions under headings — removed

Removed the line under a **page or section/card heading** that describes the section: 4 on the Dashboard, 7 on Reviews, 9 on Settings, 2 on Goal Hub, 1 each on Disputes and Data Ingestion — **24 in total**.

**Kept** the lines that describe an *individual item or control* rather than orienting you inside a section: template descriptions (`.tpl-card-desc`, 12 of them), toggle-row explanations (`.set-row-desc`), integration options (`.add-int-desc`), modal subtitles (`.modal-sub`). Those carry information the card exists to convey; the ones removed only restated the heading at greater length. If you want those gone too, it is the same one-line change per class.

Two of the removed elements were written to by JS (`.v2-subtitle`, `.page-subtitle`); both call sites are null-guarded, verified before removing.

### A23.2 The tinted chips were sitting on the 3:1 floor — **FIXED**

`.work-state` and `.entry-action` are hue-tinted pills — a 10–15% fill of the same hue as the text. On a dark card the fill pushes the background *away* from the text. On white it pushes *toward* it, so the pair converged:

| | Before | After |
|---|---|---|
| `.ws-completed` | 3.23 | **5.33** |
| `.ws-detected` | 3.35 | **5.01** |
| `.em-prompt` | 3.68 | **7.12** |
| `.em-review` / `.ws-staged` | 3.74 | **5.62** |

Technically passing the UI bar the whole time, and visibly weak — which is what the screenshot showed. The semantic hues are darkened a further step **for these pills only**, so the headline numbers using the same tokens keep their weight.

### A23.3 My contrast auditor had a blind spot — this is why it never caught them

Every earlier audit reported the Dashboard at ~1 failure in light while these chips sat at 3.2. The auditor bailed out on **any** gradient anywhere in an element's ancestor chain, and the Dashboard has a decorative gradient near the root — so a large share of the page was silently skipped and counted as passing.

The bail-out exists for a real case: white text on a brand-gradient avatar cannot be measured against a flat colour. But it has to be scoped to *that* case. It now bails only when a gradient is reached **before any opaque layer** — a decorative gradient behind an opaque card is irrelevant.

**A silent skip that reports as a pass is worse than no check.** Three earlier "0 failures in light" claims were partly this. The corrected auditor puts the Dashboard at 1 in light (the DS accent on `.nav-item.active`), both roles.

### A23.4 Icons

- **The Refresh glyph was clipped by its own viewBox.** Paths span 0.5–10.5 with a 1.2 stroke, so the circle extended to 11.1 inside a `0 0 11 11` box and was shaved flat left and right. Widened to `-1 -1 13 13`. *(My first pass matched that viewBox string globally and also shrank a healthy trend chevron on the Dashboard — reverted; the match should have been on the path, not the box.)*
- **The view toggle read inside-out.** `.goal-view-btn.active` uses `var(--d700)` — one step *toward* the foreground on dark, a lifted chip in a near-black track. The ramp inverts, so on light the same token became a mid grey and the selected segment came out **heavier than the track around it**. On light the selected segment is now the raised white one, with a hairline shadow doing the lifting.
- **White hairline borders stayed white.** `rgba(255,255,255,a)` is the lit edge of a raised panel; on white it is invisible, so panels lost their edge and controls their outline. **482 rules** across the four ported pages inverted to the same-strength dark hairline. The three main pages needed none — their white alphas were already `--wash-*` tokens, which invert correctly. That is the argument for the token scale in one line.

### A23.5 Harsh shadows in light — **FIXED**

Cards carried `rgba(0,0,0,0.45)` and `0.40` — tuned to register against a near-black canvas. On white that is a grey halo rather than an elevation cue. **158 shadows** across all seven pages softened toward the values `.aimy-toast` and `.aimy-float-bar` already used in light (0.10–0.16), which were the existing reference rather than a new invention. Max alpha on the Dashboard is now **0.14**, down from 0.45, and the colour is `rgba(16,24,40,·)` rather than pure black.

### A23.6 Black overlays became milky slabs

`rgba(0,0,0,a)` as a *background* is a recess — a segmented-control track sunk into a panel. The surfaces pass in A22 read it as "a dark panel" and inverted it to a white overlay, which on a light page is the grey slab in the screenshot. A recess on white is a faint dark tint, so the alpha now carries across and the colour does not. **70 rules** across seven pages.

### A23.7 Two faults in my own tooling, again

- The CSS scanner pushed `@keyframes` onto its at-rule stack but still yielded the percentage steps inside as selectors, emitting `:root[data-theme="light"] 100% { … }`. Invalid, therefore inert, but dead text — **12 removed**.
- My verification script split on `</style>` and counted `<div>`s in only part of the document, reporting a 4-tag imbalance on the Dashboard that did not exist. Whole-file balance is 407/407, identical to the pre-change backup. **The checker was wrong, not the file** — worth recording, because a false alarm in a verification tool costs the same trust as a missed one.

---

## A21. Light mode stops at the page boundary — **NOW CLOSED by A22**

Only `index.html`, `agent-scorecards.html` and `my-profile.html` have a light theme (46 light rules, theme boot, toggle). `disputes.html`, `goal-browser.html` and `settings.html` have **none** — no light block, no boot script, no toggle. Switching to light on the Dashboard and then navigating to Disputes lands on a dark page.

It is not *broken* — those pages never read the stored theme, so they never apply a light attribute they can't honour. But it is a visible seam, and it follows from the agreed scope (Dashboard + Reviews, extended to My Profile at your request) rather than from any decision about those pages.

`data-ingestion.html` is the odd one: it carries 4 `:root[data-theme="light"]` rules but no theme boot, so they can never activate. Dead CSS.

**Rough cost to close:** the light block is ~46 rules and the boot script is ~10 lines, both already written and portable verbatim. Per page it is a copy plus a contrast pass.

---

**Final state — Dashboard, both roles, both themes:** 11/11 reviewed actions land on a decision; 0 unclassified actions; 0 dead-end topics; 0 `transition: all`; 0 occurrences of "canvas" in user-visible copy; tabs centred at 0px; float bar centred at 0px; consoles clean.

Contrast: 3 items in dark, 1 in light, all UI text measured against a body-text bar and all clearing the design system's own ≥3:1 for UI text (§7) — `.nav-item.active` at 3.26 dark / 3.68 light is the DS's own `--accent` on `--accent-dim` and renders identically in `design-strategy/index.html`; `.filter-tray-label` at 2.49 is the original value restored at your request (A19.6); the resume pill's `×` at 3.10 is a glyph, not prose.

## B. Tokens and theme

1. **Hardcoded hex literals** — 212 occurrences in `index.html`, 380 in `agent-scorecards.html` (63 / 85 unique). Not migrated; out of the agreed scope.
2. **Stale `--qa-accent` comment** — `index.html:37–39` asserts the token is a placeholder that *"must be swapped to QA-specific magenta before v2 ships."* **Doctrine §6.3 has retracted that flag**: accents are global, there is one `--accent` token re-themed per product, and there is nothing QA-specific to swap. The comment now contradicts the locked spec. Flagged, not edited — the token bridge aliases `--accent` onto it rather than renaming.
3. **`--d200`** was referenced in both prototypes and defined in neither. Supplied by the token bridge. The doctrine states it is defined, which is true of the design system and was false of the prototypes.
4. **Light mode is unverified.** Neither file has a `[data-theme="light"]` root, so the design system's light overrides (`design-strategy/index.html:2993–3025`) are inert and were deliberately not ported. Level 7 gap.

## C. Dead and duplicated code

5. **`.aimy-done-badge`** — `index.html`, zero usages. A parallel one-off for exactly `.work-state`'s job; removed as a Level 3 parallel-component fail.
6. **`window.showAiError`** — defined once, referenced nowhere but its own definition, and threw when called (see A1). Now wired to the renderer-throws path.
7. **`STUB_RESPONSES` indices 2 and 5 were unreachable**; index 8 was reachable only through the rotating fallback. All are now bound to named topics — index 2 answers "why is quality dropping", which is the question the old router sent to a chart.
8. **Two components named "Since your last visit"** — `.slv` and `.mb-since`. Resolved in 1.6 by deleting `.mb-since`.
9. **A third persona with no button** — `setPersona` handles `'employee'` and `renderEmpInbox` exists, but `.persona-switch` has only Supervisor and Feedback Manager.
10. **The 8 `#viewEvals` filters are inert chrome** — they dispatch a bubbling `v2-select` that only `rosterDd` and the new-feedback picker listen for. No code hides or shows a row. Addressed in 1.7.

## D. Doctrine §11 "Never" violations left in place

11. **`onclick=""` string attributes** — 28 in `index.html`, 188 in `agent-scorecards.html`. Roughly 40 converted on classified actions; the remainder logged. Beyond tidiness: inline handlers are blocked by a strict CSP, so this markup cannot ship into a CSP-enforcing product as-is.
12. **`transition: all`** — one per file. Fixed in Phase 3.
13. **`border-left:`** — 1 in `index.html`, 9 in `agent-scorecards.html`. Decorative stripes to be separated from structural uses.
14. **A native `<select>` created in JS** — `agent-scorecards.html`, `dismiss-reason-select`. Invisible to a markup grep. `.v2-dropdown` is the system's only select control; this one carries none of its keyboard model or ARIA. Logged, not fixed.

## E. Broken references and find/replace damage

15. **`goal-browser.html` does not exist.** The sidebar links to it from both in-scope pages; the file is `kpi-browser.html`.
16. **`justifys.html` does not exist.** `index.html` `RECORD_LINKS` points at it; the file is `disputes.html`.
17. **Global "KPI"→"goal" and "dispute"→"justify" substitution damage.** Identifiers (`isgoalBar`, `behavgoalCard`, `.disp-goal-chip`, `renderjustifyQueue`, `LOOP_LABEL.justifyd`) and **user-visible copy**: *"1 justify is waiting on you"*, *"2 justifys past SLA"*, *"justify overturned"*. Out-of-scope files are also affected — `disputes.html` is titled "AiMY QA — justifys" and `kpi-browser.html` "AiMY QA — goal Browser". This needs a deliberate pass; it is not safe to blanket-reverse, since some "goal" occurrences are genuine.
18. **`QA/design-doc.html` is a stale copy of the component library** — it resolves 1 of the 24 doctrine anchors. `design-strategy/index.html` is the real one. It should be re-synced or deleted before someone reads it as the source of truth.
19. **The `.slv` sentence numbers are hardcoded prose**, derived from no data structure, in both the Reviews original and the Dashboard port. They will go stale silently.
