# iOS-5 — Native Focus Mode Shell + TrainingDecision Integration V1

Status: implemented. Xcode-led — Xcode Agent owns SwiftUI / pbxproj surgery,
Claude Code owns branch / worktree / static guards / docs / npm validation /
parity / xcodebuild / PR. No TypeScript runtime, golden fixture, AppData schema,
or package.json / lockfile change.

## 1. Goal

Stand up a SwiftUI `FocusModeShellView` inside the existing `IronPath` app
target that consumes `IronPathTrainingDecision`'s engine output end-to-end on
real iPhone Simulator hardware. The shell:

- shows the top-level `TrainingDecisionCoreSlice` fields the iOS-4B2..4B5 ports
  unlocked (`activePhase` / `sessionIntent` / `volumeMode` / `intensityMode` /
  `progressionMode` / `finalVolumeMultiplier`);
- shows today's exercises (`perExercise[]` + role floors + target sets) as a
  scrollable list with one card per exercise; and
- proves the productive-floor / no-all-1-set protection visually — compounds
  do not collapse to 1 set under the default sample (push-a, todayStatus
  `一般 / 中 / 无` / time 60), and the severe-rest fixture (when swapped in
  later) is the *only* legal 1-set conservative path.

This is **not** a full app. It is the first SwiftUI surface the native build
ships with real engine output behind it.

## 2. Why iOS-5 starts the Xcode-led phase

iOS-0 → iOS-4B5 was a TS → Swift core-engine port: every PR moved logic into
`ios/packages/IronPath*` SwiftPM packages, behind a parity fence and with no
visible app surface. iOS-5 is the first PR where:

- the SwiftUI view tree gains real branches,
- the `IronPath.xcodeproj` target acquires a new local package dependency
  (`IronPathTrainingDecision`),
- new Swift files have to be wired into the app target's `PBXSourcesBuildPhase`
  / `PBXGroup` / `PBXFileReference`,
- and `xcodebuild ... -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`
  has to keep returning **BUILD SUCCEEDED** for the new files.

Those four steps are Xcode UI work, not text-editor work. So this PR splits
responsibility:

| Tool | Owns |
| --- | --- |
| Xcode / Xcode Agent | SwiftUI implementation, `pbxproj` edits via Xcode UI, the app target's package link, Simulator smoke, XCTest if added |
| Claude Code | branch / worktree / `git diff` audit, static guards, this doc, full Node validation, all 9 `swift test` runs, `xcodebuild` (generic + iPhone 17 Pro), PR creation, merge gate later |

iOS-4B6 (`userFacing` full-text builders + full `arbitrationTrace` + full-object
parity) is **deferred / parallel** — it is no longer a hard pre-req for the
native UI and **does not block** iOS-5.

## 3. What iOS-4B5 unlocked for iOS-5

The Focus Mode shell needs the fields iOS-4B5 PR #407 (commit `22e9220`)
finalized:

| Field consumed by iOS-5 | Originating slice |
| --- | --- |
| `slice.activePhase` | iOS-4B2 effectivePhase |
| `slice.sessionIntent` | iOS-4B2 sessionIntentFor (`controlled-reload` unlocked by 4B3) |
| `slice.riskLevel` (for future surface) | iOS-4B3 readiness |
| `slice.deload` (for future surface) | iOS-4B4 |
| `slice.volumeMode` / `intensityMode` / `progressionMode` | iOS-4B4 modes |
| `slice.finalVolumeMultiplier` | iOS-4B4 clamp |
| `slice.perExercise[].targetSets` | iOS-4B5 `applyStatusRules` pipeline |
| `slice.exerciseRoleFloors` | iOS-4B5 role floors |
| `slice.minTargetSets` / `allTargetSets` | iOS-4B5 |

Without iOS-4B5 in place, the per-exercise list would have nothing to render.

## 4. Xcode manual package link

The new `IronPathTrainingDecision` dependency was added through Xcode UI
(`File ▸ Add Package Dependencies… ▸ Add Local…`), pointing at
`ios/packages/IronPathTrainingDecision`. The resulting `pbxproj` deltas (auditable
in `git diff -- ios/IronPath.xcodeproj/project.pbxproj`):

- `XCLocalSwiftPackageReference "packages/IronPathTrainingDecision"` added to
  the project's `packageReferences` array,
- a `packageProductDependency` entry tying the `IronPath` app target to the
  `IronPathTrainingDecision` product,
- a `PBXBuildFile` for `IronPathTrainingDecision in Frameworks` inside the
  app target's `PBXFrameworksBuildPhase`,
- four new `PBXFileReference` / `PBXBuildFile` pairs for the four new SwiftUI
  files, registered under the existing `IronPath` `PBXGroup` and the existing
  `PBXSourcesBuildPhase`.

Xcode also auto-bumped `objectVersion = 56 → 60`, `LastUpgradeCheck = 1540 →
2650`, the matching scheme's `LastUpgradeVersion = 1540 → 2650`, and added
`STRING_CATALOG_GENERATE_SYMBOLS = YES` to both Debug/Release configs. These
are Xcode UI side effects on first-touch with a newer Xcode, not iOS-5 design
decisions. They are kept as-is to avoid manual `pbxproj` fights.

## 5. SwiftUI files created

All under `ios/IronPath/` (**not** `ios/App/` — the original task prompt's path
assumption was incorrect; the SwiftUI app target source directory in this repo
has always been `ios/IronPath/`):

| File | Role |
| --- | --- |
| `ios/IronPath/FocusModeShellView.swift` | Top-level shell. Header + summary card + today list + footer disclaimer. Wires the engine call once at `init`, then renders. |
| `ios/IronPath/TrainingDecisionSummaryView.swift` | Status card. Six rows: 训练阶段 / 本次训练 / 容量 / 强度 / 进度 / 负荷系数, each with the engine-field name as a bilingual sub-label. |
| `ios/IronPath/FocusModeExerciseCard.swift` | One row per exercise. Chinese name + muscle tag + role badge + kind label + `N 组` target + `下限 K` role floor. Pure presentation. |
| `ios/IronPath/FocusModePreviewData.swift` | Deterministic in-memory sample input + the `buildCleanAppDataView` → `createCleanTrainingDecisionInput` → `buildTrainingDecisionFromCleanInput` pipeline. No `Date()`, no IO, no AppData mutation, no network. |

Modified:

- `ios/IronPath/ContentView.swift` — now hosts `FocusModeShellView()` and
  nothing else (was the iOS-1 three-label placeholder).

## 6. TrainingDecision integration path

The shell calls the **real** engine entry point — there is no mocking layer:

```
FocusModePreviewData.sampleAppData()           // synthetic AppData JSON
   ↓
buildCleanAppDataView(appData, clock: fixedClock())          // IronPathDataHealth
   ↓
createCleanTrainingDecisionInput(cleanView:, metadata:)      // IronPathTrainingDecision
   ↓
buildTrainingDecisionFromCleanInput(input)                   // IronPathTrainingDecision
   ↓
TrainingDecisionCoreSlice                                     // consumed by views
```

Every public Swift type and free function the shell touches is exported by
`IronPathTrainingDecision` (`TrainingDecisionCoreSlice`, `CleanTrainingDecisionInput`,
`CleanTrainingDecisionInputMetadata`, `TrainingDecisionTemplateExercise`,
`WorkingSetTarget`, `ExerciseRole`, `ActivePhase`, `SessionIntent`, `VolumeMode`,
`IntensityMode`, `ProgressionMode`). No new public API was added to consume
the engine.

## 7. Deterministic sample data strategy

`FocusModePreviewData` deliberately mimics the *shape* of the goldens, **not**
their bytes. Two safety properties:

1. **No live time.** `referenceClockIso = "2026-05-27T10:00:00.000Z"` plus a
   `FixedRuntimeGuardClock`. The same `TrainingDecisionCoreSlice` comes out of
   every launch.
2. **No private export.** Push-A is a fresh handwritten template (6 exercises,
   Chinese names). Two completed sessions (`td-late` 2 days ago, `td-early` 9
   days ago). `todayStatus` `一般 / 中 / 无 / time 60`. No copy from
   `fixtures/parity-goldens/real-export/redacted-2026-05-27`.

Deterministic resolution: under these inputs the engine settles at
`activePhase = base`, `sessionIntent = normal-session`, `volumeMode = normal`,
`intensityMode = normal`, `progressionMode = normal`, `finalVolumeMultiplier =
1.00`, role floors honoured — i.e. *all* compound exercises render with > 1
target set. That is the user-visible proof of the iOS-4B5 productive floor.

Swapping the sample to a `severe-rest` fixture (out of scope for this PR but
trivial — add a second `sampleSession` ≥ 28d ago and remove the recent one) is
the only legal way to see the 1-set conservative path. The shell is
intentionally single-source today; a future `iOS-5+` PR can add a sample
picker.

## 8. UI fields displayed

Header strip:

- `IronPath Native Focus` (大字标题)
- `Native SwiftUI · TrainingDecision V1` (小字副标)

Summary card (`TrainingDecisionSummaryView`):

| 中文标签 | 引擎字段 |
| --- | --- |
| 训练阶段 | `slice.activePhase` |
| 本次训练 | `slice.sessionIntent` |
| 容量 | `slice.volumeMode` |
| 强度 | `slice.intensityMode` |
| 进度 | `slice.progressionMode` |
| 负荷系数 | `slice.finalVolumeMultiplier` (formatted `%.2f`) |

Today list:

- Section title `今日动作` + `最少 N 组` (uses `slice.minTargetSets`)
- One `FocusModeExerciseCard` per `slice.perExercise[]` entry; card shows the
  Chinese template name, the muscle tag, the role badge, the kind label, the
  `N 组` target, and the `下限 K` role floor from `slice.exerciseRoleFloors`.

Footer:

- `本地 Swift TrainingDecision · 无云同步 · 无 HealthKit`

## 9. Non-goals (explicit)

- ❌ HealthKit / sleep / activity wiring.
- ❌ CloudSync / Supabase / network of any kind.
- ❌ WebKit / JavaScriptCore — no TS runtime bridge.
- ❌ AppData mutation. The shell reads a synthesized in-memory `AppData` once
  and never writes back.
- ❌ Full app navigation, history, progress, calendar, plan editor.
- ❌ Golden parity fixture changes (still 14 fixtures / 0 changed).
- ❌ `package.json` / `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`
  changes.
- ❌ iOS-4B6 `userFacing` full text builders / full `arbitrationTrace` / full
  object parity — deferred and decoupled from the native UI surface.
- ❌ New Swift package. The shell lives in the existing `IronPath` app target.

## 10. Validation

| Layer | Command | Expected |
| --- | --- | --- |
| Parity | `node scripts/generate-parity-goldens.mjs --check` | `14 fixture(s); 0 changed` |
| Parity (count) | `node scripts/generate-parity-goldens.mjs --list` | 14 entries |
| Dev API | `npm run api:dev:build` | vite SSR build green |
| TypeScript | `npm run typecheck` | `tsc --noEmit` exit 0 |
| Unit + integration | `npm test` | all green; +1 file / +33 tests vs origin/main |
| Web build | `npm run build` | rolldown success |
| Prod safety | `node scripts/scan-production-dist-safety.mjs` | 21 files scanned, pass |
| Lockfile | `git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml` | empty |
| pnpm | `test ! -e pnpm-lock.yaml` | true |
| Whitespace | `git diff --check` | clean |
| Swift × 9 | `swift test --package-path ios/packages/IronPath*` | all green; `IronPathTrainingDecision` still 128 |
| Xcode | `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'generic/platform=iOS Simulator' build` | BUILD SUCCEEDED |
| Xcode (iPhone 17 Pro) | same with `-destination 'platform=iOS Simulator,name=iPhone 17 Pro'` | BUILD SUCCEEDED |

The new file `tests/iosNativeFocusModeShellStaticGuards.test.ts` is the one
that locks all of: file existence, ContentView wiring, required imports,
six required slice fields, `perExercise` consumption, target-set badge, CJK
labels + the disclaimer string, forbidden imports
(HealthKit / CloudSync / Supabase / WebKit / JavaScriptCore /
URLSession / TS runtime), no AppData mutation, parity --check still 14 / 0,
package.json / lockfile byte-equality to `origin/main`, and the IronPath
app target's `IronPathTrainingDecision` link in `pbxproj`.

## 11. Remaining risks

- **Sample data drift.** `FocusModePreviewData` is hand-written rather than
  derived from a golden. If the engine adds a required `CleanTrainingDecisionInputMetadata`
  field, the sample needs an explicit update — but that compile-time miss
  will surface in `xcodebuild`, not silently in the user UI.
- **One sample only.** The current shell shows exactly one slice. A future
  PR can add a fixture picker (severe-rest, deload-week, productive-floor) so
  the UI can demonstrate the no-all-1-set path under stress, but this PR
  intentionally keeps the surface area minimal.
- **Xcode-only project deltas.** `objectVersion 60`, `LastUpgradeCheck 2650`,
  `STRING_CATALOG_GENERATE_SYMBOLS = YES`, scheme `LastUpgradeVersion 2650`,
  and the `Main` group's lost comment are all Xcode-UI side effects, not
  manual edits. Any reviewer who insists on minimal `pbxproj` diff should be
  aware these were not configurable.
- **iOS-4B6 still pending.** The shell does not render `userFacing` text
  (advice / why / chips) yet. That is deferred to iOS-4B6 and the shell will
  pick it up the moment the field lands in `TrainingDecisionCoreSlice`.

## 12. Next task recommendation

Following iOS-5 merge, the next worthwhile native step is **iOS-6 Focus Mode
Sample Selector + Severe-Rest / Productive-Floor Demos V1**:

- Add a small in-app picker (Picker / segmented control) that swaps between
  ≥3 deterministic samples (`normal-session`, `productive-floor`,
  `severe-rest`).
- Prove visually that severe-rest is the *only* legal 1-set conservative path
  and productive-floor stays > 1 set on compounds.
- Still no Cloud / HealthKit / network. Still Xcode-led.

In parallel (non-blocking), iOS-4B6 (`userFacing` + full `arbitrationTrace`) can
land on its own track; iOS-6 should pick up `slice.userFacing` whenever it
appears.
