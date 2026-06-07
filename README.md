# IronPath

IronPath is a native iOS personal training app for strength and hypertrophy training.

The repository is now Swift-first. The former React/Vite PWA, Node dev API, Supabase/Vercel implementation candidates, TypeScript tests, and browser runtime have been removed so future work starts from the iOS codebase.

IronPath is local-first. The app uses on-device JSON persistence through Foundation and keeps business logic in local Swift packages. It does not contain cloud sync runtime, account auth runtime, remote networking, WebView, CoreData, SwiftData, SQLite, or PWA runtime code. Future iOS-native account/cloud/sync decisions are preserved in the living docs, but they are not active implementation.

## Current Direction

Target information architecture:

| Area | Purpose |
|---|---|
| Today | Decide whether to train today, what to train, why, and where to start. |
| Train | Record the current workout in one focused training surface. |
| Progress | Review completed sessions, PR/e1RM trends, training volume, calendar continuity, and data quality. |
| Plan | Understand future training, program structure, proposed changes, and rollbackable plan decisions. |
| Profile / Settings | Low-frequency settings: profile, units, screening, HealthKit permissions, data export, subscriptions, and data controls. This is not a bottom tab. |

Current implementation still contains transitional iOS surface names such as History/Profile. The commercial target is defined in `docs/IRONPATH_iOS_SYSTEM_LOGIC.md` and `AGENTS.md`.

## What Exists Now

- A SwiftUI iOS app shell in `ios/IronPath`.
- A WidgetKit readiness widget in `ios/IronPathWidget`.
- Eleven local Swift Package Manager packages under `ios/packages`.
- A local-first canonical AppData store backed by on-device JSON files.
- A gated canonical write path through `CanonicalSessionWriter`.
- DataHealth cleaning and repair logic before engine consumption.
- Focus training surfaces for active workout execution and set logging.
- Today / training / history / plan / profile read and edit surfaces.
- HealthKit body-weight import, workout-history import, and native workout export inside the approved HealthKit boundary.
- Local rest and weekly training reminders.
- A read-only home-screen readiness widget.
- Frozen iOS test fixtures under `ios/ParityFixtures`.

Systems that are not current implementation:

- Cloud sync runtime, Supabase client/runtime implementation, account auth runtime, and remote networking.
- watchOS, WatchConnectivity, and CRDT active-session co-editing.
- Full AppData restore.
- Remote push notifications.
- Subscription SDK or remote entitlement infrastructure.

Those systems require a new approved architecture amendment and a fresh Swift-native design before implementation.

## Architecture

IronPath keeps the iOS app layer thin. SwiftUI views should render state and connect IO seams; business logic belongs in local Swift packages.

Important package groups:

| Package | Role |
|---|---|
| `IronPathDomain` | Codable AppData model and shared domain types. |
| `IronPathDataHealth` | Clean AppData projection, repair logic, and data-health guards. |
| `IronPathTrainingDecision` | Training decision, scheduling, readiness, insights, and coach-action engines. |
| `IronPathPersistence` | Local JSON persistence and canonical write infrastructure. |
| `IronPathLocalSnapshot` | Derived local display snapshots for Focus/history surfaces. |
| `IronPathHealthKit` | Approved HealthKit adapters only. |
| `IronPathNotifications` | Local notification adapters only. |
| `IronPathWidgetShared` | Read-only widget snapshot model. |
| `IronPathL10n` | Terms and formatting support. |
| `IronPathBackup`, `IronPathUIKit` | Placeholder packages; not approval to build backup/export or shared UI systems. |

Core data rules:

- Raw AppData must not enter training engines.
- Engine input must come through clean data views or clean input contracts.
- Canonical writes must go through the gated write path.
- Derived outputs, UI receipts, widgets, snapshots, and HealthKit exports must not become parallel sources of truth.
- Local-first behavior is a hard boundary until the Master Architecture explicitly changes it.

## Run The App

Requirements:

- macOS
- Xcode
- An available iOS Simulator or iOS device

Open the project:

```bash
open ios/IronPath.xcodeproj
```

Use the `IronPath` scheme to build and run the app.

To inspect available schemes from the command line:

```bash
xcodebuild -list -project ios/IronPath.xcodeproj
```

To build from the command line:

```bash
xcodebuild \
  -project ios/IronPath.xcodeproj \
  -scheme IronPath \
  -destination 'generic/platform=iOS Simulator' \
  build
```

## Package Tests

Most core logic lives in Swift packages. When changing a package, run its tests from the package directory:

```bash
cd ios/packages/IronPathTrainingDecision
swift test
```

To run all package tests:

```bash
for package in ios/packages/*; do
  if [ -f "$package/Package.swift" ]; then
    (cd "$package" && swift test) || exit 1
  fi
done
```

Some app-level behavior still requires Xcode build or simulator validation because it depends on iOS frameworks, entitlements, HealthKit, notifications, WidgetKit, or app wiring.

## Documentation

Read these before changing behavior:

| Document | Purpose |
|---|---|
| `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` | Highest-level architecture contract. This wins on boundaries, source of truth, platform scope, and forbidden changes. |
| `docs/IRONPATH_iOS_SYSTEM_LOGIC.md` | Current system logic, product target, decision loop, data model gaps, and implementation status. |
| `docs/IRONPATH_REBUILD_00_IRONRULES_AND_CLOUD.md`, `docs/CLOUD_DECISIONS_ARCHIVE.md` | Approved iOS-native account/cloud/sync/CRDT direction. Not current runtime code. |
| `docs/DOCS_MANIFEST.md` | Living-doc rules and canonical document registry. |
| `COMMERCIALIZATION_ROADMAP.md` | Commercialization roadmap and gated business infrastructure decisions. |
| `AGENTS.md` | Practical instructions for coding agents and future contributors. |

## Contribution Boundaries

Before opening a pull request:

- Read the Master Architecture and the docs manifest.
- Keep app-layer changes thin.
- Keep logic in Swift packages.
- Do not add cloud runtime, auth runtime, networking, watchOS, CRDT, CoreData, SwiftData, SQLite, remote push, or new persistence mechanisms without an approved architecture amendment.
- Do not change `project.pbxproj` or package manifests unless the task explicitly requires it.
- Update the affected living docs when behavior, architecture, or product direction changes.
- Run the relevant Swift package tests, Xcode build, or manual simulator validation.

New top-level Markdown files are not allowed unless first registered in `docs/DOCS_MANIFEST.md`.

## Training And Health Disclaimer

IronPath uses training heuristics and evidence-informed rules to support strength-training decisions. e1RM, readiness, effective sets, fatigue, recovery, and data-quality scores are estimates. Pain or discomfort guidance is conservative training guidance only. Persistent pain, numbness, radiating symptoms, or functional limitation should be evaluated by a qualified professional.
