# Editing captured data

Conversational edits target one of two committed sources. Screen-observation corrections go
to `graph.json.overrides`; reader-facing semantic edits go to `flows.json`. `view.json` and
`index.json` are generated.

## Workflow

1. Resolve the app's latest capture from `app.json`.
2. Read its `graph.json` and `flows.json`.
3. Identify whether the request changes observed screen identity or semantic packaging.
4. Edit the relevant source.
5. Run the strict validator/package command and regenerate data.
6. Show the resulting semantic or screen change to the user.

```bash
node scripts/flows.ts validate <date>/graph.json <date>/flows.json --strict
node scripts/package.ts <date>/graph.json
pnpm build-data
```

## Edit mapping

| Request | Source edit |
|---|---|
| Rename a flow | change `flows[].name`; keep its stable `id` |
| Re-parent or reorder a flow | change `parentId` or `order` |
| Add/remove/reorder semantic steps | change `steps` |
| Record another visible origin | add its flow, source screen, and destination screen to `entryPoints` |
| Explain an intentional omission | change `uncovered` |
| Record unresolved semantics | add a `flowTODO` draft item |
| Fix screen role/title/description | change `overrides.screens[id]` |
| Correct a derivation label/group | change `overrides.screens[id].state/stateGroup` |
| Force an exact merge | change `overrides.merges` |
| Prevent an incorrect merge/family | change `overrides.splits` |

Flow grouping follows [flow-grouping.md](flow-grouping.md). Screen names, derivation labels,
flow names, and stable ids follow [naming.md](naming.md).

## Semantic examples

Rename without moving the URL:

```jsonc
{ "id": "password-recovery", "name": "Recovering a password", ... }
```

Canonical placement plus an alternate origin:

```jsonc
{
  "id": "adding-money",
  "name": "Adding money",
  "parentId": "home",
  "order": 1,
  "steps": ["add-money-source"],
  "entryPoints": [
    {
      "flowId": "earn",
      "fromScreenId": "earn",
      "toScreenId": "add-money-source"
    }
  ]
}
```

One primary member for a derivation group:

```jsonc
// graph.json overrides
"gold-detail": { "title": "Asset detail", "stateGroup": "asset-detail", "state": "Gold" },
"wbtc-detail": { "title": "Asset detail", "stateGroup": "asset-detail", "state": "Wrapped BTC" }

// flows.json
{ "id": "viewing-assets", "steps": ["gold-detail"], ... }
```

## Read-only queries

- List flows: `node scripts/package.ts <latest>/graph.json`.
- Inspect canonical screen inventory: `node scripts/flows.ts inventory <latest>/graph.json`.
- Find a screen's flows: package with `--json` and read `screens[].appearsIn`.
- Audit all captures: `pnpm flows:audit --all`.

The temporal retention/provenance/re-binding system is deferred. Editing the current source
does not create provenance records or automatically rebind references in another capture.
