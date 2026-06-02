# App Capture (agent-device)

Explore mobile apps on Android emulators or iPhone devices, capture screens and flows as structured JSON, re-capture flows or full apps over time with diff tracking, and edit captured data conversationally.

## Navigation hierarchy — snapshot-first, always

The skill **MUST** try snapshots first on every screen. Screenshots are visual evidence only — never the primary source of understanding.

```
1. agent-device snapshot -i --json    ← ALWAYS first, every screen
2. If snapshot is insufficient:        ← see detection rules below
     agent-device screenshot {path}    ← read the image to understand
     agent-device find "<text>" click  ← interact via text matching
3. If both fail:                       ← Tier 3
     ask the user to tap, then screenshot the result
```

**"Insufficient snapshot" detection** — fall back to screenshot only when ANY of these are true:

- The snapshot returns 0 interactive elements.
- The snapshot tree is suspiciously thin (e.g. one generic container with no labels or roles).
- The snapshot has interactive elements but none of them match what's visually on screen (verify by comparing snapshot labels against the screenshot).
- `agent-device snapshot -i` hangs or times out twice on the same screen.

**Default: snapshot.** Falling back to screenshot-only navigation is a per-screen, per-action escalation — not a session-wide mode. Even within one app, some screens have rich snapshots and others don't. Re-test snapshot on every new screen.

Full detection ladder + Tier 1/2/3 semantics: [references/exploration.md](references/exploration.md).

## Commands this skill handles

| User request | What the skill does |
|---|---|
| "Capture {app}" (first time) | Full BFS exploration. Writes `{date}/capture.json` + assets. See workflow §1. |
| "Recapture {app}" / "Recapture full" | Walk known flows, re-explore. Writes a new `{date}/capture.json` carrying forward unchanged data with a `changes` block. See workflow §2. |
| "Recapture flow {slug} of {app}" | Replay the named flow's `.ad`, walk it, diff. Writes a new full `capture.json` for the date. See workflow §3. |
| "List flows for {app}" | Read latest `capture.json`, print flows + entry points + last-captured date. No device interaction. |
| "Change/rename/annotate {X} in {app}" | Ambient edit — load latest `capture.json`, mutate, cascade references, stamp `_humanEdited`. See [references/editing.md](references/editing.md). |
| "Show me {screen/flow} of {app}" | Read query — find entity in latest `capture.json`, present screenshot + summary. |

If the user gives enough context to start, begin immediately. Ask only when a required detail is missing.

## Setup

| Parameter | Default | Override |
|---|---|---|
| **Target app** | _(required)_ | Bundle id (`com.acme.bank`), app name, or deep link URL |
| **Platform** | inferred from target | `--platform android` or `--platform ios` |
| **Device** | auto-detected | `--device {avd-name}`, `--serial {emulator-5554}`, `--udid {ios-udid}` |
| **Output dir** | `./public/captures/` | `Output dir: /tmp/captures` |
| **Scope** | full app | `Focus on swap flows`, `Just onboarding` |
| **Exploration mode** | `guided` | `free-roam` or `guided` |

Per-platform setup details: [references/android.md](references/android.md), [references/ios.md](references/ios.md).

## Output structure

```
{OUTPUT_DIR}/{app-slug}/
  app.json                          # manifest: metadata + capture index + latest pointer
  credentials.md                    # auth details, gitignored
  assets/                           # content-addressed binaries, deduped across captures
    {sha256-12char}.png
    {sha256-12char}.snap.json
  {YYYY-MM-DD}/
    capture.json                    # full self-contained snapshot of the app at this date
    {flow-slug}.ad                  # one .ad replay script per flow, selector-hardened
  _staging/                         # working dir during capture, gitignored
    master.ad
```

**Canonical model: per-capture, copy-forward.** Every `capture.json` is a complete app snapshot — never a partial diff. Re-captures (even flow-scoped) write a new complete `capture.json` that carries unchanged screens/flows forward verbatim and replaces only what was re-walked. Schemas: [references/schema.md](references/schema.md).

## Mandatory at session start

**Every `agent-device open` MUST include `--save-script`.** No exceptions. Without it, the master `.ad` file never gets written, no per-flow replay scripts can be extracted during packaging, and every future re-capture of this app falls back to LLM-walk mode (slower, non-deterministic, drift-prone). This is the single most common way to ruin a capture.

```bash
# REQUIRED form of every open call during capture
agent-device open {pkg} --platform {p} --relaunch \
  --save-script {OUTPUT_DIR}/{app-slug}/_staging/master.ad
```

### Pre-flight checks (run before any interaction)

1. **`--save-script` is in the `open` command.** Re-read your own command before sending. If absent, abort and re-open.
2. **Staging dir exists.** `mkdir -p {OUTPUT_DIR}/{app-slug}/_staging` before opening.
3. **Session is active.** `agent-device session list --json` shows the session. If `SESSION_NOT_FOUND` later, the master `.ad` is gone — see recovery below.
4. **App is foregrounded.** `agent-device appstate --json` shows the right package/bundle.

### If `--save-script` was missed mid-session

The master `.ad` is unrecoverable for steps already taken. Two recovery paths:

- **Stop and restart with `--save-script`**, then re-walk what you already did. Pay the time cost now while the app is fresh in mind.
- **Finish exploring without it**, then in the Package step do a deliberate replay pass: re-open with `--save-script`, walk each captured flow using the step descriptions and selectors from your in-memory log, and harden the resulting `.ad`. This is slower and validates selectors as a side effect — useful but expensive.

Either way, **do not** ship a capture with no `.ad` files. Generate them before writing the final `capture.json`.

### If the session crashes and you reopen without `--save-script`

Same as above — restart with `--save-script` or plan a deliberate replay pass at packaging time.

## Workflow

### 1. Initial capture

```
1. Initialize   Resolve app slug. Ensure output dirs (mkdir -p {OUTPUT_DIR}/{app-slug}/_staging).
                Load or create credentials.md.
2. Launch       MUST include --save-script. See "Mandatory at session start" above.
                agent-device open {pkg} --platform {p} --relaunch \
                  --save-script {OUTPUT_DIR}/{app-slug}/_staging/master.ad
                Then run pre-flight checks: session list, appstate, snapshot.
3. Explore      Fingerprint-keyed BFS. Snapshot + screenshot every screen. Decision points at branches.
4. Package      a. Verify {staging}/master.ad exists and has content.
                b. Group screens into a flow TREE (references/exploration.md → Build flows).
                   Promote any distinct screen/functionality (pickers, detail/info screens) to
                   its own flow — do not bury it as a step. Pick one primary app state as the
                   spine; surface other states only as the entry of the flow that reaches them
                   or as parenthetical variant siblings — never as hand-waved adjacent steps.
                   State variants get distinct screen IDs (home-empty, home-funded) in ONE
                   screens[] array. No new top-level keys.
                c. Harden each flow's .ad (resolve @eN → stable selectors). Forbid empty
                   selectors — use a real selector or null.
                d. Compute fingerprint for every screen. Compute fingerprintBefore/After
                   for every step. No nulls allowed at write time.
                e. PRE-WRITE VALIDATION (mandatory):
                   - Run scripts/validate-capture.mjs against the in-memory capture.
                   - All keys are in the schema (no screens_funded, no comment-strings).
                   - All fingerprints are non-null.
                   - No empty-string selectors.
                   - All cross-references resolve (screenId, flowSlug, replay.path).
                   - If validation fails: fix the issues. Never write a broken capture.
                f. Write capture.json + assets atomically (tmp + rename).
                If master.ad is missing/empty: do a deliberate replay pass before step e.
5. Wrap up      Update credentials.md if changed. Update app.json manifest. Close session.
```

Details: [references/exploration.md](references/exploration.md). Validation: [references/schema.md](references/schema.md) → Schema enforcement.

### 2. Full re-capture

```
1. Initialize   Read latest capture.json. Load credentials.md.
2. Launch       Same as initial.
3. Walk known   Replay each known flow's .ad with fingerprint verification.
                On divergence: fall back to LLM-driven walk (re-snapshot, find best matching element, tap).
                Capture new state, compute fingerprints.
4. Explore new  After known flows finish, BFS from entry points where new interactive elements appeared.
5. Diff         Compare new state to prior capture's screens + flows.
                Build the `changes` array.
6. Carry forward Copy unchanged screens/flows verbatim from prior capture.json into new capture.json.
                Preserve _humanEdited fields.
7. Package + write New capture.json. New {flow}.ad files (re-hardened or copied from prior).
```

Re-capture decision ladder for each flow:
1. `agent-device replay {flow}.ad` against the verified entry fingerprint.
2. If a step fails or post-step fingerprint diverges: `agent-device replay -u {flow}.ad` to auto-repair drifted selectors.
3. If `-u` can't repair: LLM-driven walk using `FlowStep.description` + previous `selector` as hints. Re-snapshot at each step; pick best matching element; tap; verify.
4. If even that diverges: ask the user.

Details: [references/temporal.md](references/temporal.md).

### 3. Flow re-capture

Same as full re-capture but limited scope:
- Replay only the named flow.
- Don't explore beyond it unless the flow extends past its prior terminal step.
- All other screens/flows in the new `capture.json` are copied forward verbatim from the prior capture.
- `scope: "flow"`, `flowsRecaptured: ["{slug}"]` in the new capture.json.

### 4. Ambient edit

Triggered by edit-shaped requests during conversation. See [references/editing.md](references/editing.md).

The skill recognizes:
- Renames (cascade across all references).
- Field edits (title, description, role, notes, summary, primaryCta override).
- Decision-point annotations (mark `explored` flags, attach `flowSlug`).
- Flow restructuring (parent, entryPoints).

Every chat-edit stamps `_humanEdited` on the affected fields. Re-captures preserve them.

## Critical guardrails

- **`--save-script` is mandatory on every `agent-device open`.** Without it, no `.ad` replay scripts can be generated — every future re-capture falls back to LLM-walk mode. Confirm the flag is in the command before sending. See "Mandatory at session start" above.
- **NEVER invent new top-level keys.** The schema in [references/schema.md](references/schema.md) is the contract. Adding fields like `screens_funded`, `fundedScreens`, `notes_extra`, or comment-as-string hacks is a hard violation. If you need to model something the schema doesn't cover (state variants, capture context, custom tags), STOP and ask the user about a schema extension. Never silently add.
- **Run pre-write validation.** Before any `capture.json` write, run `scripts/validate-capture.mjs` (or perform the equivalent in-line checks). If it fails, do not write — fix the issues or ask the user. Specifics in workflow §4 and [references/schema.md](references/schema.md) → Schema enforcement.
- **Fingerprints are mandatory.** Every `screens[].fingerprint`, every `steps[].fingerprintBefore`, every `steps[].fingerprintAfter` must be non-null at write time. Computed from `(role, label)` pairs of interactive elements. A capture without fingerprints is unfinished. See [references/temporal.md](references/temporal.md) → Fingerprints.
- **No empty-string selectors.** Selectors are either a valid expression (`id="..."`, `label="..."`, etc.) or `null`/omitted. Empty strings will fail at replay. See [references/temporal.md](references/temporal.md) → Hardening.
- **State variants get distinct screen IDs in ONE `screens[]` array.** When a screen exists in multiple app states (empty wallet vs funded wallet, signed-in vs signed-out), give each variant its own ID with a clear state suffix (`home-empty`, `home-funded`, `home-signed-out`). Do NOT split into multiple arrays. Do NOT add fields outside the schema. See [references/schema.md](references/schema.md) → State-variant convention.
- **Flows are fine-grained; state changes are flows, not steps.** Give every distinct screen/functionality (a picker, a detail or info screen, a fee breakdown) its own flow rather than burying it as a step — a 1–3 screen flow is fine. Model a major state change (empty→funded, signed-out→in) as the flow that carries it: the alternative-state screen is that flow's entry, or a parenthetical variant sibling. Never show two state-variants of one screen as adjacent steps with a fabricated transition. See [references/exploration.md](references/exploration.md) → Build flows.
- **One device, one session.** Never spawn background agents or subagents that drive the device in parallel. Hung subagents hold the device — kill them.
- **Snapshot first, always.** Every screen begins with `agent-device snapshot -i --json`. Screenshots are evidence, never understanding. Only fall back to screenshot when snapshot is insufficient (see Navigation hierarchy above). Re-test snapshot on every new screen — don't commit to screenshot mode.
- **Fingerprints are the source of screen identity, not slugs.** Slugs are agent-assigned labels; fingerprints are the deterministic hash. When comparing across captures, use fingerprints.
- **Selectors over refs for replay.** `@eN` refs are text-resolved on replay and unstable. Always harden `.ad` files during packaging so they contain `id=`, `label=`, `role=`, or `text=` selectors.
- **Templatize credentials in `.ad`.** Replace literal emails/passwords/OTPs in saved scripts with `{{EMAIL}}`, `{{PASSWORD}}`, `{{OTP}}` placeholders. Resolve at replay from `credentials.md`.
- **Copy-forward, not diff-only.** Every `capture.json` is a self-contained snapshot. Re-captures inherit unchanged data, never just store deltas.
- **Preserve `_humanEdited` fields across re-captures.** Only override if the underlying entity changed so radically the locked value is obviously wrong — and in that case, ask first.

## When to ask the user

Always ask before proceeding when:

- **Authentication input needed** — OTP, SMS verification, email confirmation, biometric prompt, seed phrase, private key, PIN.
- **Decision point in guided mode** — present ALL options with a screenshot; wait for selection (numbers, "all", or "skip"). Decision points apply recursively at every screen with options.
- **Sensitive actions** — anything that could spend money, sign transactions, change account settings, delete data, or trigger irreversible state.
- **Blocked or unexpected state** — crash, error, unfamiliar prompt, paywall.
- **Credential decisions** — new account vs. existing, which account, password reset.
- **Re-capture divergence past tier 3** — `.ad` replay diverged, `-u` failed to repair, LLM walk got lost. Ask before guessing.
- **Locked field obviously wrong** — `_humanEdited` field would be misleading after a structural change.

Include a screenshot when asking. Use `agent-device screenshot` and show the image. Be specific about what input is needed.

## Recovery from hangs

Some screens prevent the runner from reaching idle (continuous animations, live tickers, loaders).

1. **Detect** — command hangs, times out, or fails with `Daemon request timed out`.
2. **Don't retry the same action immediately.**
3. **Reopen session** — `agent-device open {pkg} --device "{device}"`. Restores in most cases without killing the daemon.
4. **Avoid killing the daemon.** `pkill -9 -f agent-device` destroys the XCTest/UIAutomator runner cache. Last resort only. **Never** `pkill -9 -f xcodebuild` or equivalent.
5. **Escalate to Tier 3** after 2 consecutive hangs on the same screen — ask the user to navigate manually, then capture screenshots after each tap.
6. **Queue and retry** — failed screens go to a retry list, attempted again at the end of exploration.

After any kill/restart: always `agent-device open {pkg} --device "{device}"` before any other command. Without an active session, all commands fail with `SESSION_NOT_FOUND`.

## Templates

| Template | Purpose |
|---|---|
| [templates/credentials-template.md](templates/credentials-template.md) | Copy into each app directory as `credentials.md` on first capture. |

## References

| Reference | Use when |
|---|---|
| [references/schema.md](references/schema.md) | Defining or reading any JSON file. Source of truth for field shapes, provenance, and examples. |
| [references/exploration.md](references/exploration.md) | Doing the initial walk: Tier 1/2/3, BFS, decision points, scroll handling, hang recovery. |
| [references/temporal.md](references/temporal.md) | Re-capture: fingerprinting, `.ad` hardening, decision ladder, copy-forward mechanics. |
| [references/editing.md](references/editing.md) | Ambient edits, cascading renames, `_humanEdited`, field provenance. |
| [references/android.md](references/android.md) | Android specifics: emulator boot, package launching, helper APK, permissions. |
| [references/ios.md](references/ios.md) | iOS specifics: simulator, bundle id launching, biometric flows, XCTest recovery. |
