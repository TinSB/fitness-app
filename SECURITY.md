# Security Policy

## Project Surface

Rede is a local-first native iOS SwiftUI product. The clean iOS app is the active implementation; the approved first-version runtime has no web runtime, browser storage, Node API, remote networking, account runtime, or cloud-sync runtime. Retired IronPath/PWA-era code must be audited before any reuse.

Sensitive surfaces:

- Local canonical `AppData` JSON files written through the implemented gated persistence boundary (`RedePersistence.CanonicalSessionWriter`).
- DataHealth cleaning and repair before engine consumption.
- WidgetKit read-only readiness snapshots (shipped Readiness widget via `RedeWidgetShared` + the widget extension, App Group `group.com.tinsab.rede`, used for nothing else).
- The rest-timer Live Activity (ActivityKit; local only with `pushType: nil`, no push token; display-only).
- The Apple Watch companion app (status 2026-10-14; embedded in the iOS app since #732, 1.10.2 build 36 on TestFlight; current marketing version 1.11.0): WatchConnectivity between phone and watch via `RedeWatchLink`. The watch writes no canonical data and keeps no files, App Group or `UserDefaults` of its own. Its HealthKit workout session requests share (write) access for workouts and read access to heart rate and active energy, and the whole watch app is gated on the workout-write permission. Only heart rate and elapsed time are displayed, on the watch. It writes the workout to Apple Health on a normal end; that Health data is the watch's only persisted output (whether heart-rate / energy samples are saved with the workout is unverified; see system logic §7.2). Built without a Master amendment; see the Master Architecture header.
- Local notifications for rest and weekly-training reminders (planned; no notification adapter is implemented yet).
- HealthKit (status 2026-10-14): on iPhone, only the read-only body-weight adapter in `RedeHealthKit` exists; workout import is not implemented. The watch target uses HealthKit directly for the workout session above, outside `RedeHealthKit`. That is an open architecture conflict, pending the owner's decision.
- Future account/cloud/sync/CRDT work, decisioned in the living docs but not implemented in first-version runtime code.

## Security Boundaries

- Canonical writes must go through the implemented gated writer (`RedePersistence.CanonicalSessionWriter`) with validation, backup, atomic save, and honest failure.
- Raw `AppData` must not enter training engines.
- Derived stores, widgets, HealthKit exports, UI view models, and local snapshots are not sources of truth.
- Secrets must not be committed. `.env*` and local tool state are ignored.
- No network, auth SDK, cloud SDK, WebView, SQLite, CoreData, SwiftData, remote push, watchOS, WatchConnectivity, or CRDT runtime may be added without an approved Master Architecture amendment and implementation slice. (Status 2026-10-14: the existing watchOS / WatchConnectivity code was added without such an amendment and is an open conflict, neither authorized nor ordered removed; see the Master header.)
- Health and pain guidance must stay fitness-support guidance, not medical diagnosis.

## Verification

Use the smallest relevant real verification for the touched surface. Docs/security-policy changes:

```bash
git diff --check
```

Runtime package slices:

```bash
cd ios/packages/RedeTrainingDecision
swift test
```

```bash
for package in ios/packages/*; do
  if [ -f "$package/Package.swift" ]; then
    (cd "$package" && swift test) || exit 1
  fi
done
```

```bash
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination 'generic/platform=iOS Simulator' \
  build
```

## Reporting A Vulnerability

If you believe you found an issue that affects user data, do not publish exploit details in a public issue.

1. Open a GitHub issue titled `Security report` with a short impact summary and no proof-of-concept details.
2. Wait for maintainer follow-up before sharing reproduction details.
3. Confirmed reports should receive an initial response within 14 days and public disclosure after a fix is merged.

## Accepted Tradeoffs

- Local files are not encrypted by the first-version Rede target. Device security and iOS sandboxing are the default user trust boundary.
- The first-version runtime has no account lock, two-factor authentication, or server-side revocation because account runtime is not implemented.
- Third-party imported health or workout data is treated as user-provided data; it must pass the approved clean/validation path before affecting trusted views.
