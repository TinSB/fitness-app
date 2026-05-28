# Agent 5 — iOS Native Architecture Agent

Audit: iOS Native Migration Entry Gate V1
Worktree: `.claude/worktrees/peaceful-hugle-21e407`
Output kind: docs-only architecture proposal. **No Xcode project. No Swift files. No source mutation.**

---

## 1. Mission

Design the **shape** of the native iOS app that replaces the IronPath PWA, so the existing core systems (training engines, training decision engine, data-health runtime guard, auto-repair, explicit-opt-in cloud sync, Apple Health import, Focus Mode interaction state machine, i18n) can be preserved without copying the PWA's Web architecture (React + localStorage + Vite + service worker + lazy chunks).

This report stays at the **layer / module / protocol** level. It does not:

- decide the persistence file format (Agent 3),
- decide cloud-sync protocol details (Agent 4),
- write `Info.plist` permission strings (Agent 7),
- design any data-repair internal,
- propose Swift code longer than ~10 lines.

It does answer: how is the iOS app **shaped**, where do existing IronPath domain primitives live, and what is shipped in P0 vs P1 vs P2.

---

## 2. Inputs inspected (PWA structure mirrored or contrasted against)

### 2.1 Folder structure that gave the mental model

| PWA folder | Role | iOS counterpart |
| --- | --- | --- |
| `src/engines/` (~120 files) | Pure training engines: `trainingDecisionEngine.ts` (2097 lines, sole final-decision owner), `sessionBuilder`, `focusModeStateEngine`, `focusModeInteractionState`, `readinessEngine`, `progressionEngine`, `recoveryAwareScheduler`, `volumeAdaptationEngine`, etc. | `IronPathDomain` Swift package — pure functions, no UIKit/SwiftUI, no Foundation IO. |
| `src/dataHealth/` | `dataHealthRuntimeGuard`, `autoRepairOrchestrator`, `appDataIngressPipeline`, `repairs/*`, `uploadEligibilityGuard`. | `DataHealthRuntime` + `AutoRepairOrchestrator` modules. |
| `src/storage/` | `persistence.ts` facade → `localStorageAdapter.ts` → sanitized JSON snapshot under one root key with 13 split sub-keys, `version` written last as commit marker. | `AppDataStore` protocol + JSON-file default implementation in `AppDataPersistence` module. |
| `src/cloudProduction/` + `src/cloudSync/` | Explicit-opt-in single-user sync, Supabase-backed, never automatic; conflict-review when cloud snapshot hash differs from local; hash-based "已开启" receipt persisted only after a successful accepted upload. | `CloudSyncClient` module — protocol-level only at this stage. Defer details to Agent 4. |
| `src/engines/appleHealth*.ts`, `appleHealthTypeMap.ts`, `healthImportEngine.ts`, `healthSummaryEngine.ts` | XML-streaming import from Apple Health export (`apple_health_export.zip → export.xml`). Mobile hard cap 20 MB. Conversions: BPM, ms, kcal, kg/lb, %, ml/kg/min, sleep-asleep categorical. Type map keyed by `HKQuantityTypeIdentifier...`. | `HealthKitAdapter` — live HKHealthStore queries replace XML import for V1. The XML pipeline is **not** ported in P0; treated as a P2 import-from-old-PWA-backup option only. |
| `src/uiOs/` | iOS-styled but still React/Tailwind. `MobileAppShell`, `BottomNav` → `FloatingBottomNav`, `AppTopBar`, `PageContainer`, `primitives/{ActionButton,GlassCard,SegmentedControl,StatusBadge}`, `theme/UiThemeProvider`, plus per-tab subfolders (`today/`, `training/`, `history/`, `progress/`, `records/`, `settings/`). | `UIKitFreeAppShell` is replaced by `RootView` + `AppTabs` (SwiftUI `TabView` + per-tab `NavigationStack`). Primitives become `IronPathUIPrimitives` SwiftUI components. |
| `src/uiOs/uiOsNavigation.ts` | Five tabs in this **exact order**: `today` 今日, `train` 训练, `history` 历史, `progress` 进步, `settings` 设置. | Same five tabs (see §6). |
| `src/i18n/` | `zh-CN.ts` literal-string table, `formatters.ts`, `terms.ts`. Single locale: zh-CN. | `IronPathL10n` module — `String.localized(...)` lookup over a Swift dictionary mirroring `zh-CN.ts`, plus `.strings` resource for system-facing strings. Single-locale to start; multi-locale slot reserved but unused. |
| `src/auth/`, `src/cloudProduction/auth*` | Skeleton-only: `createAuthUnavailableResult()` returns `not-implemented`; real auth lives in `src/cloudProduction/supabaseAuthRuntimeAdapter.ts`. | `IdentityProvider` protocol — Apple ID / Supabase backend; Agent 4 owns. |
| `src/models/training-model.ts` | `AppData` and ~60 const literal unions (`PRIMARY_GOALS`, `TRAINING_MODES`, `MUSCLE_GROUPS`, etc.). | `IronPathDomainModel` Swift module — Codable structs + Swift enums mirroring the unions. Exact same names. |
| `src/engines/themePreferenceModel.ts` + `src/uiOs/theme/uiThemePreferenceStorage.ts` | Theme mode `light` / `dark` / `system` persisted to `localStorage`. | `ThemePreferenceStore` — same three-mode contract, persisted via `UserDefaults`. |

### 2.2 PWA-only infrastructure being deliberately LEFT BEHIND

- **Vite** (`vite.config.ts` with manualChunks for `vendor-react`, `engines-adjustment`, `engines-analytics`, `cloud-production`, `engines-health`, …). Replaced by SwiftPM module boundaries (§3.2).
- **Service Worker** (`public/sw.js`). No equivalent. iOS app is offline-first by file system; no SW cache layer.
- **PWA manifest** (`public/manifest.webmanifest`). Replaced by `Info.plist` + asset catalog (icons, launch screen). Agent 7 owns the contents.
- **`apple-mobile-web-app-status-bar-style` + `viewport-fit=cover`** plumbing in `index.html`. Replaced by SwiftUI safe-area handling.
- **Add-to-Home-Screen hint** (`src/ui/AddToHomeScreenHint.tsx`). Deleted entirely.
- **The `apps/api/` Node dev API + SQLite snapshot path** (`devApiRunner`, `httpRuntimeAdapter`, `sqliteRepository`). Was a dev-only readonly preview. **Not ported.** Agent 3 picks the iOS-native persistence story from scratch.
- **`<lucide-react>`** icon set. Replaced by **SF Symbols**.
- **Tailwind / `classNames` / `data-*` attributes** for diagnostics. Replaced by SwiftUI view modifiers + `accessibilityIdentifier(...)`.
- **`React.lazy` + Suspense + manualChunks for `PlanView`/`ProgressView`/`TrainingView`** code-splitting. Native binary loads as one image; per-screen lazy work becomes "create the view model on tab activation" instead.
- **`React.memo` / `useMemo` / `useSyncExternalStore` over `localStorage`**. Replaced by `@Observable` (Swift Observation framework) + `Combine` publishers where needed.
- **App.tsx** (2349 lines, all top-level wiring + handlers + state). Aggressively decomposed (§4).

### 2.3 Docs skimmed

- `docs/REAL_IPHONE_SYNC_CLOUD_CONFLICT_V3.md` — confirms cloud sync uses **manual override** (`overrideExistingCloudSnapshot=true`) for hash-mismatch conflicts; **never silent overwrite**. iOS must preserve this contract.
- `docs/UI_OS_R2_FOCUS_MODE_INTERACTION_STATE_MACHINE_REWRITE.md` — Focus Mode state machine (`focusModeInteractionState.ts`) is the canonical interaction model: 7 session states × 7 exercise states × 10 set states × 5 recommendation states × 5 safety states resolve a single `FocusPrimaryActionKind`. iOS must port this pure resolver intact and let the UI subscribe to its output.
- `docs/APP_RUNTIME_MIGRATION_READINESS_AUDIT.md` — confirms the existing app runtime is still localStorage-backed; SQLite dev API was readonly and never wired into `App.tsx`. iOS does not inherit any incomplete migration debt; it starts at a clean line.

---

## 3. Xcode project layout proposal

### 3.1 Project shape

**One Xcode project, one app target.** No second target until App Clip / Watch / extension goals appear (they don't, see §14).

```
IronPath.xcodeproj
├── IronPath.xcworkspace             # single workspace; SPM packages embedded as local
├── IronPathApp/                     # the app target (entry only, ~20 files)
│   ├── IronPathApp.swift            # @main, root scene, environment wiring
│   ├── RootView.swift               # composes tabs, owns AppRootViewModel
│   ├── Resources/
│   │   ├── Assets.xcassets          # icons, AppIcon, AccentColor, SF Symbol overrides
│   │   ├── Localizable.strings      # zh-Hans (and an empty zh-Hant slot for forward-compat)
│   │   └── Info.plist               # Agent 7 owns the actual values
│   └── Tests/IronPathAppTests/      # app-target-only smoke tests (launch, deep link)
└── Packages/                        # local Swift Packages
    ├── IronPathDomain/              # pure engines + model (see §4)
    ├── IronPathDataHealth/          # runtime guard + auto-repair
    ├── IronPathPersistence/         # AppDataStore protocol + default impl
    ├── IronPathCloudSync/           # CloudSyncClient (protocol stub for V1)
    ├── IronPathHealthKit/           # HealthKitAdapter
    ├── IronPathBackup/              # export/import .json
    ├── IronPathL10n/                # zh-CN string table + formatters
    └── IronPathUIKit/               # SwiftUI primitives + theme (NOT UIKit — name is product)
```

### 3.2 Why local Swift Packages rather than in-app folders

| Reason | Detail |
| --- | --- |
| Compile-time module isolation | The PWA enforces module boundaries via tests (`tests/runtimeBoundaryPersistenceCompatibility.test.ts`, `tests/localStorageAdapter.test.ts`). Swift's `internal` is per-module, so SPM packages give us free enforcement: `IronPathDomain` cannot `import HealthKit`, full stop. |
| Faster incremental builds | Touching `TrainingDecisionEngine` recompiles only `IronPathDomain` and downstream packages, not the entire app. Matches the PWA's manualChunks intent. |
| Snapshot-testability | `IronPathDomain` builds for macOS too, so XCTest golden-parity tests against TS fixtures can run on the laptop without booting an iOS simulator. |
| Forward-compatibility | If a CLI or a Mac Catalyst surface appears later (not a V1 goal), the domain modules are already extractable. |
| Local-only, not SPM-published | Packages live in `Packages/*` inside the same repo; no `Package.swift` consumer outside this project. No version pinning headache. |

### 3.3 What does NOT become a package in V1

- App target itself — too small, no point.
- Tests — each package owns its `Tests/` folder; the app target has its own thin tests.
- `IronPathDevTools` — there is no equivalent of `src/devApi/` for V1. Diagnostics live as in-app SwiftUI screens under `IronPathApp/Resources/DevPanels/` and are stripped from the App Store build via `#if DEBUG`. If they grow, promote later.

---

## 4. Swift module map (one section per layer)

### 4.1 `IronPathApp` (app entry)

**Responsibility**: `@main`, `WindowGroup`, environment wiring, the root view that owns `AppRootViewModel`. No business logic. Mirrors the role of `src/main.tsx` + the top 30 lines of `src/App.tsx`.

Owns:

- `IronPathApp` struct (`@main`).
- `AppRootViewModel` (`@Observable`) — holds `appData: AppData`, the active tab, the active session pointer, the toast queue. This is the **only** place the live `AppData` reference exists, mirroring the single `useState<AppData>` in `App.tsx:265`.
- `RootView` that builds the `TabView` (§6) and injects `AppRootViewModel` into the environment.
- Dependency injection container: a small `AppDependencies` struct holding concrete instances of every protocol the modules below expose (`AppDataStore`, `HealthKitAdapter`, `CloudSyncClient`, `IdentityProvider`, `BackupExportImporter`). Built once at launch from real implementations in production, swapped to in-memory fakes in tests.

Does NOT own:

- Business decisions — those are in `IronPathDomain`.
- Persistence — `AppDataStore` is injected.
- Networking — `CloudSyncClient` is injected.

### 4.2 `IronPathDomain` (pure engines + model)

**Responsibility**: Port the entire `src/engines/` directory plus `src/models/training-model.ts` plus `src/i18n/formatters.ts` to Swift, function-by-function, **pure**, no side effects, no Foundation IO. Builds for iOS + macOS + (theoretically) Linux.

Sub-areas (one Swift file per TS file, name parity is strict so the multi-agent audit can grep across both):

- `Model/AppData.swift`, `Model/TrainingSession.swift`, `Model/TrainingTemplate.swift`, `Model/UserProfile.swift`, `Model/ScreeningProfile.swift`, `Model/ProgramTemplate.swift`, `Model/MesocyclePlan.swift`, `Model/HealthMetricSample.swift`, `Model/UnitSettings.swift`, `Model/TodayStatus.swift`, `Model/AdaptiveCalibrationState.swift`, `Model/AppSettings.swift`. All `Codable` structs. All const unions become `enum`s with `RawRepresentable: String`.
- `Engines/SessionBuilder.swift` ← `sessionBuilder.ts`
- `Engines/TrainingDecisionEngine.swift` ← `trainingDecisionEngine.ts` (the heavyweight; 2097 lines TS, expect a similar Swift footprint, **kept intact as the sole final-decision owner** per the file's own header comment).
- `Engines/TrainingDecisionCleanInput.swift` + `Engines/TrainingDecisionContext.swift` — preserve the branded factory + static guards from PR #391.
- `Engines/FocusModeStateEngine.swift` + `Engines/FocusModeInteractionState.swift` — the pure resolver from R2.
- `Engines/ProgressionEngine.swift`, `Engines/ReadinessEngine.swift`, `Engines/E1RMEngine.swift`, `Engines/EffectiveSetEngine.swift`, `Engines/RestTimerEngine.swift`, `Engines/SessionPatchEngine.swift`, `Engines/CoachActionEngine.swift`, etc. — one-to-one with TS.
- `Engines/EnginePipeline.swift` ← `enginePipeline.ts` (orchestrates the read-after-mutation derivation; mirrors `buildEnginePipeline(...)`).
- `Engines/DerivedStateInvalidationEngine.swift` — preserves the `AppMutationEvent` discriminated union shape.
- `I18n/Formatters.swift` ← `i18n/formatters.ts` (`formatTemplateName`, `formatMuscleName`, `formatExerciseName`).

**Cardinal rule**: this module does not import `Foundation.URLSession`, `HealthKit`, `Combine`, `SwiftUI`, or `os.log`. It can import `Foundation` for `Date`, `UUID`, `Decimal`, `JSONEncoder`, `JSONDecoder` only.

**Why**: keeps the engines testable as pure functions (XCTest), keeps them shippable on watchOS/macOS later without surgery, and makes the golden-parity tests against TS fixtures (§9) feasible.

### 4.3 `IronPathDataHealth` (runtime guard + auto-repair)

**Responsibility**: Port `src/dataHealth/` — `dataHealthRuntimeGuard`, `autoRepairOrchestrator`, `appDataIngressPipeline`, `cleanAppDataView`, `uploadEligibilityGuard`, `repairs/*`.

Surface (protocol-level, no implementation details — Agent 3 owns those):

```swift
public struct DataHealthRuntimeGuardOutcome {
    public let appData: AppData
    public let changed: Bool
    public let issuesFound: [DataHealthIssue]
}

public protocol DataHealthRuntimeGuard {
    func evaluate(_ appData: AppData, now: Date) -> DataHealthRuntimeGuardOutcome
}

public protocol AutoRepairOrchestrator {
    func run(
        on appData: AppData,
        triggeredBy: RepairTrigger,
        now: Date
    ) async -> AutoRepairOrchestratorResult
}
```

Imports: `IronPathDomain` only. No HealthKit. No URLSession.

Calls into: `IronPathPersistence`'s backup adapter via injection, so `autoRepairOrchestrator` can write its pre-repair safety snapshot.

### 4.4 `IronPathPersistence` (`AppDataStore`)

**Responsibility**: The persistence boundary. **This is the architectural slot, not the file-format choice.** See §7.

Surface:

```swift
public protocol AppDataStore {
    func load() async throws -> AppData
    func save(_ appData: AppData) async throws
    func observe() -> AsyncStream<AppData>      // live changes for the UI layer
}
```

V1 default implementation lives here as `JSONFileAppDataStore` — a single file under `Application Support/IronPath/app-data.json`, written atomically via temp-file + rename, with a version marker pattern that mirrors the PWA's "version written last as commit marker" behavior (see `localStorageAdapter.ts:82–127`).

**Imports**: `IronPathDomain` (for `AppData` and `sanitizeData`). No HealthKit. No URLSession.

**Note**: SwiftData / Core Data are **not** recommended for V1. See §13 rationale. Agent 3 may override this with a defensible case.

### 4.5 `IronPathCloudSync` (`CloudSyncClient`)

**Responsibility**: The cloud-sync boundary. **Explicit opt-in only**, mirroring `explicitOptInSingleUserSyncCandidate.ts`.

Surface (V1 is protocol-only — Agent 4 owns the wire format and conflict semantics):

```swift
public enum CloudSyncReadinessStatus {
    case disabled
    case optInMissing
    case manualConfirmationMissing
    case accountNotReady
    case backupMissing
    case cloudUnavailable
    case conflictReviewRequired
    case candidateReady
    // …mirrors Phase19jExplicitOptInSyncCandidateStatus
}

public protocol CloudSyncClient {
    func currentReadiness(for appData: AppData) async -> CloudSyncReadinessStatus
    func uploadExplicit(_ appData: AppData, options: CloudUploadOptions) async throws -> CloudUploadResult
    func downloadExplicit() async throws -> AppData
    func resolveConflict(strategy: ConflictResolutionStrategy) async throws -> AppData
}
```

V1 default implementation: `DisabledCloudSyncClient` — every method either returns `.disabled` or throws `CloudSyncError.notConfigured`. This lets the rest of the app compile, run, and ship to TestFlight **without ever importing Supabase**. Real implementation is Agent 4's deliverable.

**Imports**: `IronPathDomain`. May import `Foundation.URLSession` once real implementation lands. No HealthKit.

### 4.6 `IronPathHealthKit` (HealthKit adapter)

**Responsibility**: Map between IronPath's `HealthMetricSample` / `ImportedWorkoutSample` and Apple's `HKQuantitySample` / `HKWorkout`.

Surface (Agent 7 owns the privacy strings; this is the adapter shape only):

```swift
public enum HealthKitAuthorizationStatus { case notDetermined, denied, authorized }

public struct HealthKitDailyMetricsBundle {
    public let date: Date
    public let restingHeartRate: Double?
    public let hrvSDNN: Double?
    public let sleepHours: Double?
    public let stepCount: Double?
    public let activeEnergyKcal: Double?
    public let exerciseMinutes: Double?
    public let bodyWeightKg: Double?
    public let bodyFatPercent: Double?
    public let vo2Max: Double?
}

public protocol HealthKitAdapter {
    func requestAuthorization(for types: HealthKitReadTypeSet) async throws -> HealthKitAuthorizationStatus
    func currentAuthorizationStatus(for types: HealthKitReadTypeSet) -> HealthKitAuthorizationStatus
    func fetchDailyMetrics(_ dateRange: ClosedRange<Date>) async throws -> [HealthKitDailyMetricsBundle]
    func fetchRecentWorkouts(limit: Int) async throws -> [ImportedWorkoutSample]
}
```

The unit-conversion table from `appleHealthTypeMap.ts` (bpm, ms, kcal/kJ, kg/lb, %, ml/kg/min, sleep-asleep categorical) ports verbatim into a private helper inside this module — it is identical logic, just driven by `HKQuantitySample.quantity.doubleValue(for:)` instead of XML attribute parsing.

**Why this replaces the XML import**: Apple's recommended path for native apps is HealthKit live read with an explicit authorization sheet; the XML-export-import dance was a Web workaround. The HealthKit API returns the same `HKQuantityTypeIdentifier...` keys that `appleHealthTypeMap.ts` already maps, so **the mapping layer is preserved; only the data source changes**.

**Imports**: `HealthKit`, `IronPathDomain` (for the IronPath sample types).

**Background HealthKit observers**: explicitly out of scope for V1 (see §10).

### 4.7 `IronPathBackup` (export / import .json)

**Responsibility**: Port `src/storage/backup.ts` (`exportAppData` + `importAppData` + `analyzeImportedAppData`). One-shot user-initiated flows. Hands the result to `AppDataStore`. Uses iOS's document picker for both directions.

Surface:

```swift
public protocol BackupExportImporter {
    func exportToJSONFile(_ appData: AppData) async throws -> URL  // Documents/ironpath-backup-yyyy-mm-dd.json
    func importFromJSONFile(_ fileURL: URL) async throws -> AppData
}
```

**Imports**: `IronPathDomain` (for `sanitizeData`, `validateAppDataSchema`, `analyzeImportedAppData`).

### 4.8 `IronPathL10n` (zh-CN locale model)

**Responsibility**: Mirror `src/i18n/{zh-CN.ts, formatters.ts, terms.ts}`. Single locale, slot for more.

Choice: a Swift dictionary literal generated from the TS source by a `Scripts/generateLocale.swift` step (Agent 6 may automate this). Optional: also fold into `Localizable.strings` so `SwiftUI.Text("nav.today")` works directly.

`IronPathDomain` does not depend on this module — engines hold codes, not user strings, exactly like `src/engines/` is allowed to import `formatExerciseName` but never raw zh-CN strings.

### 4.9 `IronPathUIKit` (SwiftUI primitives + theme)

**Responsibility**: Port `src/uiOs/primitives/*` and `src/uiOs/theme/*`.

Includes:

- `ActionButton` (SwiftUI) ← `ActionButton.tsx`
- `GlassCard` ← `GlassCard.tsx` (material backdrop blur via `.background(.ultraThinMaterial)`)
- `SegmentedControl` ← either the system `Picker(.segmented)` for V1 or a custom one if visual parity demands
- `StatusBadge` ← `StatusBadge.tsx`
- `BottomSheet` modifier ← matches the existing `BottomSheet` primitive used in Focus Mode
- `FloatingBottomNav` ← bottom nav (becomes the SwiftUI `TabView` bar; the floating pill design from `FloatingBottomNav.tsx` may need a custom `safeAreaInset(edge: .bottom)` overlay for parity with PWA)
- `AppTopBar` ← but the SwiftUI `NavigationStack` toolbar replaces most of it; keep only the IronPath logo + "训练中" pill
- `Theme/ThemePalette.swift` ← `themeSurfaceModel.ts` + `themeTextModel.ts`
- `Theme/UiThemePreferenceStore.swift` ← `uiThemePreferenceStorage.ts` (UserDefaults-backed)

**Imports**: `SwiftUI`, `IronPathL10n`. No `IronPathDomain` symbols leak through — primitives are pure visual.

---

## 5. UI architecture

### 5.1 Recommendation: SwiftUI + `@Observable` view models (Observation framework)

No TCA. No Composable Architecture. No Redux clone.

**Justification**:

- The PWA is already a single-source-of-truth shape (`useState<AppData>` in `App.tsx:265`, every mutation goes through engines that return `nextData`). That is functionally identical to a `@Observable` root view model holding `appData: AppData` and routing mutations through pure engine calls.
- Adding TCA buys us redux-style time-travel and reducer composition — neither is in the V1 acceptance criteria. The bigger value (predictable state mutations) is **already enforced** by the engines layer being pure: every action goes `(appData, payload) -> appData' (+ side effects)`, which the iOS app calls from a view-model method that then assigns `self.appData = next`.
- TCA introduces a learning curve, a dependency lock-in, and `Reducer` boilerplate. V1's bottleneck is "ship a real iPhone app", not "find the cleanest reducer composition". The risk of TCA paying for itself only in v3 is real.
- `@Observable` (Swift 5.9+) gives us granular re-render diffing **without** `ObservableObject`'s "republish-everything" cost.

If at P2 we discover the root view model is fat and brittle, splitting into per-tab view models is a small refactor — far smaller than choosing TCA upfront.

### 5.2 View model shape per tab

```swift
@Observable
final class AppRootViewModel {
    private(set) var appData: AppData
    private(set) var activeTab: TabID = .today
    private(set) var toast: ToastItem?
    private let store: AppDataStore
    private let dataHealth: DataHealthRuntimeGuard
    private let autoRepair: AutoRepairOrchestrator

    func bootstrap() async { /* load + dataHealth + autoRepair on cold start */ }
    func mutate(_ event: AppMutationEvent) async { /* run engines, persist, derive */ }
}
```

Per-tab view models are thin facades that read from `AppRootViewModel` and call its `mutate` method.

### 5.3 Mutation pipeline (preserves PWA's contract)

`User intent` → tab view model → `AppRootViewModel.mutate(event)` → `IronPathDomain` engine produces `nextData` → `IronPathDataHealth.evaluate` → `AppDataStore.save` → `AppRootViewModel.appData = next` → SwiftUI re-renders.

This is exactly the shape implied by `enginePipeline.ts` + `derivedStateInvalidationEngine.ts` and is the safest port: nothing about engine call order changes.

---

## 6. Navigation map

### 6.1 Five tabs (confirmed by `src/uiOs/uiOsNavigation.ts`)

```
TabView (tag: TabID)
├── .today        今日       Flame      → NavigationStack { TodayScreen }
├── .training     训练       Dumbbell   → NavigationStack { TrainingScreen, FocusModeScreen, PostSummaryScreen }
├── .history      历史       CalendarDays → NavigationStack { HistoryScreen, SessionDetailScreen, SetEditScreen }
├── .progress     进步       BookOpen   → NavigationStack { ProgressScreen, PlanScreen, AssessmentScreen, RecordsScreen }
└── .settings     设置       UserCircle → NavigationStack { SettingsRootScreen, AccountAndSyncScreen, HealthDataScreen, BackupRecoveryScreen, ThemeScreen, EquipmentProfileScreen, DiagnosticsScreen, AboutScreen }
```

### 6.2 Why `NavigationStack` per tab and not a single global one

- Each tab has its own back stack (history → session detail → set edit). A single global `NavigationStack` would collapse them.
- Matches iOS Human Interface Guidelines for tabbed apps.
- Allows deep links per-tab without coordinator overhead.

### 6.3 Focus Mode is full-screen modal, not a NavigationStack push

`MobileAppShell.tsx` already runs Focus Mode in `immersive` mode that hides `BottomNav` + `AppTopBar`. The iOS equivalent: present `FocusModeScreen` as `.fullScreenCover(isPresented:)` from the `.training` tab. The `TabView` bar disappears automatically with `.fullScreenCover`. This matches R2's "bottom nav must not compete with Focus Mode" requirement without inventing a hidden-tab-bar hack.

### 6.4 Tab order is non-negotiable

The PWA test harness pins it. The iOS tab order MUST match `UI_OS_TABS` exactly: `today / train / history / progress / settings`. This is the "Plan" tab the spec mentions — in the PWA it lives **inside the `progress` tab as a sub-route** (`progressMode = 'plan'`), so there is **no 6th tab**. Confirmed in `App.tsx:148` (`type ProgressMode = 'metrics' | 'plan'`) and `App.tsx:2322` (`openProgressPlan()`). The spec line "5-tab pattern (Today / Training / Plan / Progress / Settings)" merges Plan and Progress into separate tabs, but the **actual evolved UI puts Plan as a subview of Progress**. Honor the evolved UI.

### 6.5 Deep links (P1 / P2)

Reserve `ironpath://` scheme. Open routes like `ironpath://today`, `ironpath://history/session/<id>`. Not P0 — V1 has no share targets or external entrypoints worth handling.

---

## 7. Storage architectural slot

This section is **the slot**, not the schema. Agent 3 finalizes the schema.

### 7.1 The protocol

```swift
public protocol AppDataStore {
    func load() async throws -> AppData       // returns sanitized AppData
    func save(_ appData: AppData) async throws // atomic; sanitize before persist
    func observe() -> AsyncStream<AppData>     // live changes (for other surfaces)
}
```

### 7.2 V1 default implementation: `JSONFileAppDataStore`

- Single JSON file under `FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]/IronPath/app-data.json`.
- Atomic writes via `Data.write(to: tmpURL, options: .atomic)` then `FileManager.replaceItem(at: realURL, with: tmpURL, ...)`.
- A separate sibling file `app-data.version` written **last** (commit marker pattern; mirrors `localStorageAdapter.ts:127`). On load, the version file is consulted to detect partial-write corruption from a kill-9 mid-save.
- `sanitizeData` from `IronPathDomain` runs on every load and every save.
- `observe()` is fed by an internal Combine subject the `save` method publishes on; not by filesystem watching (FSEvents on iOS is unreliable and unnecessary here — the app is the only writer).

### 7.3 Why JSON file, not SwiftData / Core Data

- AppData is **document-shaped**, not a query workload. We never need `WHERE history.exercise = 'bench' AND date > X` indexed lookups; we always load the whole document into memory at boot and operate from a `@Observable` reference. SwiftData adds object-graph machinery for no win.
- The PWA's sanitizer / migrator / hash pipeline (`appDataSanitize`, `appDataMigration`, `repairHelpers.computeAppDataHash`) operates on the **full JSON tree**. SwiftData would require translating each repair operation into managed-object mutations, doubling the surface area.
- Cloud sync uploads a single JSON blob with a hash. SwiftData would force us to round-trip through `JSONEncoder` anyway at the sync boundary, so we'd carry the cost of both representations.
- Test fixtures from the TS side land as JSON. Golden-parity tests want to load `tests/fixtures/*.json` directly. SwiftData blocks that.
- If at P2 we discover that history queries are slow on devices with 2 years of training history (rough math: 3 sessions/week × 104 weeks × 8 exercises × 6 sets ≈ 15K set records, well within in-memory budget), we can add an **optional** SQLite index alongside the JSON snapshot. The JSON remains the source of truth.

**Agent 3** finalizes: file lock strategy, migration playbook from PWA backup JSON, schema versioning ledger, hash compatibility with the existing `computeAppDataHash` (critical for cloud-sync receipts).

### 7.4 Other UserDefaults usage (small, bounded)

`UserDefaults` (or `.appGroup` defaults if extensions appear later) is used **only** for:

- Theme preference (`light` / `dark` / `system`)
- Last-opened tab (UX nicety)
- A boot counter (diagnostic)
- The cloud-sync flow envelope (mirrors `CLOUD_SYNC_FLOW_STORAGE_KEY`)

Everything else lives in the JSON document.

---

## 8. HealthKit integration shape

Agent 7 owns `NSHealthShareUsageDescription` and the privacy-strings audit. This section is the adapter shape.

### 8.1 Read-only types (no writes for V1)

```swift
public struct HealthKitReadTypeSet {
    static let v1: Set<HKObjectType> = [
        HKQuantityType(.restingHeartRate),
        HKQuantityType(.heartRateVariabilitySDNN),
        HKQuantityType(.heartRate),
        HKQuantityType(.stepCount),
        HKQuantityType(.activeEnergyBurned),
        HKQuantityType(.appleExerciseTime),
        HKQuantityType(.bodyMass),
        HKQuantityType(.bodyFatPercentage),
        HKQuantityType(.vo2Max),
        HKCategoryType(.sleepAnalysis),
        HKObjectType.workoutType()
    ]
}
```

This matches `APPLE_HEALTH_RECORD_TYPE_MAP` keys in `appleHealthTypeMap.ts:50–100`. No write access is requested in V1; we never publish workouts back to Apple Health.

### 8.2 Authorization flow

- Triggered **only from the Settings → Health Data screen**, never on cold boot.
- A pre-prompt explainer screen renders before the system sheet (Apple does not show our explainer in the system sheet, so we must show it ourselves).
- The decision is cached in `UserDefaults` only as a "user has been asked once" flag; the **real** state lives in HealthKit itself (`currentAuthorizationStatus`).

### 8.3 Fetch model

Pull-on-demand, not push. The Today screen view model calls `healthKit.fetchDailyMetrics(today...today)` when the user opens Today and the last fetch is older than N minutes. No HKObserver, no background delivery for V1 — see §10.

### 8.4 No XML import path in V1

The PWA's `appleHealthXmlImportEngine` + `healthImportEngine.ts` is **not ported in P0**. iOS users grant HealthKit and we read directly. The XML import would only matter to migrate someone who has zip exports from outside HealthKit, which is an extremely rare path. If demand appears, the parser could ship at P2 inside `IronPathBackup` since the same module already handles file picker.

### 8.5 Workout import semantics

`fetchRecentWorkouts(limit:)` maps each `HKWorkout` to `ImportedWorkoutSample` with `formatAppleWorkoutType(...)` from `appleHealthTypeMap.ts:109` (Chinese labels: 传统力量训练, 跑步, etc.). The display layer never sees the raw `HKWorkoutActivityType` enum.

---

## 9. Testing stack

### 9.1 Framework choice

- **XCTest** as the host. Not Quick/Nimble — XCTest is the iOS-standard, ships in Xcode, has parallel execution built in, integrates with `xcodebuild test`, and matches what `xcrun simctl` runs in CI.
- **Snapshot testing**: `pointfreeco/swift-snapshot-testing` — small, well-maintained, supports Codable golden snapshots (essential for §9.3).
- **No UI test framework beyond `XCUITest`** for V1. UI tests are expensive and slow; snapshot tests of view models give us 90% of the value.

### 9.2 Test pyramid

| Layer | Where | Volume target |
| --- | --- | --- |
| Pure engine tests | `IronPathDomain/Tests/` | high — port `tests/` from TS where feasible |
| Domain integration tests | same package | medium — `EnginePipeline` end-to-end on AppData fixtures |
| Persistence tests | `IronPathPersistence/Tests/` | medium — atomic write, partial-write recovery, sanitizer roundtrip |
| Data-health tests | `IronPathDataHealth/Tests/` | medium — repair idempotency, ledger compat |
| HealthKit tests | `IronPathHealthKit/Tests/` | low — test the mapping layer against fixture `HKQuantity` doubles; HKHealthStore itself is mocked |
| Cloud-sync tests | `IronPathCloudSync/Tests/` | low — protocol contract tests only in V1 (real Supabase wire = Agent 4) |
| View-model tests | `IronPathApp/Tests/` | medium — `AppRootViewModel.mutate` produces expected `appData'` |
| Snapshot/UI tests | `IronPathApp/Tests/` | low — five tab smoke shots; Focus Mode states (active set, correction, end-requested) |
| XCUITest | `IronPathAppUITests/` | very low — single launch test for TestFlight gate |

### 9.3 Golden parity tests against TS fixtures (critical)

The PWA already has ~1360 `tests/*.test.ts` files. We do **not** rewrite all of them. We pick:

- The high-signal "engine produces this exact decision" tests (training decision, focus next-set recommendation, plan adjustment).
- Each picks a small fixture (`tests/fixtures/trainingDecision/*.json`) and an expected decision (`tests/fixtures/trainingDecision/*.expected.json`).
- The Swift side loads the same JSON, runs the Swift port of the engine, and asserts the output Codable-encodes byte-for-byte equal (or via a deep dictionary diff for ordering tolerance).

This is the **only** way to keep the iOS port honest as Agent 2 (the engines-port agent) does the translation. Without it, the engines drift silently.

Implementation: add a `Scripts/export-ts-fixtures.mjs` that runs the existing engine on each fixture and dumps the `.expected.json` companion file. Swift tests consume both.

### 9.4 CI

GitHub Actions matrix: `xcodebuild -scheme IronPath test -destination 'platform=iOS Simulator,name=iPhone 15'`. Macos runner. The pure modules also run as a `swift test` job for the speed of macOS-only execution. Triggered on PR + main.

---

## 10. Background tasks policy

**V1 ships with no background activity. None. Zero `BGAppRefreshTask`, zero `HKObserverQuery` with background delivery, zero silent push.** This is a hard line.

### 10.1 Why none

- The user explicitly forbade default background sync in the audit spec.
- Cloud sync is **explicit-opt-in** by `explicitOptInSingleUserSyncCandidate.ts`; running it in the background defeats the safety model and risks `cloud_appdata_snapshots` row writes the user never asked for.
- HealthKit observers add battery cost and entitlement complexity (`com.apple.developer.healthkit.background-delivery`) for negligible UX gain — the app pulls fresh metrics when the user opens Today.
- Push notifications require APNs + Supabase Edge + per-device tokens. Out of P0 scope.

### 10.2 What V1 ships instead

- All updates happen while the app is in the foreground.
- The Cloud Sync screen has an explicit "立即同步" button. That is the only sync trigger.
- The Today screen refreshes HealthKit on appear if cache is stale.
- The rest timer keeps running in foreground; if iOS suspends the app, the rest timer's `endsAt` ISO string is persisted, and on resume the engine computes how much time has elapsed (mirrors `restTimerEngine.ts` which is already wall-clock based).

### 10.3 Reserved slots for P2+

- `BGAppRefreshTask` for opportunistic cloud-sync **check** (read-only check whether the cloud row has changed; does not auto-resolve). User-toggleable in Settings; off by default.
- HealthKit background delivery for resting HR drift detection. Strictly opt-in. Out of V1.

---

## 11. iPhone-first UX scope decisions

### 11.1 Devices

- **iPhone only**. Portrait only.
- **Minimum iOS**: `iOS 17.0`. Justification: `@Observable` macro requires Swift 5.9 / iOS 17, and SwiftUI's `NavigationStack` is stable from 16.0 but several toolbar/inset behaviors are smoother on 17. Going lower forces `ObservableObject` + republish-all costs.
- **No iPad, no Mac Catalyst, no Apple Watch, no Vision Pro.** The PWA's `lg:hidden` sidebar branch is explicitly dropped — we do not render a sidebar even on Plus / Max sizes; the iOS canonical pattern is `TabView` everywhere phone-shaped.

### 11.2 Localization

- **Single locale**: zh-Hans (Simplified Chinese), matching `src/i18n/zh-CN.ts`. The PWA has no English UI strings, and adding one prematurely doubles every QA pass.
- The `Localizable.strings` slot is wired, but only zh-Hans is populated.

### 11.3 Accessibility

- VoiceOver labels on every primitive in `IronPathUIKit` (the PWA had `data-testid` markers; iOS uses `accessibilityIdentifier` plus `accessibilityLabel`).
- Dynamic Type respected for body text. Headings cap at `.largeTitle`.
- Reduce-motion respected for any custom transitions.

### 11.4 Theme

- Three modes (`light` / `dark` / `system`) preserved from `themePreferenceModel.ts`.
- **Focus Mode forces dark** even when system is light, mirroring the `focusModeImmersiveDark: true` flag in `UiThemeProvider.tsx:7`.

### 11.5 Haptics

- A tasteful `UIImpactFeedbackGenerator(.light)` on "Complete Set" and `.medium` on "End Workout". No haptics elsewhere in V1.

### 11.6 Safe-area / status-bar

- Replaces `apple-mobile-web-app-status-bar-style="black"` + `viewport-fit=cover` plumbing. SwiftUI handles `safeAreaInsets` natively. The "底部黑边" PWA bug class disappears because there is no document background to mismatch with the home indicator.

---

## 12. Phased build plan

### 12.1 P0 — Internal TestFlight gate

Goal: a single iPhone build with real local persistence, real engines, the five tabs navigable, and one working session loop. **No cloud, no HealthKit yet.**

Ships:

- Xcode project scaffold + all 8 SPM packages compiling.
- `IronPathDomain` engines ported sufficient for: bootstrapping `AppData`, building a session, completing sets, ending session, rest timer, persistence sanitize.
- `IronPathPersistence` JSON-file implementation with atomic write + version-marker recovery.
- `IronPathDataHealth` guard + orchestrator stub (runs but with only the smallest repair set ported).
- `IronPathUIKit` primitives (ActionButton, GlassCard, SegmentedControl, StatusBadge, BottomSheet).
- The five tabs, navigation, Today decision summary, Training session shell, Focus Mode with state-machine driven action bar, History list, Progress placeholder, Settings root.
- Backup export + import via document picker.
- Single zh-Hans locale.
- Single XCUITest that launches the app.

Explicitly out of P0:

- Real HealthKit reads (the Today readiness summary uses `todayStatus` from user input only).
- Cloud sync (`DisabledCloudSyncClient`).
- Plan view, Assessment view, Records view content beyond placeholder.
- Coach actions display.

Acceptance: developer can install via TestFlight on personal iPhone, do a full training session, and see history. Engine outputs match TS fixtures on the 5 highest-signal golden tests.

### 12.2 P1 — Feature parity on the daily loop

Goal: enough features that the developer can stop using the PWA day-to-day.

Adds:

- `IronPathHealthKit` adapter — fetch daily metrics, fetch recent workouts, full authorization flow (Agent 7's privacy strings finalized).
- Plan view (the `progressMode='plan'` branch of Progress).
- Assessment view (`AssessmentView.tsx` port).
- Coach actions panel, post-workout next-time recommendation.
- Records / PRs view.
- Equipment profile settings.
- Data-health full repair registry ported.

Out of P1: cloud sync still disabled.

Acceptance: dogfooding for 2 weeks without falling back to PWA.

### 12.3 P2 — Cloud sync + polish

Goal: explicit-opt-in cloud sync, parity with the PWA's cloud surface.

Adds:

- `IronPathCloudSync` real implementation (Agent 4's deliverable).
- First-sync flow, conflict review screen, override-conflict screen, cloud diagnostics panel.
- Account & Sync settings screen with cloud sign-in (Apple ID / Supabase OAuth).
- Optional XML import-from-zip path for users migrating from the PWA backup.
- Localization slot for English (still empty, but the macro is in place).

Out of P2: Watch / Live Activities / Widgets / background tasks / share extension.

Acceptance: explicit cloud sync round-trip works; conflict review surfaces correctly when hash mismatches; receipt persists.

### 12.4 Out of any V1 phase

- iPad, Mac Catalyst, Vision Pro, Watch, watchOS complications.
- Live Activities, Widgets.
- Background sync (`BGAppRefreshTask`).
- Push notifications.
- Share extension.
- Siri Shortcuts.
- iCloud Drive sync.

---

## 13. Risks

### 13.1 Over-engineering risk: porting `App.tsx`'s 2349 lines too literally

`App.tsx` is a regulator antipattern — it holds dozens of `useState` + a single `setData` mutation funnel + dozens of handlers. Directly porting that to one `AppRootViewModel` produces a 2000-line Swift file that nobody can review.

**Mitigation**: enforce that `AppRootViewModel` owns only the **state** (`appData`, `activeTab`, `toast`, three or four flow flags). Every handler moves to a per-tab view model that calls into engines and reports back. The audit's Implementation agent (Agent 6) must produce a handler-by-handler placement map before any code lands.

### 13.2 SwiftUI navigation pitfall risk

`NavigationStack` + `.fullScreenCover` + `.sheet` interact in non-obvious ways: dismissing a sheet from inside a `NavigationStack` push, deep-linking into a tab not currently selected, animation race conditions on `path` mutations from async work.

**Mitigation**:

- Centralize navigation state in a per-tab `NavigationPath` held by the tab's view model, not scattered `@State` in views.
- For Focus Mode (full-screen cover), drive presentation off a single source (`appRoot.activeSession?.isImmersive`).
- Cover at least the three landmines in P0 testing: (a) backgrounding mid-Focus-Mode, (b) navigating between tabs while Focus Mode is up, (c) cold-launch into a deep link.

### 13.3 Framework lock-in risk

SwiftUI's `@Observable` + Observation framework is iOS 17+ and Apple-only. If we ever want a cross-platform port (Kotlin Multiplatform, etc.), this becomes a problem.

**Mitigation**: the pure modules (`IronPathDomain`, `IronPathDataHealth`, `IronPathPersistence`'s protocol, `IronPathL10n`'s string table) **do not import SwiftUI**. They are already framework-agnostic. The lock-in is confined to `IronPathUIKit` + `IronPathApp`, which is the right boundary — UIs always have to be rewritten across platforms anyway. Accepting Apple lock-in for the View layer is the correct trade in V1.

### 13.4 Golden parity test rot risk

If the iOS engines port diverges from TS and the parity tests are slow / brittle, engineers will skip them or delete them.

**Mitigation**: make the fixture export idempotent and CI-checked. Any TS engine change runs the fixture export step in pre-commit. The Swift port must update or the CI fails. This is also why `IronPathDomain` builds for macOS — `swift test` on macOS finishes in seconds.

### 13.5 Cloud-sync receipt hash incompatibility risk

The PWA's `computeAppDataHash` is deterministic but specifically tuned for V8 of `JSON.stringify`. If the Swift `JSONEncoder` produces byte-equivalent output for the same sanitized AppData, the receipt portability works; if not, every user who flips from PWA → iOS sees `conflict_review_required` because the hash differs.

**Mitigation**: Agent 3 + Agent 4 collaborate on a **canonical JSON form** (sorted keys, no trailing spaces, fixed decimal precision) and Swift's encoder is configured to match it. There is a golden test that takes a known `AppData` and asserts the Swift-computed hash equals the TS-computed hash. **This test gates the cloud-sync work in P2.**

### 13.6 HealthKit authorization revocation risk

iOS does not tell the app when the user revokes HealthKit access in Settings.app. The app silently starts getting empty results.

**Mitigation**: every HealthKit fetch checks `currentAuthorizationStatus` first and surfaces a "重新授权 Apple 健康" banner if denied. This is a UX-level mitigation, not a code-level one.

---

## 14. Non-goals (explicit)

The following are **out of every V1 phase**:

- iPad app, iPad split view, Stage Manager support
- Mac Catalyst, native Mac app
- Apple Watch app, watchOS complications, watchOS Smart Stack
- Vision Pro / visionOS
- Live Activities (on Lock Screen or Dynamic Island)
- Widgets (Home Screen, Lock Screen, StandBy)
- Background sync of any kind (`BGAppRefreshTask`, silent push, HKObserverQuery background delivery)
- Push notifications (APNs)
- Share extension, action extension, intent extension
- Siri Shortcuts, App Intents
- iCloud Drive / CloudKit backups (we use Supabase per existing PWA, not CloudKit)
- App Clip
- StoreKit / IAP (the app is free)
- Apple Maps integration
- Sign in with Apple **as the only identity provider** — defer the identity-provider decision to Agent 4
- TestFlight public link, App Store submission, marketing site — V1 stops at Internal TestFlight

These are **non-goals** in V1, not forbidden forever; each can return in a later audit cycle.

---

## 15. Open questions

1. **Engine port strategy — automated vs. hand**. Agent 2 owns this, but the architecture question is: do we write a TS→Swift transliterator, or hand-port? Architecture allows both, but the test pyramid in §9.3 assumes hand-ported with golden tests. If automated, the parity tests still gate.
2. **Persistence format — Agent 3 may override**. The slot in §7 supports SwiftData if Agent 3 finds a defensible case. The blocker would be: how does `computeAppDataHash` interact with SwiftData's stored representation? Agent 3 must answer.
3. **Identity provider — Sign in with Apple vs. Supabase Email OTP vs. both**. Agent 4 owns. Affects Settings → Account screen design.
4. **HealthKit write-back**. Spec says read-only V1. Should "Log workout to Apple Health when session ends" be a P2 toggle? Agent 7 to confirm whether the user has policy on workout writes.
5. **TestFlight distribution**. Internal TestFlight max is 100 users; spec implies single-user dogfooding. Confirm only the developer + perhaps 2-3 trusted testers ship in P0.
6. **Build identifier surfaced for diagnostics**. PWA has `__IRONPATH_BUILD_SHA__` baked at build time (`vite.config.ts:15`) — should iOS bake `Bundle.main.infoDictionary["CFBundleVersion"]` + the short Git SHA into a Settings → About diagnostic row? The PWA needed this for cloud-sync stale-cache investigation; iOS may need a different diagnostic shape since there is no SW cache.
7. **Minimum iOS version**. §11.1 picks iOS 17. If TestFlight testers include someone on iOS 16, we drop `@Observable` and use `ObservableObject`. Confirm device matrix.
8. **App Group / Keychain usage**. For cloud-sync tokens, are we storing in `Keychain` (recommended) or `UserDefaults`? Agent 4 owns the answer, but the architecture must accommodate the Keychain access pattern (it is synchronous and may need a background queue).
9. **Apple Health XML import — P0 hard-drop or P2 soft-add?** §8.4 says drop. Confirm with Agent 7 whether any migration path from existing PWA users requires it.
10. **App Store Connect provisioning**. Not an architectural question per se but a P0 prerequisite: who owns the bundle ID `com.ironpath.app`, the Apple Developer Program account, and the signing certificates? V1 cannot ship to TestFlight without these. Out of this audit's scope but flagged for handoff.

---

## Appendix A: Module dependency graph (allowed imports only)

```
                    ┌──────────────────────┐
                    │     IronPathApp      │
                    │  (RootView + @main)  │
                    └──────────┬───────────┘
              ┌────────────────┼─────────────────────┐
              ▼                ▼                     ▼
  ┌─────────────────────┐ ┌─────────────┐ ┌─────────────────────┐
  │  IronPathUIKit     │ │ IronPathL10n│ │  IronPathPersistence │
  │  (SwiftUI views)   │ │ (zh-CN dict)│ │  (AppDataStore)      │
  └─────────┬──────────┘ └──────┬──────┘ └──────────┬──────────┘
            │                   │                   │
            └───────────────────┴───┬───────────────┘
                                    ▼
                        ┌─────────────────────────┐
                        │      IronPathDomain      │
                        │  (pure engines + model)  │
                        └─────────────────────────┘
                                    ▲
                                    │
                ┌───────────────────┼─────────────────────────┐
                │                   │                         │
   ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────────┐
   │ IronPathDataHealth │ │  IronPathBackup    │ │  IronPathCloudSync   │
   │  (guard + repair)  │ │  (export/import)   │ │  (sync protocol)     │
   └────────────────────┘ └────────────────────┘ └──────────┬──────────┘
                                                             │
                                                             ▼
                                                  ┌─────────────────────┐
                                                  │ IronPathHealthKit   │
                                                  │ (HK adapter)        │
                                                  └─────────────────────┘
                                                       ▲ (HealthKit.fwk)
```

Forbidden imports (will fail at compile time because of SPM scoping):

- `IronPathDomain` cannot import HealthKit, SwiftUI, URLSession.
- `IronPathDataHealth` cannot import HealthKit, SwiftUI.
- `IronPathPersistence` cannot import HealthKit, SwiftUI.
- `IronPathHealthKit` may import HealthKit, may not import SwiftUI.
- `IronPathUIKit` may import SwiftUI, may not import HealthKit, may not import URLSession.

This graph is the architectural contract. Any future change that violates it is a regression.

---

## Appendix B: Cross-reference table (what gets ported where)

| PWA path | iOS module | Notes |
| --- | --- | --- |
| `src/App.tsx` (top wiring) | `IronPathApp/RootView.swift` + `AppRootViewModel.swift` | Decompose aggressively — never one 2349-line file |
| `src/main.tsx` | `IronPathApp/IronPathApp.swift` | `@main` entry |
| `src/models/training-model.ts` | `IronPathDomain/Model/*` | One Swift file per logical struct group |
| `src/engines/*.ts` (~120 files) | `IronPathDomain/Engines/*` | 1:1 file name parity |
| `src/dataHealth/*` | `IronPathDataHealth/*` | Includes `repairs/*` |
| `src/storage/persistence.ts` + `localStorageAdapter.ts` | `IronPathPersistence/JSONFileAppDataStore.swift` | Default impl |
| `src/storage/backup.ts` | `IronPathBackup/BackupExportImporter.swift` | |
| `src/cloudProduction/*` + `src/cloudSync/*` | `IronPathCloudSync/*` | Real impl is Agent 4's deliverable |
| `src/auth/*` | folded into `IronPathCloudSync/IdentityProvider.swift` | |
| `src/engines/appleHealth*.ts` + `healthImportEngine.ts` (live read parts) | `IronPathHealthKit/*` | XML import dropped for V1 |
| `src/engines/healthSummaryEngine.ts` | `IronPathDomain/Engines/HealthSummaryEngine.swift` | Pure summary stays in Domain |
| `src/uiOs/primitives/*` | `IronPathUIKit/*` | |
| `src/uiOs/theme/*` | `IronPathUIKit/Theme/*` | |
| `src/uiOs/{today,training,history,progress,records,settings}/*` | `IronPathApp/Screens/*` | Per-tab SwiftUI views |
| `src/uiOs/uiOsNavigation.ts` | `IronPathApp/Navigation/TabID.swift` | |
| `src/uiOs/MobileAppShell.tsx` + `BottomNav.tsx` + `AppTopBar.tsx` | `IronPathApp/Navigation/RootView.swift` | SwiftUI `TabView` + toolbar |
| `src/i18n/zh-CN.ts` + `formatters.ts` + `terms.ts` | `IronPathL10n/*` | |
| `src/workers/appleHealthXmlImportWorker.ts` | NOT PORTED V1 | Optional P2 |
| `public/manifest.webmanifest` + icons | `IronPathApp/Resources/Assets.xcassets` | |
| `public/sw.js` | NOT PORTED | No equivalent on native |
| `apps/api/*` | NOT PORTED | Dev-only PWA artifact |
| `vite.config.ts` | NOT PORTED | Replaced by SPM `Package.swift` |
| `index.html` | NOT PORTED | Replaced by `Info.plist` + asset catalog |

---

End of Agent 5 report.
