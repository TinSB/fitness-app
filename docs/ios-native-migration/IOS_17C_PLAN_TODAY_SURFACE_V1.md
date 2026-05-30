# iOS-17C — Plan + Today Read-only Surface V1

**Baseline commit:** `e646937` (latest `origin/main`, iOS-17S Tab Shell Scaffold merged)
**Branch:** `ios-17c-plan-today-surface` (no worktree; never committed to `main`)
**Predecessor:** iOS-17S Tab Shell Scaffold V1 (#423) — the five-tab shell + the four
placeholder `*RootView` mount points this slice fills two of.

Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`. This slice is a
§19.2 (extend an active package with pure logic) + §19.3 (improve the thin app layer)
change. **Source-of-truth impact: none. Data-safety impact: none.**

---

## 1. Goal

Fill two of the iOS-17S placeholder tabs with **read-only** surfaces:

- **计划 (Plan):** render a `MesocyclePlan` / `ProgramTemplate` structure (cycle phase /
  week count / date range; template goal / split / days-per-week), restrained, with the
  strategy detail collapsed.
- **今日 (Today):** render a readiness summary derived from the **existing**
  `IronPathTrainingDecision` engine output, plus an honest entry into 训练.

## 2. Scope (what is in)

| File | Change |
| --- | --- |
| `ios/packages/IronPathTrainingDecision/Sources/IronPathTrainingDecision/TrainingDecisionSurfacePresentation.swift` | **New.** Pure `TodayReadinessSummary(slice:todayStatus:)` + `PlanSurfaceSummary(mesocycle:program:)` + `SurfaceRow`. |
| `ios/packages/IronPathTrainingDecision/Tests/IronPathTrainingDecisionTests/TrainingDecisionSurfacePresentationTests.swift` | **New.** 13 unit tests for the presenters + label maps. |
| `ios/IronPath/TodayRootView.swift` | Body filled: readiness summary + status card + 训练 CTA. Thin renderer. |
| `ios/IronPath/PlanRootView.swift` | Body filled: cycle + template cards + collapsed strategy. Thin renderer. |
| `docs/ios-native-migration/IOS_17C_PLAN_TODAY_SURFACE_V1.md` | This document. |

No other RootView, the shell (`ContentView`), `FocusMode*`, `project.pbxproj`,
`package.json` / lockfile, or any stub package is touched.

## 3. Architecture decisions

### 3.1 Package home — `IronPathTrainingDecision`, additive only
Both presenters are pure value-type formatters. They live in a **new file** in the
already-active `IronPathTrainingDecision` package (it already depends on `IronPathDomain`
+ `IronPathDataHealth`, owns `TrainingDecisionCoreSlice`, and is the only active package
that can host *both* formatters in one place — the Today presenter reads the engine slice;
the Plan presenter reads Domain `MesocyclePlan`/`ProgramTemplate`). This is a §19.2
extension: **no engine algorithm and no parity golden is modified.** The presenters
*read* the slice the engine already produced and format it; they never call, recompute,
or re-emit engine output. The full package test suite (golden / parity / shape-stability)
stays green, proving engine output is unchanged.

### 3.2 Read-only, no engine/golden change
`TodayReadinessSummary` consumes a `TrainingDecisionCoreSlice` (the engine's own output)
and a `TodayStatus`. The slice is produced through the **genuine clean-input boundary** —
`AppData → buildCleanAppDataView → createCleanTrainingDecisionInput →
buildTrainingDecisionFromCleanInput` — so raw AppData never reaches the engine
(master §10/§11). No goldens were regenerated; none needed to be.

### 3.3 Data source — deterministic sample (no canonical-AppData read path yet)
The native app has **no canonical-AppData read path** today (the first native write path
is the gated iOS-17c slice; a read path comes later). So both surfaces render a
**deterministic, honestly-labelled sample**:

- **Today** reuses the existing app-layer deterministic engine demo
  (`FocusModePreviewData.sampleCoreSlice(.normal)` — the same pipeline the Focus tab
  already ships) plus a sample `TodayStatus`.
- **Plan** uses a minimal in-file sample `MesocyclePlan` + `ProgramTemplate`.

Both surfaces carry an explicit "示例 / sample" note so nothing pretends to be the user's
real data (master §15.4 — no fake success). `PlanSurfaceSummary.isEmpty` already drives an
honest empty state for when a real read path lands and there is no plan.

### 3.4 今日 → 训练 entry — honest CTA, programmatic switch deferred
The five-tab shell's selected tab is **`ContentView`-private `@State`**, and the iOS-17S
parallel-line contract **forbids editing the shell from a tab-fill slice**. A real
programmatic tab switch therefore requires a change in the shell-owning (iOS-17S) slice
and is out of scope here. Rather than fake navigation (or instantiate a second, divergent
`FocusModeShellView` from Today), the Today CTA is an **honest, self-contained disclosure**
directing the user to the 训练 tab. The button is functional and truthful; a real
cross-tab jump is a clean follow-up for a shell-owned slice.

## 4. Boundaries

- **Forbidden systems:** none introduced. No CloudKit/iCloud/Supabase/HealthKit/
  URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData. No persistence, no IO.
- **Source-of-truth (§8):** untouched — nothing reads or writes canonical AppData.
- **Data safety (§9):** untouched — no AppData mutation, no schema bump, no open-bag
  change, no timestamp change, no restore path.
- **Engine (§11):** output unchanged; goldens not regenerated.
- **App layer (§5/§15):** stays thin — all organization/formatting is in the package;
  the views render rows and hold only in-RAM `@State` for an alert toggle.
- **pbxproj:** unchanged. New files land in an already-registered app folder and an
  already-registered SwiftPM package (file-system globbing); no project edit needed.

## 5. Validation

Swift (local — CI does not build/test Swift, master §21.2):

| Check | Result |
| --- | --- |
| `swift test` — `IronPathTrainingDecision` | **143 tests, 0 failures** (13 new) |
| `xcodebuild … -destination 'generic/platform=iOS' … CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** |
| `xcodebuild … -destination 'platform=iOS Simulator,name=iPhone 17 Pro' … CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** |

TypeScript / repo (master §21.1):

| Check | Result |
| --- | --- |
| `npm run api:dev:build` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | **6817 passed** (1368 files) — unchanged (no TS source touched) |
| `npm run build` | exit 0 |
| `git diff --check` | clean |
| `package.json` / `package-lock.json` | byte-unchanged |

> Swift was built against **this branch's content**. A concurrent native line's untracked
> work-in-progress (unrelated to this slice's files) was set aside for the build so the
> result reflects this branch, then restored untouched.

## 6. Definition of Done

- [x] Plan and Today surfaces render read-only; 今日→训练 entry is usable (honest CTA).
- [x] `TrainingDecision` consumed via the clean-input boundary; engine unchanged, no
      goldens regenerated.
- [x] No pbxproj change beyond app files (in fact none); no other surface touched.
- [x] Both `xcodebuild` targets green.
- [x] This `IOS_17C` document is in the PR.
