# Base — 2026-04-01

**Platform:** iOS
**Mode:** guided
**Flows captured:** 15
**Screens captured:** 60

## Overview

Base is a crypto wallet and social platform by Coinbase. It combines wallet functionality (deposit, trade, send, receive) with a social layer (posts, earnings, live trading feed) and a mini app ecosystem. Users register a basename (name.base.eth) as their onchain identity and can verify social accounts, chat with AI agents or other users, and earn from their content.

## Flows

### Create Account (6 steps)

Create a new Base account with email, OTP verification, and basename registration.

1. **Welcome** (`welcome`) — Entry point. Animated splash screen with "Create Account" and "Sign In" buttons.
2. **Enter email** (`enter-email`) — Tap "Create Account". Email input field with "Use passkey instead" alternative.
3. **OTP verification** (`otp-verify`) — Enter email and tap "Next". 6-digit code entry with numeric keypad and security warning.
4. **Choose username** (`choose-username`) — Enter OTP. Basename search field (name.base.eth) with Personalized Offers toggle.
5. **Username entered** (`choose-username`) — Enter "d-mysten". Shows d-mysten.base.eth available with Claim button enabled.
6. **Home** (`home-empty`) — Tap "Claim". Home screen with $0 balance and empty token list.

### Sign In (6 steps)

Sign into Base via email, passkey, or recovery phrase with wallet creation option.

1. **Welcome** (`welcome`) — Entry point. Splash screen with Sign In button.
2. **Sign in options** (`sign-in-options`) — Tap "Sign In". Three options: Email, Passkey, Recovery phrase.
3. **Import wallet** (`import-wallet`) — Tap "Sign in with recovery phrase". Dark screen with "Create new wallet" and "I already have a wallet".
4. **Import wallet options** (`import-wallet-options`) — Tap "I already have a wallet". Choose Passkey or Recovery phrase.
5. **Create passcode** (`create-passcode`) — Tap "Create new wallet". 6-digit passcode entry on dark background.
6. **Home** (`home`) — Enter passcode. Home screen with wallet balance and token list.

### Deposit / Buy (4 steps)

Deposit funds via debit card or Coinbase with token selection.

1. **Home** (`home`) — Entry point. Dashboard with Deposit button.
2. **Buy screen** (`buy-deposit`) — Tap "Deposit". Amount input with $10/$20/Max quick-select, USDC token selector, numpad, Debit Card payment, swipe to deposit.
3. **Token selector** (`token-selector`) — Tap "Deposit USDC". Modal listing tokens: USDC, Ethereum, Edge, Compound, OriginTrail, Flock.io, Pepe, Venice Token, Aerodrome.
4. **Deposit With** (`deposit-with-coinbase`) — Tap "Deposit With". Connect to Coinbase modal to use Coinbase.com payment methods.

### Trade (2 steps)

Swap tokens using the built-in DEX interface.

1. **Home** (`home`) — Entry point.
2. **Trade** (`trade`) — Tap "Trade". Swap interface: USDC → Ethereum with 50%/75%/Max buttons, exchange rate, trending tokens (ICNT, VVV), and numpad.

### Request Payment (2 steps)

Request crypto via profile search, QR code, or shareable link.

1. **Home** (`home`) — Entry point.
2. **Request** (`request`) — Tap "Request". Search profiles/address field, QR Code option, Request via Link, no recent recipients.

### Receive (2 steps)

Display wallet QR code and address for receiving funds across EVM networks.

1. **Home** (`home`) — Entry point.
2. **Receive** (`receive`) — Tap QR icon → Receive tab. QR code with avatar overlay, d-mysten.base.eth, truncated address, Copy/Share buttons, supported network icons.

### Browse Tokens (3 steps)

Discover trending tokens, view details with price charts, and buy.

1. **Discover** (`discover`) — Entry point. Pinned apps (Apps, Verify), trending coins list with filter tabs, search bar.
2. **Token detail** (`token-detail`) — Tap "Virtual Protocol". Price ($0.67714), -5.45% change, 24h volume, market cap, price chart with timeframe tabs, ownership info, about section.
3. **Buy modal** (`token-buy-modal`) — Tap "Buy". USDC → VIRTUAL swap with amount input, numpad, total with fees.

### Mini App — Bankr example (7 steps)

Install and onboard into a mini app within Base. Bankr is used as an example.

1. **Mini Apps** (`mini-apps`) — Entry point. Featured apps carousel, Trading must-haves, Connect with creators, Earn crypto categories.
2. **Display name** (`bankr-display-name`) — Tap "Get" on Bankr → Open. Set display name with "d-mysten" pre-filled.
3. **Avatar** (`bankr-avatar`) — Tap "Continue". Placeholder avatar with upload option.
4. **Bio** (`bankr-bio`) — Tap "Continue". Text input for short bio.
5. **Loading** (`bankr-loading`) — Tap "Continue". "Loading different assets..." with skeleton UI.
6. **Complete** (`bankr-complete`) — Auto-advance. "You're all set up, d-mysten!" with Start Posting CTA.
7. **Browser** (`bankr-browser`) — Tap "Start Posting". bankr.bot web app in Base in-app browser with Chat/Activity/Assets tabs.

### Verify Identity (4 steps)

Verify social accounts for profile credibility and rewards.

1. **Discover** (`discover`) — Entry point. Discover screen with Verify pinned app.
2. **Get Verified** (`verify`) — Tap "Verify". Benefits: Earn Rewards, Build Credibility, Boost Visibility.
3. **Login request** (`verify-login-request`) — Tap "Continue". Wallet signing modal from verify.base.dev with Cancel/Confirm.
4. **Manage verifications** (`manage-verifications`) — Tap "Confirm". Verify buttons for X (Twitter), Coinbase, TikTok, Instagram.

### Messaging (4 steps)

Chat with AI agents or other users via basename search.

1. **Home** (`home`) — Entry point. Home screen with chat icon in top right corner.
2. **Chat home** (`chat`) — Tap chat icon. "Chat with AI Agents" section: Bankr, Elsa. Compose button.
3. **New chat** (`chat-search`) — Tap compose. Profile search with basename results (dalxds.base.eth, dalxa.base.eth, dalispet.cb.id).
4. **Conversation** (`chat-conversation`) — Tap a result. 1:1 chat with "Hey" message delivered, message input with + attachments.

### Live Feed & Posting (4 steps)

Browse the social trading feed and create tradable posts with earnings.

1. **Live feed** (`live-feed`) — Entry point. Real-time trade cards showing who bought what, with token price charts, holder counts, and social actions.
2. **Create post** (`create-post`) — Tap + button. Text input, Enable Earnings toggle (on), camera/image/$ attachment icons.
3. **About Earnings** (`about-earnings`) — Tap info icon. "Enable earnings to make your post tradable. Only posts with earnings appear in the Trade tab."
4. **Edit Ticker** (`edit-ticker`) — Tap $ button. Set a ticker nickname for trading your content.

### Profile & Earnings (5 steps)

View and edit profile, track post and creator coin earnings.

1. **Profile drawer** (`profile-drawer`) — Tap avatar. d-mysten.base.eth, $0.10 balance, Invite Friends, View Profile, Theme, Settings, Give Feedback.
2. **View Profile** (`view-profile`) — Tap "View Profile". Avatar, basename, 0 Following/Followers, Edit Profile, View Earnings, Share, Posts/Assets/Casts/Replies tabs.
3. **Earnings** (`earnings`) — Tap "View Earnings". All time $0.00, Post/Creator coin/Creator rewards breakdown, "Enroll to earn uncapped creator rewards" banner.
4. **Edit Profile** (`edit-profile`) — Tap "Edit Profile". Avatar editor, username (read-only), display name, bio fields, Save button.
5. **Share** (`share-modal`) — Tap "Share". Profile preview card with Post, Copy link, Share to actions.

### Settings (9 steps)

Configure display, account, privacy, social, and trading preferences.

1. **Settings** (`settings`) — Entry point. Display, Account management, Connect to Coinbase, Privacy & Security, Social & Creators, Trading, Help, Legal, version info.
2. **Display** (`display-settings`) — Theme color, Appearance Mode (Auto), App Icon, Language (English - US), Local currency (USD).
3. **Account management** (`account-management`) — Authenticator App setup, Sign out.
4. **Sign out** (`sign-out-confirm`) — "Are you sure?" with passkey reminder and Find your passkey link.
5. **Connect to Coinbase** (`connect-coinbase`) — "Buy or transfer with Coinbase" CTA with legal links.
6. **Privacy & Security** (`privacy-security`) — Personalized offers (off), Privacy mode (off), Developer mode (off), Payment requests (on), Manage permissions.
7. **Manage permissions** (`manage-permissions`) — App permission requests management with Learn more.
8. **Social & Creators** (`social-creators`) — Farcaster ID (3198187), Coin pairings, Muted accounts.
9. **Trading** (`trading-settings`) — Quick Buy (off), Stealth mode (off), Dust Coins under $0.10 (off), Hidden Coins.

### Notifications (2 steps)

View notifications and configure push notification preferences.

1. **Notifications** (`notifications`) — Empty state: "Nothing here, yet!" with settings gear and chat icons.
2. **Settings** (`notification-settings`) — Social toggles: Like (off), Comments & Replies (on), Follow (on), Repost (on), Quote (on). Trading: Social trades (on).

### Home Browsing (5 steps)

Browse portfolio with filters, sorting, collectibles, and activity history.

1. **Coins tab** (`home`) — $0.10 balance, USDC (0.1 USDC), Filters and Sort buttons.
2. **Filters** (`home-filters`) — Categories: Cash, Apps, Memes, Social. Networks: All, Base, Ethereum, Polygon, Optimism, Arbitrum, Avalanche, Zora, BNB Chain.
3. **Sort By** (`home-sort`) — Balance (selected), Market Cap, Volume, Price Change.
4. **Collectibles** (`collectibles`) — "Your Collection Awaits" empty state.
5. **Activity** (`activity`) — Received +$0.10 (0.1 USDC from dalxds.base.eth), Minted d-mysten.base.eth (1 NFT).

## Decision Points

### welcome — 2 options
- [x] Create Account → `create-account` flow
- [x] Sign In → `sign-in` flow

### home — 10 options
- [x] Deposit → `deposit-buy` flow
- [x] Trade → `trade` flow
- [x] Send → triggers Deposit Funds modal (empty wallet)
- [x] Request → `request-payment` flow
- [x] Coins tab → `home-browsing` flow
- [x] Collectibles tab → `home-browsing` flow
- [x] Activity tab → `home-browsing` flow
- [x] Profile avatar → `profile-earnings` flow
- [x] QR / Receive → `receive` flow
- [x] Chat icon → `messaging` flow

### discover — 4 options
- [x] Apps → `mini-app` flow
- [x] Verify → `verify-identity` flow
- [x] Trending coin → `browse-tokens` flow
- [ ] Search — not explored

## Navigation Graph

- `welcome` → tap "Create Account" → `enter-email`
- `welcome` → tap "Sign In" → `sign-in-options`
- `enter-email` → enter email, tap "Next" → `otp-verify`
- `otp-verify` → enter 6-digit code → `choose-username`
- `choose-username` → enter name, tap "Claim" → `home`
- `home` → tap "Deposit" → `buy-deposit`
- `home` → tap "Trade" → `trade`
- `home` → tap "Send" → `send-deposit-prompt`
- `home` → tap "Request" → `request`
- `home` → tap QR icon → `receive`
- `home` → tap avatar → `profile-drawer`
- `home` → tap chat icon → `chat`
- `buy-deposit` → tap "Deposit USDC" → `token-selector`
- `buy-deposit` → tap "Deposit With" → `deposit-with-coinbase`
- `discover` → tap trending coin → `token-detail`
- `discover` → tap "Apps" → `mini-apps`
- `discover` → tap "Verify" → `verify`
- `token-detail` → tap "Buy" → `token-buy-modal`
- `mini-apps` → tap "Get" on Bankr → `bankr-display-name`
- `bankr-display-name` → tap "Continue" → `bankr-avatar`
- `bankr-avatar` → tap "Continue" → `bankr-bio`
- `bankr-bio` → tap "Continue" → `bankr-loading`
- `bankr-loading` → auto → `bankr-complete`
- `bankr-complete` → tap "Start Posting" → `bankr-browser`
- `verify` → tap "Continue" → `verify-login-request`
- `verify-login-request` → tap "Confirm" → `manage-verifications`
- `chat` → tap compose → `chat-search`
- `chat-search` → tap result → `chat-conversation`
- `live-feed` → tap + → `create-post`
- `create-post` → tap earnings info → `about-earnings`
- `create-post` → tap $ → `edit-ticker`
- `notifications` → tap gear → `notification-settings`
- `profile-drawer` → tap "Settings" → `settings`
- `profile-drawer` → tap "View Profile" → `view-profile`
- `view-profile` → tap "View Earnings" → `earnings`
- `view-profile` → tap "Edit Profile" → `edit-profile`
- `view-profile` → tap "Share" → `share-modal`
- `settings` → tap "Display" → `display-settings`
- `settings` → tap "Account management" → `account-management`
- `settings` → tap "Connect to Coinbase" → `connect-coinbase`
- `settings` → tap "Privacy & Security" → `privacy-security`
- `settings` → tap "Social & Creators" → `social-creators`
- `settings` → tap "Trading" → `trading-settings`
- `account-management` → tap "Sign out" → `sign-out-confirm`
- `privacy-security` → tap "Manage permissions" → `manage-permissions`
- `sign-in-options` → tap "Recovery phrase" → `import-wallet`
- `import-wallet` → tap "Create new wallet" → `create-passcode`
- `import-wallet` → tap "I already have a wallet" → `import-wallet-options`
