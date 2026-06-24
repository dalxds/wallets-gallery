# Exploration Reference

How the skill walks an app during initial capture and **records raw observation** into `_staging/walk.json` (`nodes` + `edges` + `decisionPoints`). Covers Tier 1/2/3 fallback, fingerprint-keyed BFS, recording nodes/edges, decision points, scroll handling, and hang recovery. The identity signals, flow tree, screen states, and replay are derived later — see [Assemble + Package](#assemble--package).

## Interaction tiers

**Rule: every screen starts at Tier 1. Snapshot first, always.** Escalate only when the snapshot is insufficient or commands hang. Re-test snapshot on the next screen — escalation is per-screen, not per-session.

### Tier 1 — Snapshot + click (DEFAULT, try first on every screen)

Snapshot returns useful structure, `click`/`find` work. Agent drives autonomously.

```bash
agent-device snapshot -i --json > /tmp/snap.json   # PRIMARY — try this first, every time
agent-device screenshot {staging}/{NNN}.png         # visual evidence — secondary
agent-device click @e3                              # or click 'id="..."' / 'label="..."'
agent-device diff snapshot -i                       # see what changed after the action
```

**Tier 1 succeeds when ALL of:**
- `snapshot -i --json` returns ≥1 interactive element.
- The returned elements plausibly match what's visible (labels overlap with screenshot text).
- `click` or `find` on a snapshot-derived target transitions the screen (or has the expected effect).

If Tier 1 succeeds, **stay in Tier 1 for that screen**. Do not fall back preemptively.

### Tier 2 — Screenshot + find (snapshot fallback)

Escalate to Tier 2 when the snapshot is insufficient. **Specific triggers:**

- `snapshot -i --json` returns **0 interactive elements**.
- Snapshot tree has interactive elements but **all labels are empty strings** or generic placeholders (e.g. `_view_0`, `_view_1`).
- Snapshot labels **don't match what's on screen** (verify by comparing snapshot labels against the screenshot — e.g. snapshot shows "OK / Cancel" but screen shows a wallet balance).
- `snapshot -i` hangs or times out **twice** on the same screen (after a `agent-device open` reattach attempt).

When any trigger fires, fall back for that screen only:

```bash
agent-device screenshot {staging}/{NNN}.png          # FULL-RES — never downscale (see below)
# Do NOT read this image yourself. Hand the file path to a sub-agent (the "vision oracle");
# it reads the image in its own context and returns a navigable text report. Then act on it:
agent-device find "Continue" click                   # preferred: exact label the oracle saw
agent-device find role button label "Email" fill ... # role+label when text is ambiguous
agent-device click <x> <y>                           # fallback: the oracle's center coords
```

#### Tier-2 vision oracle (sub-agent)

The main agent **never reads a screenshot into its own context.** Those bytes carry over into every subsequent call, and once several accumulate they trip the API's many-image pixel ceiling — so that *no* image can be read just when a sensitive screen needs one. Delegate the *look* instead:

- **Main agent owns the device.** It takes the screenshot and performs every tap/`fill`. The sub-agent is **file-only**: it reads the PNG from disk and reports — it never runs `agent-device`. This keeps "one device, one session" intact (no concurrent driver).
- **Read full-res, never downscale.** A single-image read isn't subject to the many-image cap, so fidelity is free — and, crucially, the oracle's coordinates are only directly tappable if they're in the screenshot's native pixel space. Downscaling shifts every coordinate.

**The report must be navigable, not just descriptive** — the main agent has to turn it into `agent-device` calls. Require, for every interactive element:

| Field | Why the main agent needs it |
|---|---|
| `label` — exact visible text, verbatim (or `(icon: <what it depicts>)` if none) | drives `agent-device find "<label>" click` — the resilient path when the snapshot is poor |
| `role` — button / input / tab / toggle / link / icon | role-based `find`; understanding the screen |
| `center: [x, y]` — screenshot pixels, top-left origin | the **coordinate fallback** `agent-device click x y` — the only option for icon-only elements or when `find` misses |
| `bbox: [x, y, w, h]` | disambiguate overlapping targets; tap a sub-region |
| `state` — disabled / selected (omit if normal) | don't tap a disabled CTA; read toggle/tab state |
| `hasText: false` (when no text) | tells the main agent it MUST use coords, not `find` |

Plus once per screen: `screen` (one-line role + purpose) and `imageSize: [W, H]`. Optionally pass the snapshot's claimed labels and ask the oracle to confirm/correct them.

**Coordinate space.** On Android, screenshot pixels == device tap units, so `center` is usable as-is with `agent-device click x y`. On **iOS**, screenshot *pixels* ≠ tap *points* (2×/3× Retina) — scale before tapping: `tap = center × (devicePointSize / imageSize)`. That's why the oracle echoes `imageSize`; pair it with `agent-device`'s reported device size (or `adb shell wm size` on Android) to verify the mapping.

**Main-agent navigation order** with the report: (1) `find "<label>" click`; (2) `find role <r> label "<label>"` if the label repeats; (3) `agent-device click <center.x> <center.y>` when there's no text or `find` misses. For inputs: tap the field (coords or `find`), then `type`/`fill`.

Sub-agent prompt template:

> Read the PNG at `{path}` — a full-res {platform} screen capture. Return ONLY structured data, no prose. `screen:` <what screen this is + its role>. `elements:` for each tappable/interactive element — `label` (exact visible text, or `(icon: …)` if none), `role`, `center:[x,y]` and `bbox:[x,y,w,h]` in the image's own pixels (top-left origin), `state` if disabled/selected, `hasText:false` if it has no text. `imageSize:[W,H]`. [If snapshot labels supplied: `snapshotCheck:` which of these are right / wrong / missing.] All coordinates MUST be in the image's own pixel space.

If `find` returns `AMBIGUOUS_MATCH` (e.g. icon + label both match), narrow with role-based selectors (`role=button label="..."`) before falling back to coordinate-based taps.

**On the next screen, return to Tier 1.** Try `snapshot -i --json` again. The new screen may have rich snapshots even if the previous didn't (common in apps with mixed-rendering screens — native auth, Flutter dashboard, native settings).

### Tier 3 — User-assisted navigation (screenshot-only)

Escalate to Tier 3 when both snapshot AND interaction commands fail. **Specific triggers:**

- `snapshot -i` hangs **AND** `click`/`find` also hangs on the same screen.
- Tier 2 has been attempted and `find` returns no matches for any visible element.
- 2 consecutive hangs on the same screen after a session reopen.

Workflow:

1. Ask the user to tap a specific button/element on the device.
2. Wait for user confirmation ("done", "tapped").
3. Take a screenshot to capture the result.
4. Ask for the next tap.

Tier 3 is a productive mode, not a failure state. Many apps have animated screens that block the runner; Tier 3 keeps the capture moving.

Mark animation-blocked screens in the staging log so re-encountering them later skips re-attempting Tier 1/2.

Secure screens (FLAG_SECURE → an all-black screenshot) are not an interaction tier — they're a guardrail. Detection + the host-screenshot fallback live in **SKILL.md → Critical guardrails → "Secure screens"**.

### Per-screen escalation flow

```
NEW SCREEN
  │
  ▼
┌─────────────────────────────┐
│ Tier 1: snapshot -i --json  │
│ snapshot succeeds + matches?│
└──────────────┬──────────────┘
               │
       yes ────┴──── no / hangs / mismatch
       │                    │
       │                    ▼
       │     ┌─────────────────────────────────┐
       │     │ Tier 2: screenshot + find       │
       │     │ Reopen session, try once more.  │
       │     │ Still no? read screenshot,      │
       │     │ use find with text.             │
       │     └──────────────┬──────────────────┘
       │                    │
       │            works ──┴── still hangs/no match
       │            │              │
       │            │              ▼
       │            │  ┌──────────────────────────┐
       │            │  │ Tier 3: ask user to tap  │
       │            │  │ screenshot after each    │
       │            │  └──────────────────────────┘
       │            │
       ▼            ▼
   record node + edge, advance
```

## Fingerprint-keyed BFS

The core exploration loop. Every screen becomes a **node** in `_staging/walk.json`; every tap that changes the screen becomes an **edge**. You record observation faithfully — you do not compute signals, classify states, or build flows (assemble + the packager do, see [Assemble + Package](#assemble--package)).

### Per-screen capture routine — record a NODE

At every screen, **always in this order**:

```bash
# 1. PRIMARY — snapshot first. This is how the agent understands the screen.
agent-device snapshot -i --json > /tmp/snap.json

# 2. Check sufficiency. Count interactive elements, scan for labels, validate against screen.
#    If insufficient (see Tier 1→2 triggers above), proceed in Tier 2 for this screen.

# 3. SECONDARY — screenshot to a SEQUENTIAL staging path. Evidence + the input to pHash.
#    SAVE it; do NOT read it into context. pHash is computed from this file on disk by
#    assemble.ts — you never view it for that. On Tier-2 insufficiency, delegate the read to a
#    sub-agent (vision oracle, below); the main agent never reads the image itself.
agent-device screenshot {staging}/{NNN}.png
agent-device snapshot -i --json > {staging}/{NNN}.snap.json   # save the raw snapshot too (or skip in Tier 2/3)
```

This is the single most common way to exhaust the session image budget: reading every `{NNN}.png` "to verify." Don't. The snapshot is your understanding of the screen; the PNG is an artifact for pHash and the View.

Then append a **raw node** to `walk.json` `nodes[]` (shape: [schema.md](schema.md) → walk.json). You record observation only — **no hashes, no `assets/` paths**; `assemble.ts` computes the three identity hashes (fingerprint/skeleton/pHash) and content-addresses the staging shot/snap:

- `id` — stable slug from snapshot content (page identifier, dominant text, structure), e.g. `home`, `deposit-source-picker`. Reuse the same id when you re-encounter the same screen.
- `role` — one of `home`/`list`/`picker`/`form`/`confirmation`/`auth`/`modal`/`settings`/`error`/`other`.
- `shot`, `snap` — the staging paths you just wrote (`{staging}/{NNN}.png` / `.snap.json`); `snap` is `null` in Tier 2/3.
- `texts`, `interactiveElements` — observed content. Tag the screen's main call-to-action inline on its element with `emphasis: "primary"` (`"secondary"` for a notable alternate); there is no separate CTA field.

**You do not compute `fingerprint`, `skeletonHash`, or `pHash`.** assemble derives them from what you recorded — fingerprint from `interactiveElements` (or `texts` in Tier 2/3), skeleton from structure, pHash from the staged shot. What they *mean*: [temporal.md](temporal.md) → Identity signals. (This is also why a null/garbage fingerprint can't happen any more — the old failure mode of "compute later, forget" is gone.)

**Never skip step 1.** Even on a screen you expect to be hostile to snapshots (loader, animation-heavy onboarding), try snapshot first. If it returns useful structure, you stay in Tier 1.

### Per-tap routine — record an EDGE

Every tap that changes the screen is an edge appended to `walk.json` `edges[]`:

```json
{ "from": "trade", "to": "trade-max", "action": "Tap \"Max\"", "selector": "label=\"Max\"" }
```

- `from` / `to` — node ids of the pre-tap and post-tap screens.
- `action` — human-readable, e.g. `Tap "Max"`.
- `selector` — the selector you tapped, or `null`/omit (never `""`).
- `observedAtStep` — optional; defaults to walk order.
- `kind` — **usually omit.** You don't have skeleton hashes at walk time, so `assemble.ts` finalizes `in-place` vs `nav` from skeleton equality (the deterministic state-toggle signal). Record `kind` **only** for the two cases skeletons can't detect:

| `kind` | When |
|---|---|
| `back` | Back-navigation — `agent-device back`, or a tap that returns to a prior screen. |
| `overlay` | A modal/sheet was pushed over the prior screen. |

| Derived by assemble | When |
|---|---|
| `in-place` | from/to share a `skeletonHash` (same logical screen, only data/condition changed — e.g. a "Max" amount). Drives on-step state toggles. |
| `nav` | from/to skeletons differ. |

If assemble's derived `nav`/`in-place` is ever wrong (two genuinely-different screens that happen to share a skeleton), force them apart with `overrides.splits` — don't fight it in `walk.json`.

### The loop

```
1. Snapshot the current screen. Recognize it: is this a screen you've already recorded?
   (Judge from its content — the interactive elements + texts — not from a hash; assemble
   computes hashes later. Keep a running map of {screen you've seen → its node id}.)
2. If already seen → record the edge into the existing node id; backtrack (cycled).
3. Else: append a NODE to walk.json (save shot + snap to {staging}/{NNN}; record id, role,
   texts, interactiveElements). Add it to your seen-map.
4. Enumerate interactive elements as candidate next actions. Sort by priority (below).
5. Decision point if ≥2 unfollowed candidates remain. In guided mode, present options +
   screenshot to user; wait. In free-roam, pick top-priority unexplored.
6. Tap the chosen element. Re-snapshot.
7. Record an EDGE (from, to, action, selector; add kind only for back/overlay).
8. If the new screen is new → recurse from step 1. If it's the same as the pre-tap screen,
   the tap was non-navigational (record no edge); try the next candidate.
9. Backtracking: agent-device back. Re-snapshot. Verify you're back on the parent.
   If not, agent-device open {pkg} --relaunch and replay the captured .ad chain to the parent.
```

### Candidate priority for interactive elements

When sorting candidates from a screen's interactive elements:

1. Primary CTAs (centered, large, contrast-y per snapshot hints + button role).
2. Tab bar / bottom nav items.
3. Top app bar buttons (back, search, menu, overflow).
4. List items (sample the first one to enter a list's detail; don't iterate the whole list).
5. Links / text buttons.
6. Overflow menu items (last — usually settings or rarely used).

### Decision points

At every screen with ≥2 unfollowed interactive elements, record a decision point in `graph.decisionPoints[]` (shape: `DecisionPoint`):

```
Decision Point at {node-id}: N options available

  1. {label} — {description from snapshot}
  2. {label} — {description from snapshot}
  ...

Which paths should I capture? (numbers, "all", or "skip")
```

In **guided mode**, present to the user and wait. The user picks specific numbers, says "all", or "skip". Record every option in `decisionPoints[].options[]` regardless of whether explored, with `{label, explored, toNode?}` — set `toNode` to the node id an option leads to once known.

In **free-roam mode**, the agent picks top-priority unexplored automatically and records its choices.

**IMPORTANT: Decision points apply recursively.** Every new screen with multiple options is a decision point — not just the first. Explore in depth, not just breadth.

**IMPORTANT: a fork becomes sibling flows only if you *walk* ≥2 of its branches — recording an option isn't enough to create one.** The packager (`segment`) builds the flow tree so that a screen becomes a **fork** when ≥2 distinct onward journeys are reachable only by going *through* it, and turns each into a child flow rooted at that screen. The tree is built from the nav/overlay **edges you actually walked** — so an option you record but never tap creates no edge, no branch, no flow, and walking only one option at a real fork collapses what should be siblings into one linear trunk. Your recorded `decisionPoints` aren't inert, though: **their option order now sets the order of the sibling child flows** — so record options in the order you want them to read.

Tell the kinds of multi-option screen apart:

| At this screen… | Walk | Result |
| --- | --- | --- |
| **Divergent fork** — distinct journeys (`Bank` vs `Crypto` payee; `Sign in` vs `Create account`; send-to-contact vs send-to-address) | **each** branch, to a natural endpoint (leaf / confirmation / back to a hub) | each becomes a **sibling child flow** rooted at the fork screen |
| **Homogeneous list** — many like items (tokens, contacts, transactions) | **one** representative | same-skeleton rows merge, and the packager collapses same-family detail screens to a single exemplar — extra rows add no flows |

- **Walk each branch to its endpoint, not one tap in.** A branch abandoned after one tap still becomes a flow — just a thin, half-told one. Branch-walk quality = flow quality.
- **A return-to-launcher sheet is NOT a fork.** If an option just opens a picker/peek/info sheet that pops back (no onward journey of its own), the packager treats it as an *excursion* and weaves it in as an inline **picker step** of its launcher's flow. Still capture it (tap it, record the node + the return edge) — but don't count it as a branch or expect a child flow from it.
- **Cover each fork's branches once — not every permutation.** Flows nest as a *tree*: the path *to* a fork is shared by all its children (the fork screen is the parent's last step and step 1 of each child), so return to the fork and take the next option — never re-walk the prefix or take the cartesian product of choices across forks. Coverage is additive in branches, not multiplicative.
- **Can't walk a branch** (auth gate, sensitive action, budget)? Record it in `decisionPoints[].options[]` with `explored: false` — it surfaces in the view as "branches here — not explored," but yields no flow.

**Test interactivity before presenting options.** Try one click first. If interaction hangs, switch to Tier 3 and ask the user which path directly. Don't enumerate 16 options you can't follow.

### Stopping criteria

The BFS terminates when ANY of:

- **Screen budget**: default 100 unique fingerprints per app. Configurable.
- **Saturation**: 5 consecutive screen visits add 0 new fingerprints.
- **Per-flow budget**: 20 steps along one branch before terminating it.
- **Auth wall**: screen requires credentials we don't have → ask user.
- **Sensitive action gate**: send money, sign transaction, delete account → ask user.
- **Cycle**: re-encountering only previously-seen fingerprints 3 times in a row from the same parent.
- **Hang detection**: 2+ consecutive Tier 1/2 hangs on the same screen → escalate to Tier 3 (and record the screen as animation-blocked).
- **User says stop**.

## Scroll handling

When a screen has a scrollable list of homogeneous items:

- **DO scroll** during exploration to understand the full content.
- **DO NOT record scroll positions** as separate nodes if the scrolled content is just more of the same type — they share a `skeletonHash` and the packager would merge them anyway.
- Instead, record one representative node for the list, then pick an item to enter its detail screen.
- **DO record a node** when scrolling reveals meaningfully different content (a new section, different UI elements, a footer with actions).

The fingerprint differs slightly between scrolled positions because labels change; the `skeletonHash` does not. Record the most representative position.

## Staging during exploration

```bash
# Sequential numbering in flat staging area; assemble.ts content-addresses these into assets/
mkdir -p {OUTPUT_DIR}/{app-slug}/_staging
agent-device screenshot {OUTPUT_DIR}/{app-slug}/_staging/{NNN}.png
agent-device snapshot -i --json > {OUTPUT_DIR}/{app-slug}/_staging/{NNN}.snap.json
```

`_staging/walk.json` is the artifact you build up as you go — append a raw node (referencing `{NNN}.png`/`.snap.json`) per screen and an edge per tap. It's the single input to `assemble.ts`. Keep its fields to raw observation only (id, role, texts, interactiveElements, shot/snap paths; edges; decisionPoints) — if a field doesn't map to the walk.json schema, it doesn't belong.

The agent-device session's `--save-script` accumulates an authoritative `master.ad` in `_staging/`. This is the source the packager uses to harden edge selectors and emit replay — see [temporal.md](temporal.md) → `.ad` mechanics.

## Recovery from hangs and failures

Some screens prevent the runner from reaching idle (continuous animations, live tickers, loaders). Commands timeout, run to background indefinitely, or fail with `COMMAND_FAILED: Daemon request timed out`.

1. **Detect** — a command hangs (runs to background), times out, or fails.
2. **Don't retry the same action.** The screen is likely still blocking.
3. **Reopen session first** — `agent-device open {pkg} --device "{device}"`. Reconnects without killing the daemon. Often restores functionality.
4. **Avoid killing the daemon.** `pkill -9 -f agent-device` destroys the XCTest/UIAutomator runner build cache and makes recovery harder. Last resort only.
5. **Never** `pkill -9 -f xcodebuild` or kill platform-specific runner processes directly.
6. **If reopen doesn't help** — the screen likely has continuous animations (Tier 3). Ask the user to navigate away from the blocking screen, then reopen and continue.
7. **Queue for retry** — add the failed screen to a retry list. After all other exploration is complete, attempt these screens again. The app state may have changed or animations may have settled.
8. **If retry also fails** — record it as an unexplored option in the decision-point data. Do not block the rest of the capture.

**After any kill/restart:** always `agent-device open {pkg} --device "{device}"` before any other command. Without an active session, all commands fail with `SESSION_NOT_FOUND`.

**IMPORTANT: One device, one session.** Never spawn background agents or subagents that drive the device in parallel. Hung subagents also hold the device — kill them too.

### Main navigation → `mainNav`

A persistent primary navigation — a bottom-tab bar, nav rail, or drawer shown across the app's top-level screens — defines its top-level sections. Record the node id each nav item lands on in the walk-level `mainNav` array, e.g. `"mainNav": ["home", "search", "profile"]`. The packager makes each one a **top-level flow that roots its own subtree** instead of nesting it under whatever screen you tapped it from (a peer section, not a child of Home).

- Record the node a nav item navigates TO — the section's landing screen in the state you first reach it — and include the home/default tab too.
- Optional: omit `mainNav` for apps with no persistent main navigation (pure onboarding, a single linear tool). Absence changes nothing about the derivation.
- A typo'd id fails validation in `assemble.ts` (it refuses to write), so you catch it immediately.

## Assemble + Package

After exploration you have a complete `_staging/walk.json` (raw `nodes` + `edges` + `decisionPoints` + `root` + optional `mainNav` + `meta`). Two deterministic steps turn it into the derived view — you hand-build none of it:

```bash
node scripts/assemble.ts _staging/walk.json {date}/graph.json   # 1. signals + assets + validate → graph.json
node scripts/package.ts {date}/graph.json                       # 2. derive flows/states/tree/replay
```

**Assemble** computes the four identity signals (fingerprint/skeleton via the engine, pHash from each staged shot), content-addresses the staging shots/snaps into `assets/`, finalizes each edge's `in-place`/`nav` kind from skeleton equality, validates, and writes `graph.json` (refusing to write on a validation error). **Package** validates again and derives the `View`: merges duplicate nodes, clusters logical screens, classifies states (`in-place` edges become on-step toggles), segments the flow tree, and emits inline replay — printing the flow tree, stats, and a **`namingTODO`** list.

**Fill in names.** For each entry in `namingTODO`, add a name to `overrides.flowNames["<flow-id>"]` in `graph.json` (gerund + object for actions — `Buying a token`; plain noun for sections/details — `Settings`, `Token detail`). A flow's id is its anchor node id. Re-run `package.ts` until `namingTODO` is empty or acceptable. To correct anything else the packager derived (a screen's role, a flow's parent, a wrong merge), use `overrides` and re-run — never hand-edit the derived output. See [editing.md](editing.md).

## Guidance

- **Snapshot first, always.** Every screen begins with `agent-device snapshot -i --json`. Only fall back to screenshot reading when the snapshot is insufficient. Re-test snapshot on every new screen — escalation is per-screen, not per-session.
- **Record edges, not just nodes.** Every tap that changes the screen is an edge `(from, to, action, selector)` in walk.json. Add `kind` only for `back`/`overlay`; assemble derives `in-place`/`nav`.
- **Don't compute identity signals.** Record raw observation; `assemble.ts` derives fingerprint/skeleton/pHash. A null fingerprint can't happen any more.
- Use `diff snapshot -i` after every action to detect what changed before describing the transition.
- Re-snapshot after every navigation/modal/transition before using refs.
- Assign node ids from snapshot content, not labels. Reuse the same id across the walk when you recognize the same screen.
- At decision points, enumerate ALL options and present (guided) or record choices (free-roam) — at every new screen with options, not just the first.
- Scroll lists to understand content; don't record homogeneous scroll positions as separate nodes.
- When a command hangs or fails, go back to the last known working screen. Queue the failed screen for retry at the end.
- One phone, one session. Never spawn parallel agents/subagents driving the device concurrently.
- After any process kill or restart, always `agent-device open {pkg} --device "{device}"` before any other command. Prefer reopen over kill; `pkill -9` is a last resort.
- Escalate to Tier 3 promptly. If 2 consecutive commands hang on the same screen, stop retrying and ask the user to navigate.
- Capture generously during exploration; the packager is selective when it derives the view.
- **Don't build flows or classify states by hand.** Record the graph; run the packager.
