# Temporal / Re-capture Reference

How the skill handles re-capturing an app over time: fingerprinting, `.ad` hardening, the re-capture decision ladder, copy-forward semantics, and diff computation.

## Mental model

**Each `capture.json` is a complete, self-contained snapshot of the app at a date.** Re-captures never write partial diffs. Instead, a re-capture:

1. Loads the prior `capture.json`.
2. Walks the device (full or flow-scoped).
3. Diffs new state against the prior.
4. Carries forward unchanged data.
5. Writes a new complete `capture.json` to a new date directory.

This means readers always get a full app snapshot from any single capture file. History is a directory walk — never a chain of pointers to reconstruct.

## Fingerprints — the identity primitive

**Fingerprint computation is MANDATORY on every capture.** No `screen.fingerprint`, no `step.fingerprintBefore`, no `step.fingerprintAfter` may be null at write time. The pre-write validator will reject the capture if any are missing.

Every screen has a fingerprint computed deterministically from its snapshot:

```
fingerprint = "sha256:" + sha256_hex(JSON.stringify(
  interactive_elements
    .map(e => [normalize(e.role), normalize(e.label)])
    .sort()
))
```

Where:
- `interactive_elements` = nodes with role `button`, `link`, `tab`, `edit-text`, `checkbox`, `radio`, `switch`, `slider`, `image-button`, etc.
- `normalize(s)` = lowercase, trim, collapse internal whitespace, strip leading/trailing punctuation.

Properties:
- **Deterministic.** Same screen state → same fingerprint.
- **Order-independent.** Sorted pairs mean DOM-order shuffles don't change identity.
- **Stable to dynamic text outside interactive elements.** Static labels and prose don't contribute.
- **Sensitive to UI structure.** Adding a button changes the fingerprint. So does relabeling one.

Computed once per snapshot, stored on `screen.fingerprint`, `step.fingerprintBefore`, `step.fingerprintAfter`, `flow.replay.entryFingerprint`.

### Falling back when snapshot is unavailable (Tier 2/3)

If a screen was captured in Tier 2 (screenshot + find) or Tier 3 (user-tapped) and has no usable snapshot, compute a fallback fingerprint from the screenshot-derived `texts[]` array:

```
fingerprint = "sha256-text:" + sha256_hex(JSON.stringify(
  texts.map(normalize).sort()
))
```

Note the `sha256-text:` prefix — distinguishes lower-confidence fingerprints from snapshot-derived ones. Re-capture identity matching can still work, but expect more false positives/negatives. Annotate the screen with `notes: "Tier 2/3 capture — fingerprint derived from screenshot text"` for traceability.

**Never store `fingerprint: null` at write time.** Always compute one — snapshot-derived or text-derived — before writing.

### Step fingerprints

Every step in every flow needs both `fingerprintBefore` and `fingerprintAfter`:

- `fingerprintBefore`: the fingerprint of the screen before the step's action was taken. For step 1 (entry-point), this equals the entry screen's fingerprint.
- `fingerprintAfter`: the fingerprint of the screen after the action. For step 1, this also equals the entry screen's fingerprint (no transition yet).

If you re-derive a capture from saved data after the fact (e.g., the agent forgot to compute fingerprints during capture), use the `screen.fingerprint` of the step's `screenId` as both `fingerprintBefore` and `fingerprintAfter` — best-effort but consistent.

## `.ad` file mechanics

### Recording

Every capture session uses `--save-script` from session start:

```bash
agent-device open {pkg} --platform android --relaunch --save-script {staging}/master.ad
# ... entire exploration ...
agent-device close   # the master.ad is written here
```

The master script accumulates every command issued during the session. Refs are `@eN`.

### Per-flow extraction

After packaging assigns screens to flows, extract per-flow `.ad` scripts from the master:

1. Identify the contiguous range of master commands that walk the flow.
2. Extract them into a per-flow command list.
3. Prepend a clean `open {pkg} --relaunch` if the flow's entry is the cold-launch screen.
4. Otherwise prepend the navigation chain from cold-launch → flow entry.

### Hardening (selector resolution)

Raw `@eN` refs are text-resolved on replay and unstable. Replace each `@eN` with a stable selector during packaging:

For each `@eN` in the flow's command list:
1. Find the snapshot captured immediately before the action.
2. Look up node `@eN` in that snapshot.
3. Pick the most stable selector available:
   - `id="..."` if the node has a unique resource-id / accessibilityIdentifier.
   - `label="..." role="..."` if label is unique on the screen.
   - `text="..."` as a last resort.
   - Avoid coordinate-based unless nothing else is available.
4. Replace `@eN` with the chosen selector in the command's positionals.
5. Record confidence: `high` if `id=`, `medium` if `label=`, `low` if `text=` or coordinates.

### Empty selectors are forbidden

If hardening cannot produce a valid selector for an element (no stable id, ambiguous label, no text), the resulting field must be **`null`**, never an empty string `""`.

```json
// ❌ Wrong — will fail at replay
{ "label": "Total balance", "role": "button", "selector": "" }

// ✅ Right — explicit null signals "no usable selector"
{ "label": "Total balance", "role": "button", "selector": null }
```

Apply the same rule everywhere selectors appear: `flows[].steps[].selector`, `screens[].interactiveElements[].selector`, `screens[].primaryCta.selector`, `screens[].secondaryCtas[].selector`.

The pre-write validator rejects empty-string selectors. Set them to `null` or pick a real selector.

### Credential templatization

After hardening, scan `fill` and `type` commands for credential values:

| Pattern | Placeholder |
|---|---|
| Anything in `credentials.md` under `Email` | `{{EMAIL}}` |
| Anything in `credentials.md` under `Password / PIN` | `{{PASSWORD}}` or `{{PIN}}` |
| Numeric strings of length 4-8 entered into fields labeled "OTP" / "code" / "verification" | `{{OTP}}` |
| Anything in `credentials.md` under `Seed phrase` | `{{SEED_PHRASE}}` |
| Anything in `credentials.md` under `Phone` matched as SMS code field | `{{SMS_CODE}}` |

Replace literal values with placeholders. Record present placeholders in `flow.replay.credentialsTemplate`.

At replay time, the agent reads `credentials.md`, substitutes placeholders, and pipes the resolved script through `agent-device replay`. **Never** commit resolved scripts to disk — placeholders are the canonical form.

### Confidence

`flow.replay.confidence` summarizes selector quality:

- `high`: every step uses `id=` or unique `label=`. Replay should be deterministic.
- `medium`: at least one step uses `label=` with a label that appears multiple times on its screen. Possible drift.
- `low`: any step uses `text=` only or coordinate-based selectors. Likely to drift on minor UI changes.

The agent should warn the user when re-capturing flows with `confidence: low` — drift recovery is likely needed.

## Re-capture decision ladder

When re-walking a known flow:

```
1. Verify entry
   agent-device snapshot -i --json → compute fingerprint
   If fingerprint != flow.replay.entryFingerprint:
     - Fingerprints close (Jaccard ≥ 0.7 on interactive elements)? Continue with a warning logged.
     - Fingerprints far? Abort, ask user (probably wrong screen).

2. Deterministic replay
   Resolve credential placeholders from credentials.md.
   agent-device replay {flow}.ad
   On success: walk done, capture each step's post-fingerprint, compare to fingerprintAfter.
              Detect step modifications via fingerprint mismatch.

3. Drift repair (if a step fails or post-fingerprint diverges)
   agent-device replay -u {flow}.ad
   The CLI auto-repairs drifted selectors in place. Re-run.
   On success: hardening updated → record selector-drift change entries.

4. LLM-driven walk (if -u can't repair)
   For each remaining step:
     a. agent-device snapshot -i --json
     b. Find the best interactive element matching step.description + prior step.selector.
        Use semantic matching: same role, similar label, reasonable position.
     c. Tap. Re-snapshot. Compare fingerprint to expected.
     d. If matched: continue. Update step.selector with the new stable selector.
     e. If no match: try scrolling once, retry. If still no match: ask user.

5. Ask the user (last resort)
   Show current screen screenshot + the step we were trying to perform.
   Ask: "I expected to see {expected}. The screen shows {actual}. How do I proceed?"
```

After successful re-walk, also attempt to **extend** the flow: snapshot the terminal screen, check if any new interactive elements that weren't there at last capture suggest the flow has grown.

## Diff computation

After re-walking, build the `changes` array by comparing new state to `previousCapture`.

### Screen diffs

For each screen in the new capture:
- **screen-added**: fingerprint not in prior capture. Emit `{kind: "screen-added", screen: <id>}`.
- **screen-modified**: fingerprint changed BUT identity is the same (matched via slug carryover from flow steps). Compare interactive elements, texts, role. Emit detailed sub-changes.
- **screen-unchanged**: fingerprint exactly matches a screen in prior capture. Copy forward verbatim (preserving `_humanEdited`).

For each screen in the prior capture not seen in new:
- **screen-removed**: emit `{kind: "screen-removed", screen: <id>}`.

### Flow diffs

For each flow in the new capture:
- **flow-added**: slug not in prior capture.
- **flow-modified**: same slug, but step count or step fingerprints differ. Emit per-step diffs (`step-added`, `step-removed`, `step-modified`).
- **flow-unchanged**: same slug, same steps (each step's fingerprintBefore/After matches prior).

For each flow in the prior capture not seen in new:
- **flow-removed**: only emit on `scope: "full"`. For `scope: "flow"` re-captures, untouched flows are NOT removed — they're carried forward.

### Entry-point and decision-point diffs

- **entry-point-changed**: a flow's `entryPoints[]` changed.
- **decision-point-added/removed**: new or vanished branch screens.

### Step-level granularity

For `flow-modified.details[]`:

```json
{ "kind": "step-added", "atIndex": 3, "screen": "captcha",
  "afterStep": 2, "beforeStep": 3 }

{ "kind": "step-removed", "atIndex": 5, "screen": "old-screen" }

{ "kind": "step-modified", "atIndex": 2,
  "before": { "screenId": "old", "action": "Tap Continue" },
  "after":  { "screenId": "new", "action": "Tap Submit" } }
```

For `screen-modified.details[]`:

```json
{ "kind": "element-added", "label": "Sign in with Face ID", "role": "button" }
{ "kind": "element-removed", "label": "Sign in with Touch ID", "role": "button" }
{ "kind": "element-modified", "before": {...}, "after": {...} }
{ "kind": "role-changed", "from": "list", "to": "picker" }
{ "kind": "title-changed", "from": "Login", "to": "Sign In" }
```

## Copy-forward semantics

When re-capturing, the new `capture.json` is assembled from:

1. **For full re-capture (`scope: "full"`):**
   - Re-walk every prior flow with the ladder above.
   - Optionally BFS-explore for new entry points after known flows finish.
   - Build new `screens[]`, `flows[]`, `decisionPoints[]` from re-walked state.
   - Unchanged screens carry forward verbatim, preserving `_humanEdited`.
   - Unchanged flows carry forward verbatim, preserving `_humanEdited`.
   - Removed screens/flows drop from new capture; recorded in `changes`.

2. **For flow re-capture (`scope: "flow"`):**
   - Load prior `capture.json` fully.
   - Re-walk only the named flow(s).
   - Replace the named flow's data with new state.
   - For each screen visited during re-walk: if same fingerprint as in prior, carry forward; if changed, update; if new, add.
   - All untouched flows AND their screens carry forward verbatim.
   - `changes` only reflects diffs for the named flow + screens whose fingerprints changed.

### Preserving `_humanEdited`

For every screen and flow being carried forward (or updated):

1. Identify fields listed in prior `_humanEdited`.
2. Keep those field values from the prior capture.
3. Re-derive all other fields from new device state.
4. Re-populate `_humanEdited` with the same field names.
5. If a `_humanEdited` field's underlying entity has changed so radically the value is obviously misleading (e.g. role-locked to `auth` but the screen is now clearly `confirmation`), surface this to the user before overwriting. Never silently overwrite a locked field.

## Listing flows

```bash
# pseudo-code
read app.json → find latestCapture
read {latestCapture}/capture.json
for each flow in flows[]:
  print flow.slug, flow.name, flow.entryPoints, flow.replay.confidence
```

Output format:

```
acme-bank flows (latest: 2026-05-25)

  sign-in           — Sign In             entry: [login]        confidence: high
  password-reset    — Password Reset       entry: [login]        confidence: high   modified 2026-05-25
  transfer          — Transfer             entry: [home]         confidence: medium
  ...
```

Pure metadata read. No device interaction.

## Common patterns

### "What changed since last capture?"

```
read {latestCapture}/capture.json
print capture.changes
```

The `changes` array is pre-computed at capture time. No diffing needed at read time.

### "How has the login screen evolved?"

```
for each capture in app.json.captures:
  read {date}/capture.json
  find screen with id="login"
  print date + screen.fingerprint + screen.title + screen.description
```

Walks N capture files (where N = number of captures). Cheap.

### "Which flow last changed?"

```
for each capture in app.json.captures (newest → oldest):
  if any change in capture.changes has kind="flow-modified" or kind="flow-added" or kind="flow-removed":
    return capture.date + flow
```

## Failure modes and edge cases

- **Replay drifts catastrophically.** Fingerprint divergence > 50% on entry → abort, ask user. App may have changed too much for replay to be meaningful.
- **Multiple flows share the same first screen.** Entry-point screens may serve many flows. Replay verification compares against the specific flow's `entryFingerprint`, not just any screen at the entry path.
- **Credentials placeholder missing in credentials.md.** Abort replay. Surface which placeholder is missing.
- **Snapshot helper APK upgrade mid-session (Android).** Recompute fingerprints — provider-side normalization may change. If pre/post-upgrade fingerprints diverge for unchanged screens, document the helper version in `capture.json` for traceability.
- **Schema version mismatch on read.** Refuse to operate on captures with `schemaVersion` newer than the skill knows. Migrate older versions explicitly.

## Re-capture invariants to enforce

After writing the new `capture.json`, the skill should self-check:

- Every `flows[].steps[].screenId` exists in `screens[]`.
- Every `screens[].appearsIn[].flow` exists in `flows[]`.
- Every `flows[].entryPoints[]` member exists in `screens[]`.
- Every `decisionPoints[].screenId` exists in `screens[]`.
- Every `decisionPoints[].options[].flowSlug` (if set) exists in `flows[]`.
- Every `flows[].replay.path` file exists on disk in this capture's directory.
- Every `_humanEdited` field name actually appears on the entity it's stamped on.
- `stats.screensInThisCapture` == `screens.length`.

Validation failure → roll back the write, log diagnostics, ask user.
