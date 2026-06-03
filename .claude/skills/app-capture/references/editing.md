# Editing Reference

How the skill handles ambient, conversational edits to captured data. **Every edit is made by writing to `graph.json`'s `overrides{}` block and re-running the packager** — never by hand-editing the derived `view.json`. `overrides` is the single edit surface, and it is carried forward verbatim across re-captures (see [temporal.md](temporal.md) → `overrides` copy-forward), so a correction made once persists.

## When to recognize an edit

The skill recognizes edit-shaped requests during normal conversation. Trigger phrases (non-exhaustive):

- "Rename {flow} to {new name}"
- "{flow} is a subflow of {parent}" / "Promote {X} to the top level" / "Demote {X}"
- "The {screen}'s role/title/description is wrong, it's actually {value}"
- "Mark {screen} as the empty/loading/error state of {group}"
- "These two screens are the same — merge them" / "Don't merge {A} and {B}, they're different"

If the request is ambiguous, ask before modifying. **Edits are never silent** — confirm what was changed and that you re-ran the packager.

## Edit workflow

```
1. Identify the target app slug.
   - Explicit: the user names the app.
   - Implicit: the user names an entity — package each app's latest graph.json and search the
     derived view. Unique → proceed. Ambiguous → ask which app.

2. Locate the entity in the derived view.
   - node scripts/package.ts {latestCapture}/graph.json   (or --json for the full View)
   - Resolve the flow id (= its anchor node id) or the node id you need to target.

3. Write the override.
   - Read {app-slug}/app.json → latestCapture; open {latestCapture}/graph.json.
   - Add/update the right key under `overrides` (table below). Atomic write (tmp + rename).

4. Re-derive and confirm.
   - node scripts/package.ts {latestCapture}/graph.json  (must exit 0).
   - Show the user the change in the re-derived view (renamed flow, new parent, merged screen).
```

The flow tree, screen states, names, and replay are all derived — to change them you change the *input* (`graph.json` + `overrides`) and re-run, never the *output*. If `package.ts` fails or warns (e.g. an override pointing at an unknown node id), fix the override.

## Common edits → override keys

Exact types: `lib/packager/types.ts` → `Overrides`. Flow ids are anchor node ids (`lib/packager/segment.ts`); node ids are stable across re-captures.

| Request | Override |
|---|---|
| Rename a flow | `overrides.flowNames["<flow-id>"] = "New Name"` |
| Re-parent a flow under another | `overrides.structure["<flow-id>"] = { parent: "<parent-flow-id>" }` |
| Force a flow to the top level | `overrides.structure["<flow-id>"] = { topLevel: true }` (or `{ parent: null }`) |
| Promote a screen to its own flow | `overrides.structure["<node-id>"] = { promote: true }` |
| Demote a screen (don't make it a flow) | `overrides.structure["<node-id>"] = { promote: false }` |
| Fix a screen's role / title / description | `overrides.screens["<node-id>"] = { role: "picker", title: "…", description: "…" }` |
| Force a screen's state / group (on-step toggle) | `overrides.screens["<node-id>"] = { state: "empty", stateGroup: "<logical-screen-id>" }` |
| Merge screens the packager kept separate | `overrides.merges = [["<node-a>", "<node-b>", …]]` |
| Split screens the packager merged | `overrides.splits = ["<node-id>", …]` |

`flowNames` is the most common edit — it's where the `namingTODO` from packaging lands (see [exploration.md](exploration.md) → Package). The fields under each `structure` / `screens` key are optional; set only what you're correcting.

### Notes on specific edits

- **Naming.** Gerund + object for actions (`Buying a token`), plain noun for sections/details (`Settings`, `Token detail`). Avoid filler gerunds on sections — `Settings`, not `Browsing settings`.
- **Re-parenting cycles.** Don't set a flow's `parent` to one of its own descendants. The packager assigns a deterministic parent by default; only override when its choice is wrong.
- **State (`screens[id].state`/`stateGroup`).** Use this only when the packager misclassified an in-place variant. Tag against a default: a group should have one `default` plus ≥1 alternate. A lone empty screen *is* the screen, not an "empty state" — leave it alone. The mechanics live in `lib/packager/classify.ts`; you're just forcing its outcome.
- **Merge vs. split.** `merges` forces two node ids into one logical screen (e.g. the SAF saw a data-only difference as distinct); `splits` keeps nodes apart that it merged (e.g. two genuinely different screens with the same skeleton). Both take node ids, not flow ids.

## Cross-app edits

A common pattern: apply the same correction across many apps for consistency.

```
User: "For all apps with a password-reset flow, rename it to 'Forgot password'."
```

1. For each `{app-slug}/app.json`, find `latestCapture` and package its `graph.json`.
2. Find the matching flow (by slug/name) and note its flow id (anchor node id).
3. Present the matches; **never bulk-edit silently — always preview.**
4. Apply `overrides.flowNames["<flow-id>"]` per app and re-run `package.ts` for each.

## Read queries (not edits)

When the user asks to **read**, skip the override pipeline:

- "Show me the login screen of acme-bank" → package the latest graph, find the screen in the view, display its screenshot + summary.
- "List flows for acme-bank" → `node scripts/package.ts {latest}/graph.json` (flow tree). See [temporal.md](temporal.md) → Listing flows.
- "What changed in the last capture?" → package the two adjacent graphs and diff their nodes/edges ([temporal.md](temporal.md) → Graph-based diffing).

These don't touch `overrides` and don't write any files.

## Safety rules

- **Edit the source, re-derive the output.** Never hand-edit `view.json` — it is regenerated and your change would be lost. Mutate `overrides`, then run `package.ts`.
- **Validate after every edit.** `node scripts/package.ts {graph.json}` must exit 0 and should be free of override warnings (an override key that isn't a node id means a stale or mistyped reference — fix it).
- **Atomic writes.** Tmp file + rename on `graph.json`; never truncate-and-write.
- **Don't delete via edit.** Screens/flows disappear through re-capture (when the device walk no longer reaches them), not by editing. If the user explicitly wants to drop one, confirm and back up `graph.json` first.
- **Edits target the latest capture only.** Prior dated `graph.json` files stay frozen as historical record. The `overrides` you write are carried forward to the next capture automatically.
- **Confirm wide changes.** If a cross-app or multi-flow edit touches several apps, show the preview and require confirmation.
- **Never invent fields.** If a request can't be expressed via an `overrides` key, it's a schema-extension proposal — bring it to the user (see [schema.md](schema.md)), don't add an ad-hoc field.

## Edit examples

### Rename a flow

```
User: Rename the "forgot password" flow to "Password recovery".

Agent: Editing acme-bank/2026-05-25/graph.json:
  overrides.flowNames["forgot-password"] = "Password recovery"
Re-ran package.ts (exit 0). The flow now reads "Password recovery [password-recovery]"
in the derived view. Preserved across future re-captures.
```

### Re-parent

```
User: "Selecting a coin" should sit under "Buying a token", not at the top level.

Agent: overrides.structure["coin-picker"] = { parent: "buy-amount" }
Re-ran package.ts (exit 0). "Selecting a coin" is now a child of "Buying a token".
```

### Fix a screen's role + force a state

```
User: The activity-empty screen is the empty state of the Activity tab, and it's a list not "other".

Agent: overrides.screens["activity-empty"] = { role: "list", state: "empty", stateGroup: "activity" }
Re-ran package.ts (exit 0). It now folds onto the Activity step as an Empty switcher.
```

### Merge two screens the packager split

```
User: home-1usdc and home-2usdc are the same screen with different balances — merge them.

Agent: overrides.merges = [["home-1usdc", "home-2usdc"]]
Re-ran package.ts (exit 0). They collapse to one logical Home screen.
```

### Read query (no edit)

```
User: Show me the login screen of acme-bank.

Agent: [packages latest graph, shows assets/{hash}.png]
Login (acme-bank) — role: auth — 5 interactive elements — primary CTA: Sign in
Appears in: Logging in (step 1), Password recovery (step 1)
```
