# Rede Master Technical Architecture

> **This is the canonical, highest-level engineering contract for Rede.**
> Every human and every AI agent must read this document before making changes and must obey it. If a requested task conflicts with this document, stop and require explicit architecture approval before writing code.

- **Status:** Authoritative / binding
- **Version:** 3.0
- **Last updated:** 2026-06-07
- **Repository:** `TinSB/fitness-app` (working dir `ironpath`)
- **v3.0 amendment:** establishes a clean code rewrite baseline. The existing Swift/iOS code in this repository is reference material only and is not the active implementation baseline. The product, system logic, architecture boundaries, and future implementation contract live in the manifest-registered living docs, especially `docs/REDE_iOS_SYSTEM_LOGIC.md`. New runtime code must be written cleanly against these docs instead of extending or porting the polluted legacy implementation by default.

---

## 1. Authority

This document is the single source of architectural truth for Rede. It outranks every other repo document on:

- source-of-truth boundaries
- package boundaries
- persistence and write paths
- platform permissions
- validation expectations
- forbidden dependencies and systems

It does not outrank explicit, in-the-moment human approval that knowingly amends this file. Such an amendment must be written back into this file in the same change.

---

## 2. Clean Rewrite Baseline

| Area | Baseline |
|---|---|
| Product truth | `docs/REDE_iOS_SYSTEM_LOGIC.md` plus the other manifest-registered living docs. |
| Code status | Existing iOS code may be inspected for lessons, fixtures, or terminology, but it is legacy/reference-only and not the implementation source of truth. |
| Target runtime | A clean native iOS SwiftUI app with local Swift packages and local-first persistence. |
| Target source of truth | A single canonical local AppData model, persisted through a gated write path. |
| Target engine boundary | Raw AppData never enters training engines; engines consume clean typed inputs. |
| Target platform scope | Foundation JSON persistence, approved HealthKit adapters, local notifications, WidgetKit/App Group read-only handoff. |
| Deferred systems | Account, cloud sync, CRDT, watchOS, subscription entitlement infrastructure, remote networking, remote analytics, and referral attribution require explicit architecture amendments. |

Removed implementation surfaces:

- Web/PWA runtime and assets.
- Node/Vite build and dev API.
- TypeScript source, contracts, scripts, and Vitest tests.
- Supabase/Vercel implementation candidates, browser sync, account/auth runtime code, and cloud candidate code.
- `RedeCloudSync` Swift package stub.

Legacy/reference implementation surfaces:

- Existing `ios/` SwiftUI app, widget, local packages, fixtures, and project files remain in the repository only as reference material until they are replaced or explicitly removed.
- Do not treat legacy runtime behavior as a contract when it conflicts with the living docs.
- Do not port legacy code wholesale into the clean rewrite without a review slice that proves the behavior is still desired and unpolluted.

---

## 3. Product Architecture

Rede is a local-first native iOS training app. The app should feel like a polished, restrained, professional mobile training coach, not an admin dashboard or data-heavy engineering panel.

Target commercial information architecture:

| Area | Purpose |
|---|---|
| 今日 | Should I train today, what should I train, why, and where do I start? |
| 训练 | How do I record the workout now with the least friction? |
| 进展 | Did training work, what changed, and is the data trustworthy? |
| 计划 | How will I train in the future, and what changes are proposed? |
| Profile / Settings | Low-frequency settings, data controls, units, screening, HealthKit permissions, export/backup, and subscriptions. Not a bottom tab. |

The clean rewrite must implement this target directly. Transitional names or behaviors in the legacy iOS code are not product requirements.

---

## 4. Target Native iOS Architecture

```
ios/
├── Rede/                 SwiftUI app layer
├── RedeWidget/           WidgetKit readiness extension
├── Rede.xcodeproj        App + widget project
├── Rede.xcworkspace      Workspace
├── ParityFixtures/           Frozen iOS test fixtures
└── packages/                 Local Swift packages
```

This is the target shape for the clean rewrite. Existing folders may not yet match the target quality bar and must not be treated as proof that the target has already been implemented.

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

## 5. Target Swift Package Boundaries

### Target Packages

| Package | Responsibility | Depends on |
|---|---|---|
| `RedeDomain` | Codable AppData model and domain values. | Foundation only |
| `RedeDataHealth` | Clean AppData projection, repair logic, and runtime guards. | `RedeDomain` |
| `RedeTrainingDecision` | Training decision, readiness, scheduling, progression, insights, muscle level, support allocation, session prescription, and coach-action engines. | `RedeDomain`, `RedeDataHealth` |
| `RedePersistence` | AppData store protocol, JSON file store, and canonical write orchestration. | `RedeDomain` |
| `RedeLocalSnapshot` | Derived Focus/session history snapshots. Never canonical AppData. | Foundation only |
| `RedeHealthKit` | Approved HealthKit adapters and pure mapping seams. | `RedeDomain` |
| `RedeNotifications` | Local notification policies and adapters. | Foundation only |
| `RedeWidgetShared` | Read-only widget snapshot model and App Group snapshot store. | Foundation only |
| `RedeL10n` | Terms and formatting support. | Foundation only |

### Placeholder Packages

| Package | Status |
|---|---|
| `RedeBackup` | Placeholder. It does not authorize backup/export implementation. |
| `RedeUIKit` | Placeholder. It does not authorize a shared UI framework migration. |

There is no approved cloud/sync runtime in the clean rewrite baseline. Future iOS-native account/cloud/sync work must follow `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` and `docs/CLOUD_DECISIONS_ARCHIVE.md`, then land through an explicit Master-approved implementation slice.

### Package Rules

1. `RedeDomain` is the dependency leaf.
2. `RedeLocalSnapshot` must stay decoupled from `RedeDomain` and canonical AppData.
3. The import graph must remain a DAG.
4. Packages never depend on the app target.
5. Placeholder packages stay inert until explicitly approved.

---

## 6. Source Of Truth

The target source of truth for the clean rewrite is canonical AppData.

| Surface | Source of truth | Derived records |
|---|---|---|
| Native iOS target | `RedeDomain.AppData`, persisted through `RedePersistence.JSONFileAppDataStore` | Local snapshots, widget snapshots, HealthKit exports, UI view models |
| Tests | Swift packages + versioned fixtures under `ios/ParityFixtures` or their clean-rewrite replacement | Test-only decoded views |

Hard rules:

1. There is exactly one canonical AppData document per local app install.
2. `RedeLocalSnapshot` must never read or write canonical AppData.
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

Approved target mutation classes include:

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
- HealthKit only inside `RedeHealthKit`.
- UserNotifications only inside `RedeNotifications`.
- WidgetKit only inside the widget target and `RedeWidgetShared` adapter.
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

Every change must run the smallest relevant real verification. For documentation-only rewrite planning, `git diff --check` plus targeted consistency scans are sufficient. When clean runtime code exists, typical commands are:

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
