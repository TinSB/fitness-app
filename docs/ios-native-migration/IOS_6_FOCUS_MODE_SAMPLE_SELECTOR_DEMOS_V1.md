# iOS-6 — Focus Mode Sample Selector + Severe-Rest / Productive-Floor Demos V1

Status: implemented. Xcode-led — Xcode Agent owns SwiftUI implementation;
Claude Code owns branch / worktree / static guards / docs / npm / Swift /
xcodebuild validation / PR. **No TypeScript runtime, golden fixture, AppData
schema, Swift package, pbxproj, or `package.json` / lockfile change.**

## 1. Goal

Extend the iOS-5 Focus Mode shell with an in-app **scenario picker** so the
native UI can demonstrate the three load-bearing `IronPathTrainingDecision`
states without leaving the app:

| Scenario | Engine path proved on screen |
| --- | --- |
| `普通训练 / Normal` | Steady-state baseline: `activePhase = base`, `sessionIntent = normal-session`, compounds keep > 1 target set |
| `回归保底 / Productive Floor` | Reentry: `activePhase = reentry`, `sessionIntent = reentryProductive`, `ROLE_FLOORS_REENTRY` keeps main / secondary compounds at ≥ 2 sets — the no-all-1-set regression guard the iOS-4B5 PR locked |
| `严重恢复 / Severe Rest` | Conservative: `sessionIntent = severeRest`, severe cuts → compounds may legally drop to 1 set |

Each scenario is driven through the **real** engine pipeline
(`buildCleanAppDataView → createCleanTrainingDecisionInput →
buildTrainingDecisionFromCleanInput`); only the deterministic input
(`sessions` + `acutePainReported`) varies. No row in the today-list is
hand-coded.

## 2. Why iOS-6 follows iOS-5

iOS-5 stood up the SwiftUI shell + the engine-driven status card + the
exercise list, but the app only ever rendered **one** scenario
(`normal-session`). That meant:

- the productive-floor / no-all-1-set guarantee (iOS-4B5) was only visible
  through `npm test` + static guards — never on screen;
- the severe-rest conservative path (iOS-4B5 `acutePainReported` plumbing)
  had **zero** UI exposure.

iOS-6 closes both gaps with a single segmented Picker, without enlarging the
app scope (no navigation, no persistence, no history). It is the smallest
visible delta that turns the shell into a real Focus Mode **demo**.

## 3. Xcode-led implementation statement

Claude Code's role this PR:
- create the `claude/ios-6-…` worktree off `origin/main` (`da11178`),
- run `npm install` + baseline (parity, Swift `IronPathTrainingDecision`,
  typecheck) before handing off,
- author the static guards under `tests/`,
- author this doc,
- run the full Node / Swift / xcodebuild validation matrix,
- open the PR.

Xcode / Xcode Agent's role this PR:
- the SwiftUI implementation under `ios/IronPath/`,
- a `BuildProject` pass in Xcode (the agent reported a 5.4s build, 0 errors,
  0 warnings).

**No `pbxproj` change in this PR.** Every change lives in three existing
Swift files; no new file was added, no new package was linked, no scheme
was touched. (Contrast iOS-5, which added four files + `IronPathTrainingDecision`
to the app target.)

## 4. Scenarios added

`FocusModeSampleScenario` is a fresh `enum` in
`ios/IronPath/FocusModePreviewData.swift`. It is `String`-raw,
`CaseIterable`, `Identifiable`. Each case exposes:

- `displayLabel`: the bilingual label for tooltips / accessibility
  (`普通训练 / Normal`, `回归保底 / Productive Floor`, `严重恢复 / Severe Rest`).
- `shortLabel`: the short Chinese label used in the segmented Picker
  (`普通`, `回归保底`, `严重恢复`).
- `explanation`: the single line rendered below the Picker (Chinese,
  Chinese-first).

```swift
enum FocusModeSampleScenario: String, CaseIterable, Identifiable {
    case normal
    case productiveFloor
    case severeRest
    var id: String { rawValue }
    var displayLabel: String { … }
    var shortLabel: String { … }
    var explanation: String { … }
}
```

The shell holds `@State private var scenario: FocusModeSampleScenario =
.normal`. `slice` and `rows` are now `computed` properties, so SwiftUI
re-evaluates them whenever the Picker selection changes.

## 5. TrainingDecision integration path

Identical to iOS-5; only the **input** changes per scenario.

```
sampleAppData(for: scenario)
   ↓
buildCleanAppDataView(appData, clock: FixedRuntimeGuardClock(referenceClockIso))
   ↓
createCleanTrainingDecisionInput(
   cleanView:,
   metadata: CleanTrainingDecisionInputMetadata(
       nowIso: …,
       trainingMode: "hybrid",
       acutePainReported: scenario == .severeRest ? true : nil,   // iOS-6 wire-up
       templateDurationMin: 60,
       templateExercises: pushATemplateExercises()
   )
)
   ↓
buildTrainingDecisionFromCleanInput(input)
   ↓
TrainingDecisionCoreSlice
```

The only new variable threaded through the engine is
`metadata.acutePainReported`, which was already accepted by
`CleanTrainingDecisionInputMetadata` in iOS-4B5. **No Swift package change
was needed.**

## 6. Productive-floor demo

Input shape (mirrors `tests/fixtures/parity/inputs/training-decision/productive-floor-v1.json`):

- `sessions = [(id: "td-late", daysBefore: 20), (id: "td-early", daysBefore: 34)]`
- `todayStatus = 一般 / 中 / 无 / time 60`
- `acutePainReported = nil`

The 20-day gap to the most recent session lands in the reentry window
(`EffectiveTrainingPhase.swift` triggers reentry at ≥ 14 days). The engine
settles at:

- `activePhase = reentry`
- `sessionIntent = reentryProductive`
- `finalVolumeMultiplier = 0.65`
- main / secondary compound `ROLE_FLOORS_REENTRY = 2` → compound cards
  render with **≥ 2** target sets.

This is the visual proof of the iOS-4B5 productive-floor / no-all-1-set
regression lock.

## 7. Severe-rest demo

Input shape (mirrors
`tests/fixtures/parity/inputs/training-decision/severe-rest-v1.json`):

- `sessions = [(id: "td-late", daysBefore: 2), (id: "td-early", daysBefore: 5)]`
- `todayStatus = 一般 / 中 / 无 / time 60`
- **`acutePainReported = true`** ← the only delta from `.normal`

The acute-pain flag short-circuits to `sessionIntent = severeRest` regardless
of phase/readiness, applying AR-1 severe overrides and the severe-cut volume
floor. Engine settles at:

- `sessionIntent = severeRest`
- `finalVolumeMultiplier = 0.3`
- compounds may legally render with **1** target set (this is the only
  scenario in which an all-1-set card is correct).

## 8. Deterministic sample strategy

Two safety properties preserved from iOS-5 and extended to all three
scenarios:

1. **No live time.** Every scenario passes through
   `FixedRuntimeGuardClock("2026-05-27T10:00:00.000Z")`. Same input → same
   `TrainingDecisionCoreSlice` every launch.
2. **No private export.** Sessions, today-status, and the push-A template
   exercises are handwritten in `FocusModePreviewData`. No copy from
   `fixtures/parity-goldens/real-export/redacted-2026-05-27`.

The handwritten inputs **mirror the shape** of the corresponding golden
fixtures (same `selectedTemplateId = "push-a"`, same
`trainingMode = "hybrid"`, same `daysAgo` gap structure, same
`acutePainReported` semantics) so the engine takes the same arbitrated
path. They are not byte-equal to the goldens — copying parity inputs into
the app target would be a privacy regression even on synthetic fixtures.

`sampleCoreSlice(for:)` is the single funnel. Calling it three times in a
row with `.normal`, `.productiveFloor`, `.severeRest` reproduces this PR's
acceptance demo at REPL speed.

## 9. Non-goals (explicit)

- ❌ Real user data, persistence, session logging, workout completion.
- ❌ HealthKit / sleep / activity wiring.
- ❌ CloudSync / Supabase / network of any kind.
- ❌ WebKit / JavaScriptCore — no TS runtime bridge.
- ❌ AppData mutation. Each scenario reads a synthesized in-memory `AppData`
  and never writes back.
- ❌ Full app navigation, history, progress, calendar, plan editor.
- ❌ Golden parity fixture changes (still 14 fixtures / 0 changed).
- ❌ Swift package changes — `IronPathTrainingDecision` already exposed
  `CleanTrainingDecisionInputMetadata.acutePainReported`; iOS-6 only
  consumes it.
- ❌ `pbxproj` / scheme changes — no new file, no new linked package.
- ❌ `package.json` / `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`
  changes.
- ❌ iOS-4B6 `userFacing` full-text builders / full `arbitrationTrace` /
  full-object parity — deferred, parallel, and **does not block iOS-6**.
- ❌ Caching the per-scenario `TrainingDecisionCoreSlice`. The input is
  small (6 exercises, 2 sessions) and the engine is deterministic; the
  recompute on each Picker tap is negligible.

## 10. Validation

| Layer | Command | Expected |
| --- | --- | --- |
| Parity | `node scripts/generate-parity-goldens.mjs --check` | `14 fixture(s); 0 changed` |
| Parity (count) | `node scripts/generate-parity-goldens.mjs --list` | 14 entries |
| Dev API | `npm run api:dev:build` | vite SSR build green |
| TypeScript | `npm run typecheck` | `tsc --noEmit` exit 0 |
| Unit + integration | `npm test` | all green; +1 test file / +36 tests vs iOS-5 baseline |
| Web build | `npm run build` | rolldown success |
| Prod safety | `node scripts/scan-production-dist-safety.mjs` | 21 files scanned, pass |
| Lockfile | `git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml` | empty |
| pnpm | `test ! -e pnpm-lock.yaml` | true |
| Whitespace | `git diff --check` | clean |
| Swift × 9 | `swift test --package-path ios/packages/IronPath*` | all green |
| Xcode (generic) | `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'generic/platform=iOS Simulator' build` | BUILD SUCCEEDED |
| Xcode (iPhone 17 Pro) | same with `-destination 'platform=iOS Simulator,name=iPhone 17 Pro'` | BUILD SUCCEEDED |

The new file
`tests/iosNativeFocusModeSampleSelectorStaticGuards.test.ts` locks all of:
the `FocusModeSampleScenario` enum (`CaseIterable`, three cases), the
segmented Picker mount, the `@State` binding, the three `buildCleanAppDataView`
/ `createCleanTrainingDecisionInput` / `buildTrainingDecisionFromCleanInput`
call sites, the `sampleCoreSlice(for:)` signature, the
`acutePainReported` threading, the Chinese-first / bilingual labels for
both productive-floor (`回归保底` or `Productive Floor`) and severe-rest
(`严重恢复` or `Severe Rest`), the six summary-card slice fields, the
`slice.perExercise` + `row.targetSets` bindings, all forbidden imports
(HealthKit / IronPathCloudSync / Supabase / WebKit / JavaScriptCore), no
URLSession, no TS / JS runtime bridge, no AppData mutation, parity
`--check` still 14 / 0, and `package.json` / `package-lock.json`
byte-equality to main (with the same CI-aware base-ref resolver as the
iOS-5 guards: `origin/main` if present, otherwise `git fetch --depth=1
origin main` + diff `FETCH_HEAD`).

iOS-5's existing `tests/iosNativeFocusModeShellStaticGuards.test.ts` was
**not** modified — all 33 of its assertions remain valid against the
iOS-6 SwiftUI (they were specifically about the slice fields + shell
structure, not the static-init pattern).

## 11. Simulator smoke result

`BuildProject` inside Xcode reported success (5.4s, 0 errors, 0 warnings)
when the Xcode Agent handed off. The two `xcodebuild` runs Claude Code
executed (generic iOS Simulator + iPhone 17 Pro Simulator) both returned
**BUILD SUCCEEDED**.

The Xcode-Agent harness did **not** expose a Simulator boot / UI
automation channel, so the visual smoke (running the app in iPhone 17 Pro
Simulator and tapping each segment) is **pending manual user
verification** — `⌘R` in Xcode, then switch between `普通` / `回归保底`
/ `严重恢复` and confirm:

1. summary-card values (`activePhase`, `sessionIntent`, `volumeMode`,
   `intensityMode`, `progressionMode`, `finalVolumeMultiplier`) update;
2. exercise list updates;
3. `.productiveFloor`: compound cards stay ≥ 2 sets;
4. `.severeRest`: at least one compound card drops to 1 set;
5. no crash on rapid switching.

This doc will be updated (and the merge gate reaffirmed) once the user
reports the manual smoke result.

## 12. Remaining risks

- **Manual smoke not yet reported.** `xcodebuild` proves the SwiftUI
  compiles + links into a signed `.app`; it does not prove the Picker
  actually re-renders. The Picker binding is a small, well-trodden
  SwiftUI shape (`@State` + segmented `Picker` over a `CaseIterable`
  enum), so a runtime regression here would be surprising — but it is
  the one verification step that can only be done at the keyboard.
- **Sample shape drift.** The handwritten inputs mirror the golden
  fixtures only by **shape**, not by bytes. If a future engine PR adds a
  new required `CleanTrainingDecisionInputMetadata` field that changes
  arbitration, the three samples need an explicit update. Such a change
  would surface as an `xcodebuild` compile error, not a silent UI
  regression.
- **Per-tap recompute.** The `computed` property pattern re-runs the
  engine on every Picker tap. With 6 exercises × 2 sessions, this is
  microseconds and is below any user-perceivable threshold; caching is
  intentionally not introduced. If iOS-7+ widens the sample set, a
  `@StateObject` + memo would be the right next step.
- **iOS-4B6 still pending.** The shell still does not render
  `userFacing` text (advice / why / chips). When 4B6 lands, the summary
  card can pick up those fields with no UI restructure.

## 12.5. Files changed

- `ios/IronPath/FocusModePreviewData.swift` — `FocusModeSampleScenario`
  enum + `sampleAppData(for:)` + per-scenario `sessionGaps(for:)` +
  `sampleCoreSlice(for:)` accepting a scenario and threading
  `acutePainReported` for `.severeRest`.
- `ios/IronPath/FocusModeShellView.swift` — `@State private var scenario`,
  computed `slice` / `rows`, segmented Picker + explanation line.
- `ios/IronPath/TrainingDecisionSummaryView.swift` — `#Preview` updated
  to `sampleCoreSlice(for: .normal)` (one-line change).
- `tests/iosNativeFocusModeSampleSelectorStaticGuards.test.ts` — new,
  36 assertions.
- `docs/ios-native-migration/IOS_6_FOCUS_MODE_SAMPLE_SELECTOR_DEMOS_V1.md`
  — this doc.

No change to `FocusModeExerciseCard.swift`, `ContentView.swift`,
`IronPathApp.swift`, `IronPath.xcodeproj/`, any `ios/packages/*`, any
golden fixture, `package.json`, or any lockfile.

## 13. Next task recommendation

Following iOS-6 merge, the next worthwhile native step is **iOS-7
Focus Mode Readiness / Deload Surface V1**:

- Surface `slice.riskLevel` and the `slice.deload` payload (level,
  strategy) in the summary card alongside the existing six fields,
  letting the demo also visualise the iOS-4B3 / iOS-4B4 ports.
- Add a fourth scenario (`controlled-reload` or `deload-week`) so the
  Picker can demonstrate the readiness / deload branches end-to-end.
- Still no Cloud / HealthKit / network. Still Xcode-led.

In parallel (non-blocking), iOS-4B6 (`userFacing` +
full `arbitrationTrace`) can land on its own track. iOS-7 should pick up
`slice.userFacing` whenever it lands, with no shell restructure.
