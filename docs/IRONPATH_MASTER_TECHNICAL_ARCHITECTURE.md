# IronPath Master Technical Architecture

> **This is the canonical, highest-level engineering contract for IronPath.**
> Every human and every AI agent (Claude, Codex, or otherwise) **must read this document before making changes** and **must obey it**. If a requested task conflicts with this document, **stop and require explicit architecture approval before writing any code.**

- **Status:** Authoritative / binding
- **Version:** 1.0
- **Last updated:** 2026-05-30
- **Baseline commit:** `2918afa` — *iOS-15 Local History Detail + Per-Exercise Recovery Insight V1 (#420)*
- **Repository:** `TinSB/fitness-app` (working dir `ironpath`)
- **Supersedes (for day-to-day task scoping):** the scattered planning/strategy docs under `docs/` and the root `*.md` plans. Those remain historical context; **this document wins on any conflict about boundaries, ownership, or workflow.**

---

## 1. Document Authority and Purpose

### 1.1 Authority
This document is the **single source of architectural truth** for IronPath. It outranks:
- Any individual doc in `docs/` (~345 files; most are strategy/candidate explorations, not build-now mandates).
- Any root-level `*.md` plan (`FULL_STACK_REFACTOR_PLAN.md`, `TRAINING_INTELLIGENCE_PLAN.md`, `ARCHITECTURE.md`, etc.).
- Any prior instruction that contradicts the boundaries below.

It does **not** outrank explicit, in-the-moment human approval that *knowingly* amends this document. Such an amendment must be written back into this file **in the same change**.

### 1.2 Purpose
1. Stop scope creep — especially AI/Codex scope creep — by drawing **hard, testable boundaries**.
2. Protect the **source of truth** and user data safety above all else.
3. Make the React/Vite/TypeScript PWA → native iOS SwiftUI migration **safe, incremental, and verifiable**.
4. Give every future task a **decomposition and prompt template** that bakes the rules in.
5. Define the **validation and static-guard standard** that gates every merge.

### 1.3 How this document was scoped (internal prioritization)
Candidate topics were scored 1–5 against a weighted model (scope-creep prevention 20%, source-of-truth/data-safety 20%, iOS migration 15%, task decomposition 15%, validation clarity 10%, ownership clarity 10%, long-term value 5%, staleness risk 5%). Topics that create **hard boundaries, clear ownership, and validation standards** scored 4–5 and are stated as rules here. Topics that would **prematurely encourage CloudKit/HealthKit/auth/network sync/full AppData restore/CoreData/SwiftData/production-backend assumptions** were penalized and confined to §17 (Deferred Systems) as *gated, not designed*. Detailed per-file maps were treated as appendix-level and kept concise.

### 1.4 The one rule that overrides convenience
> **When in doubt, do less.** Prefer the smallest vertical slice that is fully validated and guarded over a larger change that is partially correct. A blocked task with a clear escalation is a success; a silently-expanded task is a failure.

---

## 2. Current Project State

| Aspect | State as of baseline `2918afa` (2026-05-30) |
| --- | --- |
| PWA | Mature product surface. React 19 + Vite + TypeScript. The live runtime users rely on. |
| Native iOS | Migrating. Thin SwiftUI shell (14 files) over **10 local Swift packages**. Local-first only. |
| iOS migration progress | Completed **through iOS-15**. Native local training history, on-device JSON snapshot store, saved-session detail, history search/filter + coarse date ranges, summary stats, **per-exercise recovery insight**, and **non-destructive draft recovery** are shipped. |
| Native data model | `IronPathDomain.AppData` — pure `Codable` value type, parity-pinned to the PWA export. |
| Native persistence | **Local on-device JSON files via Foundation `FileManager` only** (atomic write + backup-before-overwrite). Two sanctioned stores (§12). **No** iCloud/CloudKit/HealthKit/Supabase/network/UserDefaults/SQLite/CoreData/SwiftData. |
| Restore (iOS-14 UI) | **In-memory local draft re-hydration only** (`LocalDraftRestorePlanner.reconcile`). Not a full AppData restore. |
| Full AppData restore | **Deferred**, gated behind DataHealth `buildCleanAppDataView` + the repair-apply pipeline. |
| `iOS-4B6` (userFacing / full arbitrationTrace) | **Deferred.** |
| Cloud / auth / HealthKit / sync (native) | **Not built.** Stub packages / gated only. (PWA has gated cloud-production scaffolding — §4.) |

---

## 3. Product Architecture Overview

IronPath is a mobile-first personal training app with two front-ends over one shared training-intelligence contract:

```
                         ┌─────────────────────────────────────────────┐
                         │      Shared training-intelligence contract     │
                         │  (AppData shape + decision-engine semantics)   │
                         │   enforced cross-platform by PARITY GOLDENS    │
                         └───────────────┬───────────────┬───────────────┘
                                         │               │
              ┌──────────────────────────┘               └───────────────────────────┐
              ▼                                                                         ▼
   ┌────────────────────────┐                                          ┌────────────────────────────┐
   │  PWA (mature product)  │                                          │  Native iOS (migrating)     │
   │  React 19 + Vite + TS  │                                          │  SwiftUI shell + 10 packages│
   │  src/ + packages/*     │                                          │  ios/IronPath + ios/packages│
   │  Local-first; cloud    │                                          │  Local-first ONLY           │
   │  production GATED       │                                          │  No cloud/network/auth      │
   └────────────────────────┘                                          └────────────────────────────┘
```

- The **PWA is the product**. It is where features are mature and where users live today.
- **Native iOS is a migration target**, advanced one validated vertical slice at a time.
- The two are kept in lock-step by **parity goldens** (the TypeScript engine emits goldens; the Swift packages decode/assert against them, and Swift comments cite the exact TS source line they mirror — e.g. `buildCleanAppDataView` mirrors `src/dataHealth/cleanAppDataView.ts`).

---

## 4. Current PWA Architecture

- **`src/`** — the React 19 + Vite PWA. Notable module groups: `engines/` (the in-browser decision engine, incl. `trainingDecisionCleanInput.ts`), `dataHealth/` (`cleanAppDataView.ts`), `features/`, `presenters/`, `ui/` + `uiOs/`, `storage/`, `data/`, `models/`, `i18n/`, `observability/`, `diagnostics/`, `workers/`, and the **gated cloud-production scaffolding** `cloudProduction/`, `cloudSync/`, `sync/`, `auth/`, `productionApi/`, `productionCutover/`, `devApi/`.
- **`packages/core/`** — shared **pure** domain/engine logic; the **canonical TypeScript engine** from which parity goldens are generated.
- **`packages/contracts/`** — shared types and JSON-schema **contracts** (validated with `ajv`).
- **`apps/api/`** (`apps/api/src/node/devApiRunner.ts`) — a dev/SSR API runner (`npm run api:dev:build`). It is a **backend candidate for local development only — not a deployed production backend.**

**Runtime source of truth (PWA):** AppData is **client-side / local-first**. `@supabase/supabase-js` is a dependency and `src/cloudProduction/*` contains real Supabase auth/RLS/env-guard/cutover/kill-switch scaffolding (~22 files reference Supabase), but **cloud/account/auth is GATED** behind environment + cutover guards (§17). It is **not** the default runtime source of truth, and **must not** be promoted to default without an approved architecture task.

**Import direction (one-way):** `src/` → `packages/core` + `packages/contracts`. The packages **must not** depend on `src/`. `apps/api` may also consume the shared packages.

---

## 5. Native iOS Architecture

```
ios/
├── IronPath/                       ← THIN SwiftUI app layer (14 .swift + assets/plist)
│   ├── IronPathApp.swift           ← @main; links all 10 packages (Version probe for bootstrap parity test)
│   ├── ContentView.swift           ← trivial root: body = FocusModeShellView()
│   ├── FocusModeShellView.swift     ← THE 专注训练 (Focus Mode) shell: .plan/.inSession/.completed;
│   │                                  .task does the real-clock opt-in + loadSavedSessions; restoredDraftBanner
│   ├── FocusModeMvpState.swift       ← @MainActor view-model: in-RAM UI state; deterministic default clock;
│   │                                  delegates ALL disk IO to LocalSessionSnapshotStore; restoreDraft (in-RAM)
│   ├── FocusModePreviewData.swift    ← deterministic AppData → buildCleanAppDataView →
│   │                                  createCleanTrainingDecisionInput → buildTrainingDecisionFromCleanInput
│   ├── FocusSavedSession{History,Detail,Preview}View.swift  ← history surface / detail sheet / completion preview
│   ├── FocusSession{Progress,Completion}View.swift, FocusSetChecklistView.swift, FocusModeExerciseCard.swift,
│   │   FocusModeStatusSurfaceView.swift, TrainingDecisionSummaryView.swift  ← pure presentation
│   └── Assets.xcassets, Info.plist
├── IronPath.xcodeproj/             ← ONE app target; 10 XCLocalSwiftPackageReference -> packages/*
├── IronPath.xcworkspace/           ← workspace wrapping project + package dirs
└── packages/                       ← ALL business logic lives here (10 packages, §6)
```

**Core principle:** the app layer is a **thin renderer**. The only app-layer logic lives in `FocusModeMvpState` (a `@MainActor ObservableObject` view-model) which holds in-RAM UI state and **delegates** persistence and reconciliation to packages. Views are pure presentation + label/date formatting.

**Deterministic clock:** `FocusModeMvpState.clock` defaults to a **deterministic** reference date so package tests/previews are reproducible. `static let systemClock = { Date() }`; `useSystemClock()` is called exactly once, from `FocusModeShellView.task`, to opt into wall-clock time at launch. **Do not make the system clock the default.**

**Local-first only:** native iOS has **no** network, cloud, auth, HealthKit, or WebView. On-device durability is **local JSON files only** (§12), guarded statically (§22).

---

## 6. Swift Package Boundaries

There are **exactly 10 local Swift packages** under `ios/packages/`, wired into the single app target via `ios/IronPath.xcodeproj`. The app links all 10, but several are inert stubs.

### 6.1 Active packages
| Package | Purpose | Depends on |
| --- | --- | --- |
| `IronPathDomain` | Canonical data model: `AppData`, `SchemaVersion`, `JSONValue` (open bag), `TrainingSession`/`TrainingSetLog`/`ActualSetDraft`, `ExercisePrescription`, `MesocyclePlan`, `ProgramTemplate`, profiles, settings. Pure `Codable`, no IO. | *(Foundation only — dependency leaf)* |
| `IronPathDataHealth` | AppData validation + auto-repair: `buildCleanAppDataView` (clean read-only view), `AppDataIngressPipeline`, `AutoRepairOrchestrator`/`RepairEngine`/`RepairLedger`/`RepairRegistry`, `JSONFileAutoRepairBackupAdapter`, `DataHealthRuntimeGuard`. Mirrors `src/dataHealth/cleanAppDataView.ts`. | `IronPathDomain` |
| `IronPathTrainingDecision` | Pure decision engine: readiness, e1RM trend, exercise prescription, role floors, deload, modes, mesocycle/phase, arbitration trace. Consumes **only** `CleanTrainingDecisionInput`. Mirrors `src/engines/trainingDecisionCleanInput.ts`. | `IronPathDomain`, `IronPathDataHealth` |
| `IronPathPersistence` | Canonical-AppData persistence seam: `AppDataStore` protocol + `JSONFileAppDataStore` (atomic JSON-on-disk, backup). | `IronPathDomain` |
| `IronPathLocalSnapshot` | Focus session **history** (separate from AppData): `LocalSessionSnapshotStore` (the sanctioned on-disk JSON store), `LocalDraftRestorePlanner`, `LocalSnapshotHistory` (`.filtered`/`.grouped`), `LocalSnapshotStats`, `LocalSnapshotMigration`, `LocalCompletedSessionSnapshot`. | *(Foundation only — deliberately NOT coupled to Domain/AppData)* |
| `IronPathL10n` | Localization helper. | *(standalone)* |

### 6.2 Stub packages (inert, `0.0.1` bootstrap) — **must stay inert**
| Package | Reserved for (DEFERRED) | Today |
| --- | --- | --- |
| `IronPathHealthKit` | HealthKit integration | Stub. **Comments explicitly say "NOT import HealthKit."** Exposes a `Version` constant only. |
| `IronPathCloudSync` | Cloud sync | Stub. No network/CloudKit. `Version` only. |
| `IronPathBackup` | Backup/export | Stub. `Version` only. |
| `IronPathUIKit` | Shared UI components | Stub. `Version` only. |

> The stubs are linked solely so `IronPathLinkedPackages.versions` can drive the iOS bootstrap parity test. Adding real cloud/health/UI behavior to a stub is a **forbidden change** (§18).

### 6.3 The package rules (enforceable)
1. **`IronPathDomain` is the dependency leaf** (Foundation only).
2. **`IronPathLocalSnapshot` stays decoupled from `IronPathDomain`/AppData.** It is a presentation-layer history record, not the canonical model. Do not make it import `IronPathDomain`.
3. **The import graph is a DAG** — no cycles. Current edges: `DataHealth → Domain`; `TrainingDecision → Domain, DataHealth`; `Persistence → Domain`; `LocalSnapshot`, `L10n`, and the 4 stubs are standalone; the app target links all 10.
4. **Packages never depend on the app target.**
5. **Stub packages stay inert** until an approved architecture task (this document amended) fills them.

---

## 7. TypeScript Module Boundaries

| Module | Responsibility | May import |
| --- | --- | --- |
| `src/` | PWA React app: pages, hooks, view state, in-browser engine, gated cloud-production scaffolding | `packages/core`, `packages/contracts` |
| `packages/core/` | Shared **pure** domain/engine logic; canonical source for parity goldens | `packages/contracts` (types) |
| `packages/contracts/` | Shared types + JSON-schema contracts (`ajv`) | *(nothing app-specific)* |
| `apps/api/` | Dev/SSR API runner (`devApiRunner`); backend **candidate**, local-dev only | `packages/core`, `packages/contracts` |

**Rules:**
1. Dependencies flow **one way**: `src` and `apps/api` depend on `packages/*`; `packages/*` never depend on `src` or `apps`.
2. `packages/core` is the **canonical engine**. Changing its output **requires regenerating parity goldens** (§21).
3. `apps/api` must not be treated as a production backend, and the PWA must not hard-require it to function.

---

## 8. Source-of-Truth Contract

> The **source of truth** is the canonical AppData document. Everything else is a *view*, a *draft*, or a *history snapshot* derived from it.

| Surface | Canonical source of truth today | Derived records |
| --- | --- | --- |
| PWA | Client-side AppData (local-first). Cloud GATED (§17). | engine views, presenters |
| Native iOS | `IronPathDomain.AppData`, persisted as JSON via `IronPathPersistence.JSONFileAppDataStore` | `IronPathLocalSnapshot` Focus-session history (separate store, **not** AppData); in-RAM drafts |
| Cross-platform | AppData **shape** + engine **semantics**, enforced by parity goldens | — |

**Hard rules:**
1. There is exactly **one** canonical AppData per surface. Drafts and Focus-history snapshots are **derived** and must never silently become the source of truth.
2. **The Focus-history store (`IronPathLocalSnapshot`) must never read or write canonical AppData.** It is a presentation-layer record by design.
3. **No task may change the source-of-truth boundary** (where canonical AppData lives, or who may overwrite it) without amending this document first.
4. Canonical AppData is mutated only through the established path (`IronPathPersistence` save, gated by DataHealth where untrusted input is involved). Do not add a second, parallel write path.

---

## 9. AppData Boundary

`IronPathDomain.AppData` is the canonical model. Its invariants are **data-safety invariants**, static-guarded by tests.

**Invariants (do not break):**
1. **Pure value type, no IO.** `AppData` and its members perform no network/disk/persistence operations.
2. **Lossless round-trip, including unknown fields,** via the `JSONValue` "open bag." Guarded by `AppDataOpenBagPreservationTests`, `AppDataUnitFieldPreservationTests`, `AppDataTypedFieldActivationTests`, `AppDataCodableRoundTripTests`.
3. **Schema version is explicit and change-guarded.** Bumping `SchemaVersion` requires a deliberate migration **and** updating `AppDataSchemaVersionGuardTests`.
4. **ISO-8601 timestamps only.** Guarded by `AppDataIsoTimestampStaticGuardTests`.
5. **Parity with the real PWA export.** Guarded by `AppDataRealExportParityTests`. A canonical JSON form (`AppData.canonicalJSONData()`) backs the persistence hash/round-trip contract.

**Forbidden:** dropping/normalizing-away unknown fields; silent schema bumps; adding IO to `IronPathDomain`; changing timestamp encoding; making `IronPathDomain` depend on another package.

---

## 10. DataHealth Boundary

`IronPathDataHealth` is the **validation chokepoint** between untrusted AppData and the engine / any restore.

- `buildCleanAppDataView(appData, clock:)` (`CleanAppDataViewBuilder.swift`) turns possibly-untrusted AppData into a **clean, validated, read-only view**.
- `AppDataIngressPipeline` is the ingress that calls it; auto-repair (`AutoRepairOrchestrator`/`RepairEngine`/`RepairLedger`/`RepairRegistry` + `JSONFileAutoRepairBackupAdapter`) repairs **after taking a file backup first**.

**Rules:**
1. Downstream consumers (notably `IronPathTrainingDecision`) **must receive the clean view, never raw AppData.**
2. `buildCleanAppDataView` is the **gate** any future **full AppData restore** must pass through (§14).
3. Auto-repair must **back up before rewriting** and must **not fake success** (errors are surfaced honestly).
4. Do not bypass DataHealth to feed raw AppData into the engine or a restore path.

---

## 11. TrainingDecision Boundary

`IronPathTrainingDecision` is a **pure, deterministic** engine depending only on `IronPathDomain` + `IronPathDataHealth`.

**Rules:**
1. **Input must be `CleanTrainingDecisionInput`, built by `createCleanTrainingDecisionInput(cleanView:metadata:)` from a DataHealth clean view — never raw AppData.** `buildTrainingDecisionFromCleanInput` accepts that branded value type **only**. (Mirrors `src/engines/trainingDecisionCleanInput.ts`; the `cleanInput`/`CleanInputEvidence` field is the proof the raw AppData passed through the clean view.)
2. **Determinism.** No IO, no networking, no ambient clock/randomness — time is injected (e.g. `FixedRuntimeGuardClock`). Output is reproducible.
3. **Output shape is parity-pinned** to the PWA engine via `TrainingDecisionGoldenFixtures`, `*ParityTests`, golden-decode tests, and `TrainingDecisionShapeStabilityTests`. Changing output shape requires regenerating and reviewing goldens.
4. **`userFacing` surface / full `arbitrationTrace` is DEFERRED (`iOS-4B6`).** Only the internal/golden-decodable arbitration trace exists today. Do not ship the user-facing trace ahead of that approved task.

---

## 12. Local Snapshot Persistence Boundary

`IronPathLocalSnapshot` owns the native Focus-session **history**. It is the home of the **only sanctioned app-side disk store** for Focus sessions.

**`LocalSessionSnapshotStore`** writes JSON under `<Application Support>/IronPathLocalSnapshots/` with a hard, statically-guarded local-only contract:
- **Atomic write** (`Data.write(.atomic)` → temp sibling + rename); a mid-write crash leaves the prior file intact.
- **Backup-before-overwrite** for the rolling `…-latest.json` pointer (`…-latest.json.bak`); history entries are append-only.
- **No fake success** — every mutating call throws on failure; callers must treat a throw as "not saved."
- **Scoped delete** — `clear()` only removes this store's own prefixed files in the sanctioned directory.

**Rules:**
1. **Allowed on-device storage = local JSON files via Foundation `FileManager` only.** **Forbidden** here: iCloud/CloudKit/ubiquity, HealthKit, Supabase, URLSession/network, WebKit, **UserDefaults, SQLite, CoreData, SwiftData** — enforced by `iosLocalJsonPersistenceStaticGuards`.
2. **This store must never read or write canonical AppData** (§8). It is a presentation-layer record.
3. `LocalSnapshotHistory.filtered/.grouped` and `LocalSnapshotStats.derive` are **pure** (no internal clock — `now` is injected). `LocalDraftRestorePlanner` and `LocalSnapshotMigration` are pure (no disk).
4. The canonical-AppData store (`IronPathPersistence.JSONFileAppDataStore`) is the **other** sanctioned JSON store; it is the source of truth (§8) and is distinct from this history store.

---

## 13. Draft Recovery Boundary

Draft recovery restores the **in-memory editing buffer** of an interrupted Focus session.

**Rules (verbatim invariant):**
> **Restore re-hydrates an in-memory local draft only. It is non-destructive and is NOT a full AppData restore. It never overwrites the canonical AppData document.**

1. `FocusModeMvpState.restoreDraft(from:)` regenerates the slice from the scenario and reinstates **only** per-exercise completed counts + a clamped resume cursor, via `LocalDraftRestorePlanner.reconcile` (matched exercise ids only; impossible progress rejected).
2. **A failed restore leaves the current session untouched** (no fake restore).
3. Wiring full AppData restore into this flow is a **forbidden change** until §14 is satisfied.

---

## 14. Full AppData Restore Gate

Full AppData restore (replacing/merging canonical AppData from an external/backup document — the repair-apply pipeline `load → snapshot → backup → apply → save`) is **deferred and gated.**

**Gate conditions — ALL required before full restore may be designed or built:**
1. Input passes **`IronPathDataHealth.buildCleanAppDataView`** (no raw restore).
2. **Backup-before-apply** is guaranteed (the persistence/auto-repair backup seam), with a documented **rollback** story.
3. This document is amended with the approved restore design, including its **source-of-truth impact**.
4. A regression-lock/static-guard suite for the restore path exists and is green.

Until then: **the iOS UI restore stays an in-memory draft (§13).** The `IronPathPersistence` load/save/backup seam exists (iOS-3A foundation) but the user-facing full-restore/repair-apply product flow is **not** wired. Any PR attempting full AppData restore without satisfying this gate must be stopped and escalated.

---

## 15. UI Architecture Rules

1. **The SwiftUI app layer stays thin** — rendering + wiring only; the only logic is the `FocusModeMvpState` view-model, which delegates to packages.
2. **The PWA UI rules elsewhere in `AGENTS.md` still apply** (mobile-first; restrained; no admin dashboards; no card-stacking; collapse exercise metadata; "专注训练" label for Focus Mode in user-facing UI).
3. Views bind to **package value types** (`TrainingDecisionCoreSlice`, `LocalCompletedSessionSnapshot`, `LocalSnapshotHistory`/`Stats`), not bespoke app-layer logic.
4. Dangerous actions require confirmation; empty states need title + explanation + one action; **no fake success** (honest 已保存/未保存).
5. No network/cloud/auth/WebView code in any UI layer.

---

## 16. Local-first Rules

1. **Native iOS must remain local-first** until a future approved architecture task (this document amended) explicitly changes it.
2. On-device durability = **local JSON files via Foundation only** (the two sanctioned stores, §12). Everything else is in-RAM value types.
3. The PWA is also local-first; its cloud-production scaffolding is gated (§4, §17).
4. **No native data leaves the device.** No telemetry, no sync, no remote calls.

---

## 17. Deferred Systems

These systems are **named but not designed here.** Each is *gated*: it requires a dedicated, approved architecture task that amends this document **before any implementation.**

| System | Current state | Gate before building |
| --- | --- | --- |
| Full AppData restore / repair-apply | Deferred (seam exists) | §14 gate |
| Cloud sync / CloudKit | Stub (`IronPathCloudSync`); `IronPathPersistence` comments name a CloudKit-backed store for **iOS-7** | Approved task; source-of-truth + offline-merge design |
| Supabase / backend (production) | PWA `src/cloudProduction/*` scaffolding present, **gated**; `apps/api` is dev-only | Auth + account + hosting architecture gate |
| Auth / accounts | PWA scaffolding gated; native none | `AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE` resolved + amended here |
| HealthKit | Stub (`IronPathHealthKit`, explicitly does not import HealthKit) | Approved task; privacy + permission design |
| `iOS-4B6` userFacing / full arbitrationTrace | Deferred | Approved task |
| Backup/export, shared UIKit | Stubs (`IronPathBackup`, `IronPathUIKit`) | Approved task |

> Existing `docs/*` and `src/cloudProduction/*` about auth/account/backend/cloud are **strategy/candidate/gated** work, not approvals. **Do not read them as "build it now."**

---

## 18. Forbidden Changes

A change is **forbidden** (stop and escalate) if it does any of the following without an approved architecture task that amends this document:

**Platform / persistence / network (native iOS especially):**
- Introduces **CloudKit, iCloud, Supabase, HealthKit, URLSession/networking, WebView, auth, UserDefaults, SQLite, CoreData, or SwiftData** into native iOS. (On-device durability stays local JSON via Foundation.)
- Adds real implementation to a **stub package** (`IronPathHealthKit`/`IronPathCloudSync`/`IronPathBackup`/`IronPathUIKit`).
- Couples `IronPathLocalSnapshot` to `IronPathDomain`/AppData, or makes it the source of truth.
- Moves native iOS off **local-first**, or promotes PWA cloud-production from gated to default.

**Source of truth / data safety:**
- Changes the **source-of-truth boundary** (where canonical AppData lives / who can overwrite it).
- Implements **full AppData restore** without satisfying §14.
- Makes **draft restore** overwrite canonical AppData (it stays an in-memory draft, §13).
- Feeds **raw AppData** into `TrainingDecision` (must be a `CleanTrainingDecisionInput`, §10/§11).
- Drops unknown fields / breaks open-bag preservation; bumps `SchemaVersion` without migration + guard; changes timestamp encoding (§9).
- Removes "backup-before-overwrite" / "no fake success" from a store; ships the `userFacing`/full `arbitrationTrace` ahead of `iOS-4B6`.

**Engineering hygiene:**
- Puts business logic into the **thin app layer**.
- Creates a **dependency cycle** or makes `IronPathDomain` depend on another package; inverts the TS import direction.
- Hand-edits **generated parity goldens**.
- Modifies **`package.json` / lockfiles** without explicit justification.
- Modifies **`project.pbxproj`** unless absolutely necessary and justified.
- Uses **`git worktree`**, works **directly on `main`**, uses **`--admin`**, or **bypasses branch protection**.
- Commits raw (non-redacted) user-export fixtures, or leaks server tokens into `dist` (CI's dist scan).

---

## 19. Allowed Change Patterns

Green-light patterns (still subject to validation §21 and guards §22):

1. **Add a validated vertical slice** to native iOS by moving one PWA capability into packages + thin UI, with parity goldens + tests + guards.
2. **Extend an active package** (Domain/DataHealth/TrainingDecision/Persistence/LocalSnapshot) with new pure logic, fully tested, parity-pinned where it affects engine output.
3. **Improve the thin SwiftUI app layer** (rendering, wiring, accessibility) without adding logic.
4. **Add/strengthen static guards, regression locks, and tests.**
5. **Add documentation** (including amending *this* document when an architecture decision is approved).
6. **Refactor within a boundary** without changing public contracts or the import graph.
7. **PWA feature work** within the existing local-first, gated-cloud boundaries.

---

## 20. Migration Strategy

**Migrate by validated vertical slice — never by blindly copying PWA screens one-by-one.**

1. **Pick a thin slice** with a clear AppData input and a clear output (e.g. "readiness for today," "history search").
2. **Land the logic in a package** (`IronPathDomain` for data; a logic package for behavior). Keep it pure; cite the mirrored TS source line.
3. **Pin parity**: if it affects engine output, generate goldens from `packages/core` and assert in Swift.
4. **Gate the input** through DataHealth → `CleanTrainingDecisionInput` where the slice consumes AppData.
5. **Render in the thin app layer** — no logic in the view.
6. **Add guards**: static guard(s) + tests covering the new boundary. **Every migrated feature must have validation and guard coverage.**
7. **Keep it local-first.** If a slice *seems* to need cloud/auth/HealthKit/network, **stop** — that is a gated system (§17), not a slice. (Local JSON files via Foundation are allowed.)

Migration respects the existing iOS-N sequencing (§27). Do not skip ahead into deferred milestones.

---

## 21. Validation Standard

> No change merges unless the required checks pass **normally** (no `--admin`, no protection bypass).

### 21.1 Required (TypeScript — enforced by CI `.github/workflows/ironpath-ci.yml`, Node 22, `TZ=America/New_York`)
CI runs, in order:
```bash
npm ci
npm run api:dev:build   # build the dev API (SSR bundle)
npm run typecheck       # tsc --noEmit
npm test                # vitest run
npm run build           # vite build
# Dist token scan: fails if dist leaks node:http/node:sqlite/devApiRunner/serverAdapter/... tokens
```
All steps must be green. Also expected locally before PR:
```bash
git diff --check                 # no whitespace/conflict markers
# package.json + package-lock.json UNCHANGED unless a dependency change is justified
```

### 21.2 Required (Swift / iOS — local; **CI does NOT build/test Swift**)
There is **no `npm run validate:ios` script.** Validate Swift manually:
```bash
# Per package (all 10 under ios/packages/*):
cd ios/packages/<Package> && swift test

# App build (both destinations):
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' build
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

### 21.3 Scope-aware validation
- **Docs-only change:** run `npm run typecheck && npm test && npm run build` for confidence + `git diff --check`; Swift `swift test`/`xcodebuild` are not required (no Swift/TS source changed) — **state this explicitly in the PR.**
- **TypeScript change:** §21.1 mandatory; regenerate parity goldens if engine output changed.
- **Swift change:** §21.1 (CI) **and** §21.2 (local Swift) mandatory.
- **If a check is unavailable or too expensive, say exactly what was and was not run, and why.**

---

## 22. Static Guard Standard

Static guards / regression locks are **first-class** — they encode invariants as failing-on-violation tests.

**Guards that must stay green:**
- **iOS local-only boundary:** `iosLocalJsonPersistenceStaticGuards` (no iCloud/CloudKit/HealthKit/Supabase/URLSession/WebKit/UserDefaults/SQLite/CoreData/SwiftData in the app/persistence stores).
- **AppData data safety:** `AppDataSchemaVersionGuardTests`, `AppDataIsoTimestampStaticGuardTests`, `AppDataOpenBagPreservationTests`, `AppDataUnitFieldPreservationTests`, `AppDataTypedFieldActivationTests`, `AppDataCodableRoundTripTests`, `AppDataRealExportParityTests`.
- **Engine contract:** `TrainingDecisionShapeStabilityTests`, golden/parity/clean-input tests; the iOS bootstrap parity test (`IronPathLinkedPackages.versions`).
- **TypeScript:** the `tests/` vitest suite (parity, boundary, regression-lock specs).
- **Build/dist:** CI's dist token scan; `scripts/scan-production-dist-safety.mjs`, `scripts/check-dist-size.mjs`, `scripts/predeploy-check.mjs`.
- **Parity goldens:** generated by `scripts/generate-parity-goldens.mjs` (+ `scripts/parityGoldensEntry.ts`). **Never hand-edit goldens — regenerate them.**

**Rule:** every new boundary introduced by a task **ships with a guard**. Removing or weakening a guard requires explicit justification in the PR and is reviewed as an architecture change.

---

## 23. Branch / PR Workflow

> The repository workflow is **non-negotiable**.

1. **Confirm** the repo path and a clean working tree before starting.
2. **Fetch** and base work on **latest `origin/main`**. Local `main` may diverge from `origin/main`; create the task branch directly from `origin/main`.
3. **Create a normal task branch** (e.g. `docs/...`, `ios-N-...`). **Never work directly on `main`.**
4. **Do NOT use `git worktree`.** Work in the main checkout.
5. Make the change; run the **validation standard** (§21).
6. **Commit only the intended files** (never `git add -A`/`.` blindly — untracked tooling files like `.claude/*` must not be committed).
7. **Push** the branch and **open a PR.**
8. **Wait for required checks.** Enable **auto-merge (squash)** only if required checks pass and **branch protection allows it normally.**
9. **Do NOT use `--admin`. Do NOT bypass branch protection.** If CI fails, **stop** and report.
10. After a successful squash merge, **delete the task branch** and **leave the repository clean.**

---

## 24. AI Development Rules

**Every AI agent (Claude / Codex / other) must:**
1. **Read this document before implementing any task.** (`AGENTS.md` points here.)
2. **Stop on conflict.** If a requested task conflicts with this document, **do not code** — require explicit architecture approval first, and amend this document as part of that approval.
3. **Never silently introduce** new persistence, network, cloud, auth, or platform dependencies, or any **source-of-truth change.** These are gated (§17) and forbidden by default (§18).
4. **Stay in scope.** Implement the smallest validated slice. Do not opportunistically expand.
5. **Keep the app layer thin** and **logic in packages**.
6. **Route AppData through DataHealth** before TrainingDecision; keep restore an in-memory draft.
7. **Validate and guard** every change (§21, §22). Report exactly what was and was not run.
8. **Follow the branch/PR workflow** (§23) verbatim — no worktree, no `--admin`, no protection bypass.
9. **Be honest about state.** If a check failed or was skipped, say so. Do not claim "done" without verification ("no fake success").
10. **Prefer escalation over silent assumption.** A clarifying question or a documented "blocked" beats an unapproved change.

---

## 25. Future Task Prompt Template

Every future Claude/Codex task must be framed with this template. Copy it, fill every field, and refuse to proceed if a field would violate this document.

```markdown
## Task: <short title>

**Baseline commit:** <git short SHA of latest origin/main, e.g. 64f37e7>
**Goal:** <one sentence — the user-visible or engineering outcome>
**Scope:** <the single vertical slice; what is explicitly in>

**Allowed files / systems:**
- <e.g. ios/packages/IronPathLocalSnapshot/**, ios/IronPath/*.swift (render only)>
- <e.g. tests/** , docs/**>

**Forbidden files / systems:**
- project.pbxproj (unless absolutely necessary + justified here)
- package.json / package-lock.json (unless a justified dependency change)
- Any stub package (HealthKit/CloudSync/Backup/UIKit)
- CloudKit/iCloud/Supabase/HealthKit/URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData

**Source-of-truth impact:** <MUST be "none" unless this is an approved architecture task amending §8/§14>
**Data safety impact:** <open-bag preservation? schema version? restore? draft vs canonical? backup-before-overwrite? — state explicitly>

**Validation commands:**
- npm run typecheck && npm test && npm run build
- git diff --check
- (if Swift) swift test for affected ios/packages/*; xcodebuild generic + iPhone 17 Pro
- (if engine output changed) regenerate parity goldens

**PR & merge rules:**
- Branch from latest origin/main (no worktree); never commit to main
- Open PR; wait for required checks; auto-merge (squash) only if checks pass & protection allows normally
- No --admin; no branch-protection bypass

**Cleanup rules:**
- Commit only intended files; delete branch after squash merge; leave repo clean
```

---

## 26. Risk Register

| # | Risk | Likelihood | Impact | Mitigation (enforced here) |
| --- | --- | --- | --- | --- |
| R1 | AI scope creep introduces cloud/auth/persistence | High | High | §17 gates, §18 forbidden list, §24 rule 3, §25 template forces "forbidden systems" |
| R2 | Draft restore silently becomes full AppData restore | Medium | High (data loss) | §13 invariant, §14 gate, §18 |
| R3 | Raw AppData reaches TrainingDecision | Medium | High (bad decisions) | §10/§11; `CleanTrainingDecisionInput` is the only accepted type |
| R4 | Open-bag/unknown fields dropped on round-trip | Medium | High (data loss) | §9, `AppDataOpenBagPreservationTests` |
| R5 | Silent schema version bump | Low | High | §9, `AppDataSchemaVersionGuardTests` |
| R6 | PWA↔Swift parity drift | Medium | Medium | §21 goldens; never hand-edit (§22) |
| R7 | Business logic leaks into the thin app layer | Medium | Medium | §5/§15/§19, code review |
| R8 | Stub package quietly implemented | Medium | High | §6.2/§6.3, §18 |
| R9 | `LocalSnapshot` coupled to AppData / becomes source of truth | Medium | High | §6.3, §8, §12 |
| R10 | A store loses atomic-write / backup / no-fake-success | Low | High | §12, `iosLocalJsonPersistenceStaticGuards` |
| R11 | Process violation (worktree/`--admin`/main) | Low | High | §23, §24 rule 8 |
| R12 | CI green but iOS untested (CI excludes Swift) | Medium | Medium | §21.2 mandatory local Swift validation |
| R13 | This doc goes stale vs. code | Medium | Medium | Amend-in-same-change rule (§1.1); baseline commit recorded |

---

## 27. Appendix: Current iOS Migration Milestones

Native iOS has advanced as a sequence of validated slices. Completed **through iOS-15** at baseline `2918afa`.

| Milestone | Summary |
| --- | --- |
| iOS-3A | Data Health runtime foundation: `AppDataStore` protocol + `JSONFileAppDataStore` (atomic JSON, backup). |
| iOS-4B1…4B5 | TrainingDecision Swift type skeleton → core rule skeleton → readiness + e1RM slice → deload/clamp/modes → exercise prescription + volume floor. |
| **iOS-4B6** | userFacing / full `arbitrationTrace`. **DEFERRED.** |
| iOS-9 | Local JSON persistence + saved-session history (`LocalSessionSnapshotStore`). |
| iOS-12 (#416) | Native local restore + history + testability bundle; extracted `IronPathLocalSnapshot`. |
| iOS-13 (#417) | Local history product surface + restore reconciliation (exercise-id matching) + grouping. |
| iOS-14 (#418) | Native history + draft recovery bundle: `LocalSnapshotHistory.filtered` search/filter, `LocalSnapshotStats.mostCommonScenarioLabel`, history search field + summary card, **non-destructive in-memory draft recovery**, real-clock opt-in (`useSystemClock`, default deterministic). |
| **iOS-15 (#420)** | Local history detail + per-exercise recovery insight: pure `LocalSnapshotRecovery.insight` (read-only projection over `LocalDraftRestorePlanner.reconcile` → per-exercise restorable/changed + new-exercise list + remapped resume), coarse history date-range filter (`LocalHistoryDateRange`), honest resume affordance. Restore stays an in-memory draft. **= baseline.** |
| Next (proposed) | iOS-16 Custom History Date Range (explicit from/to filter completing iOS-15's coarse ranges; a validated vertical slice; still local-first). |

> Milestone facts here are descriptive context; the **rules in §1–§26 are binding.**

---

## 28. Final Architecture Decision Record

**ADR-0001 — Adopt the IronPath Master Technical Architecture as the binding engineering contract.**

- **Date:** 2026-05-30
- **Status:** Accepted
- **Context:** IronPath is mid-migration from a mature React/Vite/TS PWA to native iOS SwiftUI. Work is increasingly AI-assisted (Claude/Codex). Without hard boundaries, the dominant risks are scope creep into cloud/auth/persistence, source-of-truth corruption, and accidental full-restore/data-loss.
- **Decision:** Adopt this document as the canonical, top-level contract. Native iOS stays **local-first** (on-device JSON files via Foundation only); the SwiftUI app layer stays **thin**; logic lives in **Swift packages**; `IronPathDomain.AppData` is the **source of truth**, protected by **open-bag preservation, schema/timestamp guards, and parity goldens**; the **Focus-history store stays decoupled from AppData**; **draft restore stays in-memory** until the **DataHealth full-restore gate** is met; **TrainingDecision** consumes only a **`CleanTrainingDecisionInput`**; cloud/auth/HealthKit/CloudKit/backend/sync are **deferred behind gates**; all changes follow the **validation + guard + branch/PR** standards; AI agents must **read this first and stop on conflict.**
- **Consequences:**
  - *Positive:* predictable, safe, incremental migration; strong data-safety guarantees; AI tasks are bounded and auditable; merges are gated by real checks.
  - *Negative / accepted cost:* some desirable features (cloud sync, accounts, full restore) are intentionally slower because they require an explicit architecture task that amends this document.
- **Amendment rule:** any change to a boundary in this document must be made **in the same PR** that implements the corresponding code change, and must pass the validation + guard standards.

---

*End of canonical document. If your task is not consistent with the above, stop and escalate before writing code.*
