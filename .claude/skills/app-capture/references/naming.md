# Naming screens and flows

Screen names, derivation labels, flow names, and flow ids serve different purposes. Apply
these rules only after semantic grouping is stable.

## Screen names

Use a stable noun phrase for the visible surface. Prefer the app's visible page title when it
is specific and durable; otherwise use a functional noun phrase such as `Security`, `Token
detail`, `Deposit amount`, or `Transaction receipt`.

Do not include volatile user, asset, balance, or transaction values in the canonical title.
Use a state qualifier only when the surface is materially distinct rather than a derivation.
Screen title corrections live in `graph.json.overrides.screens`.

Use sentence case and normal spaced words. Never copy camelCase or PascalCase tokens into a
canonical screen title: write `Space X` and `Redot Pay`, not `SpaceX` or `RedotPay`. Raw node
ids and code identifiers must be humanized before they become titles. The validator rejects
an internal lowercase-to-uppercase transition in canonical screen titles.

## Derivation labels

Use concise entity or state labels inside the screen switcher: `Gold`, `MetaDAO`, `Wrapped
BTC`; `Available`, `Pending`, `Active`; `Default`, `Empty`, `Error`; or ordered slide numbers.
Labels come from screen `state` metadata. They are not flow names and should not repeat the
shared screen function. A derivation label may preserve an official asset, ticker, or product
spelling such as `MetaDAO`; the no-camel-case rule applies to canonical screen and flow names,
not switcher values. Every derivation needs a non-empty name that is unique within its group,
including after URL normalization. Deep links render the name as lowercase kebab-case, such
as `Promo code` → `variation=promo-code`.

## Flow names

- Main-navigation top levels use the app's noun section labels: `Home`, `Cards`, `Markets`,
  `Earn`.
- Pre-navigation top levels may be intent-named: `Getting started`, `Signing in`.
- Child intents normally use gerund + object: `Adding money`, `Changing password`, `Reviewing
  a transaction`.
- Broader destinations can use `Managing`, `Browsing`, `Learning about`, or similarly clear
  intent language.
- Method children use the method noun when the parent carries the intent: `Bank transfer`,
  `Card`, `Crypto`.
- Do not put entry context in the name; `entryPoints` records it.
- Keep sibling names concise, distinct, and grammatically parallel.
- Use sentence case and spaced words. Do not use camelCase or PascalCase inside a flow name;
  write `Buying Space X`, not `Buying SpaceX`. The validator enforces this rule.

## Flow ids

The authored id is permanent semantic identity and the public URL slug. Use human-readable
kebab-case such as `adding-money`, not opaque ids, dates, or version suffixes. Ids are unique
within a capture.

Renaming a flow does not change its id or URL. The same intent keeps the same id across dated
captures, including when it returns after an absent capture; the all-capture audit emits an
advisory for that revival. A materially different intent receives a new, meaningfully
qualified id.
