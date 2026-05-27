# Android Reference

agent-device specifics for Android emulators and devices. Most of agent-device's command surface is platform-neutral; this doc covers what differs.

## Prerequisites

- Android SDK with `emulator`, `adb`, `platform-tools` on PATH (or under `~/Library/Android/sdk` / `/opt/homebrew/share/android-commandlinetools` on macOS).
- At least one AVD configured (`emulator -list-avds`).
- `agent-device` CLI installed and authenticated to its daemon.

Quick check:

```bash
which emulator adb
emulator -list-avds
agent-device devices --platform android --json
```

## Booting an emulator

```bash
# Boot a specific AVD by name (no GUI: add --headless)
agent-device boot --platform android --device {avd-name}

# Verify
agent-device devices --platform android --json
```

If `agent-device boot` is unavailable or you need control:

```bash
emulator -avd {avd-name} -no-snapshot-load -gpu auto &
adb wait-for-device
adb shell getprop sys.boot_completed   # should print "1"
```

## Launching an app

```bash
# By package name (preferred — agent-device infers launcher activity)
agent-device open com.acme.bank --platform android --relaunch \
  --save-script {staging}/master.ad

# By deep link URL
agent-device open "acmebank://transfer?amount=100" --platform android

# By package + deep link
agent-device open com.acme.bank "acmebank://settings" --platform android
```

**Activity-level launching** is NOT directly supported by `agent-device open`. If you need to start a specific `ComponentName`:

```bash
# Fallback: use adb directly. Session bookkeeping may not track this — agent-device may need a re-open.
adb shell am start -n com.acme.bank/.SpecificActivity
agent-device open com.acme.bank --platform android   # reattach session
```

Avoid the fallback unless required — the package-name launch is the supported path.

## Session and target binding

Pre-bind environment variables to skip flags on every command:

```bash
export AGENT_DEVICE_PLATFORM=android
export AGENT_DEVICE_SESSION=acme-capture
# Optional: constrain to specific serials
export AGENT_DEVICE_ANDROID_DEVICE_ALLOWLIST=emulator-5554
```

Multi-device targeting:

```bash
agent-device open com.acme.bank --serial emulator-5554 --platform android
```

## Snapshot helper APK

The first `snapshot` call against an Android device verifies and installs the bundled snapshot helper APK. This is automatic and idempotent.

- Helper present + working → snapshots use `interactive-windows` capture mode (multi-window: app + keyboard + system overlays serialized as one tree).
- Helper missing / outdated / failed → automatic fallback to stock UIAutomator (`active-window` mode, single window).

The snapshot result includes:

```json
{
  "androidSnapshot": {
    "captureMode": "interactive-windows",
    "windowCount": 2,
    "fallbackReason": null
  }
}
```

If `fallbackReason` is non-null, structure quality degrades — be more conservative with selector confidence and consider escalating to Tier 2.

Helper installs touch the device — **warn loudly if running against a non-emulator device** (a borrowed/loaner phone). On emulators we own this is fine.

## Selectors on Android

Supported syntax (from agent-device):

```
role="button"
label="Continue"
text="Welcome"
id="primary-cta"
visible=true
label~="Wi-Fi|Battery"     # regex via ~=
```

Combine: `'role="button" label="Continue" visible=true'`.

### Mapping Android attributes to selectors

| Android UIAutomator field | agent-device selector | Notes |
|---|---|---|
| `resource-id` | `id="..."` | Best stability. Use first. |
| `content-desc` | `label="..."` | The bundled helper normalizes content-desc into label. Verify empirically per app. |
| `text` | `text="..."` | Last resort. Drifts with localization and dynamic content. |
| `className` | NOT directly supported | Filter post-snapshot if needed. |
| `bounds` | NOT supported as selector | Use coordinate `press` if absolutely necessary. |

**Selector ranking for hardening:**

1. `id="..."` — best. Resource IDs are developer-set and intentionally stable.
2. `label="..."` — good if unique on screen. Maps to `content-desc` for icon-only elements.
3. `label="..." role="..."` — disambiguate when same label appears with different roles.
4. `text="..."` — last resort. Sensitive to copy changes and localization.

XPath is not supported. Do not use it in `.ad` files.

## App lifecycle on Android

```bash
# Install (in-place, preserves data when possible)
agent-device install com.acme.bank ./app-release.apk --platform android

# Reinstall (fresh state, removes data)
agent-device reinstall com.acme.bank ./app-release.apk --platform android

# Bundle support (.aab) requires bundletool
export AGENT_DEVICE_BUNDLETOOL_JAR=/path/to/bundletool-all.jar
agent-device install com.acme.bank ./app-release.aab --platform android
```

`open --relaunch` requires the package to be already installed. For React Native + Metro flows, install first then relaunch.

## Permissions

Pre-grant permissions before they prompt to avoid mid-flow popups:

```bash
agent-device settings permission grant camera
agent-device settings permission grant microphone
agent-device settings permission grant notifications
agent-device settings permission grant photos     # storage
agent-device settings permission grant contacts
agent-device settings permission reset notifications   # revoke
```

Maps internally to `adb shell pm grant|revoke` (and `appops` for notifications).

**For app-owned permission sheets** (not OS dialogs), use `snapshot -i` + `press` by label/ref. agent-device's `alert` commands handle OS-level alerts only.

## App state introspection

```bash
agent-device appstate --json
```

Returns the live foreground package + activity. Useful for:
- Verifying which app is in focus before issuing commands.
- Detecting when the user-installed app crashed back to launcher.
- Confirming deep-link navigation worked.

```bash
agent-device apps --platform android --json          # user-installed only
agent-device apps --platform android --all --json    # include system/OEM
```

## Text entry

agent-device handles text injection natively on Android (provider injection where available, chunk-safe ADB shell input fallback).

```bash
agent-device fill 'id="email"' "user@example.com"    # clears then types
agent-device type "additional text"                  # appends without clearing
agent-device fill 'id="otp"' "{{OTP}}"               # placeholder for replay
```

Non-ASCII text may require an ADB keyboard IME on some system images. Only install IME APKs from trusted sources.

## Hardware actions

```bash
agent-device back                      # default back press
agent-device back --system             # OS-level back (vs. app-owned)
agent-device home
agent-device app-switcher              # recent apps view
agent-device scroll down 0.5           # fractional viewport scroll
agent-device scroll down --pixels 320  # exact pixel scroll
```

## Performance metrics

```bash
agent-device perf --json
# returns: fps (droppedFramePercent + worstWindows), memory (kB), cpu (% recent snapshot)
```

Android frame-health metrics reset after each successful `perf` read and after `open <app>`. Workflow: `perf` → interaction → `perf` for a focused window.

Useful for annotating "this screen drops frames" in capture notes, but optional — don't make `perf` central to the capture loop.

## Push notifications and broadcasts

```bash
# Broadcast to a package's receiver
agent-device push com.acme.bank '{
  "action": "com.acme.bank.NOTIFY",
  "receiver": "com.acme.bank/.MyReceiver",
  "extras": { "id": "123" }
}' --platform android
```

Maps to `adb shell am broadcast` with typed extras.

## Hang recovery on Android

Common causes:
- Continuous animations / live tickers blocking accessibility tree.
- WebView screens with custom rendering.
- Apps that disable accessibility for security reasons.

Recovery (see also [exploration.md](exploration.md)):

1. `agent-device open {pkg} --platform android` to reattach.
2. If reopen doesn't help, screen is animation-blocked → Tier 3.
3. Avoid `pkill -9 -f agent-device` — destroys runner cache.
4. **Never** kill `adb` or `emulator` processes directly. Use `adb kill-server` if absolutely necessary, then `adb start-server`.

## Per-platform deltas summary

| Aspect | Android specifics |
|---|---|
| App identifier | Package name (`com.acme.bank`) |
| Launch path | `open <pkg>` or `open <url>` or `open <pkg> <url>` |
| Activity launch | Not first-class — fall back to `adb shell am start -n` |
| Permission grants | `agent-device settings permission grant <kind>` → `pm grant`/`appops` |
| Snapshot provider | Bundled helper APK (preferred) + UIAutomator (fallback) |
| Text injection | Provider native or ADB shell input |
| Hardware back | `agent-device back [--system]` |
| Push | `agent-device push <pkg> <json>` → `am broadcast` |
| Performance | `dumpsys gfxinfo` + `dumpsys meminfo` + `dumpsys cpuinfo` |

## Environment variables

| Var | Purpose |
|---|---|
| `AGENT_DEVICE_PLATFORM=android` | Default platform for all commands |
| `AGENT_DEVICE_SESSION=<name>` | Default session name |
| `AGENT_DEVICE_ANDROID_DEVICE_ALLOWLIST=<serials>` | Restrict discovery to specific serials |
| `AGENT_DEVICE_BUNDLETOOL_JAR=<path>` | Required for `.aab` installs without `bundletool` on PATH |
| `AGENT_DEVICE_ANDROID_BUNDLETOOL_MODE=<mode>` | `bundletool build-apks --mode` (default `universal`) |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | Standard Android SDK paths |

## Quick command palette for capture

```bash
# Boot
agent-device boot --platform android --device pixel_test

# Session
agent-device open com.acme.bank --platform android --relaunch \
  --save-script ./public/captures/acme-bank/_staging/master.ad

# Per-screen capture
agent-device snapshot -i --json > /tmp/snap.json
agent-device screenshot /tmp/{NNN}.png

# Interaction
agent-device click 'id="primary-cta"'
agent-device fill 'id="email"' "user@example.com"
agent-device find "Continue" click

# Navigation
agent-device back
agent-device scroll down 0.5

# Close
agent-device close
```
