# iOS-17b Native Per-Set Capture + In-RAM Session V1

> Status: product-loop bundle (single PR), the **first actionable slice** of the
> approved iOS-17 set-logging epic (see
> [`IOS_17_SET_LOGGING_ARCHITECTURE_REVIEW_V1.md`](IOS_17_SET_LOGGING_ARCHITECTURE_REVIEW_V1.md),
> Option C approved; capture granularity = full per-set). Local-only. No Cloud,
> CloudKit, iCloud, HealthKit, Supabase, network, WebView, auth, UserDefaults,
> SQLite, CoreData, or SwiftData.
>
> Binding contract: obey [`docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`](../IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md).
> This is an **Allowed Change Pattern** (§19.2 extend an active package with pure
> logic + §19.3 improve the thin app layer + §19.5 documentation). It is the
> **zero-boundary** capture half of the epic: **no persistence, no source-of-truth
> change, no snapshot/schema change, no engine, no Domain-type change.** The
> source-of-truth boundary (first native canonical-AppData write) is activated
> only in **iOS-17c**, which amends master §8 in the same PR. If any step here
> would conflict with that document, stop and escalate before writing code.

## Goal

Capture per-set **weight / reps / RIR** during a live Focus session and hold it
in the view-model **in RAM only**, using the already-typed
`IronPathDomain.ActualSetDraft`. Weight is entered in a display unit (kg/lb) and
**stored in kilograms**. Nothing is persisted — that is the deferred iOS-17c
slice.

## Why iOS-17b follows the iOS-17 review

The review (iOS-17.0) found the user-visible "逐组小结" cannot be a slice today
because the native app **never captures** per-set performance data — the live
session tracks only a set *count* (`completedSets`). iOS-17a (Domain typing) is
already satisfied by iOS-2C (`ActualSetDraft` / `TrainingSetLog` /
`TrainingSession.focusActualSetDrafts` are typed, kg-stored, open-bag preserved,
parity-cited). So the first actionable slice is **17b: capture + in-RAM session**,
with **no persistence and no boundary activation**.

## Scope

A single vertical slice: a pure capture-support helper in `IronPathDomain` + an
in-RAM capture state in `FocusModeMvpState` + a thin capture UI in
`FocusSetChecklistView`. Target **no new app Swift files → no `project.pbxproj`
change** (the new *package* file is auto-included by SPM; the new app behavior
lives in existing app files).

In scope:

1. **Pure capture support** (`IronPathDomain`, new file `NativeSetCaptureSupport.swift`):
   - `WeightConversion.toKilograms / fromKilograms` — display-unit ⇄ kg (exact
     NIST kg/lb factor; nil-safe; `.kg` identity).
   - `ActualSetDraftFactory.capturedDraft(...)` — build an `ActualSetDraft` for
     one captured set (0-based `setIndex` = prior completed count; kg-stored
     weight; blank fields stay nil; uses the existing type's public init — does
     **not** modify it).
2. **In-RAM session capture** (`FocusModeMvpState`):
   - `capturedSetDraftsByExerciseId: [String: [ActualSetDraft]]` (in RAM only),
     `captureDisplayUnit: WeightUnit` (in-RAM UI state, default `.kg`),
     `captureSet(for:target:weightInDisplayUnit:reps:rir:)` which converts to kg,
     builds a draft (`completedAt` from the injectable clock), appends it, and
     **reuses the unchanged `completeOneSet` count path**.
3. **Thin capture UI** (`FocusSetChecklistView` + `FocusModeShellView` wiring):
   weight/reps/RIR fields + a kg/lb toggle on the current-exercise card; blank
   inputs still complete the set (honest degrade); render-only.

## Existing building blocks this slice reuses (no rewrite, no Domain change)

- `IronPathDomain.ActualSetDraft` — `setIndex/weight/reps/rir/exerciseId/source/
  completedAt`, all optional, kg-stored, open-bag preserved, round-tripped
  (iOS-2C). **Used, never modified.**
- `IronPathDomain.WeightUnit` (kg/lb) + the "storage is always kilograms"
  contract — the conversion helper sits next to it.
- `FocusModeMvpState.completeOneSet(for:target:)` + `completedSetsByExerciseId` —
  the count path is reused **unchanged**, so restore/reconcile (iOS-11/13) and
  the count-based snapshot are unaffected.
- The injectable deterministic clock (`clock`) — `completedAt` uses it, so
  tests/previews stay reproducible (`useSystemClock()` remains the single
  launch-time opt-in).

## Detail design — capture state + coexistence (FocusModeMvpState)

- `captureSet(...)` reads the current count, **guards `current < target`** (at
  target the button is disabled → no fake capture), converts the entered weight
  to kg via `WeightConversion`, builds the draft via `ActualSetDraftFactory`
  (`setIndex = current`, `completedAt = iso8601(clock())`, `source =
  local-ios-focus-mvp`), appends it, then calls the **existing**
  `completeOneSet`. So for sets captured this session, `capturedSets(for:).count
  == completedSets(for:)`.
- **Coexistence with the count + restore:** the captured-drafts dictionary is
  cleared exactly where `completedSetsByExerciseId` is cleared/replaced —
  `resetProgress()` (covers `setScenario` + `startNewSession`) and inside
  `restoreDraft` (restored counts carry **no** per-set detail, so stale drafts
  must not bleed in). **`restoreDraft`/`reconcile` semantics are unchanged** —
  the same counts/cursor/stage are restored; only the new in-RAM field is reset
  alongside them.

## Detail design — conversion (kg storage, no drift)

The capture UI enters weight in `captureDisplayUnit` (kg/lb, default kg). The
view-model converts to kg with `WeightConversion.toKilograms` **before** building
the draft, so storage is always kg regardless of the display unit. A blank
weight converts to nil (honest "not entered", never a fabricated 0).

## Detail design — thin UI (render + wiring only)

- `FocusSetChecklistView` gains a kg/lb segmented toggle (bound to
  `state.captureDisplayUnit`) + three optional text fields (重量/次数/RIR). On
  "完成本组" it parses its fields to `Double?`/`Int?` and calls `onCompleteSet`,
  then clears them. Parsing is input handling, not business logic; conversion +
  draft building live in the view-model/helper.
- `FocusModeShellView` wires `onCompleteSet` to `state.captureSet(...)` and binds
  `$state.captureDisplayUnit`. No other behavior changes.

## Safety boundaries (re-locked)

- **No persistence.** No canonical-AppData write, no `IronPathPersistence.save`,
  no `LocalSnapshot` change, no snapshot schema bump. Captured drafts live only
  in RAM and vanish on reset/relaunch. Source-of-truth impact: **none.**
- **No Domain-type change.** `ActualSetDraft`/`TrainingSetLog`/`TrainingSession`
  are used, never modified; the new file adds only pure helpers.
- **kg is the stored unit** — `WeightConversion` converts on capture; no display
  unit ever reaches storage (guarded by a unit test).
- **Count + restore unchanged.** `completeOneSet` is reused as-is; `restoreDraft`
  /`reconcile` semantics are identical (drafts are only reset alongside counts).
- **Determinism.** `completedAt` uses the injectable clock (deterministic by
  default); package tests use fixed ISO strings.
- **No engine, no parity goldens.** `TrainingDecision` is untouched; engine
  output is unchanged → no golden regeneration. `iOS-4B6` stays deferred.
- **Local-only.** No forbidden API; `iosLocalJsonPersistenceStaticGuards` stays
  green. No stub package, no `project.pbxproj`, no `package.json`/lockfile change.

## Non-goals (deferred to later slices / gated)

- **Persistence of performed sets (iOS-17c)** — the first native canonical-AppData
  write path via `IronPathPersistence.save`, gated by DataHealth, amending §8.
  **Not in 17b.**
- **History/detail "last set summary" (iOS-17d)** — rendering the persisted data;
  optional denormalized snapshot copy (schema v3 + migration). Not in 17b.
- **Engine consumption (iOS-17e)** — deferred out of the epic.
- Cloud/HealthKit/accounts remain gated; performed data does not leave the device.
- Editing/deleting captured sets; warm-up vs working-set distinction; rest timer.

## Validation

Swift + docs change → §21.1 (CI / TypeScript) **and** §21.2 (local Swift) apply.
No TS source changes → no parity-golden regeneration.

```bash
# Inner loop (after each package change):
swift test --package-path ios/packages/IronPathDomain   # existing + new capture-support tests

# Wrap-up (run once before the PR; must pass NORMALLY, no --admin):
npm run api:dev:build
npm run typecheck
npm test
npm run build
git diff --check                 # no whitespace/conflict markers
# package.json + package-lock.json MUST be byte-identical

# (sanity) the other 9 packages remain green:
#   for p in IronPathDataHealth IronPathTrainingDecision IronPathPersistence \
#            IronPathLocalSnapshot IronPathL10n IronPathHealthKit \
#            IronPathCloudSync IronPathBackup IronPathUIKit; do
#     (cd ios/packages/$p && swift test); done

# App build (both destinations):
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' build
  # If the generic build fails locally with "requires a development team", append
  # CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO (local env limitation; CI
  # does not build Swift).
```

New package tests (pure, deterministic): kg identity, lb→kg (exact factor),
kg→lb, lb round-trip stability, nil-stays-nil; draft stores kg (never the display
value), setIndex == prior count (0/1/2), blank fields stay nil, factory output
round-trips through `ActualSetDraft.encoded()/decoding`, whole-kg has no trailing
decimal.

**Honest test-coverage note:** the pure capture logic (conversion + draft
factory) is unit-tested in the `IronPathDomain` test target. The view-model
wiring (`captureSet`, dictionary state, reset/restore coexistence) lives in the
**app target**, which has **no XCTest target** (deferred since iOS-9, pbxproj-test
risk) — it is covered by `xcodebuild` (compiles) + the unchanged
`IronPathLocalSnapshot` restore/reconcile tests still passing + the manual
Simulator smoke below. No app-target unit test is added in this slice.

## Manual Simulator smoke checklist

1. Start a session → the current-exercise card shows a kg/lb toggle + 重量/次数/RIR
   fields above "完成本组".
2. Enter weight/reps/RIR, tap 完成本组 → count advances, fields clear; repeat →
   count advances per set.
3. Leave the fields blank, tap 完成本组 → the set still completes (honest degrade),
   no crash.
4. Switch the toggle to lb, enter a weight → the set still completes (stored kg
   under the hood); switching units does not corrupt the count.
5. 重置样例 / switch scenario → count and captured entries both reset.
6. Continue a saved session (restore) → restored counts appear; capturing a new
   set continues from the restored count; the restore banner/drift still behaves
   as before.
7. No cloud/network/auth prompts; nothing is persisted (relaunch shows no
   captured sets — by design this slice).

## Next recommended task

**iOS-17c — Canonical-AppData write path (the boundary slice).** Persist captured
sets via `IronPathPersistence.save`, gated by DataHealth, backup-before-overwrite,
no-fake-success — **amending master §8 in the same PR**. Then iOS-17d (history
detail summary). `iOS-17e` (engine) and full AppData restore remain deferred/gated.

---

## Appendix — §25 Future Task Prompt Template (filled)

```markdown
## Task: iOS-17b Native Per-Set Capture + In-RAM Session V1

**Baseline commit:** 73b60ec  (latest origin/main; iOS-16 #421)
**Goal:** Capture per-set weight/reps/RIR during a live Focus session into in-RAM ActualSetDraft (kg-stored), no persistence.
**Scope:** One vertical slice — pure capture support in IronPathDomain + in-RAM state in FocusModeMvpState + thin capture UI. No persistence, no engine, no Domain-type change.

**Allowed files / systems:**
- ios/packages/IronPathDomain/** (new pure WeightConversion + ActualSetDraftFactory + tests)
- ios/IronPath/FocusSetChecklistView.swift, FocusModeMvpState.swift, FocusModeShellView.swift (render/wiring only)
- docs/ios-native-migration/**, docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md (descriptive refresh, §19.5)

**Forbidden files / systems:**
- Any persistence (canonical AppData write, IronPathPersistence.save, LocalSnapshot/schema change) — deferred to 17c/17d
- New/modified Domain types (ActualSetDraft/TrainingSetLog/TrainingSession — use, don't change)
- reconcile / restoreDraft semantics (restore stays an in-memory draft)
- project.pbxproj (no new app files); package.json / package-lock.json
- Any stub package; CloudKit/iCloud/Supabase/HealthKit/URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData
- IronPathLocalSnapshot coupling to IronPathDomain/AppData; weight stored in a non-kg unit

**Source-of-truth impact:** none (pure in-RAM, no persistence).
**Data safety impact:** no schema/timestamp/persistence change; existing completedSets count + draft restore unaffected; no §14 gate; engine output unchanged → no parity-golden regeneration.

**Validation commands:**
- swift test for ios/packages/IronPathDomain (+ sanity on the other 9)
- npm run api:dev:build && npm run typecheck && npm test && npm run build ; git diff --check
- xcodebuild iPhone 17 Pro Simulator + generic/platform=iOS

**PR & merge rules:**
- Branch from latest origin/main (no worktree); never commit to main → branch: ios-17b-native-set-capture
- Open PR; wait for required checks; if repo auto-merge is disabled, `gh pr checks <n> --watch` then a normal squash merge
- No --admin; no branch-protection bypass; run git writes serially (gate then commit)

**Cleanup rules:**
- Commit only intended files (NOT .claude/*); delete branch after squash merge; leave repo clean
```
