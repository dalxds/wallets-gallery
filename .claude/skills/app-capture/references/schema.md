# Schema Reference

Canonical JSON shapes for everything the skill writes.

## File index

| Path | Purpose | Updated when |
|---|---|---|
| `{app-slug}/app.json` | App-level manifest | Every capture + every edit |
| `{app-slug}/{date}/capture.json` | Full self-contained capture snapshot | At capture/recapture end |
| `{app-slug}/{date}/{flow-slug}.ad` | Selector-hardened replay script for one flow | At capture/recapture end (per flow) |
| `{app-slug}/assets/{sha256}.png` | Content-addressed screenshot | When a new screenshot's content hash is unseen |
| `{app-slug}/assets/{sha256}.snap.json` | Content-addressed raw snapshot | When a new snapshot's content hash is unseen |
| `{app-slug}/credentials.md` | Auth details (free-form markdown) | On account changes |

## `app.json`

Thin manifest. Single read tells you what apps exist and where to find the latest state.

```json
{
  "schemaVersion": 1,
  "app": {
    "name": "Acme Bank",
    "slug": "acme-bank",
    "bundleId": "com.acme.bank",
    "platform": "android"
  },
  "firstCapturedAt": "2026-04-12",
  "lastCapturedAt": "2026-05-25",
  "latestCapture": "2026-05-25",
  "captures": [
    {
      "date": "2026-05-25",
      "scope": "flow",
      "flowsRecaptured": ["password-reset"],
      "mode": "guided",
      "previousCapture": "2026-04-12",
      "path": "2026-05-25/capture.json"
    },
    {
      "date": "2026-04-12",
      "scope": "initial",
      "mode": "guided",
      "previousCapture": null,
      "path": "2026-04-12/capture.json"
    }
  ]
}
```

### Fields

| Field | Type | Provenance | Notes |
|---|---|---|---|
| `app.platform` | `"android" \| "ios"` | agent | Determines launcher semantics. |
| `app.bundleId` | string | agent | Android package name or iOS bundle id. |
| `app.slug` | string | agent | Lowercase, dashes. Stable across captures. May be edited via chat (cascade rename of directory). |
| `latestCapture` | YYYY-MM-DD | agent | Pointer used by readers for "current state" queries. |
| `captures[].scope` | `"initial" \| "full" \| "flow"` | agent | What kind of capture produced this entry. |
| `captures[].flowsRecaptured` | string[] | agent | Set when `scope: "flow"`. Empty/omitted otherwise. |
| `captures[].previousCapture` | YYYY-MM-DD or null | agent | For walking history. Null for the first capture. |

## `capture.json`

The canonical snapshot of an app at a date. Every capture writes one of these. Always complete — never a partial diff.

```json
{
  "schemaVersion": 1,
  "captureDate": "2026-05-25",
  "scope": "flow",
  "flowsRecaptured": ["password-reset"],
  "previousCapture": "2026-04-12",
  "mode": "guided",
  "durationSeconds": 142,

  "screens": [ /* ScreenEntry[] */ ],
  "flows": [ /* FlowEntry[] */ ],
  "decisionPoints": [ /* DecisionPoint[] */ ],
  "changes": [ /* ChangeEntry[] */ ],

  "stats": {
    "screensInThisCapture": 31,
    "screensVisited": 4,
    "screensAdded": 1,
    "screensModified": 1,
    "screensRemoved": 0,
    "flowsTouched": 1
  }
}
```

### `ScreenEntry`

```json
{
  "id": "login",
  "title": "Sign In",
  "role": "auth",
  "description": "Login screen with email and password fields, biometric button, and password reset link. First screen after launching with no active session.",
  "screenshotPath": "assets/e0a3a14b9f22.png",
  "snapshotPath": "assets/e0a3a14b9f22.snap.json",
  "fingerprint": "sha256:e0a3a14b9f22cd...",
  "texts": ["Sign In", "Email", "Password", "Forgot password?", "Sign in with Face ID"],
  "primaryCta": {
    "label": "Sign in",
    "role": "button",
    "selector": "id=\"primary-cta\""
  },
  "secondaryCtas": [
    { "label": "Sign in with Face ID", "role": "button", "selector": "label=\"Sign in with Face ID\"" },
    { "label": "Forgot password?", "role": "button", "selector": "label=\"Forgot password?\"" }
  ],
  "interactiveElements": [
    { "label": "Sign in", "role": "button", "selector": "id=\"primary-cta\"" },
    { "label": "Sign in with Face ID", "role": "button", "selector": "label=\"Sign in with Face ID\"" },
    { "label": "Forgot password?", "role": "button", "selector": "label=\"Forgot password?\"" },
    { "label": "Email", "role": "edit-text", "selector": "id=\"email-input\"" },
    { "label": "Password", "role": "edit-text", "selector": "id=\"password-input\"" }
  ],
  "entryPaths": [
    { "description": "Cold launch with no active session", "via": "open com.acme.bank --relaunch" },
    { "description": "Sign out from settings", "fromScreen": "settings", "action": "Tap Sign out" }
  ],
  "appearsIn": [
    { "flow": "sign-in", "step": 1 },
    { "flow": "password-reset", "step": 1 }
  ],
  "_humanEdited": ["title", "role"]
}
```

| Field | Type | Provenance | Notes |
|---|---|---|---|
| `id` | string | human-editable | Slug. Stable. Chat-rename cascades. |
| `title` | string | human-editable | Short human label. Agent picks; human refines. |
| `role` | enum | human-editable | One of `home`, `list`, `picker`, `form`, `confirmation`, `auth`, `modal`, `settings`, `error`, `other`. Agent inferred; human can override. |
| `description` | string | human-editable | Prose. Agent generates; human can rewrite. |
| `fingerprint` | string | agent (locked) | sha256 of sorted `(role, label)` pairs from snapshot. Never human-edited. |
| `screenshotPath`, `snapshotPath` | string | agent (locked) | Relative paths into `assets/`. |
| `texts` | string[] | agent (locked) | Visible text snippets, top-to-bottom. |
| `primaryCta` | object | human-editable | Agent picks by prominence; human can reassign. `{label, role, selector}`. |
| `secondaryCtas` | object[] | human-editable | |
| `interactiveElements` | object[] | agent (locked) | Every tappable on screen. |
| `entryPaths` | object[] | mixed | Agent fills `via`/`fromScreen`/`action`; human can add `description`. |
| `appearsIn` | object[] | agent (derived) | Computed from flows; rebuilt every capture. |
| `_humanEdited` | string[] | system | Field names locked against re-capture overwrite. |

**Cascading consequences when `id` is renamed:**
- All `flows[].steps[].screenId` references updated.
- All `flows[].entryPoints[]` updated.
- All `decisionPoints[].screenId` updated.
- All other screens' `appearsIn` recomputed.

### `FlowEntry`

```json
{
  "slug": "password-reset",
  "name": "Password Reset",
  "parent": null,
  "summary": "Reset password via email OTP. Starts on login, ends at OTP verification.",
  "mode": "guided",
  "entryPoints": ["login"],
  "replay": {
    "path": "password-reset.ad",
    "entryFingerprint": "sha256:e0a3a14b9f22cd...",
    "confidence": "high",
    "credentialsTemplate": ["{{EMAIL}}"]
  },
  "steps": [
    {
      "number": 1,
      "title": "Sign In",
      "screenId": "login",
      "action": "Entry point",
      "selector": null,
      "description": "Login screen — flow starts here.",
      "screenshotPath": "assets/e0a3a14b9f22.png",
      "fingerprintBefore": "sha256:e0a3a14b9f22cd...",
      "fingerprintAfter": "sha256:e0a3a14b9f22cd..."
    },
    {
      "number": 2,
      "title": "Forgot Password",
      "screenId": "forgot-password",
      "action": "Tap \"Forgot password?\"",
      "selector": "label=\"Forgot password?\"",
      "description": "Email entry to receive a reset code.",
      "screenshotPath": "assets/a8d1f329b6e4.png",
      "fingerprintBefore": "sha256:e0a3a14b9f22cd...",
      "fingerprintAfter": "sha256:a8d1f329b6e4ab..."
    },
    {
      "number": 3,
      "title": "CAPTCHA",
      "screenId": "captcha",
      "action": "Solve CAPTCHA",
      "selector": "label=\"Verify\"",
      "description": "CAPTCHA challenge before OTP.",
      "screenshotPath": "assets/b7f2c8a1d932.png",
      "fingerprintBefore": "sha256:a8d1f329b6e4ab...",
      "fingerprintAfter": "sha256:b7f2c8a1d932cd..."
    }
  ],
  "notes": "Flow ends at OTP verification. Did not submit a real OTP.",
  "_humanEdited": ["notes"]
}
```

| Field | Type | Provenance | Notes |
|---|---|---|---|
| `slug` | string | human-editable | Stable. Rename cascades to `appearsIn[].flow`, `decisionPoints[].options[].flowSlug`, `.ad` filename, `replay.path`. |
| `name` | string | human-editable | Human label. |
| `parent` | string \| null | human-editable | Slug of parent flow if this is a subflow. |
| `summary` | string | human-editable | One-paragraph description. |
| `entryPoints` | string[] | mixed | Screen IDs. Agent infers; human can add/remove. |
| `replay` | object \| null | agent (locked) | The replay block as a whole may be `null` when the flow cannot be deterministically replayed (e.g. requires SMS OTP, one-time onboarding step, sensitive auth). When null, future re-captures fall back to LLM-walk. Validator emits a warning, not an error. |
| `replay.path` | string | agent (locked) | When `replay` is non-null, always `{slug}.ad` relative to capture dir. The `.ad` file must exist on disk. |
| `replay.entryFingerprint` | string | agent (locked) | Fingerprint of the entry screen at capture time. |
| `replay.confidence` | enum | agent (locked) | `"high" \| "medium" \| "low"`. Reflects how stable selectors look. |
| `replay.credentialsTemplate` | string[] | agent (locked) | Placeholders present in the `.ad` file (e.g. `{{EMAIL}}`, `{{PASSWORD}}`, `{{OTP}}`). |
| `steps[]` | object[] | agent (locked) | The captured sequence. Replaced on re-capture. |
| `steps[].selector` | string \| null | agent (locked) | The stable selector used to trigger this step. Null for entry-point step. |
| `steps[].fingerprintBefore/After` | string | agent (locked) | For change detection on re-capture. |
| `notes` | string | human-editable | Free-form. |

### `DecisionPoint`

```json
{
  "screenId": "login",
  "options": [
    { "label": "Sign in", "explored": true, "flowSlug": "sign-in" },
    { "label": "Sign in with Face ID", "explored": false },
    { "label": "Forgot password?", "explored": true, "flowSlug": "password-reset" }
  ]
}
```

| Field | Provenance | Notes |
|---|---|---|
| `screenId` | agent | Screen where the branch occurs. |
| `options[].label` | agent | From the snapshot. |
| `options[].explored` | human-editable | Agent sets initially; human can flip. |
| `options[].flowSlug` | mixed | Agent sets when an option was followed into a captured flow. Human can attach a slug to label an option as belonging to a known flow without re-walking it. |

### `ChangeEntry`

The `changes` array records what changed vs. `previousCapture`. Empty for `scope: "initial"`. Empty for re-captures with no detected changes.

```json
[
  {
    "kind": "screen-modified",
    "screen": "login",
    "fromFingerprint": "sha256:5b1ca2c34d18ef...",
    "toFingerprint": "sha256:e0a3a14b9f22cd...",
    "details": [
      { "kind": "element-added", "label": "Sign in with Face ID", "role": "button" }
    ]
  },
  { "kind": "screen-added", "screen": "captcha" },
  { "kind": "screen-removed", "screen": "tutorial" },
  {
    "kind": "flow-modified",
    "flow": "password-reset",
    "details": [
      { "kind": "step-added", "atIndex": 3, "screen": "captcha" },
      { "kind": "step-removed", "atIndex": 5 },
      { "kind": "step-modified", "atIndex": 2, "before": { "screenId": "old" }, "after": { "screenId": "new" } }
    ]
  },
  { "kind": "flow-added", "flow": "sms-verification" },
  { "kind": "flow-removed", "flow": "legacy-onboarding" }
]
```

Possible `kind` values: `screen-added`, `screen-modified`, `screen-removed`, `flow-added`, `flow-modified`, `flow-removed`, `decision-point-added`, `decision-point-removed`, `entry-point-changed`.

For `screen-modified.details[]`: `element-added`, `element-removed`, `element-modified`, `text-added`, `text-removed`, `role-changed`, `title-changed`.

For `flow-modified.details[]`: `step-added`, `step-removed`, `step-modified`, `entry-point-changed`, `selector-drift`.

## `.ad` file format

agent-device's native replay format. Each flow gets one. Selector-hardened during packaging — no `@eN` refs.

```json
[
  { "command": "open",   "positionals": ["com.acme.bank"], "flags": { "platform": "android", "relaunch": true } },
  { "command": "wait",   "positionals": ["id=\"primary-cta\"", "5000"], "flags": {} },
  { "command": "click",  "positionals": ["label=\"Forgot password?\""], "flags": {} },
  { "command": "wait",   "positionals": ["id=\"reset-email-input\"", "3000"], "flags": {} },
  { "command": "fill",   "positionals": ["id=\"reset-email-input\"", "{{EMAIL}}"], "flags": {} },
  { "command": "click",  "positionals": ["id=\"reset-submit\""], "flags": {} },
  { "command": "wait",   "positionals": ["label=\"Verify\"", "5000"], "flags": {} },
  { "command": "click",  "positionals": ["label=\"Verify\""], "flags": {} }
]
```

Templated placeholders (`{{EMAIL}}`, `{{PASSWORD}}`, `{{OTP}}`, `{{SEED_PHRASE}}`, etc.) are resolved from `credentials.md` at replay time. The agent injects them by substituting before calling `agent-device replay`.

## Field provenance summary

| Provenance | Behavior on re-capture |
|---|---|
| **agent (locked)** | Always re-derived from the new device state. Never preserved. |
| **agent (derived)** | Recomputed from other fields (e.g. `appearsIn` from flows). |
| **human-editable** | Preserved across re-captures if listed in `_humanEdited`. Otherwise the agent's fresh value wins. |
| **mixed** | Agent fills initial values; human may refine specific subfields. Honors `_humanEdited` at the field level. |

See [editing.md](editing.md) for how `_humanEdited` is set and respected.

## Schema enforcement

**The schemas above are the contract. The skill MUST NOT invent new top-level keys, new entity fields, or comment-as-string hacks during capture.**

### Forbidden patterns (real examples that broke a real capture)

```json
// ❌ Invented top-level array for "funded state" screens
{ "screens": [...], "screens_funded": [...] }

// ❌ Comment-as-string field
{ "fundedScreens": "-- Screens captured after wallet was funded with 1 USDC --" }

// ❌ Custom tag field not in the schema
{ "screens": [{ "id": "login", "tags": ["auth", "biometric"] }] }

// ❌ Empty-string selector
{ "interactiveElements": [{ "label": "Foo", "role": "button", "selector": "" }] }

// ❌ Null fingerprint at write time
{ "screens": [{ "id": "login", "fingerprint": null }] }
```

### Why each is forbidden

- **New top-level keys** are invisible to renderers and downstream agents that follow the schema. Splitting `screens` into multiple arrays hides screens from search and analysis. Use distinct screen IDs in a single array instead (see State-variant convention below).
- **Comment-strings** abuse JSON. If you need to annotate a section, use the entity's `notes` field. If you need a new structural field, ask for a schema extension.
- **Custom fields** drift across captures and across apps. Different agents will pick different names. Renderers can't consume them. Use the `notes` field for unstructured human notes.
- **Empty-string selectors** will fail at replay. Either pick a real selector or use `null`/omit the field.
- **Null fingerprints** break re-capture identity matching. Without them, the agent cannot tell "this screen modified" from "this screen replaced." Computed once per snapshot; cannot be skipped.

### What to do when you need more structure

When you encounter a need the schema doesn't cover:

1. **STOP.** Do not invent fields.
2. **Surface to the user.** Describe the need and propose a schema extension.
3. **Wait for approval.** The user decides whether to extend the schema (bump `schemaVersion`) or to model the need using existing fields.
4. **If approved, update this file first**, then the skill, then continue capturing.

Examples of needs that warrant a schema extension proposal:
- "I want to track which screens require authentication." → Could be `screen.preconditions[]`.
- "I want to mark screens that appear only on iOS/Android." → Could be `screen.platforms[]`.
- "I want to capture API responses per screen." → Large addition; needs design.

Examples that can be modeled today, no extension needed:
- "This screen has a funded-wallet variant." → Distinct screen IDs (`home-empty`, `home-funded`). See below.
- "I want to note an internal team comment." → `screen.notes` or `flow.notes`.
- "I want to track which flows are sensitive." → `flow.notes` with a clear marker (e.g. starts with `[sensitive]`).

### Pre-write validation

Every write of `capture.json` MUST be preceded by validation. Either run `scripts/validate-capture.mjs` (see below) or perform equivalent in-line checks:

| Check | Failure response |
|---|---|
| Top-level keys subset of allowed | abort write, fix |
| `screens[]` not empty | abort write, capture more screens |
| Every `screen.fingerprint` non-null | abort write, compute fingerprints |
| Every step's `fingerprintBefore` and `fingerprintAfter` non-null | abort write, compute |
| No empty-string `selector` anywhere (use null instead) | abort write, fix |
| Every `flows[].steps[].screenId` exists in `screens[].id` | abort write, fix |
| Every `flows[].entryPoints[]` exists in `screens[].id` | abort write, fix |
| Every `decisionPoints[].screenId` exists in `screens[].id` | abort write, fix |
| Every `decisionPoints[].options[].flowSlug` (if set) exists in `flows[].slug` | abort write, fix |
| Every `flows[].replay.path` file exists in this capture directory | abort write, generate or fix |
| Every `_humanEdited` field name appears on the entity | abort write, sanitize |
| `stats.screensInThisCapture` matches `screens.length` | recompute |
| No unrecognized keys at any nesting level | abort write, remove |

Validation failure → roll back the write, log diagnostics, ask the user.

## State-variant convention

When the same logical screen exists in multiple app states (empty wallet vs funded wallet, signed-in vs signed-out, free tier vs premium), **each variant gets its own screen ID in the same `screens[]` array.**

### Convention

- Use a suffix that names the state: `home-empty`, `home-funded`, `home-signed-out`.
- Each variant has its own fingerprint (it captures a different set of interactive elements).
- Flows reference the specific variant in `steps[].screenId` and `entryPoints[]`.
- Decision points reference the specific variant in `screenId`.

### Examples (from a wallet app)

```json
{
  "screens": [
    {
      "id": "home-empty",
      "title": "Home (Empty Wallet)",
      "description": "Dashboard with $0 balance...",
      "fingerprint": "sha256:..."
    },
    {
      "id": "home-funded",
      "title": "Home (Funded)",
      "description": "Dashboard with $1 balance, Send and Trade actions enabled...",
      "fingerprint": "sha256:..."
    },
    {
      "id": "home-signed-out",
      "title": "Home (Signed Out)",
      "description": "Welcome screen with Sign In and Create Account buttons...",
      "fingerprint": "sha256:..."
    }
  ],
  "flows": [
    { "slug": "deposit",      "entryPoints": ["home-empty"] },
    { "slug": "send",         "entryPoints": ["home-funded"] },
    { "slug": "sign-in",      "entryPoints": ["home-signed-out"] }
  ]
}
```

**How variants relate to flows.** A variant screen is surfaced by the flow that reaches it — never by sitting next to another variant as adjacent steps. The state-changing journey IS a flow: `deposit` enters on `home-empty` and ends on `home-funded` (the empty→funded bridge); `sign-in` enters on `home-signed-out`. Pick one primary state (usually the populated one) as the spine for section walkthroughs; alternative-state screens hang off the flow that produces them, or off a parenthetical variant sibling (`Trading a token (no funds)`). Full rules: [exploration.md](exploration.md) → State: model state changes as flows.

### Why this works

- Renderers see all variants in one place — they can show all "home" variants side by side.
- Agents querying "show me all funded-state screens across apps" can filter by ID suffix (`*-funded`) or by precondition described in `description`/`notes`.
- The capture stays valid against the schema with no extensions.
- Re-capture matches variants by their distinct fingerprints — `home-empty` and `home-funded` won't be confused.

### What NOT to do

```json
// ❌ Splitting into multiple arrays
{ "screens": [...empty-state screens...], "screens_funded": [...funded-state screens...] }

// ❌ Adding a state field outside the schema
{ "screens": [{ "id": "home", "state": "funded", ... }] }

// ❌ Same ID for multiple variants
{ "screens": [
    { "id": "home", "title": "Home (Empty)" },
    { "id": "home", "title": "Home (Funded)" }   // duplicate ID — invalid
] }
```

If you genuinely need structured state information (e.g., to enable cross-app queries like "which apps support a guest/anonymous mode?"), that's a schema-extension proposal — bring it to the user.

## Schema versioning

Every JSON file has `schemaVersion: 1`. Bump on breaking changes. Readers should error loudly on unrecognized major versions rather than silently parse.

## Validation script

`scripts/validate-capture.mjs` is the canonical implementation of the checks above. Run it on every `capture.json` before write:

```bash
node {SKILL_DIR}/scripts/validate-capture.mjs {OUTPUT_DIR}/{app-slug}/{date}/capture.json
```

Exit code 0 = pass. Non-zero = fail; stderr has specifics. Do not write a capture that fails validation.
