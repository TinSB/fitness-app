# iOS Native Migration — Entry Gate V1

> Status: docs / planning only. **No implementation lands in this PR.**
> Sibling deliverables:
> - `docs/IOS_NATIVE_MIGRATION_TASKS_V1.md` (the 11 iOS-N tasks with acceptance criteria; see this doc §17 for the DAG)
> - `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` (the 11 frozen contracts referenced from §7)
> Underlying agent reports: `docs/ios-native-migration/agents/*.md` (8 reports) + `docs/ios-native-migration/IOS_NATIVE_MIGRATION_CROSS_AGENT_REVIEW_V1.md`.
> Version: V1. Last updated: 2026-05-28.

## 1. Executive summary

IronPath today is a single-user PWA that has spent the last six months
hardening four load-bearing systems:

1. **TrainingDecision V2** (PR #384) — a single arbiter,
   `buildTrainingDecision(input) → TrainingDecision`, owns every
   per-surface user-facing payload. Nine legacy final-decision engines
   were deleted.
2. **Real Data Health Repair V1** (PR #385 / #386) — a backup-first,
   ledger-tracked, idempotent repair system with a `CleanAppDataView`
   firewall that prevents dirty AppData from entering the decision
   engine.
3. **Cloud Sync V3 / V4 / V5** (PR #387 / #388 / #390) — explicit
   user-action upload only, mandatory eligibility guard,
   `expectedPreviousHash` plumbed through, fresh-read preflight
   mandatory on iOS.
4. **TrainingDecision Clean Input Contract Lock V1** (PR #391) —
   compile-time-equivalent factory boundary that forbids raw `AppData`
   from reaching `buildTrainingDecision`.

These four systems are the product. The PWA UI is a delivery surface
that has stabilised but has nowhere to go visually — PWA-specific work
(`AddToHomeScreenHint`, service worker, Vite manualChunks, browser
back-button quirks, manifest install nag) is no longer paying for
itself. The user has elected to migrate to a **native iOS Swift
rewrite** that preserves all four systems verbatim and replaces only
the Web shell.

This Entry Gate doc is the **APPROVE / REVISE / REJECT decision
artefact** for the migration. The 8 sibling agent reports agree that
the migration is feasible as a **Native Swift rewrite** organised in
**11 tasks** (`iOS-0` through `iOS-10`) following the team's existing
`V1` cadence. The 4 load-bearing systems are preserved through
**Swift Package Manager module isolation**, **fixture-driven parity
testing**, and **branded factory boundaries that the Swift type system
enforces at compile time**. The migration is **conditionally
APPROVED**, conditional on resolving one user-facing decision before
iOS-7 (Explicit Cloud Sync) starts: which of three SDK paths to take
for Supabase (see §10 Revision H2).

## 2. Why PWA-specific work is deprioritised

The PWA shell is sound but the product has outgrown it:

- **Distribution**: iOS users discover apps in the App Store. The
  "Add to Home Screen" nag and the `apple-mobile-web-app-status-bar-style`
  plumbing exist to paper over the PWA-on-iOS gap. The gap is fixed
  by shipping a real iOS app.
- **Sensors**: Apple Health is the readiness signal source the
  product wants. The PWA can only get HK data via XML export →
  WebFileSystem import, which is a manual chore. A native iOS app
  reads HealthKit live with explicit user authorisation. This is a
  10× product win.
- **Predictability**: `localStorage`, service-worker cache, browser
  back/refresh quirks, and the `display-mode: standalone` checks all
  inject failure modes that have nothing to do with strength
  training. A native iOS app has none of them.
- **Reviewability**: App Store review is a forcing function on the
  privacy / observability discipline the team has already adopted
  (no analytics SDK, no tracking, no background sync). The native app
  inherits the same posture and gets it audited.
- **Roadmap headroom**: future work (haptics, native rest-timer
  notifications, Apple Watch companion, Live Activities) is impossible
  on the PWA. The native rewrite unlocks all of them as separate
  V2+ decisions.

The PWA is **not** being deleted — it continues to deploy from `main`
via the existing Vercel flow. The iOS app is **additive**. After
iOS-10, both surfaces ship; the iOS app talks to the same Supabase
backend as the PWA and round-trips the same AppData JSON. Existing PWA
users can migrate via the existing JSON export → import flow.

## 3. Current IronPath system inventory

What we have today (bullet, not exhaustive):

- **TrainingDecision V2** as sole arbiter; nine legacy engines deleted
  in PR #384. `decisionVersion = 'v2'` at
  `src/engines/trainingDecisionTypes.ts:429`.
- **Reentry / restart productive-dose floor** via a gap state machine
  (0–3 / 4–7 / 8–13 / 14–27 / 28+ days), per-role floors (main 2,
  secondary 2, accessory 1, isolation 1), AR-1..AR-9 arbitration
  precedence.
- **Focus Mode** with a queue (`buildFocusStepQueue` at
  `src/engines/focusModeStateEngine.ts:141`) and an interaction state
  machine (`focusModeInteractionState.ts:100`) that resolves a single
  primary action per `(sessionState, exerciseState, setState,
  recommendationState, safetyState)` tuple.
- **Effective-set scoring** (RIR 1-3 full, 4 = ×0.65, ≥5 = ×0.45,
  technique poor = ×0.45, pain = ×0.5, threshold `score ≥ 0.75`) at
  `src/engines/effectiveSetEngine.ts:7`.
- **Equipment-aware actionable load** including the empty-bar
  fallback (theoretical 17 lb → feasible 45 lb / 20.4 kg).
- **Four-ID exercise identity** (`originalExerciseId /
  actualExerciseId / displayExerciseId / recordExerciseId`) at
  `src/engines/currentExerciseSelector.ts:40`.
- **kg / lb contract**: kg canonical storage, lb display-only,
  `KG_PER_LB = 0.45359237` exactly at
  `src/engines/unitConversionEngine.ts:4`.
- **CleanAppDataView** firewall at `src/dataHealth/cleanAppDataView.ts:86`.
- **Branded clean-input contract** at
  `src/engines/trainingDecisionCleanInput.ts:58` with stamped Symbol.
- **AutoRepairOrchestrator** (`src/dataHealth/autoRepairOrchestrator.ts:62`)
  + 9 V1 repairs in `src/dataHealth/repairs/`.
- **Repair ledger** (cap 1000, 24h idempotency window) at
  `src/dataHealth/appDataRepairLedger.ts` + repair receipts (cap
  500) at `src/dataHealth/appDataRepairEngine.ts:10`.
- **Cloud sync** to one Supabase table (`cloud_appdata_snapshots`),
  RLS via `owner_user_id = auth.uid()`, append-only, with V3 (upload
  eligibility), V4 (subsequent upload + `expectedPreviousHash`), V5
  (mandatory fresh-read preflight on iOS).
- **`STORAGE_VERSION = 8`** at `src/data/appConfig.ts:4`, migration
  ladder at `src/storage/appDataMigration.ts:166` (ends at
  `migrateToV6` which stamps to 8 — collapsed ladder).
- **AppData top-level** at `src/models/training-model.ts:1362`,
  open-bag `AppSettings` at `:1322`.
- **Snapshot hash** (`buildAppDataSnapshotHash`) at
  `src/cloudProduction/accountBoundaryLocalInventory.ts:156` — FNV-1a
  32-bit over `stableStringify(appData)`.
- **No analytics SDK**, **no Sentry / Crashlytics**, **no advertising
  SDK**, **no tracking**. Verified by `package.json` and
  `scripts/scan-production-dist-safety.mjs`.
- **Existing test surface**: ~5,500 TS tests across ~1,360 files.
- **Real-data fixtures** under `tests/fixtures/realDataRegression/`,
  `tests/fixtures/realExports/`, and the canonical redacted real
  export `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`.

## 4. Multi-agent findings summary

Eight agents ran in parallel. Each produced a focused report; this
section is a one-paragraph orientation per agent with a link.

- **Agent 1 — Product / Training Domain**
  ([report](./ios-native-migration/agents/PRODUCT_TRAINING_DOMAIN_AGENT.md)).
  Identifies the must-preserve training contracts: TrainingDecision as
  the sole arbiter, reentry / restart productive-dose floor, Focus
  Mode step queue + interaction state machine, effective-set scoring,
  equipment-aware load, four-ID exercise identity, completion quality
  guard, kg / lb contract, rest timer per-session state, today focus
  override session-only. Names the MVP shortlist: Today → start a
  session, Focus Mode → execute a session, Records → finish session +
  see what happened.

- **Agent 2 — TS Core Logic / Engines**
  ([report](./ios-native-migration/agents/TS_CORE_LOGIC_AGENT.md)).
  Enumerates 119 engine files; classifies 85 as `PURE_DOMAIN`, 24 as
  `UI_COUPLED` (decision pure, copy Chinese), only 2 as
  `BROWSER_DEPENDENT` (one CSV-export helper, one `navigator.userAgent`
  check). Tier-orders the Swift port: Tier 0 (utilities) → Tier 1
  (identity + types) → Tier 2 (core engines) → Tier 3 (Focus Mode) →
  Tier 4 (Today decision stack) → Tier 5 (analytics) → Tier 6 (Health
  + explainability) → Tier 7 (niche). Big TrainingDecision file (2,097
  LOC) recommended to be **re-derived from tests, not literal-translated**.

- **Agent 3 — Data Model / AppData / Repair**
  ([report](./ios-native-migration/agents/DATA_MODEL_REPAIR_AGENT.md)).
  Recommends **JSON snapshot file first** for AppData with measurable
  escalation thresholds (>5 MB file, p95 save >80 ms, p95 cold-start
  decode >250 ms). Cites the team's prior SQLite migration prototype
  that was deliberately never enabled in production. Ports the 9 V1
  repair recipes one-to-one. Implements the branded clean-input
  contract via Swift `fileprivate` init — **stronger than the TS
  runtime brand**. Catches subtle real-data risks (ISO timestamp
  drift, sanitiser `Date.now()` non-determinism, schema-ladder
  collapse at V5 → V8, `additionalProperties: true` everywhere).

- **Agent 4 — Cloud Sync / Supabase / Auth**
  ([report](./ios-native-migration/agents/CLOUD_SYNC_AUTH_AGENT.md)).
  Defines the wire contract (one table, one RLS pair, anon key only,
  FNV-1a 32-bit hash over `stableStringify`). Recommends the official
  `supabase-swift` SDK (**but this conflicts with the no-SDK rule and
  is deferred for explicit user approval per Cross-review Revision
  H2**). Makes V5 fresh-read preflight **mandatory** on iOS V1
  (stricter than the TS web build's optional path). Plumbs
  `expectedPreviousHash` through the Swift `writeSnapshot` API from
  day one. Forbids background sync, silent overwrite, partial-upload,
  silent retry, and local-data deletion as sync side-effects.

- **Agent 5 — iOS Native Architecture**
  ([report](./ios-native-migration/agents/IOS_ARCHITECTURE_AGENT.md)).
  Recommends one Xcode workspace + **8 local Swift Packages**
  (`IronPathDomain`, `IronPathDataHealth`, `IronPathPersistence`,
  `IronPathCloudSync`, `IronPathHealthKit`, `IronPathBackup`,
  `IronPathL10n`, `IronPathUIKit`) under `Packages/`, one app target
  `IronPathApp`. SwiftUI + `@Observable` (no TCA, no Redux clone).
  Five tabs `today / train / history / progress / settings`; Plan is
  a sub-route of Progress; Focus Mode is a `.fullScreenCover`. iOS
  17.0 minimum. **No background tasks. None. Zero `BGAppRefreshTask`,
  zero `HKObserverQuery` with background delivery, zero silent push.**

- **Agent 6 — QA / Test / Parity**
  ([report](./ios-native-migration/agents/QA_PARITY_AGENT.md)).
  Defines the parity strategy: TS engine → Swift engine pairing, Node
  sidecar for live drift detection + frozen goldens for CI hermeticity.
  Lists ~25 parity test names with their TS / Swift pairings; names
  the 5 P0-critical tests (`AppDataSnapshotHashParityTests`,
  `AppDataMigrationParityTests`, `AppDataSanitizeParityTests`,
  `CleanAppDataViewParityTests`, `TrainingDecisionEngineParityTests`).
  Names the canonical fixture directory `tests/fixtures/parity/`
  (this wins per Cross-review H1) with a 12-flow manual iPhone smoke
  checklist. Lists 25 real-data corruption cases.

- **Agent 7 — Security / Privacy / App Store**
  ([report](./ios-native-migration/agents/SECURITY_PRIVACY_AGENT.md)).
  Drafts the personal-data inventory mapped to Apple's App Privacy
  data types. Specifies the minimum HealthKit read set (11 types).
  Drafts `NSHealthShareUsageDescription` strings in zh-CN and en.
  Recommends `ITSAppUsesNonExemptEncryption = NO`. Identifies the App
  Store risks: privacy strings mismatch, account deletion required
  (Guideline 5.1.1(v)), encryption export compliance, background
  HealthKit observers, HealthKit write access requested but unused.
  **Confirms no Sentry / Crashlytics / analytics SDK without explicit
  user approval.**

- **Agent 8 — Migration Program Manager**
  ([report](./ios-native-migration/agents/MIGRATION_PROGRAM_MANAGER_AGENT.md)).
  Sequences the 11 tasks (iOS-0 through iOS-10) with hard
  dependencies, defines per-task acceptance criteria, pre-TestFlight
  gate (11 items), pre-App-Store gate (11 items), and 11 stop
  conditions. Identifies the earliest usable iPhone build (after
  iOS-5). Confirms cadence inheritance from
  `DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md`.

The cross-agent **Grill Review**
([report](./ios-native-migration/IOS_NATIVE_MIGRATION_CROSS_AGENT_REVIEW_V1.md))
ran the 8 reports against 8 failure modes (PWA copy, TrainingDecision
loss, repair-semantics loss, cloud safety regression, premature DB,
App Store / HealthKit assumption gaps, Xcode-too-early, real-data
risk gaps). Verdict: **REVISE**. Three HIGH-severity revisions
required (H1–H3, absorbed below). Seven MEDIUM/LOW revisions to
absorb. No PASS-blocker that triggered a REJECT.

## 5. Migration strategy comparison

Five candidate strategies were considered. The scoring rubric: each
column 1 (worst) to 5 (best). Total max = 25.

| Strategy | Data safety | Parity risk | App Store fit | Long-term cost | Time to first device build | Total |
|---|---|---|---|---|---|---|
| **PWA-only (status quo)** | 5 | 5 | 1 (no native distribution) | 2 (PWA shell rot) | 5 | 18 |
| **WKWebView wrap** | 4 (PWA-equivalent) | 5 (same code) | 2 (Apple rejects "web apps repackaged as native") | 1 (worst of both worlds) | 4 | 16 |
| **Capacitor / Cordova wrap** | 3 (bridge surface) | 4 (most code shared) | 3 (acceptable but flagged at scale) | 2 (Capacitor + plugin matrix maintenance) | 3 | 15 |
| **React Native** | 3 (RN-side bugs + native modules) | 3 (engine port still needed for type parity) | 4 (RN apps ship) | 3 (RN ecosystem volatility, bridge cost) | 2 | 15 |
| **Native Swift rewrite** | 4 (clean Swift type system; new persistence to validate) | 3 (engine port required, parity-test enforced) | 5 (native is what App Store rewards) | 5 (no bridge tax, no JS runtime) | 1 (longest) | 18 |

Tie at the top between **PWA-only** and **Native Swift rewrite**. The
tiebreaker is the **roadmap headroom** axis: PWA-only has zero. Native
Swift unlocks every product win that requires Apple frameworks
(HealthKit live read, native rest-timer notifications, haptics, Apple
Watch, Live Activities). The user has elected the native rewrite.

WebView wrap is **explicitly forbidden** by Stop Condition #1 (§18) —
both because of App Store Guideline 4.2 ("Web apps repackaged as
native") and because it would inherit every PWA-specific failure mode
the rewrite is trying to escape.

Capacitor / Cordova / React Native were considered and rejected on
long-term cost: the bridge layer becomes a permanent tax for every
engine call, and the type system at the bridge boundary is weaker than
either pure Swift or pure TS.

## 6. Recommended strategy

**Native Swift rewrite** organised as one Xcode workspace + 8 local
Swift Packages (`Packages/*`) + one app target (`IronPathApp`). Module
boundaries are SwiftPM packages so the `internal` Swift access modifier
enforces them at compile time; no engine module can `import HealthKit`,
no model module can `import SwiftUI`.

### 6.1 The 8 SPM module map (Architecture Agent §3 + Cross-review M6)

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

### 6.2 Module roles and forbidden imports

| Module | Role | Forbidden imports |
|---|---|---|
| `IronPathDomain` | Pure engines + model (port of `src/engines/` + `src/models/training-model.ts`); foundation only | `HealthKit`, `SwiftUI`, `URLSession`, `Combine` |
| `IronPathDataHealth` | Runtime guard + auto-repair + ingress pipeline (port of `src/dataHealth/`) | `HealthKit`, `SwiftUI`, `URLSession` |
| `IronPathPersistence` | `AppDataStore` protocol + `JSONFileAppDataStore` default impl | `HealthKit`, `SwiftUI`, `URLSession` |
| `IronPathCloudSync` | `CloudSyncGateway` + Supabase wire layer | `HealthKit`, `SwiftUI` |
| `IronPathHealthKit` | `HealthKitAdapter` + raw-attr allow-list importer | `SwiftUI` |
| `IronPathBackup` | `BackupExportImporter` JSON export/import | `HealthKit`, `URLSession` |
| `IronPathL10n` | zh-CN string table + formatters | (none beyond Foundation) |
| `IronPathUIKit` | SwiftUI primitives + theme | `HealthKit`, `URLSession` |

This graph is the architectural contract. Any future change that
violates it is a regression.

### 6.3 Why local SPM packages, not in-app folders

- **Compile-time module isolation** — Swift's `internal` is per-module.
- **Faster incremental builds** — touching `TrainingDecisionEngine`
  recompiles only `IronPathDomain` and downstream packages.
- **Snapshot-testability** — `IronPathDomain` builds for macOS too, so
  XCTest golden-parity tests against TS fixtures can run on the laptop
  without booting an iOS simulator.
- **Forward-compatibility** — if a CLI or Mac Catalyst surface ever
  appears, the domain modules are already extractable.

## 7. Contract freeze list

The iOS rewrite freezes **11 contracts**. Full text and parity-test
pairings live in
`docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md`.

| # | Contract | Anchor |
|---|---|---|
| 1 | AppData compatibility contract | `STORAGE_VERSION = 8`; open-bag preservation; `additionalProperties: true` carriers at every level |
| 2 | TrainingDecision contract | Sole arbiter; `userFacing.*` shape; AR-1..AR-9; reentry / restart / deload; per-role floors |
| 3 | Clean input contract | Swift `fileprivate` init + single factory; stronger than TS Symbol brand |
| 4 | Data Health repair contract | 9 V1 repairs; backup-first; ledger 1000 cap; receipts 500 cap; 24h idempotency |
| 5 | Cloud sync snapshot contract | Single Supabase table; FNV-1a hash; explicit sync only; account deletion required if cloud ships in V1 (H3) |
| 6 | Upload eligibility contract | `ensureCloudUploadEligible` mandatory before every upload |
| 7 | Subsequent upload / concurrency contract | V4 + V5 fresh-read preflight mandatory on iOS |
| 8 | Unit kg / lb contract | `KG_PER_LB = 0.45359237`; kg internal; lb display-only; never round-trip kg→lb→kg |
| 9 | Session lifecycle contract | Set IDs deterministic; `ActualSetDraft` draft-then-commit; rest timer per-session; 4-ID identity |
| 10 | Health data freshness contract | HK live read; staleness 3 days (todayStatus) / 14 days (HK); never written back unless V2+ |
| 11 | Real-data fixture contract | Redacted JSON; `tests/fixtures/parity/` canonical path (H1); PII-safe; license owned by IronPath project |

See `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` for the full
contract statements, TS source-of-truth references, Swift mirror
requirements, parity-test pairings, MUST-NOT lists, and version
markers (all V1).

## 8. iOS native architecture (high-level)

```
┌───────────────────────────────────────────────────────────────────┐
│                          IronPathApp                              │
│                          (@main, RootView, AppRootViewModel)       │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Today  │  │ Train  │  │History │  │ Progress │  │ Settings │  │
│  │ tab    │  │ tab    │  │ tab    │  │ tab      │  │ tab      │  │
│  │        │  │ + Focus│  │        │  │ (Plan as │  │          │  │
│  │        │  │ Mode   │  │        │  │ sub-rt)  │  │          │  │
│  │        │  │ (full- │  │        │  │          │  │          │  │
│  │        │  │ screen │  │        │  │          │  │          │  │
│  │        │  │ cover) │  │        │  │          │  │          │  │
│  └────────┘  └────────┘  └────────┘  └──────────┘  └──────────┘  │
└───────────────────────────────────────────────────────────────────┘
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                       IronPathUIKit                                │
│           (ActionButton, GlassCard, SegmentedControl,              │
│            StatusBadge, BottomSheet, FloatingBottomNav,            │
│            AppTopBar, Theme)                                       │
└───────────────────────────────────────────────────────────────────┘
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                       IronPathL10n                                 │
│           (zh-CN string table, formatters, terms)                  │
└───────────────────────────────────────────────────────────────────┘
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                       IronPathDomain                               │
│           (TrainingDecisionEngine, FocusModeStateEngine,           │
│            EffectiveSetEngine, E1RMEngine, SessionBuilder,         │
│            ActionableLoadContract, RestTimerEngine,                │
│            UnitConversion, ReplacementEngine,                      │
│            CurrentExerciseSelector, ... — ~120 engine ports)       │
└───────────────────────────────────────────────────────────────────┘
                          ▲             ▲            ▲
                          │             │            │
┌───────────────────┐   ┌─────────────────────┐   ┌──────────────┐
│ IronPathDataHealth│   │ IronPathPersistence │   │IronPathCloud │
│ (guard+repair)    │   │ (AppDataStore +     │   │   Sync       │
│                   │   │  JSONFileAppDataSto)│   │ (Supabase    │
│                   │   │                     │   │  Gateway)    │
└───────────────────┘   └─────────────────────┘   └──────────────┘
                                                         │
                                                         ▼
                                                  ┌──────────────┐
                                                  │ IronPathHK   │
                                                  │ (read-only)  │
                                                  └──────────────┘
```

See Architecture Agent's report
([link](./ios-native-migration/agents/IOS_ARCHITECTURE_AGENT.md))
for module surfaces (protocol-level), navigation deep dives, and the
full module dependency graph (Appendix A in that report).

## 9. Local storage recommendation

**JSON snapshot first**, file system, atomic write with previous-version
backup. SwiftData / Core Data / SQLite are **explicitly deferred** to
V2+ and only adopted if profiling on real device data trips the
escalation thresholds named below.

### 9.1 V1 default implementation

- One file under
  `FileManager.default.url(for: .applicationSupportDirectory, ...)` →
  `<AppGroup>/ironpath/appData.v8.json`.
- Atomic write via `Data.write(to: tmpURL, options: [.atomic,
  .completeFileProtectionUnlessOpen])` then `replaceItem`.
- Sibling `appData.previous.json` written before each replace as a
  one-step rollback.
- Pre-repair safety backups under `<AppGroup>/ironpath/backups/`
  retention 5 (mirrors `MAX_BACKUPS = 5` at
  `src/dataHealth/autoRepairBackupAdapter.ts:7`).
- `JSONDecoder.keyDecodingStrategy = .useDefaultKeys` (TS uses
  camelCase; do not convert).
- ISO timestamps decoded / encoded as `String`, never `Date` (Contract
  Freeze §1).

### 9.2 Escalation thresholds (Data Agent §4.3)

Defer migration to a normalised store **only** when one of these is
measured (not guessed) on a real user's data:

| Metric | Threshold | Why |
|---|---|---|
| `appData.v8.json` file size (uncompressed) | > 5 MB | Atomic write latency becomes user-visible on older iPhones. |
| End-to-end save time | p95 > 80 ms on iPhone 13+ | Above this users notice the spinner. |
| Cold-start decode time | p95 > 250 ms | Above this we lazy-decode heavy slots. |
| Repair-orchestrator pass time | p95 > 300 ms | All 9 detect+dryRun loops together. |

When any threshold is breached, the migration path is **NOT** "rewrite
everything to SQLite"; it is "split the JSON file along the natural
boundaries that already exist in `STORAGE_KEYS`" (history,
healthMetricSamples, importedWorkoutSamples, healthImportBatches,
settings). SQLite is only considered after sharding has been measured
to still be insufficient — and at that point, only for the data domain
that actually needs row-level queries (HealthKit samples is the
realistic candidate). **AppData proper stays JSON.**

### 9.3 Justification: prior SQLite attempt was deliberately not enabled

The team itself rejected normalisation:

- `src/storage/localStorageToSqliteMigrationDryRun.ts` (dry-run only,
  never enabled).
- `src/storage/localStorageToSqliteMigrationApply.ts` (gated behind
  five conditions, returns `productionReady: false`).
- `src/storage/migrationRollbackRecovery.ts` (exists to recover from
  the SQLite experiment if anyone ever does enable it).

See Data Agent §4.2
([link](./ios-native-migration/agents/DATA_MODEL_REPAIR_AGENT.md))
for the full evidence and the canonical Swift implementation shape.

## 10. Cloud sync migration strategy

The iOS V1 cloud sync is **explicit-action-only**, **no background
sync**, **no silent overwrite**, **no silent retry**, **no
partial-AppData upload**. It reuses the same Supabase project and the
same `cloud_appdata_snapshots` table as the PWA.

### 10.1 What is preserved verbatim

- **Wire shape** (Contract Freeze §5): one table, 11 columns, RLS
  `using (owner_user_id = auth.uid())`, append-only.
- **FNV-1a 32-bit hash** over `stableStringify(appData)` —
  byte-identical between TS and Swift (gated by
  `AppDataSnapshotHashParityTests` in iOS-3).
- **V3 upload eligibility guard** —
  `ensureCloudUploadEligible({appData, source, snapshotKind})` MUST be
  consulted before every upload; `ok: false` disables the button.
- **V4 subsequent-upload** — `expectedPreviousHash` plumbed end-to-end.
- **V5 fresh-read preflight** — **mandatory** on iOS V1 (stricter than
  the TS web build's optional path). The Swift contract refuses to
  write without it.
- **Conflict semantics** — `canAutoApply: false,
  manualResolutionRequired: true` always; 10 conflict types preserved
  (`local_newer / cloud_newer / both_changed / owner_mismatch /
  schema_mismatch / cloud_missing / local_missing /
  backend_primary_mismatch / session_account_mismatch /
  device_identity_mismatch`).

### 10.2 The 3 HIGH revisions absorbed

#### Revision H1 — Parity-fixture directory canonicalisation

The canonical fixture path is **`tests/fixtures/parity/`** (Agent 6
wins; the name "parity" generalises beyond iOS-only use). Agent 8's
original `tests/fixtures/ios-contract/` is **resolved against**.
Documented in:

- This Entry Gate §15 (Test / parity strategy) and
- `docs/IOS_NATIVE_MIGRATION_TASKS_V1.md` iOS-0 acceptance criteria
- `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` Contract #11

The script name is **`scripts/generate-parity-goldens.mjs`** (Agent
6's name); Agent 8's `scripts/export-ios-contract-fixtures.mjs` is
resolved against.

#### Revision H2 — `supabase-swift` SDK is DEFERRED-APPROVAL

Agent 4 recommends the official `supabase-swift` SDK
([report §4.1](./ios-native-migration/agents/CLOUD_SYNC_AUTH_AGENT.md)).
Agent 8 Stop Condition #10 — and the spirit of the user's "do not add
package dependencies" rule for this planning PR — forbids any SwiftPM
dependency without explicit user approval.

**Resolution**: this Entry Gate records the SDK as
**RECOMMENDED-PENDING-APPROVAL**. iOS-1 (Xcode Project Bootstrap) does
**NOT** add `supabase-swift`. iOS-7 (Explicit Cloud Sync) **cannot
start** until the user explicitly approves one of three paths:

- **Path A — Approve `supabase-swift` as the one allowed SwiftPM
  dependency.** Pros: official Keychain-backed storage, automatic
  GoTrue token refresh, security-reviewed crypto. Cons: external
  dependency, version-pin pain. iOS-7 plan doc records the approval
  verbatim.
- **Path B — Hand-roll GoTrue + REST in plain `URLSession` +
  `Codable`.** Pros: no third-party dependency. Cons: hand-rolling
  auth is security-sensitive; PKCE / token refresh / Keychain
  integration must be audited per bug.
- **Path C — Defer cloud sync entirely from V1.** Ship local-only iOS
  V1; cloud sync becomes V1.5 / V2. If chosen, iOS-7 is rescheduled
  and iOS-9 / iOS-10 ship without cloud sync (which means in-app
  account deletion is **NOT** required per H3, because no account is
  created in the app). Lowest-blocker path.

This is the **one outstanding decision** the user must make before
the iOS-7 planning PR opens. The choice is recorded in the iOS-7
planning doc and locked in.

#### Revision H3 — In-app account deletion is required if cloud sync ships in V1

App Store Guideline 5.1.1(v) requires in-app account deletion for any
app that supports account creation
([Security Agent §10](./ios-native-migration/agents/SECURITY_PRIVACY_AGENT.md)).
If H2 Path A or B is chosen (cloud sync ships in V1), the iOS app
**MUST** ship an in-app account deletion flow.

**Resolution**: H3 is absorbed into:

- iOS-7 acceptance criteria (Tasks V1 §iOS-7): "In-app account
  deletion entry under `设置 → 账号与同步 → 删除账号`; server-side
  Edge Function or `SECURITY DEFINER` Postgres function; receipt to
  `cloud_export_delete_requests`; client signs out; no soft-delete
  grace period in V1."
- iOS-10 App Store Readiness checklist (Tasks V1 §iOS-10): "In-app
  account deletion flow is shipped and verifiable by the App Store
  reviewer."
- Contract Freeze §5 (Cloud sync snapshot contract): "In-app account
  deletion is required when cloud sync ships in V1 (Guideline
  5.1.1(v))."

The server-side hook is Edge Function or `SECURITY DEFINER` Postgres
function. **No service-role key is shipped in the iOS bundle.**

### 10.3 What is forbidden

- No `BGTaskScheduler` / `BGAppRefreshTask` / `BGProcessingTask`
  (Stop Condition #2; static guard on `import BackgroundTasks`).
- No silent push (`content-available: 1`) triggering a sync.
- No `URLSession` background config for snapshot uploads.
- No `applicationDidEnterBackground` / `applicationDidBecomeActive`
  hook that schedules an upload.
- No auto-resolve of a conflict by picking newer/older.
- No silent retry on `cloud_unavailable` / `remote_unavailable`.
- No `UIAlertController` modal on sync failure (banner / inline row
  only).
- No `update` / `delete` on `cloud_appdata_snapshots` from the client
  (table is append-only).
- No service-role key in the iOS bundle (build-phase scan blocks
  JWT-shaped strings, `sk_*`, `sb_secret_*`, `SUPABASE_SERVICE_ROLE_KEY`,
  `AIza*`).

## 11. Data Health migration strategy

The PWA's Data Health system has three layers — **Runtime Guard**
(pure, derived `CleanAppDataView`), **Safe Auto Repair** (mutating with
backup + ledger + receipt), and **Audit Only** (detection without
rewrite). All three are preserved verbatim on iOS.

### 11.1 What carries over

- `CleanAppDataView` (`src/dataHealth/cleanAppDataView.ts:86`) — pure
  function that returns a *view* on AppData; never mutates.
- `AutoRepairOrchestrator`
  (`src/dataHealth/autoRepairOrchestrator.ts:62`) — backup-first →
  safe-auto repair → receipt + ledger; runs at app launch via a
  background detached task; never blocks the UI.
- Repair ledger (cap 1000, 24h idempotency window) at
  `src/dataHealth/appDataRepairLedger.ts`.
- Repair receipts (cap 500) at `src/dataHealth/appDataRepairEngine.ts:10`.
- 9 V1 repair recipes in `src/dataHealth/repairs/`.
- Backup-first rule: "The orchestrator never mutates if the backup
  write fails" — load-bearing.
- Ledger + receipts live inside `AppData.settings.*` (open-bag).
  Therefore the PWA↔iOS handoff automatically carries the full repair
  history without a separate sync step.

### 11.2 CleanAppDataView + AutoRepairOrchestrator on iOS launch

Swift `AppLaunchSequence` (Data Agent §7.2):

```swift
@MainActor
final class AppLaunchSequence {
    func didFinishLaunching() async {
        let loaded = try AppDataStore.shared.load()
        let cleanView = buildCleanAppDataView(loaded)         // pure
        AppState.shared.adopt(loaded, cleanView: cleanView)

        Task.detached(priority: .utility) {
            let result = await AutoRepairOrchestrator.shared.run(
                appData: loaded,
                triggeredBy: .boot,
                registry: AppDataRepairRegistry.shared,
                backupAdapter: FileBackupAdapter.shared,
                now: Date.init)
            if result.changed {
                await MainActor.run {
                    AppState.shared.adopt(result.appData,
                                          cleanView: buildCleanAppDataView(result.appData))
                    try? AppDataStore.shared.save(result.appData)
                }
            }
        }
    }
}
```

The clean view is constructed **before** TrainingDecision sees
anything. The orchestrator runs in the background; if it changes
AppData, the cleaned view is rebuilt and re-adopted.

### 11.3 What is forbidden

- No silent rewrite without backup-first.
- No popup / modal / alert on repair completion — passive status line
  only.
- No reapply of a repair whose `idempotencyKey` matches a ledger
  entry within 24h.
- No direct calls to individual repair `apply` methods from production
  code outside the orchestrator path.
- No removing completed sessions, sets, body weights, recommendation
  snapshots, program adjustment history, pain history, or PR/e1RM
  history (Data Agent §9.5 deletion-banned list).
- No deletion of the live snapshot file as a side-effect.

## 12. TrainingDecision migration strategy

The TrainingDecision V2 contract (Contract Freeze §2) is preserved
verbatim. `buildTrainingDecision(input) → TrainingDecision` is the
**sole final-decision owner** for every per-surface user-facing
payload. The 9 hard-deleted legacy engines (PR #384) MUST NOT be
re-introduced.

### 12.1 What carries over

- `decisionVersion = 'v2'` constant at
  `src/engines/trainingDecisionTypes.ts:429`.
- AR-1..AR-9 arbitration precedence (severe override > reentry
  override > role-floor > min-not-product > weekly cap > AR-5 triplet
  suppression).
- `ROLE_FLOORS_REENTRY` (main 2, secondary 2, accessory 1,
  isolation 1) at `src/engines/trainingDecisionEngine.ts:89`.
- Gap state machine (0–3 / 4–7 / 8–13 / 14–27 / 28+ days) at
  `src/engines/effectiveTrainingPhaseEngine.ts:140`.
- `userFacing.{today, plan, training, focus, progress, record,
  explanation}` payloads — typed Swift structs with closed enums per
  reason code.
- `hiddenDebugSignals.arbitrationTrace: [String]` — dev-only, but
  **parity tests assert byte-equality** (Cross-review revision M4).
- Four-ID exercise identity (`originalExerciseId / actualExerciseId /
  displayExerciseId / recordExerciseId`) preserved.

### 12.2 CleanInputContract Swift mirror

The TS Symbol brand (`'ironpath.trainingDecision.cleanInput.v1'`)
becomes a stricter **compile-time Swift enforcement**:

- `CleanTrainingDecisionInput` has a `fileprivate init`.
- The single sanctioned construction site is
  `TrainingDecisionInputFactory.make(from cleanView:
  CleanAppDataView, metadata:)` in the same file.
- Therefore raw `AppData` **cannot reach** `buildTrainingDecision` at
  compile time, not just at runtime.

This is **stronger than the TS brand** (which is runtime-only). Take
the win.

### 12.3 Copy strategy

The Chinese user-facing copy strings in `userFacing.*` payloads are
**re-derived in Swift from a localised `Strings.swift` table** —
not literal-translated from the TS inlined helpers. This is Agent 2's
recommendation
([report §3a row 98](./ios-native-migration/agents/TS_CORE_LOGIC_AGENT.md)):
"Re-derive from tests in Swift, do not literal-translate." The
2,097-LOC `trainingDecisionEngine.ts` is too copy-tangled to
transliterate cleanly; the engine returns reason codes + numeric
outputs, and the strings come from `IronPathL10n`.

### 12.4 What is forbidden

- No second decision path (e.g. a "Plan tab computes its own
  recommendation"). The V1 BLOCKING bug.
- No re-derivation of user-facing copy at the View layer. Views
  consume `decision.userFacing.{surface}` and render.
- No collapse of the four-ID exercise identity (PR / e1RM /
  effective-set keying uses `recordExerciseId`, NOT
  `originalExerciseId`).
- No change to the effective-set scoring constants (Product Agent §3.4 /
  §5.3).
- No re-introduction of any of the 9 hard-deleted legacy engine names
  (grep guard).
- No skipping of `hiddenDebugSignals.arbitrationTrace` — parity tests
  rely on it.

## 13. UI module mapping

Five tabs in **this exact order** (Architecture Agent §6.1; cross-confirmed
by Product Agent §6 and Cross-review §14 #20):

```
TabView (tag: TabID)
├── .today        今日       SF Symbol: flame         → NavigationStack { TodayScreen }
├── .train        训练       SF Symbol: dumbbell      → NavigationStack { TrainingScreen, PostSummaryScreen }
│                                                       + .fullScreenCover(FocusModeScreen)
├── .history      历史       SF Symbol: calendar.days → NavigationStack { HistoryListScreen, SessionDetailScreen }
├── .progress     进步       SF Symbol: book.open     → NavigationStack { ProgressScreen, PlanSubview, AssessmentSubview, RecordsSubview }
└── .settings     设置       SF Symbol: person.crop.circle → NavigationStack { SettingsRootScreen, AccountAndSyncScreen, HealthDataScreen, BackupRecoveryScreen, ThemeScreen, EquipmentProfileScreen, DiagnosticsScreen, AboutScreen }
```

### 13.1 Notable navigation choices

- **Plan as a sub-route of Progress** (not a 6th tab). This honours
  the PWA's evolved UI (`progressMode = 'metrics' | 'plan'`). Recorded
  as an intentional choice with rollback path per Cross-review M9 — if
  a future agent wants to split Plan into a top-level tab, that is a
  new V2 task with its own planning doc.
- **Focus Mode as `.fullScreenCover`** (not a `NavigationStack` push).
  The tab bar disappears automatically with `.fullScreenCover`. This
  matches R2's "bottom nav must not compete with Focus Mode"
  requirement without inventing a hidden-tab-bar hack.
- **`NavigationStack` per tab** (not a single global one). Each tab
  has its own back stack; this matches iOS Human Interface Guidelines
  for tabbed apps.

### 13.2 No iPad / Mac / Watch / Vision Pro in V1

iPhone only, portrait only. iOS 17.0 minimum (Architecture Agent
§11.1 + Cross-review M8). Single locale: zh-Hans (Architecture Agent
§11.2; the `Localizable.strings` slot is wired but only zh-Hans is
populated in V1).

## 14. HealthKit strategy

Live HealthKit read replaces the PWA's XML import path. Read-only.
Minimum scope. Lazy permission request. The XML import is **not
ported to V1** (P2 reserved per Architecture Agent §8.4).

### 14.1 Read type set (frozen — Contract Freeze §10)

| iOS-native HealthKit type | Source identifier | Used for |
|---|---|---|
| `HKQuantityType(.restingHeartRate)` | `HKQuantityTypeIdentifierRestingHeartRate` | Readiness |
| `HKQuantityType(.heartRateVariabilitySDNN)` | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | Readiness |
| `HKQuantityType(.heartRate)` | `HKQuantityTypeIdentifierHeartRate` | Activity load |
| `HKQuantityType(.stepCount)` | `HKQuantityTypeIdentifierStepCount` | Activity load |
| `HKQuantityType(.activeEnergyBurned)` | `HKQuantityTypeIdentifierActiveEnergyBurned` | Activity load |
| `HKQuantityType(.appleExerciseTime)` | `HKQuantityTypeIdentifierAppleExerciseTime` | Activity load |
| `HKQuantityType(.bodyMass)` | `HKQuantityTypeIdentifierBodyMass` | Bodyweight series |
| `HKQuantityType(.bodyFatPercentage)` | `HKQuantityTypeIdentifierBodyFatPercentage` | Composition trend |
| `HKQuantityType(.vo2Max)` | `HKQuantityTypeIdentifierVO2Max` | Conditioning trend |
| `HKCategoryType(.sleepAnalysis)` | `HKCategoryTypeIdentifierSleepAnalysis` | Readiness |
| `HKWorkoutType.workoutType()` | implicit | External workouts |

### 14.2 Info.plist strings

`NSHealthShareUsageDescription` (REQUIRED — we read from Health):

- **简体中文**: `IronPath 会从 Apple 健康读取你的训练、体重、心率、HRV、睡眠、步数和活动能量，用来根据你当前的恢复状态调整今天的训练强度。除非你主动开启可选的云同步，否则这些健康数据只保存在你的设备上。`
- **English**: `IronPath reads your workouts, body weight, heart rate, HRV, sleep, steps, and active energy from Apple Health so it can adjust today's training load to your recovery and progress. Your Health data stays on your device unless you turn on optional cloud sync.`

`NSHealthUpdateUsageDescription` (OMITTED in V1 — no write access
needed). If iOS-side reviewers ever see
`NSHealthUpdateUsageDescription` in our Info.plist without a
corresponding write-type request, that's a red flag — remove it.

Other privacy-relevant `Info.plist` keys: NSCameraUsageDescription
(absent), NSPhotoLibraryUsageDescription (absent),
NSMicrophoneUsageDescription (absent), NSLocationWhenInUseUsageDescription
(absent), NSMotionUsageDescription (absent), **NSUserTrackingUsageDescription
(absent — must remain absent)**.

### 14.3 Authorisation flow

- Triggered **only** from Settings → Health Data screen, never on
  cold boot.
- A pre-prompt explainer screen renders before the system sheet (Apple
  does not show our explainer in the system sheet, so we must show it
  ourselves).
- The decision is cached in `UserDefaults` only as a "user has been
  asked once" flag; the **real** state lives in HealthKit itself
  (`currentAuthorizationStatus`).

### 14.4 Fetch model

- Pull-on-demand, **not push**. The Today screen view model calls
  `healthKit.fetchDailyMetrics(today...today)` when the user opens
  Today and the last fetch is older than N minutes.
- **No `HKObserverQuery`**. **No background delivery.** **No
  `com.apple.developer.healthkit.background-delivery` entitlement.**

## 15. Test / parity strategy

The parity strategy: every Swift module that owns a piece of
recommendation, data-repair, or cloud-write logic has a paired test
that runs the same input through both runtimes and compares outputs.

### 15.1 Canonical fixture directory (Cross-review H1)

```
tests/fixtures/parity/
  inputs/         # input JSON, one per scenario
  golden/         # expected output JSON from the TS engine
  README.md       # fixture index + privacy statement + regen instructions
```

This is the canonical path. Agent 8's original
`tests/fixtures/ios-contract/` is resolved against.

### 15.2 Generator + check mode

- `scripts/generate-parity-goldens.mjs` — Node script that reads
  inputs and writes goldens; `--check` mode for CI.
- `tests/parity/parityFixturesGenerationConsistency.test.ts` — CI
  guard.
- Privacy guard `tests/fixturePrivacyGuard.test.ts` extended to scan
  the new directory.

### 15.3 Swift parity layer

- XCTest as the host (not Quick / Nimble).
- `pointfreeco/swift-snapshot-testing` for Codable golden snapshots.
- `IronPathDomain` builds for macOS, so `swift test` on macOS finishes
  in seconds — keeps the parity loop tight.
- The 5 P0-critical parity tests (Cross-review §14 + QA §4):
  1. `AppDataSnapshotHashParityTests.swift`
  2. `AppDataMigrationParityTests.swift`
  3. `AppDataSanitizeParityTests.swift`
  4. `CleanAppDataViewParityTests.swift`
  5. `TrainingDecisionEngineParityTests.swift` (must assert
     `arbitrationTrace` byte-equal — M4).
- Plus 9 `DataRepair<Name>ParityTests` for the V1 repairs.

### 15.4 Manual iPhone smoke (12 flows)

QA Agent §7 lists 12 manual iPhone smoke flows that must pass on a
real iPhone before TestFlight (Flow 1 install + first launch, …,
Flow 12 forbidden-copy scan on the device build). The same checklist
forms the body of `IOS_9_TESTFLIGHT_TEST_PLAN.md` (created in iOS-9).

### 15.5 Forbidden-copy scan

Per `tests/trainingDecisionHardRewriteForbiddenCopyScan.test.ts`, the
4 Chinese phrases (`力量有进步`, `恢复压力偏高`, `下次建议保持重量`,
`本周先控制风险`) MUST NOT appear in the compiled `.app` bundle.
Enforced by `tests/iosForbiddenCopyScanGuard.test.ts` (`xcrun strings`
scan of the shipped resources).

## 16. Security / privacy strategy

**Default: nothing leaves the device.**

- **No analytics SDK** (no Sentry, no Crashlytics, no Firebase, no
  Mixpanel, no Amplitude, no Segment, no PostHog, no Adjust, no
  AppsFlyer, no Google Analytics, no Meta SDK). Stop Condition #7 +
  static guard.
- **No background sync** (no `BGTaskScheduler` / `BGAppRefreshTask` /
  silent push / `URLSession` background config). Stop Condition #2 +
  static guard on `import BackgroundTasks`.
- **No tracking** (no IDFA, no `NSUserTrackingUsageDescription`, no
  ATT prompt). Apple App Privacy section: **Data Used to Track You =
  NONE**.
- **No advertising SDKs.** Health data may not be used for advertising
  (App Review 5.1.1(ii)).
- **No `MetricKit` opt-in for remote transmission** unless an explicit
  per-user opt-in toggle is added later.
- **Account deletion in-app** if cloud sync ships in V1 (H3 — App
  Review Guideline 5.1.1(v)). Single-tap path from in-app.
  Server-side via Edge Function or `SECURITY DEFINER` Postgres
  function. No service-role key on the client.
- **`ITSAppUsesNonExemptEncryption = NO`** in `Info.plist`
  (Security Agent §9). HTTPS via `URLSession`, Keychain via
  Security.framework — both exempt under §740.17(b)(2). No ERN
  required.
- **Sign in with Apple is NOT required** in V1 (no third-party OAuth
  provider wired — only email/password via GoTrue; App Review 4.8 only
  triggers when a third-party login is offered).

### 16.1 Logging policy

A log line is acceptable iff every field is one of: a stable enum from
a closed allow-list, a non-secret content hash truncated to ≤ 8 hex
chars, a count, a duration in ms, a boolean, an `operationId` /
`requestFingerprint`, an ISO timestamp, or a build identifier. **Never
log AppData payloads, HealthKit samples, free-text user content,
identity values, localStorage contents, or repair receipt `before` /
`after` blobs.** Mirror of `src/observability/redaction.ts` and
`src/cloudProduction/monitoringAuditAdapterCandidate.ts` deny-lists.

### 16.2 Secrets handling

- iOS bundle contains at most the Supabase project URL and the **anon
  key** (which is public-by-design; RLS protects rows).
- **No service-role key.** Build-phase script fails on any literal
  that looks like a service-role JWT, `sk_*`, `sb_secret_*`,
  `SUPABASE_SERVICE_ROLE_KEY`, or `AIza*`.
- Local-only secrets (per-install device ID): generated client-side,
  stored in Keychain with
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, never synced to
  iCloud, never logged.

## 17. Roadmap

Full task definitions live in
`docs/IOS_NATIVE_MIGRATION_TASKS_V1.md`. The 11 tasks
(iOS-0 through iOS-10) are sequenced as:

```
                                          iOS-0
                                  (Contract Fixture Export V1)
                                            │
                                            ▼
                                          iOS-1
                                  (Xcode Project Bootstrap V1)
                                            │
                                            ▼
                                          iOS-2
                                   (AppData Swift Models V1)
                                            │
                            ┌───────────────┴───────────────┐
                            ▼                               ▼
                          iOS-3                     (iOS-2 also enables iOS-4
                  (Data Health Swift Port V1)        but iOS-4 needs iOS-3 too)
                            │
                            ▼
                          iOS-4
                  (TrainingDecision Swift Port V1)
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
              iOS-5                   iOS-6
        (Native Focus Mode      (Plan / History /
            MVP V1)              Progress Native
                │                   Screens V1)
                │                       │
                └───────────┬───────────┘
                            ▼
                ┌───────────┴───────────┐
                ▼                       ▼
              iOS-7                   iOS-8
       (Explicit Cloud           (HealthKit
         Sync iOS V1)             Adapter V1)
                │                       │
                └───────────┬───────────┘
                            ▼
                          iOS-9
                  (TestFlight Internal
                    Acceptance V1)
                            │
                            ▼
                         iOS-10
                  (App Store Readiness V1)
                            │
                            ▼
                       [App Review]
                            │
                            ▼
                       [Public App Store]
```

Parallelisation rules:
- iOS-0 → iOS-1 → iOS-2 are strictly sequential.
- iOS-3 and iOS-4 may open in parallel once iOS-2 is merged; iOS-4
  cannot merge until iOS-3 is merged.
- iOS-5 and iOS-6 may develop in parallel once iOS-4 is merged.
- iOS-7 and iOS-8 may develop in parallel once iOS-5 is merged
  (Cross-review M7).
- iOS-9 is strictly after iOS-3 + iOS-4 + iOS-5 + iOS-6 + iOS-7 +
  iOS-8 all merged.
- iOS-10 is strictly after iOS-9 merged.

**Earliest usable iPhone build** = iOS-0 + iOS-1 + iOS-2 + iOS-3 +
iOS-4 + iOS-5 (log a real set on a real device).

## 18. Stop conditions

These are the explicit halt-and-rethink triggers. Every iOS-N PR
re-checks them. Static-guard tests enforce most of them in CI.

1. **iOS V1 MUST NOT ship a WebView wrapper of the existing PWA as
   its final architecture.**
2. **iOS V1 MUST NOT enable background sync by default.**
3. **iOS V1 MUST NOT feed raw AppData into TrainingDecision — only
   CleanAppDataView equivalents.**
4. **iOS V1 MUST NOT upload partially-repaired AppData.**
5. **iOS V1 MUST NOT silently overwrite cloud snapshots on conflict.**
6. **DO NOT create an Xcode project before iOS-0 Contract Fixture
   Export V1 is green.**
7. **DO NOT add any third-party SwiftPM dependency (including
   `supabase-swift`) without explicit user approval.**
8. **DO NOT add Sentry / Crashlytics / analytics SDKs without
   explicit user approval.**
9. **DO NOT request HealthKit write permission unless a feature
   actually writes back.**
10. **DO NOT ship cloud sync in V1 without an in-app account deletion
    flow.**
11. **DO NOT use `gh pr merge --admin` to bypass branch protection.**

If a stop condition trips during a PR review:

- The PR is blocked.
- A new planning PR is opened in the form of
  `docs/ios-native-migration/IOS_N_*_STOP_CONDITION_*.md` explaining
  the trigger.
- The program owner decides whether to revise the stop condition
  (rare) or revise the offending PR (default).
- No code merges until the stop condition is reconciled.

## 19. Risks (program-level, top 6)

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Over-scoping V1** — temptation to land a "V1.5" feature mid-V1 (e.g. rest timer with HealthKit HR overlay, Apple Watch companion, push notifications) that delays App Store. | Every iOS-N task has explicit non-goals. Anything outside them is a separate V2 task with its own planning doc. Per-PR merge checklist re-verifies the task's non-goals are honoured. |
| 2 | **TS / Swift output drift** — as TS engines evolve, the Swift port falls behind silently. | iOS-0 fixtures versioned with the source commit SHA; static guard test fails if Swift output diverges from the golden. A "Swift port refresh" PR opens whenever the TS engine moves materially. CI `--check` mode on the generator. |
| 3 | **Cloud-sync receipt hash incompatibility** between PWA `JSON.stringify` and Swift `JSONEncoder`. | Agent 3 + Agent 4 collaborate on a canonical JSON form (sorted keys, no trailing spaces, fixed decimal precision). Golden test takes a known `AppData` and asserts the Swift-computed hash equals the TS-computed hash. This test **gates the cloud-sync work in iOS-7**. ISO timestamps stored as `String`, never `Date`. |
| 4 | **HealthKit / App Store review rejection** — most common fitness-app rejection cause is vague HK descriptions or unused HK scopes. | Stop Conditions #8 / #9 + per-PR static guards; iOS-10 reviewer notes doc explains HK usage in plain language; per-scope user benefit cited; no `NSHealthUpdateUsageDescription`; no background HK observers. |
| 5 | **Premature SwiftData / Core Data introduction.** | Stop Condition #9 (SwiftData / Core Data forbidden in iOS-1 through iOS-3). Static guard on `@Model` / `@Observable` annotations on model types in iOS-2. JSON-file with measurable escalation thresholds (§9.2) is the V1 default. |
| 6 | **Account deletion gap if cloud sync ships in V1** (Guideline 5.1.1(v)). | Cross-review H3 absorbed into iOS-7 acceptance + iOS-10 readiness checklist + Contract Freeze §5. Server-side via Edge Function / `SECURITY DEFINER` function (no service-role key on client). If H2 Path C is chosen (defer cloud), the deletion requirement is auto-removed because no account is created. |

Additional documented risks (not program-blocking but tracked):

- SwiftUI navigation pitfalls (Architecture Agent §13.2).
- Framework lock-in to SwiftUI `@Observable` (Architecture §13.3 —
  acceptable because the pure modules are framework-agnostic).
- Golden parity test rot (Architecture §13.4).
- HealthKit authorisation revocation (Architecture §13.6).
- Migration distracts from PWA stability (Program Manager §11.9 — iOS
  PRs do NOT touch `src/`, `apps/api/`, `tests/` except for fixture
  export and static guards).
- PR review bottleneck (Program Manager §11.8).

## 20. Final recommendation

**APPROVE the iOS Native Migration Entry Gate V1**, conditional on
resolving Cross-review Revision H2 (the `supabase-swift` SDK decision)
before iOS-7 (Explicit Cloud Sync iOS V1) opens its planning PR. The
3 HIGH revisions (H1 fixture path, H2 SDK approval, H3 in-app account
deletion) are absorbed verbatim into this Entry Gate, the Tasks doc,
and the Contract Freeze doc. The 7 MEDIUM / LOW revisions are
absorbed in the relevant sections. Implementation is unblocked for
iOS-0 (Contract Fixture Export V1) once this docs-only PR merges and
the program owner provides written sign-off.

---

End of Entry Gate V1.
