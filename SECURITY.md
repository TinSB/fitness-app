# Security Policy

## Project Surface

IronPath is a local-first native iOS SwiftUI app. The current repository has no web runtime, browser storage, Node API, remote networking, account runtime, or cloud-sync runtime.

Current sensitive surfaces:

- Local canonical `AppData` JSON files written through `IronPathPersistence`.
- DataHealth cleaning and repair before engine consumption.
- HealthKit adapters for approved body-weight import, workout-history import, and native workout export.
- WidgetKit read-only readiness snapshots.
- Local notifications for rest and weekly-training reminders.
- Future account/cloud/sync/CRDT work, which is decisioned in the living docs but not implemented in runtime code.

## Security Boundaries

- Canonical writes must go through `CanonicalSessionWriter`.
- Raw `AppData` must not enter training engines.
- Derived stores, widgets, HealthKit exports, UI view models, and local snapshots are not sources of truth.
- Secrets must not be committed. `.env*` and local tool state are ignored.
- No network, auth SDK, cloud SDK, WebView, SQLite, CoreData, SwiftData, remote push, watchOS, WatchConnectivity, or CRDT runtime may be added without an approved Master Architecture amendment and implementation slice.
- Health and pain guidance must stay fitness-support guidance, not medical diagnosis.

## Verification

Use the smallest relevant real verification for the touched surface:

```bash
cd ios/packages/IronPathTrainingDecision
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
  -project ios/IronPath.xcodeproj \
  -scheme IronPath \
  -destination 'generic/platform=iOS Simulator' \
  build
```

## Reporting A Vulnerability

If you believe you found an issue that affects user data, do not publish exploit details in a public issue.

1. Open a GitHub issue titled `Security report` with a short impact summary and no proof-of-concept details.
2. Wait for maintainer follow-up before sharing reproduction details.
3. Confirmed reports should receive an initial response within 14 days and public disclosure after a fix is merged.

## Accepted Tradeoffs

- Local files are not encrypted by IronPath. Device security and iOS sandboxing are currently the user trust boundary.
- Current runtime has no account lock, two-factor authentication, or server-side revocation because account runtime is not implemented.
- Third-party imported health or workout data is treated as user-provided data; it must pass the approved clean/validation path before affecting trusted views.
