# Editing Reference

How the skill handles ambient, conversational edits to captured data. Edits modify the latest `capture.json`, cascade across references, and stamp `_humanEdited` to survive future re-captures.

## When to recognize an edit

The skill recognizes edit-shaped requests during normal conversation. Trigger phrases (non-exhaustive):

- "Change the {field} of {entity} to {value}"
- "Rename {entity} to {new name}"
- "Update {entity}'s {field}"
- "The {entity}'s {field} should be {value}"
- "{entity}'s {field} is wrong, it's actually {value}"
- "Add a note to {entity}: {note}"
- "Mark {decision option} as explored"
- "Set the primary CTA on {screen} to {label}"
- "{entity} is a subflow of {parent}"

If the request is ambiguous, ask for clarification before modifying. **Edits are never silent** — confirm what was changed and where.

## Edit workflow

```
1. Identify target app slug.
   - Explicit: user names the app.
   - Implicit: user names an entity without app context — search across apps' latest capture.json files. If unique, proceed. If ambiguous, ask which app.

2. Load latest capture.
   - Read {app-slug}/app.json → latestCapture.
   - Read {latestCapture}/capture.json.

3. Resolve entity and field.
   - Screen: find by id, fingerprint, or title (case-insensitive prefix match).
   - Flow: find by slug or name.
   - Step: find by flow + step number/title/screenId.
   - Decision option: find by screenId + label.
   - If ambiguous, ask.

4. Validate the change.
   - Type check (e.g. role must be one of the allowed enum values).
   - Cascade preview: if a rename, identify all references that will be updated.
   - Show the user a preview of changes before applying when there are cascades.

5. Apply the change.
   - Mutate the entity in memory.
   - Add the field name to the entity's _humanEdited array.
   - Cascade references (see below).
   - Recompute derived fields (e.g. appearsIn from flows).

6. Validate invariants.
   - All cross-references still resolve.
   - Slugs are unique within their type (screen IDs unique among screens, flow slugs unique among flows).

7. Write back.
   - Atomic write to {latestCapture}/capture.json.
   - If a flow slug changed, rename the .ad file too.

8. Confirm to the user.
   - State what changed.
   - State what cascaded.
   - State that the field is now locked against re-capture overwrites.
```

## Cascading references

### Screen `id` rename: `login` → `sign-in`

Updates required (all atomic):
- `screens[].id` for that screen.
- `flows[].steps[].screenId` everywhere it appeared.
- `flows[].entryPoints[]` for every flow listing the screen as an entry.
- `decisionPoints[].screenId` if the renamed screen had a decision point.
- `decisionPoints[].options[].flowSlug` references aren't affected (those reference flows, not screens).
- Recompute `screens[].appearsIn[]` (derived).

Validation:
- New id must be unique among `screens[].id`.
- New id must be valid slug (lowercase, dashes, no special chars).

### Flow `slug` rename: `password-reset` → `forgot-password`

Updates required:
- `flows[].slug` for that flow.
- `screens[].appearsIn[].flow` everywhere.
- `decisionPoints[].options[].flowSlug` where matching.
- `flows[].replay.path` from `password-reset.ad` to `forgot-password.ad`.
- Rename the actual file on disk: `{date}/password-reset.ad` → `{date}/forgot-password.ad`.
- `flows[].parent` references for any sub-flow whose parent was renamed.

Validation:
- New slug must be unique among `flows[].slug`.
- New slug must be valid slug format.
- File rename must succeed before JSON write commits.

### Screen `role` change: `list` → `picker`

- Update `screens[].role`.
- No cascades — role is purely descriptive.

### Decision option `explored` flip

- Update `decisionPoints[].options[].explored`.
- If flipping to true and no `flowSlug` is set, ask if the option should be linked to a known flow.
- If flipping to false and a `flowSlug` is set, ask if the link should be cleared.

### Flow `parent` set

- Update `flows[].parent` to the new parent slug.
- Validate the parent exists in `flows[]`.
- No cycle: parent's parent chain must not include this flow.

### Step `description` edit

- Update `flows[].steps[N].description`.
- No cascades.

### Setting `primaryCta` override

- Update `screens[].primaryCta` to point at a specified element.
- The element must exist in `interactiveElements[]`.
- The displaced previous primaryCta moves to `secondaryCtas[]`.
- If the user names an element not currently in `interactiveElements[]`, ask whether they want to add it (rare; usually means a re-capture should happen first).

## `_humanEdited` semantics

A list of field names on the entity that have been human-edited and should be preserved across re-captures.

### Adding to the list

Whenever a chat-edit changes a field listed as `human-editable` in [schema.md](schema.md), add the field name to `_humanEdited` if not already present.

```javascript
// Pseudo
entity._humanEdited = entity._humanEdited || []
if (!entity._humanEdited.includes(fieldName)) {
  entity._humanEdited.push(fieldName)
}
```

### What survives re-capture

During re-capture's copy-forward pass:

1. Match new entity to prior by stable identity (fingerprint for screens, slug for flows).
2. Start with the new captured data.
3. For each field in prior's `_humanEdited`:
   a. If the field exists in the new entity, replace its value with prior's value.
   b. Otherwise (field structure changed), surface to user.
4. Preserve `_humanEdited` array in the new entity.

### When re-capture should ask before preserving

Some structural changes make a locked field nonsensical:

- Locked `role: "auth"` but the screen's elements have nothing to do with auth.
- Locked `title: "Send Money"` but the screen's primary action is now "Receive".
- Locked `primaryCta` pointing to an element that no longer exists.

In these cases, surface a prompt:

```
The login screen's role is locked to "auth", but the screen has changed substantially
(no more email/password fields, primary action is now "Verify identity").

Should I:
  1. Keep the locked role (auth)
  2. Update to my inference (verification)
  3. Let you set a new value
```

### Removing from the list

To "unlock" a field so re-capture can overwrite it:

```
User: "Unlock the title of the login screen so future captures can update it"
```

Remove the field name from `_humanEdited`. The value stays as-is until next re-capture.

## Cross-app edits

A common pattern: rename or annotate the same field across many apps for consistency.

```
User: "For all apps with a password reset flow, rename the flow to 'forgot-password'"
```

The skill should:
1. Search all `{app-slug}/app.json` for `latestCapture`.
2. For each, search `flows[]` for `slug: "password-reset"` (or similar).
3. Present the matches to the user before applying.
4. Apply renames in sequence, each cascading per-app.

Never bulk-edit silently. Always preview cross-app changes.

## Adding free-form annotations

For fields not in the schema (e.g. tags, classifications), use the entity's `notes` field. Don't invent new top-level fields — they break the schema.

```
User: "Tag the login screen with 'biometric' and 'face-id'"

Agent: I'll add this to the login screen's notes:
  Notes: tags: [biometric, face-id]

This is preserved on re-capture but not searchable as structured tags. Want me to instead extend the schema with a `tags[]` field?
```

If the user wants structured tags, propose a schema extension (`schemaVersion` bump). Don't quietly add ad-hoc fields.

## Read queries (not edits)

When the user asks to **read** something (not change it), skip the edit pipeline:

- "Show me the login screen of acme-bank" → read latest, find screen, display screenshot + summary.
- "List flows for acme-bank" → use the `list flows` workflow ([temporal.md](temporal.md)).
- "What changed in the last capture?" → read latest `capture.changes`.
- "When did acme-bank add Face ID?" → walk captures, find the first one with `Face ID` element.

These don't touch `_humanEdited` and don't write any files.

## Safety rules

- **Never** delete entities via chat edit. Removal happens through re-capture (when the screen/flow no longer exists in the device walk). If the user explicitly asks to delete, confirm and create a backup of the current `capture.json` first.
- **Never** rename across captures — edits modify only the latest. Prior captures stay frozen as historical record.
- **Validate before write.** All invariants from [temporal.md](temporal.md)'s "Re-capture invariants to enforce" section apply to edit writes too.
- **Atomic writes.** Tmp file + rename. Don't truncate-and-write — a crash mid-write corrupts the canonical record.
- **Backup on schema-extending edit.** If the user proposes a schema change (e.g. adding `tags[]`), back up `capture.json` before applying.
- **Confirm cascades > 3 references.** If a rename will touch more than 3 references, show the preview and require confirmation.

## Edit examples

### Simple field edit

```
User: The home screen's role is "dashboard", not "home".

Agent: Updating acme-bank/2026-05-25/capture.json:
  screens[id=home].role: "home" → "dashboard"
  screens[id=home]._humanEdited: ["role"]
  
Locked. Future re-captures will preserve this.
```

### Rename with cascade

```
User: Rename the password-reset flow to forgot-password.

Agent: This will cascade to 4 references:
  - flows[].slug: password-reset → forgot-password
  - screens[id=login].appearsIn[].flow: 1 reference updated
  - decisionPoints[screenId=login].options[].flowSlug: 1 reference updated
  - flows[slug=forgot-password].replay.path: password-reset.ad → forgot-password.ad
  - File rename on disk: 2026-05-25/password-reset.ad → forgot-password.ad

Proceed? (y/n)

User: y

Agent: Done. forgot-password is now locked against re-capture overwrites.
```

### Read query (no edit)

```
User: Show me the login screen of acme-bank.

Agent: [shows screenshot from assets/{hash}.png]

Login (acme-bank)
- Role: auth
- 5 interactive elements
- Primary CTA: Sign in (id="primary-cta")
- Last captured: 2026-05-25
- Appears in: sign-in (step 1), forgot-password (step 1)
- Visible text: Sign In, Email, Password, Forgot password?, Sign in with Face ID
```

### Ambiguous edit, clarifying

```
User: Change the title of the home screen to "Wallet".

Agent: I found "home" screens in 3 apps:
  1. acme-bank/2026-05-25
  2. xyz-bank/2026-04-30
  3. crypto-wallet/2026-05-20

Which one? (or "all" to apply to all three)
```

### Cross-app rename

```
User: For every app with a "forgot-password" flow, rename it to "password-recovery".

Agent: Found in 4 apps. Preview:
  - acme-bank → forgot-password → password-recovery
  - xyz-bank → forgot-password → password-recovery
  - crypto-wallet → forgot-password → password-recovery
  - fintech-x → forgot-password → password-recovery

Each will cascade 3-5 references. Proceed? (y/n)
```
