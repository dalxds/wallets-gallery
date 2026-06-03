# Temporal / Re-capture Reference

How the skill handles re-capturing an app over time: the four per-node identity signals, `.ad` hardening + credential templating, the re-capture decision ladder, graph-based diffing, and `overrides` copy-forward.

## Mental model

**Each `graph.json` is a complete, self-contained graph of the app at a date** (`nodes` + `edges` + `decisionPoints` + `overrides`). Re-captures never write partial diffs. A re-capture:

1. Reads the prior `graph.json`.
2. Replays known edges, then walks for new state (full or flow-scoped).
3. Writes a new complete `graph.json` to a new date directory, carrying `overrides` forward verbatim.
4. Diffs are computed *from the graphs* (compare node fingerprints + edges across dates) — see [Graph-based diffing](#graph-based-diffing).

History is a directory walk over dated `graph.json` files, not a chain of pointers to reconstruct.

## Identity signals — four per node

Every node carries four signals, all computed at capture time and **never deferred**. Together they let the packager (and re-capture) decide whether two observations are the same screen state, variants of one logical screen, or genuinely different. The fingerprint is also what re-capture matches on to tell "modified" from "replaced".

### 1. `fingerprint` — identity hash

Computed deterministically from the snapshot's interactive elements:

```
fingerprint = "sha256:" + sha256_hex(JSON.stringify(
  interactiveElements.map(e => [fpRole(e.role), normalize(e.label)]).sort()
)).slice(0, 24)
```

- `fpRole(role)` = last dotted segment, lowercased, trimmed (`android.widget.Button` → `button`).
- `normalize(s)` = lowercase, trim, collapse internal whitespace.

Properties: **deterministic** (same state → same hash), **order-independent** (sorted pairs), **stable to dynamic prose** (only interactive `(role,label)` pairs contribute), **sensitive to structure** (adding or relabeling a control changes it). Reference implementation: `lib/packager/identity.ts` → `computeFingerprint`.

**Tier 2/3 fallback.** When a screen has no usable snapshot (screenshot-only), derive the fingerprint from the screenshot-extracted `texts[]` and prefix `sha256-text:`:

```
fingerprint = "sha256-text:" + sha256_hex(JSON.stringify(texts.map(normalize).sort())).slice(0, 24)
```

The prefix marks the lower-confidence form; identity matching still works but expect more false positives/negatives. **Never store `fingerprint: null`** — the validator rejects it (it must match `sha256:` or `sha256-text:`).

### 2. `skeletonHash` — structure-only identity

A hash of the snapshot tree with labels and text stripped (roles + nesting). It survives data changes, so it **clusters variants of one logical screen** (home empty vs funded) during merging, and it is the signal behind edge `kind`: when the post-tap `skeletonHash` equals the pre-tap one, the tap is an `in-place` state toggle, not a navigation. Fallbacks for element-less / Tier 2/3 screens: `identity.ts` → `skeletonFromElements` / `skeletonFromTexts` (`sk:` / `skt:` prefixed).

### 3. `pHash` — perceptual hash (visual backstop)

A perceptual hash of the screenshot (`p:`-prefixed), `null` when there's no usable shot. It's the **backstop** identity signal: the packager merges two nodes when their `skeletonHash` matches and `pHash` is near-identical, and clusters them as one logical screen when `pHash` is within a looser band. Distance is Hamming over the hex digits (`identity.ts` → `pHashDistance`).

### 4. `routeKey` — platform screen key

Android resource-id of the root / iOS view-controller class when recoverable, else `null`. A strong same-logical-screen signal when present.

How to record all four per screen: [exploration.md](exploration.md) → Per-screen capture routine.

## `.ad` mechanics

The `.ad` script is agent-device's native replay format. Selectors are hardened from the recorded `master.ad`; the per-flow replay is **emitted inline by the packager** into `view.json` (`ViewReplay.commands`) — there is no separate per-flow `.ad` file to author, and it's materialized to a temp file only when you actually replay.

### Recording

Every capture session uses `--save-script` from session start (see SKILL.md → Mandatory at session start):

```bash
agent-device open {pkg} --platform android --relaunch --save-script {staging}/master.ad
# ... entire exploration ...
agent-device close   # master.ad is written here
```

The master script accumulates every command issued during the session, with `@eN` refs.

### Hardening (selector resolution)

Raw `@eN` refs are text-resolved on replay and unstable. They are hardened against the snapshot context recorded alongside each command — this is the same hardening the agent applies when populating an edge's `selector`, and it's what the packager's inline replay reuses:

1. Find the snapshot captured immediately before the action and look up node `@eN`.
2. Pick the most stable selector: `id="..."` (unique resource-id / accessibilityIdentifier) → `label="..." role="..."` (unique label) → `text="..."` (last resort). Avoid coordinate-based.
3. Use the chosen selector as the edge `selector`. **If none is stable, use `null`, never `""`** — the validator rejects empty-string selectors.

Replay confidence (`ViewReplay.confidence`, computed by `lib/packager/replay.ts`): `high` when every step uses `id=`; `medium` when some use `label=`/`role=`; `low` when any step is `text=`-only or a selector is missing. Warn the user before re-capturing a `low`-confidence flow — drift recovery is likely.

### Credential templating

Scan `fill`/`type` commands for credential values and replace literals with placeholders before storing/replaying:

| Pattern | Placeholder |
|---|---|
| Value under `Email` in `credentials.md` | `{{EMAIL}}` |
| Value under `Password / PIN` | `{{PASSWORD}}` / `{{PIN}}` |
| 4–8 digit code in an "OTP" / "code" / "verification" field | `{{OTP}}` |
| Value under `Seed phrase` | `{{SEED_PHRASE}}` |
| SMS code matched against `Phone` | `{{SMS_CODE}}` |

At replay time the agent reads `credentials.md`, substitutes placeholders, and pipes the resolved script through `agent-device replay`. **Never** commit resolved scripts — placeholders are the canonical form.

## Re-capture decision ladder

When re-walking a known flow (replay → replay -u → LLM-walk → ask):

```
1. Verify entry
   agent-device snapshot -i --json → compute fingerprint.
   Compare to the flow's entry fingerprint (ViewReplay.entryFingerprint, from the packager).
   Close (Jaccard ≥ 0.7 on interactive elements)? Continue with a warning. Far? Abort, ask.

2. Deterministic replay
   Resolve credential placeholders from credentials.md.
   Materialize the inline replay commands to a temp .ad and: agent-device replay {tmp}.ad
   On success: walk done; re-snapshot each landed screen and record fresh nodes/edges.

3. Drift repair (a step fails or a landed fingerprint diverges)
   agent-device replay -u {tmp}.ad   # auto-repairs drifted selectors in place; re-run.

4. LLM-driven walk (if -u can't repair)
   Per remaining step: snapshot → find the best element matching the prior action +
   selector (same role, similar label, reasonable position) → tap → re-snapshot →
   compare fingerprint. Matched: continue with the new selector. No match: scroll once,
   retry; still none → ask the user.

5. Ask the user (last resort)
   Show the current screenshot + the step being attempted:
   "I expected {expected}; the screen shows {actual}. How do I proceed?"
```

After a successful re-walk, also try to **extend** the flow: snapshot the terminal screen and check for new interactive elements that weren't present last time.

## Graph-based diffing

Diffs are computed by comparing the two `graph.json` files — there is no stored `changes` array; the view's stats and any change summary are derived on demand.

### Node diffs (match by fingerprint)

- **added** — a node fingerprint in the new graph not in the prior.
- **modified** — same node id (carried via reused slugs / matched skeleton+route) but a changed fingerprint. Compare `interactiveElements`, `texts`, `role` for sub-changes (element added/removed/relabeled, role change).
- **unchanged** — fingerprint matches a prior node.
- **removed** — a prior node fingerprint absent from the new graph.

### Edge / flow diffs

Compare `edges[]` keyed by `(from, to, action)`: added / removed transitions. Because the flow tree is *derived*, flow-level changes fall out of the node/edge diff once both graphs are packaged — compare the two derived views' flows/steps if a flow-level summary is wanted. For a `scope: "flow"` re-capture, only the named flow's nodes/edges are re-walked; everything else is carried forward unchanged.

## `overrides` copy-forward (replaces `_humanEdited`)

The new dated `graph.json` carries the **entire `overrides` block forward verbatim** from the prior capture. This is the single edit-preservation mechanism — there is no per-field `_humanEdited` stamping any more, and no field-by-field provenance to reconcile. Because `overrides` is keyed by stable node ids and flow ids (a flow id is its anchor node id), human corrections survive re-capture automatically:

1. Re-walk the device and build fresh `nodes[]` / `edges[]` / `decisionPoints[]`.
2. Copy the prior `overrides` object into the new graph unchanged.
3. Re-run the packager; the overrides re-apply on top of the fresh observation.

If a re-capture removed a node/flow that an override still references, the validator emits a warning (`overrides.* "<id>" is not a node id`) — prune the stale key or re-point it. Edits themselves are made only through `overrides`; see [editing.md](editing.md).

## Listing flows / read queries

Listing flows or answering "what changed" is a packager run, not a device session:

```bash
node scripts/package.ts {latestCapture}/graph.json        # flow tree + stats + namingTODO
node scripts/package.ts {latestCapture}/graph.json --json  # full derived View
```

"How has the login screen evolved?" → walk the dated `graph.json` files, find the node with `id="login"`, print `captureDate` + `fingerprint` + `texts`. "What changed since last capture?" → package the two adjacent graphs and diff their nodes/edges as above. All pure reads — no device.

## Failure modes and edge cases

- **Replay drifts catastrophically.** Entry fingerprint divergence > 50% → abort, ask the user; the app may have changed too much for replay to be meaningful.
- **Multiple flows share an entry screen.** Verify against the specific flow's `entryFingerprint`, not just any screen at the entry path.
- **Missing credential placeholder.** Abort replay; surface which placeholder is absent from `credentials.md`.
- **Snapshot helper upgrade mid-session (Android).** Recompute signals — provider-side normalization may shift hashes. If fingerprints diverge for unchanged screens, note the helper version for traceability.
- **Schema version mismatch.** Refuse to operate on a `graph.json` whose `meta.schemaVersion` is newer than the skill knows; migrate older ones explicitly.
