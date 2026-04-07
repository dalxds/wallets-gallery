# Tuyo — 2026-03-30

**Platform:** ios
**Mode:** guided
**Flows captured:** 13
**Screens captured:** 33

## Flows

### New Account Onboarding (6 steps)

Create a new Tuyo account — generate a key, enable notifications, and set a handle.

1. **Welcome** (`welcome`) — App launch. Tuyo Visa card hero, "Spend. Earn. Trade. Bank." Get started, Already have account, I have a referral code.
2. **Create key — hold** (`create-key-interactive`) — Tap Get started. Geometric key illustration, "HOLD TO CREATE" instruction.
3. **Create key — ready** (`create-key-ready`) — Hold to create. Key transforms into lock/card shape, "TAP INSIDE WHEN YOU FEEL READY."
4. **Notifications** (`onboarding-notifications`) — Enable notifications prompt. Enable now / Skip for now.
5. **Handle** (`onboarding-handle`) — Choose your handle. Set handle / Skip for now.
6. **Home** (`home`) — Onboarding complete. Dashboard with $0.00 balance.

### Recover Account (2 steps)

Recover an existing Tuyo account by importing a mnemonic phrase.

1. **Welcome** (`welcome`) — App launch. Get started, Already have account, I have a referral code.
2. **Recover** (`recover-account`) — Tap Already have account. Lock/keyhole animation, "Import mnemonic manually" button, "Continue without recovering" link.

### Browse Tokens (3 steps)

Search and browse available tokens with prices, sparklines, and token detail view.

1. **Home screen** (`home`) — Entry point. Dashboard with $0.00 balance, Add money/Send/Convert actions, yield promo card.
2. **Token search** (`search`) — Tap search icon. Watchlist (USDC, Ethereum, EURC, Bitcoin) and Most Relevant token list with sparklines and prices.
3. **Token detail** (`token-detail`) — Tap a token. MemeCore at $2.31, price chart with timeframe toggles, Buy/Sell/Receive/Send buttons, balance.

### Explore Yield Strategies (3 steps)

Browse yield strategies by currency and view available options with APY, risk, and AUM.

1. **Home screen** (`home`) — Entry point.
2. **Strategies Overview** (`strategies-overview`) — Tap Strategies tab. Four currency cards: USD (6.99%), ETH (3.50%), EUR (1.69%), BTC (1.09%).
3. **USD Strategies** (`usd-strategies`) — Tap USD. Five strategies: yoUSD (4.89%, Best Performer), Morpho Moonwell (3.88%), Fluid USDC (3.19%), Morpho Seamless, Aave USDC.

### Manage Account Settings (7 steps)

Access and manage account settings including handle, verification, backup, privacy, and permissions.

1. **Home screen** (`home`) — Entry point.
2. **Settings** (`settings`) — Tap profile avatar. Wallet address (0x93d...Ce569), NOT VERIFIED status. General: Account Handle (AVAILABLE), Verification, Account Backup (BACKUP NEEDED), Privacy, Permissions. Security: Keys & Security.
3. **Account Handle** (`account-handle`) — Choose @handle with text input.
4. **Identity Verification** (`identity-verification`) — Verify identity prompt, takes 2 min, unlocks Card and banking.
5. **Backup** (`backup`) — iCloud Drive backup — NOT CONNECTED. Private key stored via iCloud Keychain.
6. **Privacy** (`privacy`) — Toggle: Hide Holdings & Earn Balances (off).
7. **Permissions** (`permissions`) — Biometrics (off), Push Notifications (on).

### Add Money (2 steps)

Add funds to Tuyo account via bank transfer, crypto wallet, or Coinbase.

1. **Home screen** (`home`) — Entry point.
2. **Choose the source** (`add-money`) — Tap Add money. Bottom sheet: Bank (INSTANT), Wallet (INSTANT), Coinbase (external).

### Receive Crypto (3 steps)

Get wallet address and QR code to receive crypto from multiple networks.

1. **Home screen** (`home`) — Entry point.
2. **Choose the source** (`add-money`) — Tap Add money. Bank, Wallet, Coinbase options.
3. **Receive address** (`receive`) — Tap Wallet. QR code with avatar, supported networks: Base, Arbitrum, Polygon, BNB, Ethereum. Address with copy button.

### Send Money (4 steps)

Send money via Tuyo username, wallet address, or bank account.

1. **Home screen** (`home-with-balance`) — Dashboard with $1.00 balance, EARN/CASH sections, recent transactions.
2. **Add Recipient** (`send`) — Tap Send. Three options: Find on Tuyo (BEST), Wallet Address, Bank Account.
3. **Send to Wallet** (`send-to-wallet`) — Tap Wallet Address. Input with 0x placeholder, "Send crypto to any 0x address."
4. **Send to Bank** (`send-to-bank`) — Tap Bank Account. Identity verification required — unlocks bank account number and Tuyo Card.

### Send to Tuyo User (4 steps)

Send money instantly to another Tuyo user by searching their @Tuyoname.

1. **Home screen** (`home-with-balance`) — Dashboard with $1.00 balance.
2. **Add Recipient** (`send`) — Tap Send. Find on Tuyo (BEST), Wallet Address, Bank Account.
3. **User found** (`send-to-tuyo-found`) — Search "joe". Result: @joe with verified checkmark.
4. **User not found** (`send-to-tuyo-not-found`) — Search "joep". No results.

### Convert Tokens (2 steps)

Convert between tokens using the built-in swap interface.

1. **Home screen** (`home-with-balance`) — Dashboard with $1.00 balance.
2. **Convert** (`convert`) — Tap Convert. Amount input, USDC on Base as source, token picker with Watchlist and Tokens lists.

### View Transaction History (3 steps)

View transaction history and individual transaction details.

1. **Home screen** (`home-with-balance`) — Dashboard with $1.00 balance, Transactions section with recent entries.
2. **Transaction history** (`transaction-history`) — Tap transactions. Full list: two Receive USDC entries grouped under TODAY.
3. **Transaction details** (`transaction-details`) — Tap a transaction. Bottom sheet: Received status, March 31 2026 timestamp, from address, 1 USDC amount.

### Explore Tuyo Card (3 steps)

Learn about the Tuyo Visa card — pay with USDC worldwide and use Apple Pay.

1. **Home screen** (`home`) — Entry point.
2. **USDC payments** (`card-promo`) — Tap Card tab. Tuyo Visa card preview (ending 6321). "Pay with USDC, anywhere in the world" — 40M merchants. "Get Tuyo Card for free" CTA.
3. **Apple Pay** (`card-promo`) — Swipe left. iPhone with Tuyo card in Apple Wallet at payment terminal. "Spend in-store with Apple Pay."

### Explore TUYOs Rewards (4 steps)

Browse the TUYOs rewards program — earn points, invite friends, and view the leaderboard.

1. **TUYOs dashboard** (`tuyos-rewards`) — Tap Rewards tab. Balance: 0. Actions: Get TUYOs, Invite friends, Leaderboard, Redeem (soon). Invite code: 18FTN9. Breakdown: Card/Earn/Convert/Referral (all 0).
2. **Get TUYOs** (`get-tuyos`) — Carousel explaining earning methods. "Pay with Tuyo Card — 0.50 TUYOs per dollar spent."
3. **Invite friends** (`invite-friends`) — Invite code 18FTN9. Direct referrals: 20%. Second level: 10%. Share button, Become an ambassador link.
4. **Leaderboard** (`leaderboard`) — Five league tier badges. "You're not part of any league yet."

## Decision Points

### welcome — 3 options
- [x] Get started → `new-account-onboarding`
- [x] Already have a Tuyo account? → `recover-account`
- [ ] I have a referral code — not explored

### home — 8 options
- [x] Search → `browse-tokens`
- [x] Profile/Settings → `manage-settings`
- [x] Add money → `add-money`
- [x] Send → `send-money`
- [x] Convert → `convert-tokens`
- [x] Strategies tab → `explore-strategies`
- [x] Card tab → `explore-tuyo-card`
- [x] Rewards tab → `explore-tuyos-rewards`

### send — 3 options
- [x] Find on Tuyo → `send-to-tuyo`
- [x] Wallet Address → `send-money`
- [x] Bank Account → `send-money`

### add-money — 3 options
- [ ] Bank — not explored
- [x] Wallet → `receive-crypto`
- [ ] Coinbase — not explored

### settings — 6 options
- [x] Account Handle
- [x] Verification
- [x] Account Backup
- [x] Account Privacy
- [x] Permissions
- [ ] Keys & Security — not explored

### tuyos-rewards — 4 options
- [x] Get TUYOs
- [x] Invite friends
- [x] Leaderboard
- [ ] Redeem — coming soon

## Navigation Graph

- `welcome` → tap Get started → `create-key-interactive`
- `welcome` → tap Already have account → `recover-account`
- `create-key-interactive` → hold to create → `create-key-ready`
- `create-key-ready` → tap inside → `onboarding-notifications`
- `onboarding-notifications` → enable/skip → `onboarding-handle`
- `onboarding-handle` → set handle/skip → `home`
- `home` → tap Search → `search`
- `search` → tap token → `token-detail`
- `token-detail` → swipe down → `search`
- `search` → tap back → `home`
- `home` → tap profile avatar → `settings`
- `settings` → tap Account Handle → `account-handle`
- `settings` → tap Verification → `identity-verification`
- `settings` → tap Account Backup → `backup`
- `settings` → tap Account Privacy → `privacy`
- `settings` → tap Permissions → `permissions`
- `home` → tap Add money → `add-money`
- `add-money` → tap Wallet → `receive`
- `home-with-balance` → tap Send → `send`
- `send` → tap Find on Tuyo → `send-to-tuyo-found`
- `send` → tap Wallet Address → `send-to-wallet`
- `send` → tap Bank Account → `send-to-bank`
- `home-with-balance` → tap Convert → `convert`
- `home-with-balance` → tap Transactions → `transaction-history`
- `transaction-history` → tap transaction → `transaction-details`
- `home` → tap Strategies tab → `strategies-overview`
- `strategies-overview` → tap USD → `usd-strategies`
- `home` → tap Card tab → `card-promo`
- `home` → tap Rewards tab → `tuyos-rewards`
- `tuyos-rewards` → tap Get TUYOs → `get-tuyos`
- `tuyos-rewards` → tap Invite friends → `invite-friends`
- `tuyos-rewards` → tap Leaderboard → `leaderboard`
