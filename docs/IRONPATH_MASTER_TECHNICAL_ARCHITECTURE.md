# IronPath Master Technical Architecture

> **This is the canonical, highest-level engineering contract for IronPath.**
> Every human and every AI agent must read this document before making changes and must obey it. If a requested task conflicts with this document, stop and require explicit architecture approval before writing code.

- **Status:** Authoritative / binding
- **Version:** 2.0
- **Last updated:** 2026-06-07
- **Repository:** `TinSB/fitness-app` (working dir `ironpath`)
- **v2.0 amendment:** retires and removes the former Web/PWA, Node/Vite, browser-test, Supabase/Vercel implementation candidates, and `IronPathCloudSync` stub package. The active product and engineering baseline is native iOS SwiftUI plus local Swift packages. iOS-native account/cloud/sync/CRDT decisions remain canonical in `docs/IRONPATH_REBUILD_00_IRONRULES_AND_CLOUD.md` and `docs/CLOUD_DECISIONS_ARCHIVE.md`; they are not current implementation.

---

## 1. Authority

This document is the single source of architectural truth for IronPath. It outranks every other repo document on:

- source-of-truth boundaries
- package boundaries
- persistence and write paths
- platform permissions
- validation expectations
- forbidden dependencies and systems

It does not outrank explicit, in-the-moment human approval that knowingly amends this file. Such an amendment must be written back into this file in the same change.

---

## 2. Current Project State

| Area | Current state |
|---|---|
| Product surface | Native iOS SwiftUI app in `ios/IronPath` plus a WidgetKit extension in `ios/IronPathWidget`. |
| Business logic | Local Swift packages under `ios/packages`. |
| Package count | 11 local Swift packages. No active sync/cloud package exists. |
| Data model | `IronPathDomain.AppData`, a pure `Codable` value model. |
| Persistence | Local on-device JSON files via Foundation `FileManager` only. |
| Canonical writes | One gated path through `IronPathPersistence.CanonicalSessionWriter`. |
| Derived stores | `IronPathLocalSnapshot` Focus/history snapshots, widget snapshots, HealthKit exports, and UI projections are not sources of truth. |
| HealthKit | Approved adapters only: body-weight import, workout-history import, and user-triggered native workout export. |
| Notifications | Local-only rest and weekly-training reminders. |
| Widget | Read-only readiness widget backed by a derived App Group snapshot. |
| Test fixtures | Frozen iOS fixtures live under `ios/ParityFixtures`. They are test assets, not a live generator or alternate source of truth. |
| Account/cloud/sync decisions | Canonical future iOS-native direction is preserved in `docs/IRONPATH_REBUILD_00_IRONRULES_AND_CLOUD.md` and `docs/CLOUD_DECISIONS_ARCHIVE.md`. No runtime code is present. |

Removed implementation surfaces:

- Web/PWA runtime and assets.
- Node/Vite build and dev API.
- TypeScript source, contracts, scripts, and Vitest tests.
- Supabase/Vercel implementation candidates, browser sync, account/auth runtime code, and cloud candidate code.
- `IronPathCloudSync` Swift package stub.

---

## 3. Product Architecture

IronPath is a local-first native iOS training app. The app should feel like a polished, restrained, professional mobile training coach, not an admin dashboard or data-heavy engineering panel.

Target commercial information architecture:

| Area | Purpose |
|---|---|
| 今日 | Should I train today, what should I train, why, and where do I start? |
| 训练 | How do I record the workout now with the least friction? |
| 进展 | Did training work, what changed, and is the data trustworthy? |
| 计划 | How will I train in the future, and what changes are proposed? |
| Profile / Settings | Low-frequency settings, data controls, units, screening, HealthKit permissions, export/backup, and subscriptions. Not a bottom tab. |

The current iOS app still contains transitional surface names such as `History` and `Profile`. Product target changes must be tracked in `docs/IRONPATH_iOS_SYSTEM_LOGIC.md`.

---

## 4. Native iOS Architecture

```
ios/
├── IronPath/                 SwiftUI app layer
├── IronPathWidget/           WidgetKit readiness extension
├── IronPath.xcodeproj        App + widget project
├── IronPath.xcworkspace      Workspace
├── ParityFixtures/           Frozen iOS test fixtures
└── packages/                 Local Swift packages
```

The app layer is a thin renderer and IO seam. It may:

- own SwiftUI screens and view models
- connect package APIs to platform adapters
- format local UI labels and dates
- surface honest loading/error states

The app layer must not:

- own business decision logic
- bypass DataHealth before engine consumption
- create a second persistence path
- introduce network, account/auth runtime, cloud runtime, WebView, CoreData, SwiftData, SQLite, or UserDefaults source-of-truth storage

---

## 5. Swift Package Boundaries

### Active Packages

| Package | Responsibility | Depends on |
|---|---|---|
| `IronPathDomain` | Codable AppData model and domain values. | Foundation only |
| `IronPathDataHealth` | Clean AppData projection, repair logic, and runtime guards. | `IronPathDomain` |
| `IronPathTrainingDecision` | Training decision, readiness, scheduling, progression, insights, and coach-action engines. | `IronPathDomain`, `IronPathDataHealth` |
| `IronPathPersistence` | AppData store protocol, JSON file store, and canonical write orchestration. | `IronPathDomain` |
| `IronPathLocalSnapshot` | Derived Focus/session history snapshots. Never canonical AppData. | Foundation only |
| `IronPathHealthKit` | Approved HealthKit adapters and pure mapping seams. | `IronPathDomain` |
| `IronPathNotifications` | Local notification policies and adapters. | Foundation only |
| `IronPathWidgetShared` | Read-only widget snapshot model and App Group snapshot store. | Foundation only |
| `IronPathL10n` | Terms and formatting support. | Foundation only |

### Placeholder Packages

| Package | Status |
|---|---|
| `IronPathBackup` | Placeholder. It does not authorize backup/export implementation. |
| `IronPathUIKit` | Placeholder. It does not authorize a shared UI framework migration. |

There is no active cloud/sync package. Future iOS-native account/cloud/sync work must follow `docs/IRONPATH_REBUILD_00_IRONRULES_AND_CLOUD.md` and `docs/CLOUD_DECISIONS_ARCHIVE.md`, then land through an explicit Master-approved implementation slice.

### Package Rules

1. `IronPathDomain` is the dependency leaf.
2. `IronPathLocalSnapshot` must stay decoupled from `IronPathDomain` and canonical AppData.
3. The import graph must remain a DAG.
4. Packages never depend on the app target.
5. Placeholder packages stay inert until explicitly approved.

---

## 6. Source Of Truth

The source of truth is canonical AppData.

| Surface | Source of truth | Derived records |
|---|---|---|
| Native iOS | `IronPathDomain.AppData`, persisted through `IronPathPersistence.JSONFileAppDataStore` | Local snapshots, widget snapshots, HealthKit exports, UI view models |
| Tests | Swift packages + frozen fixtures under `ios/ParityFixtures` | Test-only decoded views |

Hard rules:

1. There is exactly one canonical AppData document per local app install.
2. `IronPathLocalSnapshot` must never read or write canonical AppData.
3. No task may change where canonical AppData lives without amending this document.
4. Canonical AppData writes must go through `CanonicalSessionWriter`.
5. Full AppData restore is deferred behind DataHealth clean-view and repair-apply gates.

---

## 7. Canonical Write Path

`CanonicalSessionWriter` is the only sanctioned canonical write orchestration. It owns:

- load existing AppData
- build a candidate mutation
- run the injected DataHealth validation gate
- backup before overwrite
- atomic save
- honest failure propagation

Approved current mutation classes include:

- completed-session append
- HealthKit body-weight sample append
- HealthKit imported-workout sample append into derived display-only storage
- profile scalar edit
- unit setting edit
- screening list edit
- program scalar config edit
- logged-set correction
- saved-session exercise replacement
- coach-action dismissal intent

Rules:

- No fake success.
- No overwrite of unreadable user data.
- No parallel store.
- No schema bump unless explicitly approved.
- No engine outputs written back as truth.

---

## 8. Engine Input Boundary

Raw AppData must not enter training engines. Engine inputs must come from:

- DataHealth clean views
- explicit clean input contracts
- typed domain values that have passed the relevant clean/validation boundary

HealthKit imports, widget snapshots, local snapshots, UI receipts, and future platform observations are not engine truth unless a specific architecture amendment and implementation slice promote them through a clean input contract.

---

## 9. Platform Boundaries

Allowed platform integrations:

- `FileManager` for local JSON persistence and sanctioned backups.
- HealthKit only inside `IronPathHealthKit`.
- UserNotifications only inside `IronPathNotifications`.
- WidgetKit only inside the widget target and `IronPathWidgetShared` adapter.
- App Groups only for the read-only widget snapshot handoff.

Forbidden without amendment:

- CloudKit / iCloud
- Supabase client/runtime implementation
- URLSession / remote networking
- WebView
- account/auth SDKs
- UserDefaults as source-of-truth storage
- SQLite
- CoreData
- SwiftData
- remote push notifications
- watchOS / WatchConnectivity
- CRDT storage or sync

---

## 10. Validation

Every change must run the smallest relevant real verification. Typical commands:

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

The GitHub workflow must remain Swift/Xcode based. Do not reintroduce Node, Vite, browser tests, or web build checks.

---

## 11. Documentation Discipline

The living-doc set is governed by `docs/DOCS_MANIFEST.md`.

Code changes must update the affected living docs. New top-level Markdown files are not allowed unless registered in the manifest first.

---

## 12. Branch And PR Workflow

- Use a normal branch from latest `origin/main`.
- Do not work directly on `main`.
- Open a PR.
- Wait for checks.
- Do not bypass branch protection.
- Do not force-push unless the user explicitly asks and the risk is explained.
