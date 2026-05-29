# iOS-8 — Native Local Training MVP Mega Migration V1

Status: implemented. Multi-agent migration; Claude Code implemented ALL lanes
(engine + SwiftUI + pbxproj + guards + docs) per the user's "Swift 部分也全部交由
你做 / 大迁移" directive. **No Cloud / HealthKit / Supabase / network / WebView /
auth / on-disk persistence / AppData mutation / TS runtime / golden / package /
lockfile change.** The only `pbxproj` change registers two new SwiftUI files
into the IronPath app target.

## 1. Goal

Move the iOS app from an interactive demo shell toward a **local native training
MVP**: a real engine deload field on screen, a start→complete-sets→complete-
session flow, and an in-memory saved-session preview — all local-only and safe.

## 2. Why a larger multi-agent migration is allowed now

iOS-5/6/7 proved the per-PR Xcode-led loop and the static-guard/parity safety
net. With that net trusted, the user authorized a larger bounded pass using a
multi-agent discovery wave for breadth + strict single-integrator assembly +
strict validation, to reach a usable local MVP faster without lowering
acceptance.

## 3. Agent workflow summary

**Wave 1 (read-only, 20 agents via the Workflow tool):** 19 discovery/design/
risk/ownership agents (app-surface, deload-exposure, session-model, JSON-snapshot,
DataHealth-boundary, UI/UX, history-preview, static-guards, tests, regression,
package-graph, build/xcode, docs, acceptance, scope-governor, performance,
privacy, interaction, file-ownership) → 1 integrator synthesis with a
stop-condition verdict. 8 agents raised STOP; the integrator **disproved/resolved
all of them** (stopConditionHit=false): deload exposure is purely additive (no
golden change), and file persistence is cut to in-memory.

**Wave 2 (implementation, single-owner lanes, no parallel writers):** Lane A
(engine), Lane B/C/D (SwiftUI + pbxproj), Lane E (guards + docs), Lane F
(validation fixes). Implemented sequentially by Claude Code: A → B/C/D → E →
validation, with one coherent integration checkpoint before the PR.

## 4. Scope included

- **Lane A — deload exposure**: `public let deload: DeloadDecision` added to
  `TrainingDecisionCoreSlice`, populated from the engine's ALREADY-computed
  `deload` local (`buildTrainingDecisionFromCleanInput`), wired 1:1 — not
  recomputed, not fabricated. `DeloadDecision`/`DeloadLevel`/`DeloadStrategy`
  were already public (no edit). + a compute-not-decode Swift test asserting
  `slice.deload == buildAdaptiveDeloadDecision(...)` on all 9 fixtures.
- **Lane B — status surface**: `FocusModeStatusSurfaceView` 减载档位 row now binds
  `slice.deload.level.rawValue` (+ strategy sub-label); the iOS-7 `—`/`deferred`
  placeholder is gone.
- **Lane C/D — local session shell**: `FocusModeMvpState` gains a
  `FocusSessionStage` (plan/inSession/completed), an in-RAM
  `FocusCompletedSessionSummary`, an injectable deterministic clock, and
  `completeSession(...)` / `startNewSession()`. New views
  `FocusSessionCompletionView` (完成本次训练) and `FocusSavedSessionPreviewView`
  (local saved preview). `FocusModeShellView` switches over the 3 stages.
- **Lane E — guards + docs**: this doc + the static-guard file(s).

## 5. Scope excluded (cut / deferred)

- **File-backed JSON persistence — CUT to in-memory-deferred.** Crosses the
  no-disk constraint and the iOS-7 / architecture-boundary bans on
  FileManager/UserDefaults/AppData-mutation; real persistence needs a
  backup-first adapter + store relocation + finalize/session-save parity = a
  separate gated PR.
- Any AppData write / saveSession / completeSession-to-store — CUT.
- Full history section (porting the summary engines) — CUT to a single in-RAM
  just-completed preview.
- Adding `deload` to the TS golden projection / regenerating goldens — CUT
  (goldens stay byte-identical; the Swift field is Swift+UI-only).
- An Xcode XCTest/UITest bundle for `FocusModeMvpState` — CUT (would add a test
  target to pbxproj); deferred to a follow-up Xcode-led test-target task.
- Per-tap engine memoization — CUT (perf nice-to-have).
- Cloud / HealthKit / Supabase / network / WebView / auth / account / real
  sync — CUT (hard constraints, out of scope by definition).
- **iOS-4B6** (full `userFacing` builders + full `arbitrationTrace` parity) —
  remains **deferred / parallel**, not in this PR.

## 6. Deload exposure

`TrainingDecisionCoreSlice` (TrainingDecisionCoreSliceEngine.swift) now carries:

```swift
public let deload: DeloadDecision   // level / triggered / volumeMultiplier / strategy / reasons
```

populated in `buildTrainingDecisionFromCleanInput` from the existing
`let deload = TrainingDecisionDeload.buildAdaptiveDeloadDecision(history:todayStatus:screening:)`
that already feeds `clampMultiplier`. **Parity `--check` stays 14/0** — no golden
records a deload field, so this is Swift+UI-only. The Swift test
`test_deload_field_is_the_engine_computed_value_on_all_9_fixtures` independently
recomputes the adaptive deload from the same cleaned input and asserts equality,
proving the field is wired, not fabricated (deleting the wiring fails the test).

## 7. Local session shell

`FocusModeMvpState` is the single in-RAM source of truth:
`selectedScenario`, `selectedExerciseIndex`, `completedSetsByExerciseId`, `stage`
(plan/inSession/completed), `completedSummary?`. Interactions: `startSession`,
`completeOneSet` (clamps `min(target, current+1)`), `moveToNext/Previous`,
`resetProgress`, `completeSession` (captures the snapshot), `startNewSession`,
`setScenario` (resets progress + stage + summary). `isInSession` stays as a
computed alias for backward compatibility.

## 8. Local completion preview

On 完成本次训练, `completeSession(slice:lines:)` builds a
`FocusCompletedSessionSummary` (scenario, sessionIntent, activePhase, deload
level+strategy, per-exercise completed/target lines, totals, timestamp) and moves
to `.completed`. `FocusSavedSessionPreviewView` renders it: an engine-context
card + a completed-exercise list + 再来一次. The timestamp comes from the
injectable deterministic clock (default = `FocusModePreviewData.referenceClockIso`),
never an inline `Date()`.

## 9. Persistence decision: DEFERRED (in-memory only)

iOS-8 ships **in-memory-only**. The "saved" preview is a RAM snapshot in
`FocusModeMvpState`, cleared on scenario change and on app restart. The
completion card is labeled `仅本机 · 重启清空 · 无云同步`. On-disk JSON persistence
is the next task and requires a backup-first safety path + the DataHealth ingress
rule below; it is intentionally NOT in this PR.

## 10. UI changes

Chinese-first throughout; 3-stage flow on one scrollable page with safe-area
bottom padding; large `completed / target` readouts; the live 减载档位 row; the
in-memory disclaimer; footer `本地 Swift TrainingDecision · 无云同步 · 无 HealthKit`.
No tab bar, no full navigation/history app.

## 11. Safety boundaries

- **DataHealth ingress rule (documented for the future persistence task):** any
  local session restore MUST route raw AppData through
  `buildCleanAppDataView` / the ingress path before the branded
  `CleanTrainingDecisionInput` factory. The engine never consumes raw AppData.
  iOS-8 does not load any AppData, so no raw data reaches the engine.
- 100% in-RAM: no FileManager / UserDefaults / Keychain / SQLite / CoreData /
  SwiftData / disk egress in any Focus MVP file (in-RAM `Codable` is permitted,
  disk write is not).
- No AppData mutation / session save-to-store. No cloud upload/download. No auth.
- Sample data is synthetic/deterministic only (no real-export fixture).

## 12. Tests / guards

- Swift: `IronPathTrainingDecision` 128 → **130** tests (+2 deload-exposure
  asserts), compute-not-decode, all green.
- TS: `tests/iosNativeLocalTrainingMvpMegaMigrationStaticGuards.test.ts` — 27
  assertions covering deload exposure (field declared + wired-not-fabricated +
  surface reads it / no `—`), the in-memory session shell + completion + preview,
  the full forbidden set (HealthKit/CloudSync/Supabase/WebKit/network/JS-TS-runtime/
  SwiftData/CoreData/SQLite/AppData-mutation/cloud/auth), no on-disk persistence
  across the Focus MVP files, synthetic-only sample, Chinese-first labels, parity
  14/0, package.json+lock byte-identical, no pnpm-lock, no deploy.
- The CloudSync-import ban is scoped to the Focus MVP file set (excludes
  `IronPathApp.swift`, the bootstrap linked-packages proof).

## 13. Validation

parity `--check` 14/0 + `--list` 14; `test:parity`/`test:ios`/`validate:ios`
runner tiers; `api:dev:build`; `typecheck`; `npm test` (full); `npm run build`;
`scan-production-dist-safety` 21 files; package.json/lock byte-identical; no
pnpm-lock; `git diff --check` clean; `swift test` × 9 packages green
(`IronPathTrainingDecision` 130); `xcodebuild` generic + iPhone 17 Pro
BUILD SUCCEEDED.

## 14. Manual Simulator smoke checklist (iPhone 17 Pro)

- app launches into the Focus MVP; page scrolls (press-and-drag in Simulator).
- 4 scenarios switch (普通 / 回归保底 / 严重恢复 / 减载周); status surface + list refresh.
- **减载周 shows a real deload level/strategy** in 减载档位 (no `—`).
- 开始训练 → in-session; 完成本组 increments (clamped); 上一/下一动作; 重置样例 clears.
- 完成本次训练 → local saved preview appears (completed exercises, sets,
  sessionIntent, activePhase, deload, timestamp); 再来一次 returns to plan.
- app-restart behavior: in-memory state + saved preview are cleared (documented;
  no persistence yet).
- no crash.

## 15. Remaining risks

- **Manual interaction smoke is the user's step** — build + Swift logic are green;
  the tap-through (incl. complete-session → preview) is keyboard-only.
- **Deterministic timestamp** — the saved preview shows the fixed reference
  instant (demo determinism), not wall-clock; real time arrives with the
  persistence task via the injectable clock.
- **In-memory only** — saved preview does not survive restart (by design / cut).
- **Sample-shape drift** — `FocusModePreviewData` mirrors golden shapes, not
  bytes; a new required engine field surfaces as an `xcodebuild` error.

## 16. Next task recommendation

**iOS-9 Local Session JSON Snapshot Persistence V1** (gated): introduce a
backup-first, app-local JSON snapshot store for completed sessions, routing any
restore through `buildCleanAppDataView` (the DataHealth ingress rule above),
with deterministic tests and a guard relaxation scoped to the sanctioned local
file path. In parallel / non-blocking, iOS-4B6 (`userFacing` + full
`arbitrationTrace`) remains deferred.
