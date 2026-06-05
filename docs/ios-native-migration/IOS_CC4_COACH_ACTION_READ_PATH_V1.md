# CC-4 — Coach-Action Read Path (LIVE read-only surface) + ②③ audit fixes V1

Status: merged on the `cc4-coach-action-ui` branch. Capstone of the coach-action (CC) track:
the CC-0…3 engines were ported + parity-pinned but "NOT wired into any UI"; CC-4 adds the FIRST
read-only consumer and lands the ②③ audit fixes. **Pure / read-only — no source-of-truth write
(dismiss persistence is deferred to CC-5).** See the master architecture §11 (CC-4 note) + §27 row.

## What landed

### Live read path (package — `IronPathTrainingDecision`)
- **`CoachActionReadPath.swift`** (new, SPM-auto-included — no `Package.swift`/pbxproj edit):
  - `enum CoachActionAppDataLoadOutcome` (`missing` / `unreadable` / `loaded(CleanAppDataView)`).
  - `enum CoachActionSurfaceState` (`ready` / `empty` / `unavailable`).
  - `func resolveCoachActionState(_:now:)` — the PURE resolver. Mirrors
    `resolveNextWorkoutScheduleState`: from the DataHealth clean view it assembles a CLEAN-DERIVED
    `BuildCoachActionsInput` and calls `CoachActionEngine.buildCoachActions`. The engine input is
    **never raw AppData** — a freshly-built `AppData` carries only the CLEANED `cleanedActiveSession`
    + the CONFIG `templates` slot (the `NextWorkoutReadPath` precedent), plus the SC-C next-workout
    (+ nested SC-A recovery) over the cleaned history. Other upstream signals (dataHealth /
    dailyAdjustment / sessionQuality / plateau / volume / recommendationConfidence / setAnomaly) stay
    at honest nil defaults (SCOPE HONESTY — they light up when their own sources wire).
  - `struct CoachActionSurfaceSummary` — the read-only presentation projection, a faithful Swift
    mirror of the PWA `coachActionPresenter` / `CoachActionList` / `CoachActionCard` (source / priority
    / status labels, fallback title/description, `getCoachActionPrimaryLabel`, `cleanText` token +
    mojibake scrub, pending-only `today` surface, priority-DESC + zh-Hans-CN title sort). The dismiss
    control is carried as `secondaryLabel` (+ `dismissDeferredNote`) — DISPLAY-ONLY.

### Live wiring (app — inside the existing `ios/IronPath/TodayRootView.swift`, no new app file)
- **`CoachActionSurfaceModel`** — a thin `@MainActor ObservableObject` mirroring `TrainingInsightsModel`:
  opts the running app into the SAME sanctioned canonical store, loads it READ-ONLY, builds the
  DataHealth clean view (`buildCleanAppDataView`, the §10 chokepoint), and delegates to
  `resolveCoachActionState`. NEVER writes. A SINGLE injected instant drives both the clean view's
  guard clock and the engine's `nowIso`.
- The 教练建议 block renders cards (title + source / priority / status, description, 需要确认/只查看
  (+ 可撤销), optional disabled reason, read-only primary label) with an honest empty state and a
  DISABLED "暂不处理" + a "持久化待 CC-5" note. `#Preview("含教练动作")` added.

### ②③ audit fixes
- **③ (highest-priority — the iOS-17e-6a `asOfDate` same-class silent regression).**
  `buildCoachActions` stamps `createdAt` from `nonEmpty(now) ?? ""` (coachActionEngine.ts:637 wall-
  clock default NOT ported). CC-4 is the FIRST live caller, so it INJECTS the pipeline `nowIso` and
  `precondition`-asserts it non-empty in `resolveCoachActionState` BEFORE the builder → the `""` branch
  is UNREACHABLE on the live path (the runtime assert 17e-6a deferred for want of a live call site now
  LANDS). A comment-only cross-reference marks the engine's `createdAt` seam (zero golden impact).
  Pinned by `CoachActionReadPathTests.test_injectedNowIso_becomesCreatedAt_neverEmptyFallback`.
- **② (audit) — `WeeklyCoachActionEngine` `confidence: current.confidence` (ts:340).** The flattened
  `E1RMSignal` carries `currentE1rmKg`/`currentConfidence` as separate optionals; the guard binds only
  `currentE1rmKg`. `EstimatedOneRepMax.confidence` is REQUIRED (training-model.ts:1041), so on every
  faithful input confidence rides with current (every CC-1 golden byte-identical). The old silent
  `?? "medium"` (a fallback TS never has) drops to `?? ""` → `EstimateConfidence(rawValue: "")` is nil
  → the key is OMITTED, faithfully reproducing TS's absent-confidence (`undefined`). Pinned by
  `testE1RMConfidenceIsFaithfulNoMediumFallback`.

## Boundaries held
- Pure read-only; the engine eats CLEAN-derived input, never raw AppData (§10/§11).
- Zero `: Date` in the engines; the §11.2 clock is the injected `now: Date` (the `NextWorkoutReadPath`
  seam). No `CanonicalSessionWriter` / §8 write-boundary touch.
- CC-0…3 engine parity UNCHANGED (no engine semantics edited; ② is golden-neutral). Every parity
  golden byte-identical — zero `--diff-filter=MD`.
- `project.pbxproj` / `package.json` / lockfiles / both `Package.swift` byte-unchanged. New package
  source is SPM-auto-included; app code lands inside the existing `TodayRootView.swift`.

## Deferred to CC-5
- The gated **dismiss WRITE** (`dismissCoachActionToday` persistence via the §8 write path). CC-4
  shows the dismiss control disabled and honestly notes the deferral; it does not persist anything.
