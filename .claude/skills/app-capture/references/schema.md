# Schema Reference

What the skill writes on disk, and the full shape of each file. **This doc is the contract — record fields from here; do not invent fields.** (`lib/packager/types.ts` is the engine's own copy of these types — read it only if you want to confirm the mechanism; you never need to for a capture.)

## File index

| Path | Purpose | Source / generated |
|---|---|---|
| `{app-slug}/_staging/walk.json` | **What you author** — raw observation: `nodes` (no hashes) + `edges` + `decisionPoints` + `meta` | written by the agent during the walk |
| `{app-slug}/{date}/graph.json` | **THE capture** — `nodes` + `edges` + `decisionPoints` + `overrides` | **source of truth**, produced by `assemble.ts` from `walk.json` |
| `{app-slug}/app.json` | App-level manifest: metadata + capture index + latest pointer | written by the agent (every capture/edit) |
| `{app-slug}/{date}/view.json` | Derived screens + flow tree + inline `.ad` replay | **generated** by `pnpm build-data`; never hand-edited (gitignore-able) |
| `{app-slug}/assets/{sha256-12}.png` | Content-addressed screenshot, deduped across **this app's** dated captures | written by `assemble.ts` |
| `{app-slug}/assets/{sha256-12}.snap.json` | Content-addressed raw snapshot | written by `assemble.ts` |
| `{app-slug}/credentials.md` | Auth details (free-form markdown), gitignored | written by the agent |
| `{app-slug}/_staging/master.ad` | Recorded command script (`--save-script`); source for replay hardening | written by agent-device |

## `walk.json` (what you author)

The single artifact you write during exploration. `assemble.ts` turns it into `graph.json` — computing the four identity signals, content-addressing the staging shots/snaps into `assets/`, and finalizing each edge's `kind`. You record **raw observation only; never a hash**.

```json
{
  "meta": { "app": { "name": "Acme Bank", "slug": "acme-bank", "bundleId": "com.acme.bank", "platform": "android" },
            "captureDate": "2026-05-25", "scope": "initial", "mode": "guided", "previousCapture": null },
  "root": "login",
  "mainNav": ["home", "accounts", "settings"],                   // optional: main-nav landing screens (see below)
  "nodes": [
    {
      "id": "login",
      "role": "auth",
      "shot": "public/captures/acme-bank/_staging/003.png",     // staging path, relative to repo root
      "snap": "public/captures/acme-bank/_staging/003.snap.json", // or null in Tier 2/3
      "texts": ["Sign In", "Email", "Password", "Forgot password?"],
      "interactiveElements": [
        { "label": "Sign in", "role": "button", "selector": "id=\"primary-cta\"", "emphasis": "primary" },
        { "label": "Forgot password?", "role": "button", "selector": "label=\"Forgot password?\"" }
      ]
    }
  ],
  "edges": [
    { "from": "login", "to": "forgot-password", "action": "Tap \"Forgot password?\"", "selector": "label=\"Forgot password?\"" }
  ],
  "decisionPoints": [
    { "nodeId": "login", "options": [
      { "label": "Sign in", "explored": true, "toNode": "home" },
      { "label": "Forgot password?", "explored": true, "toNode": "forgot-password" } ] }
  ]
}
```

- **`nodes[]`** — one per unique screen. Record `id`, `role`, `texts`, `interactiveElements`, and the `shot`/`snap` staging paths. Tag the screen's main call-to-action inline on its element with `"emphasis": "primary"` (and `"secondary"` for a notable alternate) — there is no separate `primaryCta` field. **No `fingerprint`/`skeletonHash`/`pHash`/`screenshotPath`** — assemble computes those. Reuse the same `id` when you re-encounter a screen (record only new edges from it).
- **`edges[]`** — `{from, to, action}` plus optional `selector` (a real selector or omit/`null`) and optional `kind`. Record `kind` **only** for `back` (you pressed back) or `overlay` (a sheet over the prior screen); assemble derives `in-place` vs `nav` from skeleton equality. `observedAtStep` is optional (defaults to walk order).
- **`decisionPoints[]`** — `{nodeId, options[{label, explored, toNode?}]}`.
- **`mainNav[]`** — optional. Node ids of the app's persistent main-navigation destinations (bottom-tab bar / nav rail / drawer) — the landing screen each nav item navigates to, home/default tab included. The packager makes each a **top-level flow that roots its own subtree** instead of nesting it under whatever launched it. Omit for apps with no persistent main nav. A bad id fails validation.
- **`overrides`** — omit on a fresh capture. On a re-capture, copy the prior `graph.json`'s `overrides` here verbatim so assemble carries it forward.

## `app.json`

Thin manifest. A single read tells you what apps exist and where the latest state is.

```json
{
  "schemaVersion": 1,
  "app": { "name": "Acme Bank", "slug": "acme-bank", "bundleId": "com.acme.bank", "platform": "android" },
  "firstCapturedAt": "2026-04-12",
  "lastCapturedAt": "2026-05-25",
  "latestCapture": "2026-05-25",
  "captures": [
    { "date": "2026-05-25", "scope": "flow", "mode": "guided", "previousCapture": "2026-04-12", "path": "2026-05-25/graph.json" },
    { "date": "2026-04-12", "scope": "initial", "mode": "guided", "previousCapture": null, "path": "2026-04-12/graph.json" }
  ]
}
```

`slug` is lowercase-dashes and stable across captures. `latestCapture` is the pointer readers use for "current state". `captures[].previousCapture` chains history (`null` for the first). `scope` ∈ `initial` / `full` / `flow`.

## `graph.json` (the capture — assemble's output)

The committed source-of-truth file per capture, `schemaVersion: 2`. **You don't hand-write this** — `assemble.ts` produces it from `walk.json`, adding the computed identity signals (`fingerprint`, `skeletonHash`, `pHash`) and the content-addressed asset paths (`screenshotPath`, `snapshotPath`), and finalizing each edge's `kind`. The only part you ever hand-edit afterward is `overrides`. Below is what a finished node/edge looks like.

```json
{
  "meta": {
    "schemaVersion": 2,
    "app": { "name": "Acme Bank", "slug": "acme-bank", "bundleId": "com.acme.bank", "platform": "android" },
    "captureDate": "2026-05-25",
    "scope": "full",
    "mode": "guided",
    "previousCapture": "2026-04-12"
  },
  "root": "login",
  "nodes": [
    {
      "id": "login",
      "fingerprint": "sha256:e0a3a14b9f22cd0b1f4e7a90",
      "skeletonHash": "sk:91b3e0c2a7d4f1098e2c5b6a",
      "pHash": "p:c1a2b3d4e5f60718",
      "role": "auth",
      "screenshotPath": "assets/e0a3a14b9f22.png",
      "snapshotPath": "assets/e0a3a14b9f22.snap.json",
      "texts": ["Sign In", "Email", "Password", "Forgot password?"],
      "interactiveElements": [
        { "label": "Sign in", "role": "button", "selector": "id=\"primary-cta\"", "emphasis": "primary" },
        { "label": "Forgot password?", "role": "button", "selector": "label=\"Forgot password?\"" }
      ]
    }
  ],
  "edges": [
    { "from": "login", "to": "forgot-password", "action": "Tap \"Forgot password?\"",
      "selector": "label=\"Forgot password?\"", "kind": "nav", "observedAtStep": 3 }
  ],
  "decisionPoints": [
    { "nodeId": "login", "options": [
      { "label": "Sign in", "explored": true, "toNode": "home" },
      { "label": "Forgot password?", "explored": true, "toNode": "forgot-password" }
    ] }
  ],
  "overrides": {}
}
```

- **`nodes[]`** — screen states. Three computed identity signals (`fingerprint`, `skeletonHash`, `pHash`) from `assemble.ts`, plus content (`texts`, `interactiveElements`, with CTAs tagged inline via `emphasis`), `role`, and asset paths. What you record (in walk.json): [exploration.md](exploration.md) → Per-screen capture routine. What the signals mean: [temporal.md](temporal.md) → Identity signals.
- **`edges[]`** — transitions `{from, to, action, selector, kind, observedAtStep}`. `kind` ∈ `nav` / `overlay` / `in-place` / `back`. An `in-place` edge (from/to share a `skeletonHash`) is the deterministic state-toggle signal — assemble derives `in-place`/`nav`; you record only `back`/`overlay`.
- **`decisionPoints[]`** — branch points `{nodeId, options[{label, explored, toNode?}]}`.
- **`root`** — the launch node id (BFS root).
- **`mainNav`** — optional main-navigation landing-screen ids; each becomes a top-level flow (carried through from `walk.json`).
- **`overrides`** — see below.

### `overrides` — the only hand-edited block

Written exclusively by the edit agent and carried forward verbatim across re-captures. Each key corrects something the packager derived; after editing, re-run the packager. Shape: the table below. Full edit guide: [editing.md](editing.md).

| Key | Type | Corrects |
|---|---|---|
| `flowNames` | name-key → name | the name of a derived flow. The key is the flow's **name key** (`nameKey` in `view.namingTODO`): its first distinctive screen (`steps[1]`, or the launch screen for a one-step hub), not its goal. Decoupled from the routing slug, so cross-section copies share one authored name |
| `structure` | flow-id → `{parent?}` | the derived tree: re-parent a flow (`parent: null` pins it top-level). Main-nav sections are handled generally by `mainNav` — no per-flow override needed |
| `screens` | node-id → `{role?, title?, description?, state?, stateGroup?}` | a screen's facts, incl. forcing its state classification / group |
| `merges` | node-id groups (`string[][]`) | force-merge nodes the packager kept separate into one logical screen |
| `splits` | node-ids (`string[]`) | force-keep nodes distinct that the packager would merge |

## `view.json` (derived)

`view.json` is **generated** by the packager (`pnpm build-data`) and never hand-edited. It holds the merged `screens[]`, the `flows[]` tree (each with ordered `steps[]` and an inline `.ad` `replay` command list), `decisionPoints[]`, and `stats` — this is what the static build renders. To change anything in it, edit `graph.json`'s `overrides` and re-run, not the file.

## Screen states & validation (handled by the packager)

You no longer classify states or hand-enforce schema rules — both are deterministic and handled for you. **State classification** labels each screen `default`/`empty`/`loading`/`error`/`max` and routes non-default variants as an on-step *toggle* (an `in-place` edge between variants of one screen), a *divergent* sibling flow, or a *lifecycle* step — `overrides.screens[id].state`/`stateGroup` force a specific outcome. **Validation** runs twice: `assemble.ts` validates before it writes `graph.json` (and refuses to write on error), and `node scripts/package.ts <graph.json>` validates again. It fails loudly on a missing/invalid `fingerprint` (must match `sha256:` or `sha256-text:`), a `root`/edge/decision-point reference not in `nodes[]`, any empty-string selector (use `null`), or `meta.schemaVersion !== 2`, and warns on overrides that point at unknown node ids. Both must exit 0 before you finish.

## Schema versioning

`graph.json` is `schemaVersion: 2`; `app.json` is `schemaVersion: 1`. Bump on breaking changes; readers should error loudly on an unrecognized major version rather than silently parse. Need a field the contract doesn't have? STOP and propose a schema extension to the user — don't invent keys.
