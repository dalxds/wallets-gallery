# Semantic flow packaging simulation

Status: exploratory simulation against the current Avici, RedotPay, and Tuyo captures. This
is not a committed `flows.json` package and no packager implementation is implied.

## Method

This simulation applies the rules in `journey-packaging-redesign.md` to the latest three
captures:

- group screens by coherent user intent, not graph branch shape;
- keep useful one-screen destinations as flows;
- never bundle sibling destinations into tours;
- represent alternate origins as `entryPoints`, not duplicate flows;
- keep local steps separate from any mechanically derived context tile;
- treat same-intent data, lifecycle, and UI examples as derivations of one logical step;
- choose parents solely for semantic readability, regardless of graph reachability;
- keep useful authored screens even when direct replay cannot be derived;
- audit the current direct forward/picker patterns as non-blocking replay diagnostics;
- expose non-primary derivations through the existing screen switcher rather than as flows or
  sequential steps; and
- account for every canonical screen, directly or through its derivation group.

The simulation used `graph.json` nodes, texts, actions, edges, state groups, existing authored
names, and current `view.json` screen titles. It did not perform a visual review of every
snapshot, so names remain proposals for the golden-package review.

## Results

| App      | Current flows | Simulated flows | Top level | One-screen | Screen coverage | Direct replay pickers | Replay gaps |
| -------- | ------------: | --------------: | --------: | ---------: | --------------: | --------------------: | ----------: |
| Avici    |            28 |              28 |         5 |         20 |         54 / 54 |                     1 |           0 |
| RedotPay |            70 |              65 |         5 |         57 |         93 / 93 |       0 of 4 intended |           4 |
| Tuyo     |            28 |              26 |         4 |         17 |         58 / 58 |                     4 |           0 |

The earlier estimates of approximately 22, 55, and 23 flows relied on suppressing or
absorbing one-screen destinations. They are not representative of the revised model.
RedotPay remains close to its current count because it contains many independently useful but
shallowly captured destinations. The improvement is the semantic hierarchy and removal of
duplicates, not necessarily a lower flow count.

`uncovered` is empty in this simulation. Avici's previously omitted MetaDAO and Wrapped BTC
details become inspectable derivations of `Viewing assets`; RedotPay's previously omitted
credit-priority screen becomes a useful one-screen flow. Other derivations remain switcher
content rather than flow steps: RedotPay's phone-login state, plus Tuyo's funded Earn state
and informational carousel continuation states. The reviewed packages must add or confirm
the corresponding screen-group overrides before these become golden fixtures.

## Avici

All 28 semantic flows validate once the reviewed screen derivation groups are applied. The
current direct replay compiler can also recognize `Swap quote details` as a picker: it opens
from Swap, returns to Swap, and the journey then continues to the high-impact warning.

```text
Getting started [welcome]
  Signing in [email-login -> email-otp -> home-onboarding]

Home [home]
  Managing settings [settings]
    Referring friends [referrals]
    Opening a credit line [credit-mode -> credit-borrow -> home-credit -> credit-line]
      Managing a credit line [credit-manage]
      Learning about credit rewards [credit-info]
  Adding money [deposit-crypto] (also from Getting a card)
    Crypto [deposit-crypto-eth]
    Dollar and euro accounts [deposit-cash]
  Reviewing a transaction [transaction-detail]
  Filtering activity [activity-filter]
  Withdrawing funds [withdraw -> add-payee -> add-payee-bank]
  Scanning a QR code [qr-scanner]

Card [card: Available | card-my-cards: Issued]
  Getting a card
    [card-gen-account-type -> card-gen-country -> card-gen-kyc -> card-gen-consent
     -> card-gen-terms -> card-gen-sumsub]
  Viewing card details [card-detail]
    Setting a spending limit [card-limits]
    Deleting a card [card-delete-confirm]
  Adding a card [card-tab-menu -> card-add]

Markets [markets]
  Browsing market-cap rankings [markets-section-ranked]
  Buying SpaceX [spacex-detail -> buy-amount -> buy-review]
  Swapping tokens [swap -> swap-quote-details (picker) -> high-impact-warning]
  Viewing assets [gold-detail: Gold | metadao-detail: MetaDAO | wbtc-detail: Wrapped BTC]

Grow [grow]
  Earning stablecoin yield
    [grow-stablecoin-yields -> grow-usdc-yield -> grow-yield-deposit -> grow-funded
     -> grow-growing-assets -> grow-position-detail -> grow-position-manage]
```

### What changes

- `Adding money` appears once under Home; `Getting a card` is an alternate entry.
- Crypto and cash remain method flows even though each currently has one local screen.
- Gold, MetaDAO, and Wrapped BTC share one `Viewing assets` step because they are data
  derivations of the same intent and interaction structure; SpaceX remains in `Buying SpaceX`
  because its flow continues through amount and review.
- `card` and `card-my-cards` are available/issued derivations of the Card surface. The issued
  member may supply an optional context tile or direct replay predecessor, but the semantic
  hierarchy places card management under Card independently.

## RedotPay

The semantic tree covers all 93 screens and is valid independently of replay. Three flows are
missing four return transitions used by the current direct replay compiler. They are marked
`REPLAY GAP` below. Splitting these screens into standalone flows would make the graph easier
to replay but would violate the semantic rule: they are transient choices within registration,
sending, and identity verification, not independent intents.

```text
Getting started [welcome]
  Signing in [login]
  Creating an account [signup -> signup-verify -> signup-password -> account-created]

Home [home]
  Exploring RedotPay Pro [edit-widgets]
  Managing account [profile]
    Managing security [security]
      Changing password [change-password]
      Configuring app lock [app-lock]
      Setting an anti-phishing code [anti-phishing-code]
      Managing connected accounts [third-party-linking]
      Setting up a passkey [passkey-setup]
      Setting up Google Authenticator [google-authenticator]
    Managing payment settings [payment-settings]
    Visiting the community [community]
    Viewing app information [about-us]
    Sharing a referral [share]
  Viewing notifications [notifications]
  Getting support [support]
  Scanning to pay [qr-scan-to-pay] (also from Sending to a user)
  Preparing scan and pay [qr-security-gate]
  Exploring more services [more-hub]
    Trading P2P [p2p-express]
      Browsing the P2P marketplace [p2p-marketplace]
      Viewing the P2P leaderboard [p2p-leaderboard]
      Reviewing P2P orders [p2p-orders]
      Reading P2P chat [p2p-chat]
      Managing P2P ads [p2p-ads]
    Withdrawing [withdraw-method]
    Receiving crypto [receive] (also from Sending to a user)
    Topping up mobile [mobile-topup]
    Viewing points [points]
    Completing missions [mission]
    Setting card payment priority [card-payment-priority]
    Sending to a user [send-method-chooser -> send-to-user]
      Understanding recipient verification [send-notice]
      Reviewing transfer records [transfer-records]
      Managing recent recipients [send-recipients-manage]
  Depositing crypto [deposit-currency -> deposit-method -> deposit-network -> deposit-address]
  Buying crypto [buy-crypto]
  Swapping crypto [swap] (also from Exploring more services)
  Using credit [credit-intro -> credit-dashboard]
    Reviewing a credit position [credit-dashboard-scrolled]
    Managing collateral [credit-collateral]
    Configuring auto-collateralization [credit-auto-pledge]
    Setting credit payment priority [credit-priority]
    Increasing a credit limit [credit-increase-limit]
    Learning how to increase credit [credit-how-to-increase]
    Managing credit settings [credit-settings]
      Reviewing risk status [credit-risk-management]
      Setting collateral priority [credit-collateral-priority]
      Learning about Credit [credit-learn]
    Taking a loan [loan-intro -> loan-borrow-form] (also from Exploring more services)

Cards [card: Available | card-pending: Pending | card-active: Active]
  Registering a card (also from Managing cards)
    [card-choose -> card-confirm: Default | Promo code | Total
     -> card-pro-membership (picker) -> card-activated]
    REPLAY GAP: card-pro-membership -> card-confirm return is missing
  Setting card limits [card-limits]
  Reviewing a card statement [card-transaction-statement]
  Browsing card statements [card-statement-list]
  Managing cards [my-cards]

Send [send]
  Sending globally
    [send-from-currency (picker) -> send-to-currency (picker) -> send-global-details]
    REPLAY GAP: send-from-currency -> send return is missing
    REPLAY GAP: send-to-currency -> send return is missing

Assets [assets]
  Viewing a token [token-detail]
  Exploring Earn [earn]
  Verifying identity
    [verify-identity-gate -> kyc-add-phone -> kyc-issuing-country
     -> kyc-country-picker (picker) -> kyc-id-selfie-intro -> kyc-checklist
     -> kyc-q-employment -> kyc-q-source-of-funds -> kyc-q-income-volume
     -> kyc-q-account-purpose -> kyc-approved]
    REPLAY GAP: kyc-country-picker -> kyc-issuing-country return is missing
```

### What changes

- Security, P2P, and credit settings become coherent parent flows with separately named child
  intents; they are not woven into tours.
- Pro membership, promo code, and total are parts of `Registering a card`, not child intents.
  Promo and total are application-screen derivations; Pro membership remains a picker step.
- Available, pending, and active are derivations of the Cards surface. Card limits,
  statements, and card management therefore sit directly under Cards. The active derivation
  may help direct replay but does not determine their parent.
- Send currency and payout currency become picker steps in `Sending globally`, not standalone
  flows.
- The country picker becomes part of identity verification, not a child flow.
- Credit priority is covered as a useful one-screen flow.
- Receive, scan-to-pay, swap, loan, and card application use alternate-entry metadata instead
  of duplicate tree nodes.

## Tuyo

All 26 semantic flows validate. The current direct replay compiler recognizes four authored
steps as pickers: country selection, funding-method selection, the notifications modal, and
the Earn strategy information surface.

```text
Getting started [welcome]
  Creating an account
    [email-entry -> otp -> legal-name -> choose-username -> notifications-priming
     -> country-residence -> country-picker (picker) -> top-up -> add-funds-amount
     -> add-funds-method-picker (picker) -> deposit-onchain
     -> enable-notifications-modal (picker) -> deposit-onchain-pending
     -> deposit-complete -> whats-new-promo]
  Recovering an account [recover-account -> recover-phrase-import]
  Entering a referral code [referral-code]

Home [home]
  Adding money [add-money-source] (also from Earn)
  Sending money [send-recipient -> send-find-tuyo] (also from Earn)
  Getting the Tuyo Card
    [card-intro -> kyc-verify-prompt -> kyc-persona-start
     -> kyc-persona-country -> kyc-persona-id-type]
  Reviewing a transaction [transaction-detail]
  Managing settings [settings]
    Verifying identity [settings-verification]
    Changing an account handle [settings-account-handle]
    Configuring privacy [settings-privacy]
    Managing permissions [settings-permissions]
    Managing keys and security [settings-keys-security]
    Getting help [settings-help]

Earn [earn]
  Converting tokens [earn-convert -> earn-convert-pair -> earn-convert-review]
  Investing [earn-invest-explorer]
    Viewing a token [earn-token-detail] (also from Searching for a token)
    Searching for a token [earn-token-search]
  Earning yield
    [earn-strategies -> strategies-info-1 (picker) -> earn-strategy-list
     -> earn-strategy-deposit -> earn-vault-deposit -> earn-vault-deposit-review]

Rewards [rewards-intro -> rewards]
  Learning how to earn TUYOs
    [rewards-get-tuyos -> rewards-get-tuyos-trade
     -> rewards-get-tuyos-yield -> rewards-get-tuyos-referral]
  Inviting friends [rewards-invite]
  Viewing the leaderboard [rewards-leaderboard -> leaderboard-info-1]
```

### What changes

- `Adding money` and `Sending money` each appear once under Home; Earn is an alternate entry.
- Every Settings destination remains a distinct one-screen intent. No Settings tour is
  created.
- Token detail appears once, with Search recorded as an alternate entry.
- Informational carousel continuation screens and the funded Earn screen remain screen
  derivations, not extra flows.

## Findings for the plan

### One-screen flows are necessary

The revised rule behaves as intended. Avici has 20 useful one-screen flows, RedotPay has 57,
and Tuyo has 17. These are primarily settings pages, option hubs, details, status pages, and
shallowly captured features. A hard two-step minimum would either hide them or manufacture
tours. In the UI, a one-screen child always renders its local screen and may also render an
optional mechanically derived context tile.

### Semantic grouping and replay routing are separate

The current graphs expose card-management controls from issued or active card states. Those
states can help direct replay or provide a context tile, but they do not determine hierarchy:

```text
Card [Available | Issued] -> Viewing card details
Cards [Available | Pending | Active] -> Setting card limits
```

The semantic parent remains Card(s) even when replay is unavailable. When the direct replay
compiler can use `card-my-cards` or `card-active`, it records that operationally; no launcher
field is authored in the flow. This keeps prerequisite capture history from becoming permanent
tree ownership.

### Same-intent examples should not inflate the flow tree

Gold, MetaDAO, and Wrapped BTC are three captured instances of `Viewing assets`, not three
reader intents. Likewise, Cards available/pending/active and card-application
default/promo/total are logical-screen derivations. Grouping them at the screen level retains
all useful visual evidence in the switcher while avoiding duplicate flows, route selectors,
and sequential tours.

### Missing return edges should remain replay gaps

RedotPay's Pro-membership, currency, and country pickers are the only direct replay gaps. They
should not be promoted to standalone flows or removed from presentation. Re-capturing the four
returns would improve replay, but packaging remains valid without them.

### Non-repeatable screens remain useful content

Login, onboarding, KYC, registration, and one-time lifecycle screens remain first-class flow
content. A later re-capture may be unable to revisit them because the app opens in a logged-in,
verified, or post-activation state. The semantic release still packages these screens and
does not make their usefulness depend on replayability. Retaining their last-known observation,
showing a subtle last-captured date, and classifying them as `not-recaptured` are agreed product
requirements for the separate temporal follow-up; this simulation does not validate or define
that data model.

### Flow count is not the success metric

The new model substantially improves Tuyo's duplication and all three apps' hierarchy, but
does not drastically reduce RedotPay's count. Acceptance should focus on whether every row has
a coherent intent, duplicate intents are removed, parents read naturally, and no artificial
tours exist.
