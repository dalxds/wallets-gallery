# App Capture (agent-device)

Explore mobile apps on Android emulators or iPhone devices and **record a screen graph** as `graph.json`, re-capture over time with diff tracking, and edit captured data conversationally.

## Mental model — observe a walk, derive the rest

You author exactly **one** thing during exploration: **`_staging/walk.json`** — raw observation, one entry per screen (`role`, `texts`, `interactiveElements`, a staging screenshot/snapshot path, optional `routeKey`) plus `edges` and `decisionPoints`. You never hand-compute a hash, hand-build a flow, or classify a state — every downstream artifact is *derived deterministically*:

```
walk      →  _staging/walk.json                                        ← the ONLY thing you author
assemble  →  node scripts/assemble.ts _staging/walk.json {date}/graph.json
                                                                       ← computes the 4 identity signals,
                                                                         content-addresses assets, validates
package   →  node scripts/package.ts {date}/graph.json                 ← derives flows / states / tree / replay
edit      →  write overrides into {date}/graph.json + re-run package   ← never hand-edit derived data
```

`graph.json` (assemble's output) is the committed **source of truth** — `nodes` + `edges` + `decisionPoints` + a small `overrides` block (the only hand-edited surface). The flow tree, state classification, screen merges, and replay are all derived by the packager from it.

Every field you record into `walk.json` is documented in **[references/schema.md](references/schema.md)** — read that, not source. `lib/packager/types.ts` is the engine's own copy of those types if you ever want to confirm the mechanism; **you never need to open it to do a capture.** Do **not** invent fields.

## Capture isolation — what you may read, what contaminates

A capture is an **independent observation of one app at one moment.** The single biggest failure mode is letting another app's — or an earlier run's — data leak in: that silently imports foreign structure, naming, quirks, and mistakes into a graph that's supposed to stand alone.

**Read freely:**
- This skill — `SKILL.md` + everything under `references/`. Your procedure *and* the full schema live here.
- The **engine** — `lib/packager/`, `scripts/assemble.ts`, `scripts/phash.ts`, `scripts/package.ts` — *to understand how derivation works.* Reading the mechanism is fine; you should never *need* to, because the reference docs already specify everything you record.
- The **live target app** on the device (snapshots, screenshots). This is your only source of truth for what the app does.
- This app's own `credentials.md`.

**Never read during a capture — it contaminates:**
- Any **other app's** files — anywhere under `public/captures/<other-app>/`.
- **Any** `graph.json` / `view.json` / `*.snap.json` / asset as a *reference* for how to record this one (yours or another's). Build from the live device + the schema, never by imitating a sibling capture.
- `public/captures/index.json` / `search-index.json`, or any `assets/` dir as a reference.
- **Git history** — `git log` / `git show` / `.bak` files / a prior run's `_staging/`. The past state of a capture is not evidence about the app now.
- **This app's own previous captures.** A fresh capture observes the app as it is, with zero priors.

**The one sanctioned cross-time read:** a *re-capture* reads only **this app's `latestCapture` `graph.json`** — to replay its known edges and copy its `overrides` forward (into `walk.json.overrides`). Nothing else: not history, not other dates, not other apps. (See [references/temporal.md](references/temporal.md).)

If another app is installed on the same device, it is irrelevant — confirm the foreground package is the target before recording (`agent-device appstate`).

## Navigation hierarchy — snapshot-first, always

```
1. agent-device snapshot -i --json    ← ALWAYS first, every screen
2. If snapshot is insufficient:        ← see detection rules in exploration.md
     agent-device screenshot {path}    ← read the image to understand
     agent-device find "<text>" click  ← interact via text matching
3. If both fail: ask the user to tap, then screenshot the result
```

The screenshot at step 1 is **saved, not read** — it's the node's `screenshotPath` and the input to `pHash` (computed from the file on disk, never from your vision). At step 2, when the snapshot is insufficient, **delegate the read to a sub-agent** (the "vision oracle") rather than reading it yourself — the image bytes stay in the sub-agent's isolated context, never the main thread, and it returns a navigable report (labels + coordinates) you act on with `agent-device`. See the Tier-2 vision oracle in [references/exploration.md](references/exploration.md). The main agent itself never reads a screenshot into context — doing so per screen exhausts the session image budget and kills visual fallback exactly when a Tier-2 screen needs it.

Full tier ladder + insufficiency detection: [references/exploration.md](references/exploration.md).

## Commands this skill handles

| User request | What the skill does |
|---|---|
| "Capture {app}" (first time) | Full BFS → `_staging/walk.json` → `assemble.ts` → `package.ts`. See workflow §1. |
| "Recapture {app}" / "Recapture flow {slug}" | Replay known edges, re-explore, write a fresh `walk.json` → assemble a new dated `graph.json`, diff. §2. |
| "List flows for {app}" | Run `scripts/package.ts` on the latest `graph.json`, print the derived flow tree. No device. |
| "Change/rename/reparent {X}" | Ambient edit — write to `graph.json` `overrides`, re-run packager. See [references/editing.md](references/editing.md). |
| "Show me {screen/flow}" | Run the packager, find the entity in the view, present screenshot + summary. |

If the user gives enough context to start, begin immediately. Ask only when a required detail is missing.

## Setup

| Parameter | Default | Override |
|---|---|---|
| **Target app** | _(required)_ | Bundle id, app name, or deep link |
| **Platform** | inferred | `--platform android` / `--platform ios` |
| **Device** | auto-detected | `--device {avd}` / `--serial {emu}` / `--udid {ios}` |
| **Output dir** | `./public/captures/` | `Output dir: /tmp/captures` |
| **Scope** | full app | `Focus on swap flows` |
| **Exploration mode** | `guided` | `free-roam` or `guided` |

Per-platform setup: [references/android.md](references/android.md), [references/ios.md](references/ios.md).

## Output structure

```
{OUTPUT_DIR}/{app-slug}/                  # one dir per app — never read a sibling app's dir
  app.json                  # manifest: metadata + capture index + latest pointer
  credentials.md            # auth details, gitignored
  assets/                   # content-addressed binaries, deduped across THIS app's dated captures
    {sha256-12}.png         #   (assemble writes these; never a cross-app store)
    {sha256-12}.snap.json
  {YYYY-MM-DD}/
    graph.json              # THE capture (assemble's output): nodes + edges + decisionPoints + overrides
    view.json               # GENERATED by the build (do not hand-edit; gitignore-able)
  _staging/                 # working dir during capture, gitignored
    walk.json               # raw observation you author; assemble → graph.json
    {NNN}.png / .snap.json  # sequential staging shots/snapshots (assemble content-addresses these)
    master.ad               # --save-script recording; source for replay hardening
```

Each `graph.json` is a complete graph snapshot at a date. Re-captures write a new dated `graph.json`, carrying `overrides` forward verbatim. `view.json` is a build artifact (`pnpm build-data`); never edit it.

## Mandatory at session start

**Two non-negotiables on every `agent-device open`: a dedicated `--session` and `--save-script`.**

- **`--session {app-slug}-{YYYY-MM-DD}` — never the shared `default`.** Each capture gets its own session namespace. The `default` session is shared across every app you've ever captured; reusing it lets one app's session state/baseline bleed into another's diffs. A per-capture session is cheap isolation — always set it.
- **`--save-script {…}/master.ad`** — the master `.ad` is the source for hardening edge selectors during packaging.

**Cold-boot the device first (Android).** Always cold-boot the emulator before a capture — not just `am force-stop`. A soft restart leaves the device-side accessibility-node cache intact, which on a secure surface can resurface a *previous* screen (the stale-snapshot trap); only a cold boot clears it. For a first-time capture, also `pm clear` the app so it starts at first-launch.

```bash
# Android: cold-boot the emulator (clears the device a11y cache), then start the app fresh
adb emu kill                                        # stop the running emulator
emulator -avd {avd} -no-snapshot-load -no-boot-anim &   # relaunch cold (no saved snapshot)
adb wait-for-device                                 # then poll `getprop sys.boot_completed` == 1
adb shell pm clear {pkg}                            # FIRST-TIME capture only: reset app to first-launch
mkdir -p {OUTPUT_DIR}/{app-slug}/_staging
agent-device open {pkg} --platform {p} --relaunch \
  --session {app-slug}-{YYYY-MM-DD} \
  --save-script {OUTPUT_DIR}/{app-slug}/_staging/master.ad
```

(iOS: `xcrun simctl shutdown {udid}` then `boot`; `simctl uninstall`/reinstall for a first-launch state.)

Pre-flight: confirm `--session` (dedicated, not `default`) and `--save-script` are in the command; `session list` shows the session; `appstate` shows the right app.

## Workflow

### 1. Initial capture

```
1. Initialize  Resolve slug. mkdir -p _staging. Load/create credentials.md.
2. Launch      open … --save-script (see above). Pre-flight checks.
3. Explore     Fingerprint-keyed BFS. For EACH screen append a raw NODE to walk.json
               (id, role, texts, interactiveElements, shot/snap staging paths, routeKey?);
               for each tap append an EDGE (from, to, action, selector?, kind?). Decision
               points at branches. You do NOT compute hashes here. Full recipe: references/exploration.md.
4. Assemble    node scripts/assemble.ts _staging/walk.json {date}/graph.json
               — computes fingerprint/skeletonHash/pHash, content-addresses shots into
               assets/, finalizes edge kind, validates. Refuses to write on a validation error.
5. Package     a. node scripts/package.ts {date}/graph.json   (derive flows/states/tree/replay).
               b. Name flows: the packager prints a `namingTODO`. For each, add a name to
                  {date}/graph.json overrides.flowNames["<flow-id>"] (gerund for actions, noun
                  for sections). Re-run package.ts until namingTODO is empty / acceptable.
6. Wrap up     Update credentials.md + app.json manifest. Close session.
```

You do **not** compute identity signals, build the flow tree, classify states, or write replay scripts by hand — `assemble.ts` and the packager do. You record raw observations and supply flow names.

### 2. Re-capture

```
1. Read THIS app's latest graph.json (the one sanctioned cross-time read). Replay its known
   edges with fingerprint verification; on drift, agent-device replay -u, then LLM-walk, then ask.
2. BFS-explore where new interactive elements appeared, appending to a fresh walk.json.
3. Copy the prior graph.json's `overrides` block into walk.json.overrides (carried forward verbatim),
   then assemble → a new dated graph.json, then package.
4. Diffing is done from the graph: compare node fingerprints + edges across dates.
```

Details: [references/temporal.md](references/temporal.md).

### 3. Ambient edit

Edit-shaped requests during conversation mutate `graph.json` `overrides`, then re-run the packager. The skill recognizes: flow renames (`overrides.flowNames`), re-parenting / promote-demote (`overrides.structure`), screen role/title/state corrections (`overrides.screens`), and merge/split (`overrides.merges` / `overrides.splits`). See [references/editing.md](references/editing.md). **Never hand-edit the derived view.**

## Critical guardrails

- **App isolation — one app per capture, zero cross-references.** See *Capture isolation* above for the read rules (no other captures, no this-app priors, no git history). Beyond reads: never assume, infer, port, or *mention* behavior from another app — not in `graph.json`, `overrides`, `credentials.md`, titles, names, **or in your reasoning to the user**. "Looks like {other app}", "white-label of {X}", "same stack as {Y}" is never a basis for a decision — read *this* app's live snapshot. Each capture stands alone.
- **Secure screens (FLAG_SECURE) — get the visual from the user, don't trust a blank snapshot.** Auth/OTP, payment, and KYC screens in finance apps render to a secure surface: `agent-device screenshot` / `adb screencap` come back **black**, and when the live a11y read is also empty the `snapshot` can return a **stale tree from an earlier screen** — so never record a node from a snapshot that contradicts where you actually are. Say plainly it's a secure screen, ask the user for a **host screenshot** (the emulator's own screenshot bypasses `FLAG_SECURE`), and record the node from that (`snapshotPath: null`, text-derived `sha256-text:` fingerprint). Many finance apps set FLAG_SECURE **app-wide**, so once you hit one, expect *every* programmatic screenshot to stay black — plan to source visuals from the user for the whole capture. (More: [references/exploration.md](references/exploration.md) → Tier-S.)
- **The main agent never reads a screenshot into its own context.** Every screen's screenshot is *saved* (node `screenshotPath` + `pHash` input, both computed from the file on disk — you never view it for that). When the snapshot is insufficient (Tier 2) and vision is genuinely needed, **delegate the read to a file-only sub-agent (the vision oracle)**: it reads the full-res PNG in its own context and returns a *navigable* report — exact `label`, `role`, `center [x,y]`, `bbox`, `state` per element, plus `imageSize` — so the main agent can drive `agent-device find`/`click` from text and coordinates. The sub-agent never touches `agent-device` (keeps "one device, one session"). Phone screenshots are tall (≥2000px); reading them in the main thread accumulates across calls and trips the many-image pixel ceiling, killing visual fallback when you need it. Full recipe + prompt template: [references/exploration.md](references/exploration.md) → Tier-2 vision oracle.
- **`--save-script` on every `open`.** Without it, edge selectors can't be hardened.
- **Record edges, not just screens.** Every tap that changes the screen is an edge `(from, to, action, selector?, kind?)` in `walk.json`. You don't have skeleton hashes at walk time, so `assemble.ts` finalizes `in-place` vs `nav` from skeleton equality. Record `kind` only for what skeletons can't detect — `back` (you pressed back) and `overlay` (a sheet appeared over the prior screen); leave it off otherwise.
- **Identity signals are computed for you, never by hand.** `assemble.ts` derives all four per node from your observation — `fingerprint`, `skeletonHash`, `pHash` (from the staged shot), `routeKey` (passed through). Do not hand-hash; a hand-written or null fingerprint is the classic failure the validator rejects. What the signals *mean*: [references/temporal.md](references/temporal.md).
- **Never invent fields — and don't accrete scaffolding.** Need a graph field the schema (schema.md) doesn't have? STOP and ask about a schema extension. Apply the *same* restraint where no validator reaches — `walk.json`, helper scripts, this skill's prose: a novel screen or surprising failure (a secure screen, a stale snapshot, an odd state) is almost never a reason for new infrastructure. The fix is a one-line observation plus asking the user — not a new flag, a detection script, or a forensic write-up here. Test for any `walk.json` field: if it doesn't map to a schema field or raw observation (`shot`/`snap` path, `texts`, `interactiveElements`, edges), drop it. Incident-specific detail lives in that capture's notes, never in the skill.
- **Don't hand-build flows or classify states.** That logic is deterministic (the packager). If the derived tree is wrong, fix it with an `override`, not by editing output.
- **`overrides` is the only hand-edited surface,** and it's preserved across re-captures.
- **No empty-string selectors** — a real selector or `null`.
- **One device, one session.** Never run parallel agents driving the device.
- **Validate before finishing:** `assemble.ts` validates on write, and `node scripts/package.ts {graph.json}` must exit 0.

## When to ask the user

Always ask before: auth input (OTP/SMS/biometric/seed/PIN); a guided-mode decision point (show all options + screenshot, wait); sensitive actions (spend, sign, delete, settings change); blocked/unexpected state; credential decisions; re-capture divergence past tier 3. Include a screenshot when asking.

## Recovery from hangs

Some screens never reach idle (animations, live tickers). 1) Detect (timeout/hang). 2) Don't retry the same action. 3) `agent-device open {pkg} --device "{device}"` to reattach. 4) Avoid `pkill -9` (destroys the runner cache); last resort only. 5) After 2 hangs on one screen, escalate to user-assisted taps. 6) Queue failed screens, retry at the end. After any restart, always `open` before any other command.

## References

| Reference | Use when |
|---|---|
| [references/schema.md](references/schema.md) | **The contract** — every field of `walk.json` / `graph.json` / `app.json`, and what the packager derives. Read this, not source. |
| [references/exploration.md](references/exploration.md) | The walk: tiers, fingerprint-keyed BFS, recording nodes+edges into walk.json, decision points, scroll, hangs. |
| [references/temporal.md](references/temporal.md) | What the identity signals mean, edge `kind`, `.ad` hardening, re-capture ladder, graph-based diffing. |
| [references/editing.md](references/editing.md) | Ambient edits via `overrides`. |
| [references/android.md](references/android.md) · [references/ios.md](references/ios.md) | Platform specifics. |
| `lib/packager/types.ts` | Engine source for the type shapes — optional, to confirm mechanism; never required for a capture. |
```
