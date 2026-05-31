# iOS Profile (我的) — Real AppData Read Path V1

**Baseline commit:** `bb1f643` (latest `origin/main`, *Today real-AppData read path V1* #437 merged)
**Branch:** `profile-real-appdata-read` (no worktree; never committed to `main`)
**Predecessor:** iOS-17B Profile Surface V1 — supersedes its "fixed deterministic
preview sample, no canonical-AppData read path yet." Reuses the **Today real-AppData
read path V1 (#437)** load→clean→resolve pattern for a second surface.

Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`. This slice is a
§19.2 (extend an active package with pure logic) + §19.3 (improve the thin app layer)
change. **Source-of-truth impact: none (read-only). Data-safety impact: none (no write).**

---

## 1. Goal

Switch the 我的 (Profile) surface from a fixed sample to the user's **real on-device
data**. It reads the user's own canonical `AppData` and renders the real
profile / units / screening / settings **plus the latest Apple-Health-imported body
weight** —

```
canonical AppData store (Application Support / IronPathAppData, the §8 source of truth)
   → load() (read-only)
   → buildCleanAppDataView         (IronPathDataHealth — the §10 chokepoint)
   → resolveProfileDisplayState    (IronPathDataHealth — pure branch resolver)
   → ProfileDisplayData            (IronPathDomain — pure read-model + derived latest body weight)
```

It is **read-only**: no new write path, no `save`, no source-of-truth move, no engine
change, no golden touched. It reuses the exact load→clean→resolve shape the Today read
path (#437) established, for a second surface.

## 2. Scope (what is in)

| File | Change |
| --- | --- |
| `ios/packages/IronPathDomain/Sources/IronPathDomain/ProfileDisplayData.swift` | **New.** Pure `ProfileDisplayData` read-model (the four Domain values + derived `latestBodyWeightKg`) + `latestBodyWeightKilograms(from:)` (mirrors TS `healthSummaryEngine.latestBodyWeightKg`) + `hasAnyContent` (honest empty-state signal). Foundation-only — Domain stays the leaf. |
| `ios/packages/IronPathDomain/Tests/IronPathDomainTests/ProfileDisplayDataTests.swift` | **New.** 16 unit tests: latest-body-weight selection (single / most-recent / lb→kg / excluded-filtered / all-excluded / missing value-or-startDate) + `hasAnyContent` branches. |
| `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/ProfileDisplayProjection.swift` | **New.** Pure `ProfileAppDataLoadOutcome` / `ProfileDisplayState` + `resolveProfileDisplayState(_:)` — the testable branch logic that reads the CLEANED view (`cleanedScreening` + `raw` scalars + the health-metric series). |
| `ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests/ProfileDisplayProjectionTests.swift` | **New.** 7 branch tests (missing / unreadable / loaded-empty / loaded-with-profile / reads-cleaned-screening / body-weight-only / determinism), AppData built in memory and run through the GENUINE `buildCleanAppDataView`. |
| `ios/IronPath/ProfileRootView.swift` | Reworked: inlines the thin `@MainActor ProfileRealDataModel` (store wiring + the only IO seam) and renders three honest states (ready / empty / unavailable). Adds a derived "最新体重（Apple 健康）" row. HealthKit import/export + rest/training reminder sections are unchanged. |
| `docs/ios-native-migration/IOS_PROFILE_REAL_APPDATA_READ_V1.md` | This document. |
| `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` | Minimal §27 milestone row + a one-line §5 note that the read-for-display path now also backs the 我的 surface (per §1.1 same-PR doc update; no binding rule changed). |

No other RootView, the shell (`ContentView`), `FocusMode*`, any persistence **write**
path, `project.pbxproj`, `package.json` / lockfile, any golden, or any stub package is
touched.

## 3. Architecture decisions

### 3.1 Package homes — additive only, import graph unchanged
- **Pure display logic → `IronPathDomain`** (where `ProfileDisplay` formatting already
  lives). `ProfileDisplayData` holds the four read-only Domain values + the derived
  `latestBodyWeightKg`, and answers `hasAnyContent`. It operates on Domain types only —
  no `CleanAppDataView`, no IO — so Domain stays the Foundation-only leaf (§6.3).
- **Outcome→state resolver → `IronPathDataHealth`** (the owner of `CleanAppDataView`,
  §10). Profile is **not** engine-related, so — unlike Today's resolver, which lives in
  `IronPathTrainingDecision` because it needs the engine — Profile's resolver lives here,
  keeping the import graph a DAG (`DataHealth → Domain` only; **no new edge**). This is a
  §19.2 extension: both files are new, no existing symbol changed, no golden touched.

### 3.2 DataHealth gating is mandatory + structural (§10)
`resolveProfileDisplayState` accepts a `ProfileAppDataLoadOutcome` whose `.loaded` case
carries a **`CleanAppDataView`** — so a caller **cannot** resolve a state without first
routing the document through `buildCleanAppDataView` (the §10 chokepoint). The gating is
structural, not a convention. The resolver reads the **CLEANED** screening
(`cleanView.cleanedScreening`, with capped issueScores / filtered performanceDrops),
never `raw.screeningProfile`; the other profile/unit/settings scalars and the
health-metric time series are read from `cleanView.raw` (the document that PASSED the
clean-view ingress) — **raw AppData is never displayed without passing through the clean
view first.** `test_loadedReadsCleanedScreening_notRaw` pins this structurally.

### 3.3 Latest body weight is DERIVED, not via the (unported) engine (§8.2)
HK-1 stores Apple-Health body weight as a `HealthMetricSample
{ metricType: "body_weight", unit: "kg" }` and **never** writes `userProfile.weightKg`
(the self-entered field). The PWA derives "current body weight" as the latest such sample
(`src/engines/healthSummaryEngine.ts` → `latestBodyWeightKg`). The native engine does
**not** port `healthSummaryEngine`, so — as scoped for this read-only slice — the latest
sample is selected **directly** in `ProfileDisplayData.latestBodyWeightKilograms`, not via
the engine. The rule mirrors the TS one: among `body_weight` samples that are not
`dataFlag == "excluded"` and carry both a `startDate` and a `value`, take the greatest
ISO-8601 `startDate` (`localeCompare`-equivalent) and normalize to kg (`lb` → kg via the
single `WeightConversion` home; `kg`/absent taken as-is). The surface shows it as a
distinct "最新体重（Apple 健康）" row, separate from the self-entered 体重, and only when
present (honest absence otherwise).

### 3.4 Honest states (§15.4) — first launch / empty / unreadable
The loader maps the read to one of three outcomes; the resolver maps those to three
honest rendered states:

| Outcome (app-layer loader) | State | Surface |
| --- | --- | --- |
| no canonical file yet (first launch) / no live source | `.empty` | "还没有个人资料" + explanation + 重试 |
| a document loads but has **no user-meaningful profile content** | `.empty` | same — no real profile/baseline to show |
| a document exists but **cannot be loaded/decoded** | `.unavailable` | "暂时无法读取资料" — honest degrade + 重试; the document is **left untouched** |
| a document loads **with** profile content (or a body weight) | `.ready(data)` | the real profile / units / screening / settings + latest body weight |

No fabricated profile is ever shown. `hasAnyContent` is the empty gate: a document with
zero profile fields, no screening, no unit preference, no user-meaningful setting, and no
imported body weight renders the honest empty state rather than a page of "未设置"
placeholders. Internal bookkeeping (schemaVersion / DataHealth ledgers) deliberately does
**not** count as content. A document with **only** an imported body weight is `.ready`
(honest — there is real data to show).

### 3.5 Data safety — read-only, never overwrite the unreadable
This path **never writes**: no `save`, no `backup`, no candidate build. A present-but-
**unreadable** document maps to `.unavailable` and is left exactly as it is on disk — the
same "never destroy unparseable user data" stance the write path takes (§8.1), reached
here by simply never writing. The open-bag / schema / canonical document are untouched.

### 3.6 App layer stays thin (§5/§15) — inlined model, no pbxproj edit
The `@MainActor ProfileRealDataModel` is **inlined in `ProfileRootView.swift`** (an
already-registered file) rather than a new file, so **`project.pbxproj` is untouched** —
following the N-2 / HK-2 / HK-3 / Today-read precedent (the iOS-17S contract reserves
pbxproj for the shell-owning slice). The model owns ONLY wiring + the IO seam: it opts the
running app into the **same** sanctioned store the `CanonicalSessionWriter` writes
(`JSONFileAppDataStore.applicationSupport()`), delegates the load to the store (it never
touches `FileManager`), and delegates the whole transform to the pure package resolver.
All branch logic is in the packages and unit-tested; the view only renders + formats (via
the existing `ProfileDisplay`). The display-unit toggle stays local UI state seeded once
from the loaded `UnitSettings` — it never writes back (storage stays kg).

### 3.7 Shared read path with Today
The load→clean step reuses the **same package-level primitives** as the Today read path
(#437): `JSONFileAppDataStore.applicationSupport()` (IronPathPersistence),
`buildCleanAppDataView` + `FixedRuntimeGuardClock` (IronPathDataHealth). The thin loader
mirrors `TodayRealDataModel` exactly; the pure `resolveProfileDisplayState` is the
Profile analogue of `resolveTodayReadinessState`. Today's loader is left untouched (no
shared-file extraction was needed: the orchestration is ~6 lines and the iOS-17S
parallel-line contract keeps each RootView self-contained), so there is **zero regression
surface on the 今日 tab**.

## 4. Boundaries

- **Forbidden systems:** none introduced. No CloudKit/iCloud/Supabase/HealthKit/
  URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData. The only IO is the
  existing sanctioned `JSONFileAppDataStore` read, delegated by the model.
- **Source-of-truth (§8):** untouched — the read does not move where canonical AppData
  lives, and adds **no write path**. The latest body weight is **derived** (latest
  sample), never written into `userProfile.weightKg`.
- **Data safety (§9):** untouched — no AppData mutation, no schema bump, no open-bag
  change, no timestamp change, no restore path; an unreadable document is never overwritten.
- **DataHealth (§10):** the document is routed through `buildCleanAppDataView` before
  display; the cleaned screening is what is shown; raw AppData never bypasses the chokepoint.
- **Engine (§11):** untouched — the Profile surface does not call the engine; no golden
  regenerated (the full `IronPathTrainingDecision` suite stays green, proving it).
- **App layer (§5/§15):** stays thin — all branch logic + formatting is in the packages;
  the model holds only the store seam + in-RAM `@Published` state.
- **pbxproj:** unchanged (new package files are SPM-auto-included; the new app-layer
  model is inlined into the already-registered `ProfileRootView.swift`).
- **LocalSnapshot (§12):** untouched and not coupled to AppData.

## 5. Validation

Swift (local — CI does not build/test Swift, master §21.2):

| Check | Result |
| --- | --- |
| `swift test` — `IronPathDomain` | **106 tests, 0 failures** (16 new) — exit 0 |
| `swift test` — `IronPathDataHealth` | **112 tests, 0 failures** (7 new) — exit 0 |
| `swift test` — `IronPathTrainingDecision` (golden/parity proof, unchanged) | **149 tests, 0 failures** — exit 0 |
| `xcodebuild … -scheme IronPath -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** — exit 0 |
| `xcodebuild … -scheme IronPathWidgetExtension -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** — exit 0 |

TypeScript / repo (master §21.1 — no TS *source* touched; the iOS static-guard suites
that scan the Swift packages + app layer DO gate this Swift change, so they ran):

| Check | Result |
| --- | --- |
| `npm run api:dev:build` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` (vitest, incl. all iOS static guards) | **1373 files / 6904 tests passed** — exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0 |

Dependencies unchanged (`npm ci` from the existing lockfile; no `package.json` /
lockfile edit). No parity golden regenerated.

## 6. Device smoke (manual, on-device — not automated)

1. **Fresh install / no canonical file:** open 我的 → the profile area shows the honest
   **empty** state ("还没有个人资料" + 重试); the HealthKit + reminder sections still appear.
   Nothing crashes, nothing is written.
2. **Import a body weight (HK-1):** tap "从 Apple 健康导入最新体重", authorize, import →
   tap 重试 (or re-open the tab) → the profile area becomes **ready** and a
   "最新体重（Apple 健康）" row appears with the imported kg (respecting the kg/lb toggle).
   This proves the HK-1 imported weight is really displayed.
3. **Real profile present** (a document written by the PWA / a future native editor):
   open 我的 → real name / sex / age / height / weight / level / goal / screening /
   settings render; the unit toggle flips kg↔lb for both weights with no data write.
4. **Unreadable document:** with a deliberately corrupt canonical file, open 我的 → the
   **unavailable** degrade state appears, the file is left untouched on disk (re-openable
   by the PWA), and 重试 re-reads without overwriting.

## 7. Follow-ups (out of scope here)

- Native profile **editing** (a write path) — a separate, gated slice (§8/§14); this
  slice is read-only.
- Engine consumption of imported health metrics (`healthSummaryEngine` port) — deferred;
  the latest body weight here is display-only and never engine input.
