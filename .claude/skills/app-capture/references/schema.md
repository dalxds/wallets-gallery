# Schema Reference

What the skill writes on disk, and where the contract lives. **`lib/packager/types.ts` is the authoritative shape definition** — quote field names from there; do not invent fields.

## File index

| Path | Purpose | Source / generated |
|---|---|---|
| `{app-slug}/app.json` | App-level manifest: metadata + capture index + latest pointer | written by the agent (every capture/edit) |
| `{app-slug}/{date}/graph.json` | **THE capture** — `nodes` + `edges` + `decisionPoints` + `overrides` | **source of truth**, written by the agent |
| `{app-slug}/{date}/view.json` | Derived screens + flow tree + inline `.ad` replay | **generated** by `pnpm build-data`; never hand-edited (gitignore-able) |
| `{app-slug}/assets/{sha256-12}.png` | Content-addressed screenshot, deduped across captures | written by the agent |
| `{app-slug}/assets/{sha256-12}.snap.json` | Content-addressed raw snapshot | written by the agent |
| `{app-slug}/credentials.md` | Auth details (free-form markdown), gitignored | written by the agent |
| `{app-slug}/_staging/master.ad` | Recorded command script (`--save-script`); source for replay hardening | written by agent-device |

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

## `graph.json` (the capture)

The single source-of-truth file per capture. It is `schemaVersion: 2`. Exact field types: `lib/packager/types.ts` → `Graph`, `GraphNode`, `GraphEdge`, `DecisionPoint`, `Overrides`, `GraphMeta`.

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
      "routeKey": "com.acme.bank:id/login_root",
      "role": "auth",
      "screenshotPath": "assets/e0a3a14b9f22.png",
      "snapshotPath": "assets/e0a3a14b9f22.snap.json",
      "texts": ["Sign In", "Email", "Password", "Forgot password?"],
      "interactiveElements": [
        { "label": "Sign in", "role": "button", "selector": "id=\"primary-cta\"" },
        { "label": "Forgot password?", "role": "button", "selector": "label=\"Forgot password?\"" }
      ],
      "primaryCta": { "label": "Sign in", "role": "button", "selector": "id=\"primary-cta\"" }
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

- **`nodes[]`** — screen states observed during the walk. Each carries four identity signals (`fingerprint`, `skeletonHash`, `pHash`, `routeKey`), content (`texts`, `interactiveElements`, `primaryCta`, `secondaryCtas`), `role`, and asset paths. How to record one: [exploration.md](exploration.md) → Per-screen capture routine. Algorithms: [temporal.md](temporal.md) → Identity signals.
- **`edges[]`** — observed transitions `{from, to, action, selector, kind, observedAtStep}`. `kind` ∈ `nav` / `overlay` / `in-place` / `back`. An `in-place` edge (post-tap `skeletonHash` equals pre-tap) is the deterministic signal the packager uses for on-step state toggles.
- **`decisionPoints[]`** — branch points `{nodeId, options[{label, explored, toNode?}]}`.
- **`root`** — the launch node id (BFS root).
- **`overrides`** — see below.

### `overrides` — the only hand-edited block

Written exclusively by the edit agent and carried forward verbatim across re-captures. Each key corrects something the packager derived; after editing, re-run the packager. Shape: `types.ts` → `Overrides`. Full edit guide: [editing.md](editing.md).

| Key | Type | Corrects |
|---|---|---|
| `flowNames` | flow-id → name | the name of a derived flow (flow id = its anchor node id) |
| `structure` | flow-id → `{parent?, promote?, topLevel?}` | the derived tree: re-parent, force/suppress promotion to its own flow, pin top-level |
| `screens` | node-id → `{role?, title?, description?, state?, stateGroup?}` | a screen's facts, incl. forcing its state classification / group |
| `merges` | node-id groups (`string[][]`) | force-merge nodes the packager kept separate into one logical screen |
| `splits` | node-ids (`string[]`) | force-keep nodes distinct that the packager would merge |

## `view.json` (derived)

`view.json` is **generated** by `packageGraph(graph)` (`lib/packager/index.ts`) and never hand-edited. It holds the merged `screens[]`, the `flows[]` tree (each with ordered `steps[]` and an inline `.ad` `replay` command list), `decisionPoints[]`, and `stats` — this is what the static build renders. Its shapes are `types.ts` → `View` / `ViewScreen` / `ViewFlow` / `ViewStep` / `ViewReplay`. To change anything in it, edit `graph.json`'s `overrides` and re-run, not the file.

## Screen states & validation (handled by the packager)

You no longer classify states or hand-enforce schema rules. **State classification** lives in `lib/packager/classify.ts`: it labels each screen `default`/`empty`/`loading`/`error`/`max` and routes non-default variants as an on-step *toggle* (an `in-place` edge between variants of one screen), a *divergent* sibling flow, or a *lifecycle* step — `overrides.screens[id].state`/`stateGroup` force a specific outcome. **Validation** lives in `lib/packager/validate.ts`, run via `node scripts/package.ts <graph.json>`: it fails loudly on a missing/invalid `fingerprint` (must match `sha256:` or `sha256-text:`), a `root`/edge/decision-point reference not in `nodes[]`, any empty-string selector (use `null`), or `meta.schemaVersion !== 2`, and warns on overrides that point at unknown node ids. Run it before finishing — it must exit 0.

## Schema versioning

`graph.json` is `schemaVersion: 2`; `app.json` is `schemaVersion: 1`. Bump on breaking changes; readers should error loudly on an unrecognized major version rather than silently parse. Need a field the contract doesn't have? STOP and propose a schema extension to the user — don't invent keys.
