# iOS Native Migration Entry Gate V1 — Agent 2 Report
## TypeScript Core Logic & Engine Agent

> Audit scope: docs/planning only. No runtime code touched. No Swift files created.
> Date: 2026-05-27. Working tree: `peaceful-hugle-21e407`.

---

## 1. Mission

Map every engine and core pure-logic module in IronPath's TypeScript codebase,
classify each by portability to Swift, and produce a prioritised port plan plus
a cross-language fixture wishlist.

The native iOS rewrite needs a clean answer to three questions:

1. Which engines are pure TypeScript domain logic that can be translated to
   Swift line-for-line (preserving observable behaviour)?
2. Which engines are messy enough that we should re-derive them from their
   tests / specs in Swift rather than translate?
3. Which engines are not domain logic at all — PWA shell, web persistence,
   browser-only diagnostics — and should simply be dropped in the iOS app?

This report does **not** design the iOS architecture (that is Agent 5) and
does **not** redesign data-repair (Agent 3 owns `src/dataHealth/`). Where the
two overlap, I classify the engine but leave the design call to Agent 3.

---

## 2. Files / dirs inspected

| Area                                            | What I looked at                                              |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `src/engines/` (113 `*.ts` at depth ≤ 2)        | enumerated via `find`, then `head -8` on each to read imports |
| `src/engines/explainability/`                   | all 6 files                                                   |
| `src/presenters/` (10 files)                    | full import scan + selective head-30 read                     |
| `src/models/training-model.ts` + 2 schema JSON  | top-level shape, exported `as const` enums                    |
| `src/features/*.tsx` (9 view files)             | `grep` of every `from '../engines/'` / `from '../presenters/'` |
| `src/dataHealth/` (11 files)                    | engine classification only; design deferred to Agent 3        |
| `src/storage/` (16 files)                       | browser-API grep + `head` of adapters                         |
| `src/content/`                                  | only confirmed `professionalCopy` / `evidenceRules` exist     |

Numbers:

- **119** `*.ts` files under `src/engines/` at depth ≤ 2.
- **113** at depth 1 (top-level engines).
- **6** under `src/engines/explainability/`.
- **0** engines import `react`.
- **2** engines reference real browser globals (`analytics.ts`, `healthImportEngine.ts`); 2 other matches (`effectiveTrainingPhaseEngine.ts`, `setByRirAdjustmentEngine.ts`) were false positives in comments.
- **9** files in `src/features/` are React views (`.tsx`); none of them are `.ts`-only logic.
- **31,926** total LOC in `src/engines/*.ts` (depth 1). Largest single file: `trainingDecisionEngine.ts` at **2,097 LOC**.

---

## 3. Engine inventory table

Legend:

- **Class.** = classification bucket
  - `PURE_DOMAIN` — pure functions over typed inputs; port to Swift directly
  - `UI_COUPLED` — domain decisions tangled with UI strings / view-model shape; port the decision part
  - `BROWSER_DEPENDENT` — touches DOM / `localStorage` / `navigator` / `fetch`; rewrite for iOS
  - `TEST_OR_SPEC_ONLY` — only exists to support tests; do not port
  - `OBSOLETE_PWA` — PWA-specific (manifest, A2HS, etc); drop
  - `REFERENCE_ONLY` — keep TS as canonical reference, do not port (one-time migrations, dev diagnostics)
- **Prio** = Swift port priority — `P0` (foundation, port first), `P1` (core), `P2` (high-value), `P3` (defer), `SKIP` (do not port).

Engines are listed in file-system order (matches `find ... | sort`). Notes capture imports, side-effects, and any subtle non-purity (wall-clock reads via `Date.now()` are noted because they need a `Clock` abstraction in Swift, not because they block porting).

### 3a. Top-level engines (`src/engines/*.ts`)

| # | File | Class. | Prio | Notes |
|---|---|---|---|---|
| 1 | `actionableLoadContract.ts` | PURE_DOMAIN | P1 | Combines equipment-aware prescription + unit settings. Pure transform. |
| 2 | `adaptiveCalibrationSummaryEngine.ts` | PURE_DOMAIN | P2 | Pure aggregation over `AdaptiveCalibrationState`. |
| 3 | `adaptiveFeedbackEngine.ts` | PURE_DOMAIN | P0 | Foundation: deload decisions, performance snapshot, screening reconciliation. Used everywhere. |
| 4 | `adaptiveRecommendationEngine.ts` | PURE_DOMAIN | P1 | Rep-band / day-state calibration updates. Calls `Date.now()` for outcome timestamps — needs `Clock`. |
| 5 | `adherenceAdjustmentEngine.ts` | PURE_DOMAIN | P2 | Small heuristic over `AdherenceReport`. |
| 6 | `adjustmentReviewEngine.ts` | PURE_DOMAIN | P2 | Pulls together `analytics`, `effectiveSet`, `painPattern` to score a program adjustment. |
| 7 | `analytics.ts` | BROWSER_DEPENDENT (1 fn) + PURE_DOMAIN (rest) | P1 | All analytic aggregations (`buildMonthStats`, `buildPrs`, `buildAdherenceReport`, `buildBodyWeightMomentum`) are pure. **Only `downloadText` uses `document.createElement('a')`** — that one helper is OBSOLETE_PWA (CSV export). Split when porting. |
| 8 | `appleHealthStreamingImportEngine.ts` | PURE_DOMAIN | P2 | Streaming XML parser. Uses `AbortSignal` and `Date.now()` but no DOM. Heavy — re-implement as Swift `XMLParser` delegate instead of porting; behaviour spec'd by tests. |
| 9 | `appleHealthTypeMap.ts` | PURE_DOMAIN | P2 | Static mapping table + unit conversions. Trivial port. |
| 10 | `appleHealthXmlImportEngine.ts` | PURE_DOMAIN | P2 | Pure parser. Same comment as #8 — derive from tests, not line-by-line. |
| 11 | `autoDeloadTriggerEngine.ts` | PURE_DOMAIN | P1 | Feature #19. Clean. |
| 12 | `coachActionDismissEngine.ts` | PURE_DOMAIN | P1 | Fingerprint-based dismiss filtering. Pure. |
| 13 | `coachActionEngine.ts` | UI_COUPLED | P0 | Builds `CoachAction[]` from many engines. Imports `i18n/formatters` (Chinese display names) — the decision part is pure, but the rendered `title`/`description` strings should be re-derived in Swift from localised `Strings.swift`, not literal-translated. |
| 14 | `coachActionIdentityEngine.ts` | PURE_DOMAIN | P0 | Fingerprint algorithm. Must port byte-identically (otherwise dismiss-state breaks). High parity-fixture priority. |
| 15 | `currentExerciseSelector.ts` | PURE_DOMAIN | P1 | Resolves `originalExerciseId / actualExerciseId / displayExerciseId / recordExerciseId` from session + step. **Subtle but load-bearing identity contract.** Parity fixture required. |
| 16 | `dailyTrainingAdjustmentEngine.ts` | PURE_DOMAIN | P1 | Signal-only (V2 hard rewrite). Returns reason codes + numeric `suggestedChanges`, no user-facing copy. Easy port. |
| 17 | `dataHealthClaritySummary.ts` | PURE_DOMAIN | P1 | No imports from `models/`; pure string→severity. Trivial. |
| 18 | `dataHealthEngine.ts` | UI_COUPLED | P1 | Issue detection mixes severity logic with Chinese `userMessage` strings. Decision logic = pure; copy gets re-derived in Swift. **Agent 3 will design the iOS data-health flow.** |
| 19 | `dataHealthRepairEngine.ts` | UI_COUPLED | P2 | Same shape as #18 — pure repair plan + Chinese log strings. Defer to Agent 3 design. |
| 20 | `dataRepairEngine.ts` | UI_COUPLED | P2 | Older repair-plan generator; some overlap with #19. Likely consolidated in iOS — Agent 3 call. |
| 21 | `derivedStateInvalidationEngine.ts` | PURE_DOMAIN | P1 | Pure event → invalidation-flag table. Trivial Swift `switch`. |
| 22 | `e1rmEngine.ts` | PURE_DOMAIN | P0 | Estimates 1RM from set logs; used by analytics, plateau, weekly coach, training-level, fine-tune. **Dependency root.** Must port first. |
| 23 | `effectiveSetEngine.ts` | PURE_DOMAIN | P0 | Scores each completed set; foundation for volume, quality, trainingLevel, dataHealth. **Dependency root.** |
| 24 | `effectiveSetExplanationEngine.ts` | UI_COUPLED | P2 | Reason codes are pure; labels are Chinese strings. Port the codes only. |
| 25 | `effectiveTrainingPhaseEngine.ts` | PURE_DOMAIN | P1 | Gap-detection state machine for mesocycle re-entry. Comment block claims "no persistence-layer side-effects". Pure. |
| 26 | `enginePipeline.ts` | PURE_DOMAIN | P0 | Single entry that wires CleanAppDataView → coach actions / next workout / today state / data health. **In Swift this is the place every UI screen will call.** Port skeleton early; fill in as sub-engines land. |
| 27 | `engineUtils.ts` | PURE_DOMAIN | P0 | Tiny helpers: `number`, `clamp`, `isCompletedSet`, `formatDate`, `monthKey`, `setVolume`, `sessionVolume`, `clone`, etc. Used by ~80 % of engines. **Port first.** |
| 28 | `equipmentAwareActionablePrescription.ts` | PURE_DOMAIN | P1 | Layered on top of `equipmentAwareLoadModel` + `equipmentAwareRecommendationDisplay`. Pure. |
| 29 | `equipmentAwareLoadModel.ts` | PURE_DOMAIN | P0 | Defines `EQUIPMENT_KINDS`, plate math, rounding modes. **Dependency root** for any focus-mode load recommendation. |
| 30 | `equipmentAwareRecommendationDisplay.ts` | UI_COUPLED | P2 | Decision pure; some display strings ("加 5 kg / 减 5 kg"). |
| 31 | `equipmentFallbackEngine.ts` | PURE_DOMAIN | P2 | Feature #25 alternative-exercise ranking. Pure. |
| 32 | `equipmentProfileDraft.ts` | PURE_DOMAIN | P2 | Constructors / mutations over `EquipmentProfile`. |
| 33 | `exerciseDataAuditEngine.ts` | PURE_DOMAIN | P3 | Dev-time sanity audit over `EXERCISE_DISPLAY_NAMES` / aliases. Consider REFERENCE_ONLY if iOS uses static seed files. |
| 34 | `exerciseEfficiencyEngine.ts` | PURE_DOMAIN | P2 | Feature #26 stimulus-per-fatigue ratio. |
| 35 | `exerciseEquipmentProfiles.ts` | PURE_DOMAIN | P2 | Default profile factories. |
| 36 | `exercisePathEngine.ts` | PURE_DOMAIN | P2 | Learning-path step builder. Pure, uses `EXERCISE_DISPLAY_NAMES`. |
| 37 | `exercisePrescriptionEngine.ts` | PURE_DOMAIN | P0 | Builds the per-exercise prescription (sets × reps × weight). **Dependency root.** Co-exported with `progressionEngine`. |
| 38 | `exerciseRecoveryConflictEngine.ts` | UI_COUPLED | P2 | Pure conflict detection; Chinese display names imported. |
| 39 | `exerciseTypeBucketEngine.ts` | PURE_DOMAIN | P2 | Feature #5 compound vs isolation bucketing + RIR window. |
| 40 | `explainabilityEngine.ts` | TEST_OR_SPEC_ONLY (barrel) | SKIP | One line: `export * from './explainability';`. Drop in Swift — Swift has no barrel concept. |
| 41 | `feasibleLoadEngine.ts` | PURE_DOMAIN | P0 | Plate-feasibility math. **Dependency root** for actionable prescription. |
| 42 | `focusModeInteractionState.ts` | PURE_DOMAIN | P1 | Pure enum state machine (session / exercise / set / recommendation states). Trivial Swift enum port. |
| 43 | `focusModeStateEngine.ts` | PURE_DOMAIN | P0 | 903 LOC. Drives the focus-mode workout state machine. Many dependencies (`engineUtils`, `restTimer`, `unitConversion`, `warmupPolicy`, `actionableLoadContract`, `workoutExecutionStateMachine`). **Backbone of the active-workout screen** — port early. |
| 44 | `focusNextSetRecommendationEngine.ts` | PURE_DOMAIN | P0 | Computes "next set" weight/reps. UI-critical. |
| 45 | `goalConsistencyEngine.ts` | PURE_DOMAIN | P2 | Normalises primary goal vs training mode. |
| 46 | `guardedRecommendationContractEngine.ts` | PURE_DOMAIN | P2 | Contract / guard layer over recommendation outputs. Pure type discrimination. |
| 47 | `healthImportEngine.ts` | BROWSER_DEPENDENT | P2 | Uses `navigator.userAgent` / `maxTouchPoints` to detect mobile, and a `File`-shaped DOM type. Decision logic is pure; the device-detection helper is moot on iOS (always mobile) — drop it and pass `isMobile = true` in Swift. |
| 48 | `healthSummaryEngine.ts` | PURE_DOMAIN | P1 | Activity-load / sleep / HRV aggregations. Pure. |
| 49 | `historyCalendarSummary.ts` | PURE_DOMAIN | P1 | Pure aggregation. Uses `Date()` for "today" — Clock abstraction. |
| 50 | `loadFeedbackEngine.ts` | PURE_DOMAIN | P1 | RIR/feedback aggregation. |
| 51 | `mesocycleEngine.ts` | PURE_DOMAIN | P0 | Mesocycle phase math (base / build / overload / deload). Dependency root for plan view. Uses `Date()` — Clock. |
| 52 | `muscleFrequencyAutoAdjustEngine.ts` | PURE_DOMAIN | P2 | Feature #22. Pure 4-week trend. |
| 53 | `nextSessionPreviewEngine.ts` | PURE_DOMAIN | P1 | Pure preview of upcoming session. |
| 54 | `nextWorkoutScheduler.ts` | UI_COUPLED | P0 | Decides what to suggest next; imports `i18n/formatters`. Decision is pure, copy is Chinese. **Dependency root for TodayView.** |
| 55 | `painPatternEngine.ts` | PURE_DOMAIN | P1 | Pure frequency / severity accumulator. |
| 56 | `planAdjustmentIdentityEngine.ts` | PURE_DOMAIN | P1 | Fingerprint + dedupe for plan drafts. Pair with #14. |
| 57 | `plateauDetectionEngine.ts` | PURE_DOMAIN | P1 | Detects exercise plateaus across history. Pure. |
| 58 | `practicalWarmupPolicy.ts` | PURE_DOMAIN | P2 | Warmup-set construction. Pure. |
| 59 | `programAdjustmentEngine.ts` | UI_COUPLED | P2 | Big — builds adjustment drafts; some Chinese copy. Decision part = pure. |
| 60 | `progressionEngine.ts` | TEST_OR_SPEC_ONLY (barrel) | SKIP | Two lines, re-exports `progressionRulesEngine` + `exercisePrescriptionEngine`. Drop in Swift. |
| 61 | `progressionRulesEngine.ts` | PURE_DOMAIN | P0 | Inter-session progression rules. **Dependency root.** |
| 62 | `readinessEngine.ts` | PURE_DOMAIN | P0 | Maps Chinese readiness inputs (差/一般/好) to `ReadinessResult`. Foundation for today / decision engine. |
| 63 | `recentPRDeltaEngine.ts` | PURE_DOMAIN | P2 | Pure aggregation. |
| 64 | `recommendationConfidenceEngine.ts` | PURE_DOMAIN | P1 | Confidence scoring. |
| 65 | `recommendationDiffEngine.ts` | PURE_DOMAIN | P2 | Signal-only diff between recommendations. |
| 66 | `recoveryAwareScheduler.ts` | UI_COUPLED | P1 | Pure schedule decision + Chinese label imports. |
| 67 | `repRangeAutoMigrationEngine.ts` | PURE_DOMAIN | P2 | Feature #3. |
| 68 | `replacementEngine.ts` | PURE_DOMAIN | P0 | Validates / resolves replacement exercise IDs. Touched by ~25 engines. **Dependency root.** |
| 69 | `restTimerEngine.ts` | PURE_DOMAIN | P0 | Pure wall-clock state. Uses `Date.now()` — needs `Clock`. Foundation for focus mode. |
| 70 | `rirCalibrationEngine.ts` | PURE_DOMAIN | P1 | Per-user RIR bias calibration. |
| 71 | `screeningEngine.ts` | PURE_DOMAIN | P1 | Pure screening profile transforms. Tiny. |
| 72 | `sessionBackfillToleranceEngine.ts` | PURE_DOMAIN | P2 | Feature #33. Pure. |
| 73 | `sessionBuilder.ts` | PURE_DOMAIN | P0 | Constructs `TrainingSession` from `ProgramTemplate` + screening + status. **Dependency root.** Uses `Date()` — Clock. |
| 74 | `sessionCompositionEngine.ts` | PURE_DOMAIN | P1 | Counts main/correction/functional steps. Pure. |
| 75 | `sessionDetailSummaryEngine.ts` | UI_COUPLED | P1 | Imports `i18n/formatDataFlag`. Decision pure, labels Chinese. |
| 76 | `sessionEditEngine.ts` | PURE_DOMAIN | P1 | Pure edit-snapshot. Uses `Date.now()`. |
| 77 | `sessionHistoryEngine.ts` | PURE_DOMAIN | P0 | Filters / sorts session history. Used by every analytics surface. |
| 78 | `sessionPatchEngine.ts` | PURE_DOMAIN | P1 | Pending patch apply / consume. |
| 79 | `sessionPostSummaryEngine.ts` | PURE_DOMAIN | P1 | Top-set / volume post-summary. Pure. |
| 80 | `sessionQualityEngine.ts` | PURE_DOMAIN | P1 | Quality result. |
| 81 | `setAnomalyEngine.ts` | PURE_DOMAIN | P1 | Detects bad set inputs. Pure. |
| 82 | `setByRirAdjustmentEngine.ts` | PURE_DOMAIN | P1 | Feature #2 intra-session adjustment. |
| 83 | `setWeightFineTuneEngine.ts` | PURE_DOMAIN | P1 | Feature #1 linear trend fine-tune. |
| 84 | `settingsSafetySummary.ts` | UI_COUPLED | P2 | Settings page safety roll-up. |
| 85 | `smartReplacementEngine.ts` | UI_COUPLED | P1 | Pure ranking + Chinese exercise names. |
| 86 | `sorenessImpactSummaryEngine.ts` | PURE_DOMAIN | P2 | Pure. |
| 87 | `supportPlanEngine.ts` | PURE_DOMAIN | P1 | Builds correction + functional support modules. |
| 88 | `systemConsistencyEngine.ts` | PURE_DOMAIN | P2 | Self-check across templates / aliases. Borderline REFERENCE_ONLY — likely dev-only on iOS. |
| 89 | `themePreferenceModel.ts` | PURE_DOMAIN | P3 | Tiny resolver for theme mode + immersive flag. In iOS, theme is OS-level — only the `focusModeUsesImmersiveDark` decision is interesting. Mostly trivial to recompute. |
| 90 | `todayStateEngine.ts` | PURE_DOMAIN | P0 | TodayView state machine: not_started / planned / in_progress / completed / skipped. **Dependency root for TodayView.** Uses `Date()` via `toLocalDateKey`. |
| 91 | `todayTrainingFocusOverrideEngine.ts` | UI_COUPLED | P2 | Override decision pure + Chinese template names. |
| 92 | `todayTrainingReadinessDecisionEngine.ts` | PURE_DOMAIN | P1 | Signal-only after V2 hard rewrite. Returns reason codes; UI adapts. |
| 93 | `trainingCadenceAdvisorEngine.ts` | PURE_DOMAIN | P2 | Cadence advice (rebuild / maintain / extend). |
| 94 | `trainingCalendarEngine.ts` | PURE_DOMAIN | P0 | Calendar day model. `toLocalDateKey` is used by ~12 other engines. **Dependency root.** |
| 95 | `trainingCompletionEngine.ts` | PURE_DOMAIN | P0 | Applies completion to AppData (reconciles screening, updates calibration). **Critical** — the moment the user finishes a session. |
| 96 | `trainingDecisionCleanInput.ts` | PURE_DOMAIN | P0 | The branded `CleanTrainingDecisionInput` factory. Locks the input boundary for TrainingDecision. Tiny, must port byte-identical (brand check). |
| 97 | `trainingDecisionContext.ts` | PURE_DOMAIN | P0 | Aggregates AppData into the input context for TrainingDecision. |
| 98 | `trainingDecisionEngine.ts` | UI_COUPLED | P0 | **2,097 LOC.** Sole final-decision owner per V2 hard rewrite. Every surface's user-facing payload (progress / plan / record / today / explanation / training / focus) is produced here. Has a lot of Chinese copy inlined. **Re-derive from tests in Swift, do not literal-translate.** This is the largest single port effort. |
| 99 | `trainingDecisionTypes.ts` | PURE_DOMAIN | P0 | Type declarations for TrainingDecision. No runtime. Port to Swift types first. |
| 100 | `trainingEngine.ts` | TEST_OR_SPEC_ONLY (barrel) | SKIP | 19-line barrel re-exporting most engines. Drop in Swift. |
| 101 | `trainingIntelligenceSummaryEngine.ts` | PURE_DOMAIN | P2 | Aggregator. |
| 102 | `trainingLapseBannerEngine.ts` | PURE_DOMAIN | P2 | Banner state from lapse signal. Pure. |
| 103 | `trainingLapseEngine.ts` | PURE_DOMAIN | P1 | Computes lapse stage from history + calibration. Pure; `Date()` Clock. |
| 104 | `trainingLevelEngine.ts` | UI_COUPLED | P1 | Beginner/intermediate/advanced assessment + Chinese label. Decision pure. |
| 105 | `trainingStreakEngine.ts` | PURE_DOMAIN | P2 | Weekly / monthly streaks. Pure. |
| 106 | `trainingViewCompletionEngine.ts` | PURE_DOMAIN | P1 | Set completion in the "old" training view (pre-focus). Pure. May be redundant once iOS app commits to focus-only flow — discuss with Agent 5. |
| 107 | `unitConversionEngine.ts` | PURE_DOMAIN | P0 | kg ↔ lb, formatting. Used in ~30 engines. **Port first.** |
| 108 | `volumeAdaptationEngine.ts` | PURE_DOMAIN | P1 | Weekly muscle-volume adaptation report. Pure. |
| 109 | `warmupPolicyEngine.ts` | PURE_DOMAIN | P1 | Warmup decision. |
| 110 | `weeklyCoachActionEngine.ts` | UI_COUPLED | P1 | Weekly action recommendations; Chinese muscle names. Decision pure. |
| 111 | `weeklyMuscleBalanceEngine.ts` | PURE_DOMAIN | P1 | Balance per muscle. Pure. |
| 112 | `workoutCycleScheduler.ts` | PURE_DOMAIN | P1 | Cycle scheduling (which template next). Pure. |
| 113 | `workoutExecutionStateMachine.ts` | PURE_DOMAIN | P1 | State transitions during a session. Pure. |

### 3b. Explainability subfolder (`src/engines/explainability/`)

| # | File | Class. | Prio | Notes |
|---|---|---|---|---|
| 114 | `adjustmentExplainability.ts` | UI_COUPLED | P2 | Chinese explanation copy via `professionalCopy`. |
| 115 | `evidenceExplainability.ts` | UI_COUPLED | P2 | Maps evidence rules to labels. Pure decision + Chinese labels. |
| 116 | `index.ts` | TEST_OR_SPEC_ONLY (barrel) | SKIP | Re-exports. |
| 117 | `shared.ts` | UI_COUPLED | P2 | `safeText`, `limitSentences`, `buildTemplate` — sanitises generated copy. Specific to Chinese sentence splitting (`/(?<=[。！？.!?])\s*/`). In Swift this becomes a small `String` extension. |
| 118 | `trainingExplainability.ts` | UI_COUPLED | P1 | 611 LOC of explanation builders (e1RM, session summary, training level, today). High port effort. **Re-derive from tests + localised iOS strings**, do not literal-translate. |
| 119 | `weeklyActionExplainability.ts` | UI_COUPLED | P2 | Weekly review copy. |

### 3c. Aggregate counts

| Bucket | Count |
|---|---|
| PURE_DOMAIN | 85 |
| UI_COUPLED | 24 |
| BROWSER_DEPENDENT | 2 (`analytics.ts` *partial*, `healthImportEngine.ts`) |
| TEST_OR_SPEC_ONLY (barrels) | 4 (`explainabilityEngine`, `progressionEngine`, `trainingEngine`, `explainability/index`) |
| OBSOLETE_PWA | 1 helper inside `analytics.ts` (`downloadText`) |
| REFERENCE_ONLY | 2 candidates (`exerciseDataAuditEngine`, `systemConsistencyEngine`) — final call is Agent 5's |

**Headline finding**: ~96 % of the engine LOC is pure or UI-decision-only. Browser surface area in engines is tiny — basically one CSV-export helper and one `navigator.userAgent` check.

---

## 4. Presenter inventory table

Presenters live in `src/presenters/` and convert engine outputs to view models for the React UI. They are uniformly UI_COUPLED — the decision parts that they wrap are interesting; the view-model shaping should be re-done in Swift against the iOS view layer.

| File | LOC | Class. | Prio | Notes |
|---|---|---|---|---|
| `coachActionPresenter.ts` | 212 | UI_COUPLED | P1 | Maps `CoachAction[]` to UI rows: `id`, `title`, `description`, `priority`, `actionButtonVariant`. Re-derive in Swift `CoachActionViewModel`. |
| `coachReminderPresenter.ts` | 99 | UI_COUPLED | P2 | Reminder banner rendering. |
| `dataHealthPresenter.ts` | 431 | UI_COUPLED | P1 | Maps `DataHealthReport` to view rows + dismissed-issue actions. Agent 3 will reshape with the iOS data-health design. |
| `planAdviceAggregator.ts` | 340 | UI_COUPLED | P1 | Aggregates plan-level advice into one card. Decision logic worth porting; presentation is React-specific. |
| `planPresenter.ts` | 353 | UI_COUPLED | P1 | Plan view-model. Imports `ActionButton` / `Card` types (UI). |
| `profilePresenter.ts` | 15 | UI_COUPLED | P3 | Tiny. Likely dropped; SwiftUI binds directly to profile model. |
| `recordPresenter.ts` | 28 | UI_COUPLED | P3 | Tiny. |
| `sessionExplanationPresenter.ts` | 50 | UI_COUPLED | P2 | Maps explanation item to UI. |
| `todayPresenter.ts` | 227 | UI_COUPLED | P1 | TodayView view-model. The decision part is small; most is string assembly. |
| `trainingPresenter.ts` | 52 | UI_COUPLED | P2 | Tiny. |

**Recommendation**: Treat presenters as **reference for what fields the iOS view-models must expose**, not as code to port. The Swift SwiftUI / TCA store will produce its own view models from engine outputs. The valuable bit is the field list (what does TodayView actually need from the engine pipeline?), and that is fully captured by reading these 10 files.

---

## 5. Logic that leaked into `src/features/`

`src/features/*.tsx` are nine React view files totalling **9,338 LOC**. The `grep` of their engine imports shows substantial business logic invoked directly from views, often bypassing the presenters. The presenters are not consistently the single seam between engines and UI.

Specific leakage hotspots (engines imported by `.tsx` files):

| Feature view | Engine functions called directly | Concern |
|---|---|---|
| `ProgressView.tsx` (1,686 LOC) | `buildE1RMProfile`, `buildEffectiveVolumeSummary`, `evaluateEffectiveSet`, `buildPainPatterns`, `detectExercisePlateau`, `detectSetAnomalies`, `buildMonthStats`, `buildPrs`, `downloadText`, `makeCsv` | Computation done inside the React render path. Should sit behind a `ProgressViewModel`. |
| `RecordView.tsx` (1,694 LOC) | `buildE1RMProfile`, `buildEffectiveVolumeSummary`, `evaluateEffectiveSet`, `buildSessionDetailSummary`, `filterAnalyticsHistory`, `listSessionHistory`, `groupSessionSetsByType` | History & detail computation inside view. |
| `TodayView.tsx` (972 LOC) | `buildEnginePipeline` (correct), `buildTodayViewModel` (correct), but also direct `applyStatusRules`, `buildAdaptiveDeloadDecision`, `buildAdherenceAdjustment`, `buildDataHealthClaritySummary`, `buildHistoryCalendarSummary`, `formatAutoTrainingLevel` | Mixed — partly through presenter, partly direct. |
| `PlanView.tsx` (942 LOC) | `buildAdjustmentDiff`, `buildSettingsSafetySummary`, `buildTrainingLevelAssessment`, `buildSmartReplacementRecommendations`, `buildSupportPlan`, `buildWeeklyActionRecommendations`, `buildWeeklyActionExplanation`, `buildWeeklyCoachReview`, `getOrderedProgramDayTemplates`, `dedupePlanAdjustmentDraftsByFingerprint` | Heavy engine usage in render. |
| `TrainingView.tsx` (945 LOC) | `buildSessionComposition`, `buildSessionQualityResult`, `buildLoadFeedbackSummary`, `buildSessionSummaryExplanations` | |
| `TrainingFocusView.tsx` (1,533 LOC) | `buildFocusModeInteractionInput`, `resolveFocusModeInteractionState`, `dedupeFocusNotices`, `getFocusNavigationState`, `getCurrentExerciseIdentity`, `getExerciseIdentityFromExercise`, `convertKgToDisplayWeight`, `formatTrainingVolume`, `formatWeight`, `parseDisplayWeightToKg` | Most of focus mode is engine logic — view is glue. Good news for the port. |
| `HealthDataPanel.tsx` (765 LOC) | `buildHealthSummary` + import-engine usage | Mostly thin wrapper. |
| `ProfileView.tsx` (612 LOC) | `buildAdaptiveDeloadDecision`, `formatAutoTrainingLevel` | Minor. |
| `AssessmentView.tsx` (189 LOC) | constants only | Clean. |

**Prescription for iOS port:**

1. Treat the existing presenters as the **minimum** seam, but assume every place a `.tsx` view directly imports an engine is a place where the Swift app must produce a view model via its own store. Do not try to mirror "feature calls engine directly" in Swift — that creates the same coupling.
2. The fields exposed by direct engine calls in views are the contract Agent 5 should design store outputs against. List them when designing each screen.
3. `downloadText` / `makeCsv` from `analytics.ts` are called from `ProgressView.tsx`. On iOS the CSV export is a `UIActivityViewController` or `ShareLink` — drop the helper, replace with a native share sheet.

---

## 6. Cross-language fixture requirements

These are the engines whose outputs we **must** be able to compare byte-for-byte between the TS reference and the Swift port. For each: capture inputs and expected outputs as JSON in a fixture file that both runtimes can load.

For each engine, the format suggestion is:

```
fixtures/<engine-name>/<scenario-name>.json
  {
    "name": "<scenario-name>",
    "input": { ... },
    "output": { ... },
    "notes": "optional"
  }
```

| Engine | Fixture dir | Input shape | Output shape | Why parity matters |
|---|---|---|---|---|
| `engineUtils` | `fixtures/engine-utils/` | `{ setVolume / sessionVolume / completedSets / monthKey / clamp / number / formatDate / setWeightKg / todayKey: <args> }` per fixture file | scalar / boolean | Used by 80 % of engines. Off-by-one in `number()` (NaN coercion) ripples everywhere. |
| `unitConversionEngine` | `fixtures/unit-conversion/` | `{ valueKg / valueLb / unitSettings, mode }` | `{ displayValue, unit, kg, lb }` | Display weight bugs are user-visible. |
| `e1rmEngine` (`buildE1RMProfile`) | `fixtures/e1rm/` | `{ history: TrainingSession[], exerciseId, unitSettings? }` | `E1RMProfile` (estimates, confidence, source pool) | Foundation for plateau, fine-tune, weekly coach, training-level. |
| `effectiveSetEngine` (`evaluateEffectiveSet`, `buildEffectiveVolumeSummary`) | `fixtures/effective-set/` | `{ set: TrainingSetLog, prescription, sessionContext }` / `{ history }` | `EffectiveSetResult` / `EffectiveVolumeSummary` | Cascades into quality, level, data health. |
| `feasibleLoadEngine` | `fixtures/feasible-load/` | `{ equipmentProfile, theoreticalKg, roundingPref, readinessBias }` | `FeasibleLoadResult` | Plate math — easy to drift between languages because of rounding mode. |
| `replacementEngine` | `fixtures/replacement/` | `{ exercise, prescriptions }` | `{ valid: bool, reasons: string[] }` etc | Identity contract; subtle. |
| `currentExerciseSelector` | `fixtures/current-exercise/` | `{ step, session }` | `CurrentExerciseIdentity` | Identity contract — display vs record vs original IDs. |
| `coachActionIdentityEngine` (fingerprints) | `fixtures/coach-action-fingerprint/` | `{ action / draft / history }` | string fingerprint | Dismiss state breaks if fingerprints diverge between TS and Swift. |
| `planAdjustmentIdentityEngine` | `fixtures/plan-adjustment-fingerprint/` | same shape | fingerprint | Same concern. |
| `readinessEngine` | `fixtures/readiness/` | `{ todayStatus, history?, painPatterns? }` | `ReadinessResult` | Drives today decision; small mismatch flips banner colour. |
| `mesocycleEngine` | `fixtures/mesocycle/` | `{ plan, currentDate }` | `{ activePhase, weekIndex, ... }` | Calendar math + timezone landmines. |
| `trainingCalendarEngine` (`toLocalDateKey`, `getSessionCalendarDate`) | `fixtures/calendar/` | `{ dateInput, timezone? }` | `YYYY-MM-DD` | Heavily reused — date-key drift is catastrophic. |
| `sessionBuilder` | `fixtures/session-builder/` | `{ programTemplate, screening, status, currentDate }` | `TrainingSession` | Generated-session shape must match the iOS app's session model. |
| `trainingCompletionEngine` | `fixtures/training-completion/` | `{ appData, sessionId }` | post-completion `AppData` (diff) | Mutation pipeline at the end of a workout. |
| `progressionRulesEngine` (`applyStatusRules`) | `fixtures/progression/` | `{ exerciseTemplate, performanceSnapshot, history }` | `ExercisePrescription` | Inter-session progression. |
| `exercisePrescriptionEngine` | `fixtures/prescription/` | `{ template, screening, calibration }` | `ExercisePrescription` | Per-exercise plan. |
| `adaptiveFeedbackEngine` (`buildAdaptiveDeloadDecision`, `reconcileScreeningProfile`) | `fixtures/adaptive-feedback/` | `{ history, exercises, screeningProfile }` | `DeloadDecision`, normalised profile | Used by many downstream engines. |
| `adaptiveRecommendationEngine` (`applyCompletedSessionToCalibration`) | `fixtures/adaptive-calibration/` | `{ session, calibrationState }` | next `AdaptiveCalibrationState` | Persistence-shaped — diverging here breaks user history. |
| `nextWorkoutScheduler` (decision part) | `fixtures/next-workout/` | `{ history, programTemplate, templates, todayState, readiness, ... }` | `NextWorkoutRecommendation` (kind + reason codes, **not** localised copy) | Drives TodayView next-suggestion. |
| `todayStateEngine` | `fixtures/today-state/` | `{ activeSession, history, plannedTemplateId, currentLocalDate }` | `TodayTrainingState` discriminated union | TodayView root state. |
| `trainingDecisionContext` | `fixtures/training-decision-context/` | `{ appData, currentDate, trainingMode? }` | `TrainingDecisionContext` | Input to `trainingDecisionEngine`. Capture before the big engine. |
| `trainingDecisionEngine` | `fixtures/training-decision/` | `CleanTrainingDecisionInput` | full `TrainingDecision` (kinds + reason codes; ignore Chinese copy fields) | The biggest port; tests must pin every reason code per scenario. |
| `focusModeStateEngine` | `fixtures/focus-mode-state/` | `{ session, action, clock }` | next focus state | Active-workout backbone. |
| `focusNextSetRecommendationEngine` | `fixtures/focus-next-set/` | `{ focusStep, sessionContext, unitSettings }` | `FocusNextSetRecommendation` (kind + numeric load, not copy) | UI-critical recommendation. |
| `restTimerEngine` | `fixtures/rest-timer/` | `{ timer, deltaSeconds, now }` | `RestTimerState` | Wall-clock state machine — Clock injection required. |
| `enginePipeline` (`buildEnginePipeline`) | `fixtures/engine-pipeline/` | `{ appData, currentDate, options }` | `EnginePipelineResult` (kinds + reason codes, skip copy) | End-to-end integration; one fixture per representative AppData snapshot. |

Three fixture-quality notes:

1. **Strip localised copy fields when comparing.** Reason codes, kinds, numeric values, and IDs must match exactly. Chinese `title` / `summary` / `userMessage` fields can be regenerated in Swift from localised string tables, so do not assert them.
2. **Pin the clock.** Every engine that calls `Date.now()` or `new Date()` must accept a `currentDate: string` (or, in Swift, a `Clock`) to make fixtures deterministic. The TS code already does this in most places (`buildEnginePipeline` takes `currentDate`); the few engines that don't (`restTimerEngine`, `adaptiveRecommendationEngine`, `sessionEditEngine`, `appleHealthStreamingImportEngine`) should be wrapped before the fixture run.
3. **Reuse existing fixtures.** `tests/fixtures/realDataRegression`, `tests/fixtures/userComparison`, `tests/fixtures/realExports` already contain AppData snapshots. Re-running the TS pipeline against these and capturing outputs as the parity baseline is faster than synthesizing new ones.

---

## 7. Swift port priority recommendation

Port order is dictated by the engine dependency graph (which engines have to exist before others can be ported and tested). Within each tier, port can proceed in parallel.

### Tier 0 — Foundation utilities (must land first)

These have ~zero engine dependencies and are imported by everything else. Port them first, write parity fixtures, then expose them as a tiny Swift module (`IronPathCore.Engines.Foundation`).

1. `engineUtils.ts`
2. `unitConversionEngine.ts`
3. `trainingCalendarEngine.ts` (especially `toLocalDateKey`)
4. `restTimerEngine.ts`
5. `themePreferenceModel.ts` (trivial; optional)
6. `derivedStateInvalidationEngine.ts` (trivial enum mapping)

### Tier 1 — Identity & data-shape contracts

These are small but **must match TS byte-for-byte**, otherwise the iOS app desyncs from cloud / dismiss-state / replacements.

7. `replacementEngine.ts`
8. `currentExerciseSelector.ts`
9. `coachActionIdentityEngine.ts` (fingerprints)
10. `planAdjustmentIdentityEngine.ts` (fingerprints)
11. `trainingDecisionCleanInput.ts` (branded factories)
12. `trainingDecisionTypes.ts` (types)

### Tier 2 — Core engines (the dependency roots cited above)

13. `e1rmEngine.ts`
14. `effectiveSetEngine.ts`
15. `sessionHistoryEngine.ts`
16. `readinessEngine.ts`
17. `mesocycleEngine.ts`
18. `equipmentAwareLoadModel.ts`
19. `feasibleLoadEngine.ts`
20. `exercisePrescriptionEngine.ts` + `progressionRulesEngine.ts`
21. `sessionBuilder.ts`
22. `trainingCompletionEngine.ts`
23. `adaptiveFeedbackEngine.ts`

### Tier 3 — Active workout (focus mode)

24. `focusModeStateEngine.ts`
25. `focusNextSetRecommendationEngine.ts`
26. `focusModeInteractionState.ts`
27. `workoutExecutionStateMachine.ts`
28. `actionableLoadContract.ts` + `equipmentAwareActionablePrescription.ts` + `equipmentAwareRecommendationDisplay.ts`
29. `warmupPolicyEngine.ts` + `practicalWarmupPolicy.ts`
30. `setAnomalyEngine.ts`, `setByRirAdjustmentEngine.ts`, `setWeightFineTuneEngine.ts`

### Tier 4 — TodayView decision stack

31. `trainingDecisionContext.ts`
32. `trainingDecisionEngine.ts` *(re-derive from tests, not literal-translate)*
33. `todayStateEngine.ts`
34. `todayTrainingReadinessDecisionEngine.ts`
35. `nextWorkoutScheduler.ts` (decision-only; copy via iOS strings)
36. `dailyTrainingAdjustmentEngine.ts`
37. `enginePipeline.ts`

### Tier 5 — Insights / analytics / weekly review

38. `analytics.ts` (pure parts only; drop `downloadText`)
39. `plateauDetectionEngine.ts`
40. `loadFeedbackEngine.ts`
41. `painPatternEngine.ts`
42. `historyCalendarSummary.ts`
43. `volumeAdaptationEngine.ts`
44. `weeklyMuscleBalanceEngine.ts`
45. `weeklyCoachActionEngine.ts`
46. `sessionQualityEngine.ts`
47. `sessionDetailSummaryEngine.ts` + `sessionPostSummaryEngine.ts` + `sessionCompositionEngine.ts`
48. `coachActionEngine.ts` + `coachActionDismissEngine.ts`
49. `recommendationConfidenceEngine.ts` + `recommendationDiffEngine.ts`
50. `guardedRecommendationContractEngine.ts`

### Tier 6 — Health & explainability

51. `appleHealthTypeMap.ts`
52. `appleHealthXmlImportEngine.ts` *(re-implement in Swift using `XMLParser`; specs from tests)*
53. `appleHealthStreamingImportEngine.ts` *(same; or rely on native streaming for large `export.xml`)*
54. `healthSummaryEngine.ts`
55. `healthImportEngine.ts` *(drop `navigator.userAgent` branch; iOS = always mobile)*
56. `explainability/shared.ts`
57. `explainability/evidenceExplainability.ts`
58. `explainability/trainingExplainability.ts`
59. `explainability/adjustmentExplainability.ts`
60. `explainability/weeklyActionExplainability.ts`

### Tier 7 — Lower-priority / niche features

The remaining engines (cadence advisor, lapse banner, streak, training level assessment, training intelligence summary, equipment fallback, exercise efficiency, exercise type bucket, rep range auto migration, support plan, screening, soreness impact summary, recent PR delta, session edit, session patch, session backfill tolerance, muscle frequency auto adjust, training cadence advisor, etc.) — port as the UI screens that need them are scheduled.

### SKIP entirely

- `explainabilityEngine.ts`, `progressionEngine.ts`, `trainingEngine.ts`, `explainability/index.ts` — these are TS barrels; Swift has no equivalent need.
- `analytics.ts > downloadText` — replace with native share sheet.
- `healthImportEngine.ts > isLikelyMobileDevice` — drop.

### REFERENCE_ONLY

- `exerciseDataAuditEngine.ts` — dev-time consistency audit over the exercise library. iOS likely ships a curated library bundle, so this audit lives in the build pipeline (Swift script or a one-off Node tool), not in the runtime.
- `systemConsistencyEngine.ts` — same shape.

---

## 8. Risks

### Engines that look pure but secretly aren't

- **`restTimerEngine.ts`** — uses `Date.now()` directly. Looks pure, but every consumer passes the timer through unchanged, so the side-effect is concentrated. In Swift, hide behind a `Clock` protocol.
- **`adaptiveRecommendationEngine.ts`** — `applyCompletedSessionToCalibration` writes `lastUpdatedAt = new Date().toISOString()` into persisted state. **Fingerprint risk**: if the Swift port writes ISO strings with a different fractional-seconds precision or timezone, the diff will look gratuitous. Pin the `now` parameter and use a fixed ISO formatter.
- **`sessionEditEngine.ts`, `sessionBuilder.ts`, `trainingCalendarEngine.ts`** — same wall-clock concern.
- **`analytics.ts > downloadText`** — DOM-only, but the rest of the file is pure. Easy to overlook when porting and accidentally bring the helper. Just delete that one function and replace at the call site (`ProgressView.tsx`).
- **`healthImportEngine.ts > isLikelyMobileDevice`** — `navigator.userAgent` lives in the *guard* helper, not in the import pipeline itself. The pipeline is pure; only the file-size limit defaulting needs adjusting on iOS.
- **`coachActionEngine.ts` / `nextWorkoutScheduler.ts` / `dataHealthEngine.ts`** — these import `i18n/formatters` to build Chinese display strings inline. A naive port copies the strings. Better: extract the *decision shape* into a Swift type, then localise via `Localizable.xcstrings`.
- **`trainingDecisionEngine.ts`** — 2,097 LOC of decision logic with comments saying "copy logic is inlined as private helpers below". The decision and the copy are interleaved. **Do not literal-translate**; the V2 hard rewrite already moved the engine to return reason codes for many surfaces. Port reason codes + numeric outputs first; build Chinese strings from a `Strings.swift` table.

### Engines that look obsolete but are load-bearing

- **`trainingViewCompletionEngine.ts`** — looks like a legacy "old training view" thing (focus mode is the new flow). However, it is still imported by `TrainingView.tsx`, which is still in the app. Before dropping it, Agent 5 must confirm the iOS app does **not** ship an equivalent of `TrainingView` (i.e. iOS commits 100 % to focus mode).
- **`themePreferenceModel.ts`** — looks trivial. The `focusModeUsesImmersiveDark` flag drives whether focus mode forces dark UI regardless of system theme. On iOS the same UX call must be made — and the *default* (immersive dark on) is in this file. Don't lose the default.
- **`exerciseDataAuditEngine.ts` / `systemConsistencyEngine.ts`** — look like dev-only audits. They are. But they exist because the exercise / alias library has historically been inconsistent. Whatever curated library the iOS app ships **must pass these audits at build time** — otherwise iOS will desync from the web app when the user moves between them. Run the TS audit against the iOS exercise library in CI.
- **`derivedStateInvalidationEngine.ts`** — tiny (one big `switch`), but it is the source of truth for "which UI surfaces must refresh when X happens". In Swift this is likely the closest thing to "actions that invalidate cached view models". Port faithfully.
- **`trainingDecisionCleanInput.ts`** — branded TypeScript types do not survive to Swift. Replace with an actual factory whose only public entrypoint is `CleanAppDataView`; let the type system enforce the boundary the brand currently fakes.
- **`enginePipeline.ts`** — looks like glue. It is the single API the React app uses today; the iOS app should adopt the same shape (one `buildEnginePipeline` call per relevant input change) for parity testing.

### Two non-engine risks worth flagging here

- **`src/storage/localStorageAdapter.ts`** — the only file that touches `localStorage`. iOS will replace this with a JSON-on-disk or SQLite-backed `AppDataStorage` actor; the rest of `src/storage/` is pure orchestration (sanitize / validate / migration). This means **only one file in storage needs an iOS rewrite**; the rest can be type-translated.
- **`src/dataHealth/`** — none of the engines in this folder touch browser APIs (I checked). They are pure orchestration over `AppData`. Agent 3 owns the iOS design, but from a port-cost perspective the entire data-health subsystem is portable as pure logic.

---

## 9. Non-goals

- iOS module structure / target layout — Agent 5.
- Data-repair design (`appDataRepairEngine`, `dataHealthRuntimeGuard`, `cleanAppDataView` design choices) — Agent 3.
- UI screen mapping — Agent 4 (UI).
- Test-strategy details beyond the fixture wishlist — Agent 6/7.
- Cloud sync / Supabase / API contract — Agent 8.
- Recommendation on whether to use TCA, Observation, or another Swift state pattern — Agent 5.
- Specific Swift type design (struct vs class, value vs reference) — Agent 5.

---

## 10. Open questions

1. **Does the iOS app drop `TrainingView` entirely** (the pre-focus-mode workout screen) in favour of `TrainingFocusView`? If yes, `trainingViewCompletionEngine.ts` becomes REFERENCE_ONLY and the port budget drops by ~140 LOC. If no, focus-mode and legacy-mode logic must co-exist in Swift. **Agent 5 must answer.**
2. **Do we ship the curated `EXERCISE_*` tables from `src/data/` as a static iOS bundle, or fetch them from cloud?** If bundled, the consistency audits stay as build-time scripts. If fetched, the audits must run on every fetch.
3. **How does the iOS app handle the CSV export currently driven by `analytics.downloadText`?** Recommendation: `UIActivityViewController` with the CSV as a `URL` to a tempfile. Confirm with Agent 4/5.
4. **Is there an appetite to drop the `themePreferenceModel.ts` `focusModeImmersive` toggle** in iOS (force immersive dark in focus mode unconditionally)? If so, the model collapses to ~5 lines.
5. **What is the canonical Chinese-vs-English strategy for the iOS app?** All engines that I tagged `UI_COUPLED` use hard-coded Chinese strings. If iOS launches Chinese-only, the simplest path is to keep the strings inline as Swift `String`s and localise later. If iOS launches with multi-language support from day one, the explainability + presenter layer must move to `Localizable.xcstrings` immediately, and that is a 1–2 person-week task on its own.
6. **Should `trainingDecisionEngine.ts` be re-derived from tests, or literal-translated?** I recommended "re-derive" because the file is large and copy-heavy. Confirm before scheduling — re-derivation is higher risk but produces a cleaner Swift engine; literal-translation is lower risk but preserves the V2 hard-rewrite scars.
7. **Are the `tests/fixtures/realDataRegression` + `realExports` snapshots safe to ship to the iOS test target** (no PII, no real user data)? If yes, we can reuse them directly for parity testing. If not, we need synthetic equivalents.
8. **Are fingerprint hash functions in `coachActionIdentityEngine.ts` and `planAdjustmentIdentityEngine.ts` deterministic across platforms today?** If they use `JSON.stringify` of object keys, Swift's `JSONEncoder` will need `outputFormatting = .sortedKeys` to match. Spot-check before porting.
9. **Engine dependency graph diagram**: do we want one (one PNG / SVG of the import graph)? Not required for the audit, but Agent 5 would benefit. Out of scope here; happy to spawn a follow-up.
10. **OBSOLETE_PWA classification** — I only found one true PWA fragment in engines (`analytics.downloadText`). Is there a separate PWA-shell layer (service worker, manifest helpers) outside `src/engines/`? Yes — `public/manifest*.json`, service worker glue in `src/main.tsx` — but those are outside this agent's scope. Flagging for whichever agent owns app-shell.

---

*End of report.*
