# iOS Reference

agent-device specifics for iPhone simulators and physical devices. Most of agent-device's command surface is platform-neutral; this doc covers what differs.

## Prerequisites

- Xcode installed with command-line tools.
- iOS simulator(s) created via Xcode or `xcrun simctl`.
- For physical devices: Apple ID, provisioning profile, USB connection.
- `agent-device` CLI installed and authenticated to its daemon.

Quick check:

```bash
xcrun simctl list devices
agent-device devices --platform ios --json
```

## Booting a simulator

```bash
# Recommended: ensure-simulator (creates if needed, boots)
agent-device ensure-simulator --device "iPhone 16" --boot

# Or pinned to a runtime
agent-device ensure-simulator --device "iPhone 16 Pro" \
  --runtime com.apple.CoreSimulator.SimRuntime.iOS-18-4 --boot

# With a specific simulator set (isolation)
agent-device ensure-simulator --device "iPhone 16" \
  --ios-simulator-device-set /tmp/tenant-a/simulators --boot
```

The returned response includes `udid`, `device`, `runtime`, `created`, and `booted`.

## Launching an app

```bash
# By bundle id (preferred)
agent-device open com.acme.bank --platform ios --relaunch \
  --save-script {staging}/master.ad

# By app name (alias resolution)
agent-device open "Acme Bank" --platform ios

# By deep link URL (with bundle id hint for ambiguity)
agent-device open com.acme.bank "acmebank://transfer" --platform ios
```

iOS session responses include `device_udid` and `ios_simulator_device_set` for isolation verification.

## Selectors on iOS

Same syntax as Android — `role=`, `label=`, `text=`, `id=`, `visible=`, regex via `~=`.

### Mapping iOS attributes

| iOS XCUIElement field | agent-device selector | Notes |
|---|---|---|
| `accessibilityIdentifier` | `id="..."` | Best stability. Developer-set. |
| `accessibilityLabel` | `label="..."` | Often the visible text or content description. |
| `accessibilityValue` | (not directly selectable) | Read via `get attrs`. |
| `name` (UIKit) | usually `label="..."` | Maps to accessibility label in most cases. |
| `text` (text field content) | `text="..."` | Sensitive to user input. |
| XCUIElementType | `role="..."` | e.g. `button`, `cell`, `textfield`. |

XPath is not supported.

## App lifecycle on iOS

```bash
# Install .app or .ipa
agent-device install com.acme.bank ./AcmeBank.app --platform ios

# Reinstall (fresh state)
agent-device reinstall com.acme.bank ./AcmeBank.app --platform ios

# For .ipa, the tool extracts Payload/*.app automatically
agent-device install com.acme.bank ./AcmeBank.ipa --platform ios
```

`open --relaunch` requires the app to already be installed.

## Permissions

iOS simulator permission grants:

```bash
agent-device settings permission grant camera
agent-device settings permission grant microphone
agent-device settings permission grant notifications
agent-device settings permission grant photos full      # iOS-specific mode
agent-device settings permission grant photos limited   # iOS-specific mode
agent-device settings permission grant contacts
agent-device settings permission reset notifications
```

`full|limited` mode applies only to iOS `photos`.

### Biometric simulation (iOS simulator)

```bash
agent-device settings faceid enroll
agent-device settings faceid match        # successful Face ID
agent-device settings faceid nonmatch     # failed Face ID
agent-device settings faceid unenroll

agent-device settings touchid match
# similar variants
```

### Permission alerts

```bash
agent-device alert wait                  # block until an alert appears
agent-device alert accept                # grants permission
agent-device alert dismiss               # denies
```

`accept`/`dismiss` retry internally for up to 2 s — no manual sleeps needed.

## Clipboard

```bash
agent-device clipboard read              # works on simulator
agent-device clipboard write "token"     # works on simulator
```

iOS physical devices are not supported for clipboard helpers yet.

## App state introspection

```bash
agent-device appstate --json
```

iOS `appstate` is **session-scoped** (not live foreground polling like Android). Response includes `device_udid` and `ios_simulator_device_set`.

```bash
agent-device apps --platform ios --json
```

## Push notifications

```bash
# APNs-style payload
agent-device push com.acme.bank '{
  "aps": { "alert": "New message", "badge": 1 }
}' --platform ios
```

## XCTest runner recovery

iOS uses XCTest internally for snapshot and interaction. The runner has a build cache that's expensive to rebuild.

**Hang recovery:**

1. `agent-device open com.acme.bank --device "{device}"` to reattach.
2. If reopen doesn't help, the screen likely has continuous animations blocking XCTest idle → Tier 3.
3. `pkill -9 -f agent-device` is a **last resort** — destroys the runner build cache, recovery takes minutes.
4. **Never** `pkill -9 -f xcodebuild` — directly killing the runner process leaves orphaned state.

**Common animation-blocking patterns:**
- Onboarding screens with continuous Lottie animations.
- Live ticker price feeds (crypto/finance apps).
- Loading spinners that never resolve idle (poor app design).
- Carousels with auto-advance.

Escalate to Tier 3 after 2 consecutive hangs on the same screen.

## TV target (tvOS)

```bash
agent-device open com.acme.bank --platform ios --target tv
```

`back`/`home`/`app-switcher` map to Siri Remote actions (`menu`, `home`, double-home).
tvOS follows iOS simulator-only semantics for helpers like `pinch`, `settings`, `push`.

## Environment variables

| Var | Purpose |
|---|---|
| `AGENT_DEVICE_PLATFORM=ios` | Default platform |
| `AGENT_DEVICE_SESSION=<name>` | Default session |
| `AGENT_DEVICE_IOS_SIMULATOR_DEVICE_SET=<path>` | Scope to a simulator set |
| `IOS_SIMULATOR_DEVICE_SET` | Compat alias for the above |

## Per-platform deltas summary

| Aspect | iOS specifics |
|---|---|
| App identifier | Bundle id (`com.acme.bank`) |
| Launch path | `open <bundle>` or `open <url>` or `open <bundle> <url>` |
| Activity launch | N/A — iOS doesn't have Activities |
| Permission grants | `settings permission grant <kind> [full\|limited]` (iOS-specific modes for `photos`) |
| Biometrics | `settings faceid \| touchid <enroll\|unenroll\|match\|nonmatch>` |
| Snapshot provider | XCTest |
| Text injection | XCTest typing |
| Hardware back | N/A — iOS uses in-app back gestures or nav buttons |
| Push | APNs-style JSON payload |
| Permission alerts | `alert wait` + `alert accept\|dismiss` |
| Clipboard | Simulator only |
| Runner recovery | XCTest cache; prefer reopen over kill |

## Quick command palette for capture

```bash
# Ensure simulator
agent-device ensure-simulator --device "iPhone 16" --boot

# Session
agent-device open com.acme.bank --platform ios --relaunch \
  --save-script ./public/captures/acme-bank/_staging/master.ad

# Per-screen capture
agent-device snapshot -i --json > /tmp/snap.json
agent-device screenshot /tmp/{NNN}.png

# Interaction
agent-device click 'id="primary-cta"'
agent-device fill 'id="email"' "user@example.com"
agent-device find "Continue" click

# Permissions
agent-device alert wait
agent-device alert accept

# Close
agent-device close
```
