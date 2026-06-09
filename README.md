# Rede

Rede is a native iOS personal training product for strength and hypertrophy training.

The repository is now governed by a clean iOS rewrite baseline. Future runtime work starts from the living docs, not from the legacy Swift implementation. The former React/Vite PWA, Node dev API, Supabase/Vercel implementation candidates, TypeScript tests, and browser runtime have been removed and must not be restored as this repo's product runtime.

The target product is local-first. The clean iOS runtime must use on-device JSON persistence through Foundation and keep business logic in local Swift packages. It must not contain cloud sync runtime, account auth runtime, remote networking, WebView, CoreData, SwiftData, SQLite, or PWA runtime code unless the Master Architecture is amended first. Future iOS-native account/cloud/sync decisions are preserved in the living docs, but they are not first-version runtime.

## Current Direction

Target information architecture:

| Area | Purpose |
|---|---|
| Today | Decide whether to train today, what to train, why, and where to start. |
| Train | Record the current workout in one focused training surface. |
| Progress | Review completed sessions, PR/e1RM trends, training volume, calendar continuity, and data quality. |
| Plan | Understand future training, program structure, proposed changes, and rollbackable plan decisions. |
| Profile / Settings | Low-frequency settings: profile, units, screening, HealthKit permissions, data export, subscriptions, and data controls. This is not a bottom tab. |

The commercial target is defined in `docs/REDE_iOS_SYSTEM_LOGIC.md` and `AGENTS.md`. Legacy iOS screens may contain transitional names such as History/Profile; the clean rewrite must implement the target structure directly.

## Repository Status

- Living docs are the current product and engineering truth.
- Existing `ios/` code is legacy/reference inventory. It can inform naming, fixtures, and local algorithms, but it is not the implementation baseline and must not be presented as shipping progress.
- The clean iOS runtime is not yet the approved active implementation.
- External website / landing-page paid-intent validation can happen before the rebuild, but it is separate from this repository's runtime and must not restore a PWA/web app here.

Systems that are not approved first-version runtime:

- Cloud sync runtime, Supabase client/runtime implementation, account auth runtime, and remote networking.
- watchOS, WatchConnectivity, and CRDT active-session co-editing.
- Full AppData restore.
- Remote push notifications.
- Subscription SDK or remote entitlement infrastructure.

Those systems require a new approved architecture amendment and a fresh Swift-native design before implementation.

## Target Architecture

Rede keeps the iOS app layer thin. SwiftUI views should render state and connect IO seams; business logic belongs in local Swift packages. Existing package names below are target boundaries or reference names, not proof that the clean runtime is complete.

Important package groups:

| Package | Role |
|---|---|
| `RedeDomain` | Codable AppData model and shared domain types. |
| `RedeDataHealth` | Clean AppData projection, repair logic, and data-health guards. |
| `RedeTrainingDecision` | Training decision, scheduling, readiness, insights, and coach-action engines. |
| `RedePersistence` | Local JSON persistence and canonical write infrastructure. |
| `RedeLocalSnapshot` | Derived local display snapshots for Focus/session projections. |
| `RedeHealthKit` | Approved HealthKit adapters only. |
| `RedeNotifications` | Local notification adapters only. |
| `RedeWidgetShared` | Read-only widget snapshot model. |
| `RedeL10n` | Terms and formatting support. |
| `RedeBackup`, `RedeUIKit` | Placeholder packages; not approval to build backup/export or shared UI systems. |

Core data rules:

- Raw AppData must not enter training engines.
- Engine input must come through clean data views or clean input contracts.
- Canonical writes must go through the gated write path.
- Derived outputs, UI receipts, widgets, snapshots, and HealthKit exports must not become parallel sources of truth.
- Local-first behavior is a hard boundary until the Master Architecture explicitly changes it.

## Clean Rewrite Entry

Start by reading:

- `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md`
- `docs/REDE_iOS_SYSTEM_LOGIC.md`
- `docs/DOCS_MANIFEST.md`
- `COMMERCIALIZATION_ROADMAP.md`

The existing Xcode project may be inspected or built only as a legacy reference. It is not the product validation baseline. Do not start new feature work by patching legacy runtime code unless a rewrite slice explicitly approves reuse.

Optional legacy reference inspection:

```bash
open ios/Rede.xcodeproj
```

To inspect available legacy schemes from the command line:

```bash
xcodebuild -list -project ios/Rede.xcodeproj
```

To build the legacy reference from the command line:

```bash
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination 'generic/platform=iOS Simulator' \
  build
```

## Validation

For docs/spec changes:

```bash
git diff --check
```

When clean runtime code exists, run the smallest real validation for the touched slice. Package tests should be run from the relevant package directory:

```bash
cd ios/packages/RedeTrainingDecision
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

App-level behavior requires Xcode build or simulator validation when the clean runtime touches iOS frameworks, entitlements, HealthKit, notifications, WidgetKit, or app wiring.

## Documentation

Read these before changing behavior:

| Document | Purpose |
|---|---|
| `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md` | Highest-level architecture contract. This wins on boundaries, source of truth, platform scope, and forbidden changes. |
| `docs/REDE_iOS_SYSTEM_LOGIC.md` | Clean rewrite system logic, product target, decision loop, data model gaps, and reference inventory. |
| `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md`, `docs/CLOUD_DECISIONS_ARCHIVE.md` | Approved iOS-native account/cloud/sync/CRDT direction. Not first-version runtime code. |
| `docs/DOCS_MANIFEST.md` | Living-doc rules and canonical document registry. |
| `COMMERCIALIZATION_ROADMAP.md` | Commercialization roadmap and gated business infrastructure decisions. |
| `AGENTS.md` | Practical instructions for coding agents and future contributors. |

## Contribution Boundaries

Before opening a pull request:

- Read the Master Architecture and the docs manifest.
- Preserve approved product/system logic unless the living docs are explicitly amended.
- Treat existing `ios/` code as reference-only unless a rewrite slice approves reuse.
- Keep app-layer changes thin.
- Keep logic in Swift packages.
- Do not add cloud runtime, auth runtime, networking, watchOS, CRDT, CoreData, SwiftData, SQLite, remote push, or new persistence mechanisms without an approved architecture amendment.
- Do not change `project.pbxproj` or package manifests unless the task explicitly requires it.
- Update the affected living docs when behavior, architecture, or product direction changes.
- Run docs validation for docs-only changes and the relevant Swift package tests, Xcode build, or manual simulator validation for runtime slices.

New top-level Markdown files are not allowed unless first registered in `docs/DOCS_MANIFEST.md`.

## Training And Health Disclaimer

Rede uses training heuristics and evidence-informed rules to support strength-training decisions. e1RM, readiness, effective sets, fatigue, recovery, and data-quality scores are estimates. Pain or discomfort guidance is conservative training guidance only. Persistent pain, numbness, radiating symptoms, or functional limitation should be evaluated by a qualified professional.
