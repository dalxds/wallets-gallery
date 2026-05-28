# Exploration Reference

How the skill walks an app during initial capture. Covers Tier 1/2/3 fallback, fingerprint-keyed BFS, decision points, scroll handling, and hang recovery.

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
agent-device screenshot {staging}/{NNN}.png
# READ the screenshot image to understand what's there
agent-device find "Sign In" click               # text-matching, separate engine from snapshot
agent-device find label "Email" fill "user@example.com"
agent-device find role button click             # role-based when label ambiguous
```

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
   capture screen + advance
```

## Fingerprint-keyed BFS

The core exploration loop.

### Per-screen capture routine

At every screen, **always in this order**:

```bash
# 1. PRIMARY — snapshot first. This is how the agent understands the screen.
agent-device snapshot -i --json > /tmp/snap.json

# 2. Check sufficiency. Count interactive elements, scan for labels, validate against screen.
#    If insufficient (see Tier 1→2 triggers above), proceed in Tier 2 for this screen.

# 3. SECONDARY — screenshot. Evidence only. Used for:
#    - Reading screen content WHEN snapshot is insufficient (Tier 2)
#    - Final visual record for capture.json (every screen, regardless of tier)
agent-device screenshot {staging}/{NNN}.png

# 4. MANDATORY — compute fingerprint NOW and record it in the staging log.
#    sha256 of sorted (role, label) pairs from interactive elements.
#    If Tier 2/3 (no usable snapshot), compute "sha256-text:" fingerprint from texts.
#    NEVER defer this to packaging — compute and store per screen, immediately.
```

**Never skip step 1.** Even when you suspect a screen will be hostile to snapshots (loading screen, animation-heavy onboarding), try snapshot first. If it returns useful structure, you stay in Tier 1.

**Never skip step 4.** Fingerprints are mandatory at capture time. Storing `null` and "computing later" is a known failure mode — the agent forgets and writes a null-fingerprint capture. Compute immediately, store in the staging log, propagate to `capture.json` at packaging.

The fingerprint = `sha256` of sorted `(role, label)` pairs from the interactive nodes in the snapshot. Cheap, deterministic, stable across minor UI changes. In Tier 2/3 where the snapshot is empty/missing, derive a fallback fingerprint from extracted screenshot text — prefix `sha256-text:` so downstream code can distinguish. See [references/temporal.md](temporal.md) → Fingerprints for the exact algorithm and fallback rules.

### The loop

```
1. Compute fingerprint of current screen.
2. If fingerprint already in seen[] → backtrack (we've cycled).
3. Else: capture screenshot + save snapshot to assets/ by content hash.
   Extract texts, interactive elements, infer role, propose title and primary CTA.
   Add fingerprint to seen[].
4. Enumerate interactive elements as candidate next actions.
   Sort by priority (see below).
5. Decision point if ≥2 unfollowed candidates remain. In guided mode, present
   options + screenshot to user; wait. In free-roam, pick top-priority unexplored.
6. Tap the chosen element. Re-snapshot. Compute new fingerprint.
7. If new fingerprint → recurse from step 1.
8. If old fingerprint → action didn't transition; mark element as non-navigational
   and try the next candidate.
9. Backtracking: agent-device back. Re-snapshot. Verify fingerprint matches parent.
   If not, agent-device open {pkg} --relaunch and replay the captured .ad chain
   up to the parent.
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

At every screen with ≥2 unfollowed interactive elements, record a decision point:

```
Decision Point at {screen-id}: N options available

  1. {label} — {description from snapshot}
  2. {label} — {description from snapshot}
  ...

Which paths should I capture? (numbers, "all", or "skip")
```

In **guided mode**, present to the user and wait. The user picks specific numbers, says "all", or "skip". The agent records every option in `decisionPoints[].options[]` regardless of whether explored.

In **free-roam mode**, the agent picks top-priority unexplored automatically and records its choices.

**IMPORTANT: Decision points apply recursively.** Every new screen with multiple options is a decision point — not just the first. Explore in depth, not just breadth.

**Test interactivity before presenting options.** Try one click first. If interaction hangs, switch to Tier 3 and ask the user which path directly. Don't enumerate 16 options you can't follow.

### Stopping criteria

The BFS terminates when ANY of:

- **Screen budget**: default 100 unique fingerprints per app. Configurable.
- **Saturation**: 5 consecutive screen visits add 0 new fingerprints.
- **Per-flow budget**: 20 steps per flow before terminating that branch.
- **Auth wall**: screen requires credentials we don't have → ask user.
- **Sensitive action gate**: send money, sign transaction, delete account → ask user.
- **Cycle**: re-encountering only previously-seen fingerprints 3 times in a row from the same parent.
- **Hang detection**: 2+ consecutive Tier 1/2 hangs on the same screen → escalate to Tier 3 (and record the screen as animation-blocked).
- **User says stop**.

## Scroll handling

When a screen has a scrollable list of homogeneous items:

- **DO scroll** during exploration to understand the full content.
- **DO NOT package scroll states** as separate screens or flow steps if the scrolled content is just more of the same type.
- Instead, capture one representative view of the list, then pick an item to enter its detail screen.
- **DO package scroll states** when scrolling reveals meaningfully different content (a new section, different UI elements, a footer with actions).

The fingerprint will differ slightly between scrolled positions because labels change. Treat fingerprints from scroll states as variants of the same screen ID; pick the most representative one for packaging.

## Staging during exploration

```bash
# Sequential numbering in flat staging area
mkdir -p {OUTPUT_DIR}/{app-slug}/_staging
agent-device screenshot {OUTPUT_DIR}/{app-slug}/_staging/{NNN}.png
```

Keep a running log of what was done at each step. The log is in-memory during exploration; written out as a sidecar during packaging:

- Step number (NNN)
- Fingerprint
- Screen-id (assigned)
- Action taken (what was pressed/filled/scrolled)
- Snapshot path (in assets/, content-hashed)
- What changed (from diff snapshot)

The agent-device session's `--save-script` is also accumulating an authoritative master `.ad` file in `_staging/`. This is the source for per-flow `.ad` extraction during packaging.

## Recovery from hangs and failures

Some screens prevent the runner from reaching idle (continuous animations, live tickers, loaders). Commands timeout, run to background indefinitely, or fail with `COMMAND_FAILED: Daemon request timed out`.

1. **Detect** — a command hangs (runs to background), times out, or fails.
2. **Don't retry the same action.** The screen is likely still blocking.
3. **Reopen session first** — `agent-device open {pkg} --device "{device}"`. Reconnects without killing the daemon. Often restores functionality.
4. **Avoid killing the daemon.** `pkill -9 -f agent-device` destroys the XCTest/UIAutomator runner build cache and makes recovery harder. Last resort only.
5. **Never** `pkill -9 -f xcodebuild` or kill platform-specific runner processes directly.
6. **If reopen doesn't help** — the screen likely has continuous animations (Tier 3). Ask the user to navigate away from the blocking screen, then reopen and continue.
7. **Queue for retry** — add the failed screen to a retry list. After all other exploration is complete, attempt these screens again. The app state may have changed or animations may have settled.
8. **If retry also fails** — record it as unexplored in the decision point data. Do not block the rest of the capture.

**After any kill/restart:** always `agent-device open {pkg} --device "{device}"` before any other command. Without an active session, all commands fail with `SESSION_NOT_FOUND`.

**IMPORTANT: One device, one session.** Never spawn background agents or subagents that drive the device in parallel. Hung subagents also hold the device — kill them too.

## Packaging (after exploration)

After exploration is complete, use the saved snapshots (not just screenshots) to group screens into flows and build the JSON output.

### Save unique screens

For each unique fingerprint encountered:

```bash
# Screenshot already exists in assets/ if we used content-addressing during staging.
# If staged with sequential NNN names, move to assets/{hash}.png.
```

The screenshot's content hash is computed from its bytes. Same-bytes = same hash = stored once.

### Assign screen IDs

For each unique fingerprint, assign a stable **screen-id** (lowercase, dashes, e.g. `home`, `deposit-source-picker`, `send-token-select`). Reuse the same screen-id when the same fingerprint appears in different flows.

Decide the screen-id from the snapshot content (page identifier, dominant text, screen structure), not from screenshots.

### Build flows

**Every captured screen must belong to at least one flow.** Flows describe user tasks (e.g. "Buying a token", "Sending money", "Getting verified"). There should be no orphan screens. A screen can naturally appear in multiple flows when journeys overlap.

**Flow naming: gerund + object.** Name every flow as a user action in gerund form: "Buying a token", "Sending a token", "Switching to dark mode" — NOT "Deposit", "Send", "Display Settings". Each name should answer "what is the user doing?" in natural language.

Exception: top-level navigation flows are named after the navigation label itself: "Wallet", "Discover", "Settings". These represent "being in" that section of the app.

**Flow hierarchy is recursive and entry-point driven.** A flow's `parent` field describes where its entry screen comes from:

- **Top-level flows** (`parent: null`): one per primary navigation item (tab bar, drawer, bottom nav). The entry screen is the navigation tap landing screen. Plus "Onboarding" for pre-auth flows.
- **Child flows**: their entry screen is a screen that already appears within the parent flow. The child represents one specific action reachable from that screen.
- **Grandchild flows**: their entry screen appears within a child flow. Nesting can go 3+ levels deep.

Each level's entry point IS a screen in the level above. This makes the tree mirror the app's actual navigation depth.

**Split at decision points.** When a screen offers multiple branches (`decisionPoints` data records this), do NOT bundle all branches into one linear flow. Instead:

1. The parent flow ends at the decision-point screen.
2. Each explored branch becomes a separate child flow.
3. Each child flow's steps repeat the path to the decision-point screen, then add the branch-specific steps.

Example — a "Deposit" screen has options for token-selector and payment-method:
- ❌ One flow with steps: Home → Deposit → Token Selector → Payment Method (bundled, linear)
- ✓ Three flows:
  - "Buying a token" (parent): Home → Deposit
  - "Selecting a coin" (child): Home → Deposit → Token Selector
  - "Selecting a payment method" (child): Home → Deposit → Payment Method

This produces a tree that matches the app's branching IA, and each leaf flow is individually linkable as a focused user task.

**No state-variant flows.** Do not create separate flows for the same action in different app states (empty wallet vs. funded wallet, free vs. premium). Capture the primary variant as the main flow. If the state difference produces materially different screens (different CTAs, different steps), capture both as sibling flows with descriptive names: "Trading a token (funded)" and "Trading a token (no funds)".

**Flow granularity:** every distinct sub-action the user can take from within a flow should ideally be its own child flow. "Selecting a coin" is a separate flow from "Buying a token", nested as a child. Do not create child flows for trivial interactions (dismissing a modal, scrolling).

### Harden `.ad` files

The master `.ad` recorded via `--save-script` contains `@eN` refs. These are text-resolved on replay and unstable. During packaging, harden them:

1. Read each `@eN` ref's saved snapshot context.
2. Find the corresponding interactive element.
3. Pick the most stable selector: `id=` first, then `label=`+`role=` combination, then `text=`. Last resort: position-based selectors (avoid).
4. Replace `@eN` with the chosen selector in the `.ad` step.
5. Templatize literal credential values: `{{EMAIL}}`, `{{PASSWORD}}`, `{{OTP}}`, `{{SEED_PHRASE}}`, `{{SMS_CODE}}`. Record present placeholders in `flow.replay.credentialsTemplate`.
6. Write the per-flow `.ad` to `{date}/{slug}.ad`.

Confidence rating in `flow.replay.confidence`:
- `high`: all steps use `id=` or unique `label=`.
- `medium`: some steps use `label=` with potentially-duplicate labels.
- `low`: any step relies on `text=` only, or coordinate-based.

### Compute entry fingerprints

For each flow, compute `replay.entryFingerprint` = the fingerprint of the entry screen's snapshot. Used to verify replay landed on the right screen before walking.

### Build `changes` array

If `previousCapture` is not null, diff against the prior capture's screens + flows and populate `changes`. See [temporal.md](temporal.md).

### Write capture.json

Assemble screens + flows + decisionPoints + changes + stats.

**Pre-write validation is MANDATORY.** Run the validator before any disk write:

```bash
# Write to a temp file first
echo "$capture_json" > {capture_dir}/capture.json.tmp

# Validate
node {SKILL_DIR}/scripts/validate-capture.mjs {capture_dir}/capture.json.tmp
# Exit code 0 = pass; non-zero = fail with details on stderr

# Only if validation passes:
mv {capture_dir}/capture.json.tmp {capture_dir}/capture.json
```

The validator enforces every rule in [schema.md](schema.md) → Schema enforcement. Common failures and fixes:

| Failure | Fix |
|---|---|
| Unknown top-level key `X` | Remove the key. If you need this data, surface a schema-extension request to the user. |
| `screens[i].fingerprint` is null | Compute it from `interactiveElements`. |
| `steps[i].fingerprintBefore/After` is null | Use the relevant screen's fingerprint. |
| Empty-string selector | Set to `null` if no usable selector, or pick a real one. |
| `flows[i].steps[j].screenId` not in `screens[]` | Add the screen or fix the reference. |
| `flows[i].replay.path` file missing | Run the deliberate replay pass to generate the `.ad` file. |
| `_humanEdited` lists a field not on the entity | Remove the stale entry. |

**Never write a capture that fails validation.** If you can't fix the issues yourself, surface them to the user.

Write atomically (tmp file + rename) to avoid corruption on crash.

## Guidance

- **Snapshot first, always.** Every screen begins with `agent-device snapshot -i --json`. Only fall back to screenshot reading when the snapshot is insufficient (0 interactive elements, suspiciously thin tree, mismatched labels, or repeated hangs). Re-test snapshot on every new screen — escalation is per-screen, not per-session.
- Save snapshot data during exploration so it can be written to content-addressed assets during packaging.
- Use `diff snapshot -i` after every action to detect what changed before describing the transition.
- Re-snapshot after every navigation/modal/transition before using refs.
- Assign screen IDs from fingerprints, not labels. Reuse the same screen ID across flows when fingerprints match.
- Name flows based on user intent ("Send money") not technical paths ("transfer-screen-2").
- Every screen must belong to at least one flow. No orphans.
- At decision points, always enumerate ALL options and present to the user (guided) or record choices (free-roam). Do this at every new screen with options, not just the first.
- Scroll lists to understand content; don't package homogeneous scroll states as separate screens or flow steps.
- When a command hangs or fails, go back to the last known working screen. Queue the failed screen for retry at the end.
- One phone, one session. Never spawn parallel agents/subagents driving the device concurrently.
- After any process kill or restart, always `agent-device open {pkg} --device "{device}"` before any other command.
- Prefer reopen over kill. Only `pkill -9` as last resort.
- Escalate to Tier 3 promptly. If 2 consecutive commands hang on the same screen, stop retrying and ask the user to navigate.
- Test interactivity before presenting decision points. Try one click before listing 16 options you can't follow.
- Every flow starts from a reachable screen. Step 1 shows how the user gets there.
- Capture generously during exploration; be selective during packaging.
- Flows tell a story: someone reading the flow + screenshots should understand what the app does without having the app open.
