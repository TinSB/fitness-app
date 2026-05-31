# iOS Today — Real AppData Read Path V1

**Baseline commit:** `b8a6067` (latest `origin/main`, HK-3b WorkoutBuilder migration merged)
**Branch:** `today-real-appdata-read` (no worktree; never committed to `main`)
**Predecessor:** iOS-17C Plan + Today Read-only Surface V1 (#424) — supersedes its §3.3
("deterministic sample, no canonical-AppData read path yet"). W-1/§27 explicitly
anticipated this: *"real-data snapshot once a canonical read path lands."*

Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`. This slice is a
§19.2 (extend an active package with pure logic) + §19.3 (improve the thin app layer)
change. **Source-of-truth impact: none (read-only). Data-safety impact: none (no write).**

---

## 1. Goal

Build the **first native canonical-AppData READ-for-display path**. The 今日 (Today)
surface stops rendering a fixed deterministic sample and instead shows the user's
**real on-device readiness**, computed from their own canonical `AppData` —

```
canonical AppData store (Application Support / IronPathAppData, the §8 source of truth)
   → load() (read-only)
   → buildCleanAppDataView            (IronPathDataHealth — the §10 chokepoint)
   → createCleanTrainingDecisionInput (mints the branded CleanTrainingDecisionInput)
   → buildTrainingDecisionFromCleanInput (the §11 engine — read, never changed)
   → TodayReadinessSummary            (pure presenter, already shipped by iOS-17C)
```

It is **read-only**: no new write path, no `save`, no source-of-truth move, no engine
change, no golden touched.

## 2. Scope (what is in)

| File | Change |
| --- | --- |
| `ios/packages/IronPathTrainingDecision/Sources/IronPathTrainingDecision/TodayRealReadiness.swift` | **New.** Pure `TodayAppDataLoadOutcome` / `TodayReadinessState` + `resolveTodayReadinessState(_:now:)` — the testable branch logic that routes a loaded document through the clean view before the engine. |
| `ios/packages/IronPathTrainingDecision/Tests/IronPathTrainingDecisionTests/TodayRealReadinessTests.swift` | **New.** 6 branch unit tests (missing / unreadable / loaded-empty / loaded-with-history / real-status-flows / determinism). |
| `ios/IronPath/TodayRootView.swift` | Reworked: inlines the thin `@MainActor TodayRealDataModel` (store wiring + the only IO seam) and renders three honest states (ready / empty / unavailable). Now feeds the widget the REAL readiness when available. |
| `docs/ios-native-migration/IOS_TODAY_REAL_APPDATA_READ_V1.md` | This document. |
| `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` | Minimal §27 milestone row + a one-line §5 note that a native read-for-display path now exists (per §1.1 same-PR doc update; no binding rule changed). |

No other RootView, the shell (`ContentView`), `FocusMode*`, any persistence **write**
path, `project.pbxproj`, `package.json` / lockfile, or any stub package is touched.

## 3. Architecture decisions

### 3.1 Package home — `IronPathTrainingDecision`, additive only
The pure transform + branch resolver live in a **new file** in the already-active
`IronPathTrainingDecision` package (it already depends on `IronPathDomain` +
`IronPathDataHealth`, owns `TodayReadinessSummary`, and hosts the clean-input factory).
This is a §19.2 extension: **no engine algorithm and no parity golden is modified** —
the full package suite (golden / parity / shape-stability) stays green, proving engine
output is unchanged. The resolver only *orchestrates* already-shipped functions.

### 3.2 DataHealth gating is mandatory (§10/§11)
`resolveTodayReadinessState(.loaded(appData), now:)` calls `buildCleanAppDataView`
**first** and feeds the engine **only** the branded `CleanTrainingDecisionInput` minted
from that clean view. **Raw `AppData` never reaches the engine.** This is enforced
structurally: the engine entry (`buildTrainingDecisionFromCleanInput`) accepts only the
branded input type, whose initializer is `fileprivate` to the package.

### 3.3 Determinism preserved (§11.2) — injected instant
The engine and the DataHealth guard are deterministic; this read layer keeps them so.
The instant is **injected** (`now`): both the `FixedRuntimeGuardClock` for the clean
view and the engine's `nowIso` derive from the same `Date`, never an ambient `Date()`
inside the pure resolver. The running app injects the real wall clock at the loader
seam (the impure edge), mirroring `FocusModeMvpState.useSystemClock()`; previews/tests
inject a fixed instant. UTC ISO-8601 keeps the whole pipeline on the codebase's
UTC-day convention.

### 3.4 Honest states (§15.4) — first launch / empty / unreadable
The loader maps the read to one of three outcomes; the resolver maps those to three
honest rendered states:

| Outcome (app-layer loader) | State | Surface |
| --- | --- | --- |
| no canonical file yet (first launch) / no live source | `.empty` | "还没有训练数据" + explanation + 前往「训练」 |
| a document loads but has **no cleaned training history** | `.empty` | same — no real baseline to compute readiness from |
| a document exists but **cannot be loaded/decoded** | `.unavailable` | "暂时无法读取数据" — honest degrade + 重试; the document is **left untouched** |
| a document loads **with** cleaned history | `.ready(summary)` | the real readiness + status cards |

No fabricated readiness is ever shown. The empty-history → `.empty` gate is deliberate:
readiness / intent / phase / risk are history-derived, so with zero cleaned sessions the
engine's bare defaults are not presented as a "result."

### 3.5 Data safety — read-only, never overwrite the unreadable
This path **never writes**: there is no `save`, no `backup`, no candidate build. A
present-but-**unreadable** document maps to `.unavailable` and is left exactly as it is
on disk — the same "never destroy unparseable user data" stance the write path takes
(§8.1), reached here by simply never writing. The open-bag / schema / canonical document
are untouched.

### 3.6 App layer stays thin (§5/§15) — inlined model, no pbxproj edit
The `@MainActor TodayRealDataModel` is **inlined in `TodayRootView.swift`** (an
already-registered file) rather than a new file, so **`project.pbxproj` is untouched** —
following the N-2 / HK-2 / HK-3 precedent (the iOS-17S contract reserves pbxproj for the
shell-owning slice). The model owns ONLY wiring + the IO seam: it opts the running app
into the **same** sanctioned store the `CanonicalSessionWriter` writes
(`JSONFileAppDataStore.applicationSupport()`), delegates the load to the store (it never
touches `FileManager`), and delegates the whole transform to the pure package resolver.
All branch logic is in the package and unit-tested; the view only renders.

### 3.7 Widget (W-1/W-2) now gets real readiness
The 今日 surface still publishes a **derived, read-only** readiness snapshot to the App
Group for the home-screen widget — but now the user's **real** readiness when a document
is ready, and **nothing** when empty/unavailable (the widget keeps its prior snapshot /
placeholder; no fabricated readiness). This is exactly the "real-data snapshot once a
canonical read path lands" that §27 anticipated. The widget remains read-only and never
a source of truth (§8/§12); `WidgetSnapshotWriterModel` is unchanged.

## 4. Boundaries

- **Forbidden systems:** none introduced. No CloudKit/iCloud/Supabase/HealthKit/
  URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData. The only IO is the
  existing sanctioned `JSONFileAppDataStore` read, delegated by the model.
- **Source-of-truth (§8):** untouched — the read does not move where canonical AppData
  lives, and adds **no write path**.
- **Data safety (§9):** untouched — no AppData mutation, no schema bump, no open-bag
  change, no timestamp change, no restore path; an unreadable document is never overwritten.
- **DataHealth (§10) / engine (§11):** raw AppData routed through the clean view before
  the engine; engine output unchanged; goldens not regenerated.
- **App layer (§5/§15):** stays thin — all branch logic + formatting is in the package;
  the model holds only the store seam + in-RAM `@Published` state.
- **pbxproj:** unchanged (new package files are SPM-auto-included; the new app-layer
  model is inlined into the already-registered `TodayRootView.swift`).
- **LocalSnapshot (§12):** untouched and not coupled to AppData.

## 5. Validation

Swift (local — CI does not build/test Swift, master §21.2):

| Check | Result |
| --- | --- |
| `swift test` — `IronPathTrainingDecision` | **149 tests, 0 failures** (6 new) — exit 0 |
| `xcodebuild … -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build` | **BUILD SUCCEEDED** — exit 0 |
| `xcodebuild … -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** — exit 0 |

TypeScript / repo (master §21.1 — no TS *source* touched; the 4 iOS TrainingDecision
static-guard suites that scan the Swift package DO gate this Swift change, so they were
run and are green):

| Check | Result |
| --- | --- |
| `npm run api:dev:build` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | **6904 passed** (1373 files) — exit 0 (incl. the 4 iOS TrainingDecision static-guard suites that assert the engine package never constructs the clean view) |
| `npm run build` | exit 0 |
| `git diff --check` | clean (exit 0) |
| `package.json` / `package-lock.json` | byte-unchanged |

> Engine output unchanged → **no parity golden regenerated** (the 10 training-decision
> goldens are intact; the Swift parity / shape-stability suites + the TS golden-count
> guard stay green). No `project.pbxproj`, `Package.swift`, or dependency change.

## 6. Real-device / simulator smoke (manual)

1. **First launch (no data):** fresh install → 今日 shows "还没有训练数据" + 前往「训练」.
   No crash, no fabricated readiness.
2. **After a real session:** complete + save a session (the iOS-17A write path) →
   relaunch / revisit 今日 → readiness + 今日状态 cards reflect the saved history and the
   stored `todayStatus` (not the old fixed sample).
3. **Unreadable document:** corrupt the on-disk `IronPathAppData/ironpath-appdata.json`
   → 今日 shows "暂时无法读取数据" + 重试; the file is **left untouched** (verify bytes
   unchanged); 重试 re-reads.
4. **Widget:** with real readiness, the home-screen widget shows the real summary; with
   no data, it keeps its placeholder.

## 7. Definition of Done

- [x] Today readiness + actions come from the user's real on-device canonical AppData,
      cleaned via DataHealth.
- [x] First launch / no file / unreadable → honest empty / degrade state; no crash, no
      overwrite.
- [x] Raw AppData never feeds the engine (always via `buildCleanAppDataView` → branded
      clean input).
- [x] No new write path; source of truth, engine, and goldens unchanged.
- [x] Branch logic unit-tested (6 new tests); both `xcodebuild` targets green.
- [x] No forbidden system, no other RootView, no `project.pbxproj` touched.
