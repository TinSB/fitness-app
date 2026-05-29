# iOS-7 — Native Focus MVP Bundle V1 (5-in-1)

Status: implemented. Xcode-led — Xcode Agent owns SwiftUI; Claude Code owns
branch / worktree / static guards / docs / validation / PR. **No TypeScript
runtime, golden fixture, AppData schema, Swift package, or `package.json` /
lockfile change.** The only `pbxproj` change is the registration of the four
new SwiftUI files into the IronPath app target.

## 1. Goal

Ship a runnable, native **Focus Mode MVP** by combining five Xcode UI-layer
tasks into one bounded PR: a 4-scenario sample selector, a readiness/risk
status surface, a native in-session interaction shell, in-memory set-progress
tracking, and UI polish. All five sit on top of the **real** Swift
`IronPathTrainingDecision` engine (no mocked output).

## 2. Why 5-in-1 is now allowed

iOS-5 / iOS-6 proved the per-task Xcode-led loop (one SwiftUI surface per PR,
guarded + xcodebuild'd + simulator-smoked). Now that the loop is trusted and
each piece is small and additive, bundling them amortizes the merge-gate /
review overhead and gets to a usable MVP faster — while staying inside the same
hard boundaries (no Cloud / HealthKit / network / persistence / engine change).

## 3. Scope boundaries

Allowed: the 8 Focus files under `ios/IronPath/` + the new static-guard test +
this doc. Forbidden (and statically guarded): Cloud, HealthKit, Supabase,
network (URLSession/URLRequest/NSURLSession), WebView/JS bridge, **disk
persistence (FileManager / UserDefaults / SQLite / CoreData / SwiftData)**,
AppData mutation / session save/complete, full history/progress/calendar,
`userFacing` full text, full `arbitrationTrace` parity, TS runtime, fixture /
golden / package / lockfile changes.

## 4. Xcode-led implementation statement

Claude Code: worktree off `origin/main` (`47c30e6`, post iOS-6 + tiering),
baseline, the explicit ready-to-copy Xcode Agent prompt, the static guards,
this doc, the full validation matrix, the PR. Xcode Agent: the SwiftUI files +
their registration into the app target + `BuildProject` (reported 5.6s, 0
issues) and the simulator screenshots.

**No `ios/packages/**` change.** The Xcode Agent reported zero engine-interface
gaps — every field/symbol it needed was already public.

## 5. Scenario selector (Part 1)

`FocusModeSampleScenario` now has **four** cases: `.normal`,
`.productiveFloor`, `.severeRest`, and the new **`.deloadWeek`**. The 4th was
addable with **no engine change**: it reuses `.normal`'s `(late: 2, early: 9)`
session gaps and only sets `CleanTrainingDecisionInputMetadata.explicitDeloadAssigned
= true`, which the already-ported `sessionIntentFor(… explicitDeload: true …)`
branch resolves to `sessionIntent = deload-week`. Segmented Picker, labels
`普通 / 回归保底 / 严重恢复 / 减载周`.

## 6. Readiness / deload / risk surface (Part 2)

New `FocusModeStatusSurfaceView` renders every readiness/risk field the
`TrainingDecisionCoreSlice` exposes today, each with the engine field-name as a
sub-label: `activePhase`, `sessionIntent`, `readinessLevel`, `riskLevel`,
`trainingAdjustment`, `volumeMode`, `intensityMode`, `progressionMode`,
`finalVolumeMultiplier` (`%.2f`).

**Deferred (documented, not engine-changed):** `deload` level/strategy is **not
a public field on `TrainingDecisionCoreSlice`** (only `explicitDeloadAssigned`
exists on the input metadata). The 减载档位 row shows a static `—` with the
in-code comment `// deload not exposed on TrainingDecisionCoreSlice yet —
deferred to a future engine PR`. Readiness exposes only a **level** enum (no
numeric score), so the surface shows the level.

## 7. In-session interaction shell (Part 3)

`FocusModeShellView` now has two modes driven by `FocusModeMvpState.isInSession`:

- **Plan mode**: header → segmented scenario Picker + explanation → status
  surface → today exercise list → `开始训练` / `重置样例` → footer.
- **In-session mode**: back link + scenario badge → `FocusSessionProgressView`
  (aggregate `完成 / 目标` + linear bar) → `FocusSetChecklistView` for the
  current exercise (big `completed / target`, capsule row, `完成本组`) →
  `上一动作` / `下一动作` → status surface → `重置样例` / `结束训练` → footer.

All in-memory: no AppData write, no session save, no disk.

## 8. In-memory state model (Part 4)

`FocusModeMvpState` (`@MainActor final class … : ObservableObject`, held by the
shell as `@StateObject`):

- `selectedScenario`, `selectedExerciseIndex`,
  `completedSetsByExerciseId: [String: Int]`, `isInSession`.
- Derived in the shell: `totalCompletedSets`, `totalTargetSets`, progress %.
- `completeOneSet(for:target:)` clamps via `min(target, current + 1)`.
- `setScenario(_:)` calls `resetProgress()` + resets the cursor + exits session.
- **No FileManager / UserDefaults / SQLite / CoreData / SwiftData / Keychain.**
  Pure RAM → resets on app restart, resets on scenario change.

## 9. UI fields displayed

Status surface: 训练阶段 / 本次训练 / 准备度 / 风险等级 / 训练调整 / 容量 /
强度 / 进度 / 负荷系数 / 减载档位(—). Exercise list/card: Chinese name + muscle
+ role badge + `completed / targetSets` + role floor. Session: aggregate
`完成 / 目标` + percent. Footer: `本地 Swift TrainingDecision · 无云同步 · 无 HealthKit`.

## 10. Non-goals

Cloud, HealthKit, Supabase, network, WebView, real AppData persistence, JSON
file persistence, session save/complete, full history/progress/calendar,
`userFacing` full text, full `arbitrationTrace`, TS runtime, fixture/golden
changes, package/lockfile changes, full app tab/navigation system, deploy,
auto-merge. The deload **value** surface is deferred to a future engine PR.

## 11. Validation

| Layer | Result |
| --- | --- |
| parity `--check` / `--list` | 14 / 0 ✅ / 14 ✅ |
| `api:dev:build` | green ✅ |
| `typecheck` | pass ✅ |
| `npm test` | full suite green ✅ |
| `npm run build` | rolldown success ✅ |
| `scan-production-dist-safety` | 21 files ✅ |
| package.json / lockfile diff | empty; no pnpm-lock ✅ |
| `git diff --check` | clean ✅ |
| swift × 9 | all green ✅ |
| `xcodebuild` generic + iPhone 17 Pro | BUILD SUCCEEDED ✅ |
| new guard `iosNativeFocusMvpBundleStaticGuards` | 33 assertions ✅ |

The iOS-6 selector guard's Picker-binding assertion was widened (not weakened)
to accept the scenario living on `FocusModeMvpState` (`@StateObject`) instead of
a local `@State` — the load-bearing property (a segmented Picker over
`FocusModeSampleScenario.allCases`) is unchanged.

## 12. Simulator smoke

Xcode Agent `BuildProject` 5.6s / 0 issues; `xcodebuild` generic + iPhone 17
Pro **BUILD SUCCEEDED**; the agent's launch screenshots confirmed: app boots
into the Focus MVP, the 4-segment Picker shows 普通 / 回归保底 / 严重恢复 /
减载周, the status surface renders (e.g. `.normal` → activePhase=base,
sessionIntent=normal-session, finalVolumeMultiplier=0.90, 减载档位 —; `.deloadWeek`
→ sessionIntent=deload-week), and the exercise list renders `0 / N 组`.

**Pending manual `⌘R` (5 interaction bullets):** the agent's harness has no tap
automation (`simctl` has no tap; snippet exec timed out). Please verify by hand:
tap all 4 Picker segments; `开始训练`; `完成本组` several times (progress
increments, clamped); `重置样例` (clears); switch scenario (progress resets);
`.productiveFloor` compounds stay ≥ 2 sets; `.severeRest` shows a 1-set
conservative path; no crash. The state logic is statically verifiable
(`completeOneSet` = `min(target, current+1)`; `setScenario` → `resetProgress()`
+ cursor/session reset).

## 13. Remaining risks

- **Manual interaction smoke not yet machine-confirmed** — build + static logic
  are green; the tap-through is the one keyboard-only step.
- **deload value still deferred** — the surface shows `—` until a future engine
  PR exposes `DeloadDecision` on `TrainingDecisionCoreSlice`.
- **Per-tap recompute** — `slice` is a computed property recomputed on each
  scenario change; inputs are tiny (deterministic), so cost is negligible.
- **Sample-shape drift** — `FocusModePreviewData` mirrors golden *shapes*, not
  bytes; a new required metadata field would surface as an `xcodebuild` error,
  not a silent UI regression.

## 14. Next task recommendation

**iOS-8 Deload Surface + Engine Field Exposure V1** (small, mixed): surface the
`DeloadDecision` (level + strategy) on `TrainingDecisionCoreSlice` (the one
sanctioned, narrow engine change), then fill the 减载档位 row — turning the
deferred Part-2 field live. In parallel / non-blocking, iOS-4B6 (`userFacing` +
full `arbitrationTrace`) remains deferred. Alternatively, a **Native Focus
Persistence Spike** could begin (still no Cloud) if local session history is
wanted — but that needs an explicit persistence-policy decision first.
