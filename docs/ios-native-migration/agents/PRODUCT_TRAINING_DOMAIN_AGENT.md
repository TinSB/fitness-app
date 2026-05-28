# iOS Native Migration — Agent 1 Report: Product & Training Domain

## 1. Mission

Identify what IronPath must preserve as a real training system when rewriting natively for iOS — i.e. the product/domain layer (training arbitration, prescription, focus mode, reentry/restart/deload semantics, set / volume / progression rules, kg–lb behavior, equipment-aware load, equivalence/replacement, completion quality, set identity) that the future native iOS app cannot lose without breaking product correctness.

This report is docs/planning only. It does not propose Swift code, an Xcode project, or any runtime change. It identifies contracts to *carry forward* and behaviors that are *Web artifacts*.

Audience: orchestrator + downstream agents (Architecture, UI, Data Safety, Recommendation, Regression, Implementation).

## 2. Files inspected

Engines (TrainingDecision pipeline):
- `src/engines/trainingDecisionEngine.ts` (sole final-decision owner; AR-1..AR-9 arbitration; emits `userFacing.{today,plan,training,focus,progress,record,explanation}`)
- `src/engines/trainingDecisionTypes.ts` (`TrainingDecision` shape, `SessionIntent`, `RiskLevel`, `VolumeMode`, `IntensityMode`, `ProgressionMode`, `ExerciseRole`, `WeeklyAdjustmentDecision`, `NextSetPolicy`, `HiddenDebugSignals`)
- `src/engines/trainingDecisionContext.ts` (input normalizer; scopes `TodayStatus` to local date, builds readiness, pain patterns, load feedback, training level)
- `src/engines/trainingDecisionCleanInput.ts` (branded `CleanTrainingDecisionInput` / `CleanTrainingDecisionContextSource`; hard boundary between raw AppData and TrainingDecision)
- `src/engines/sessionBuilder.ts` (`createSession`, `scoreSuggestedTemplates`, `pickSuggestedTemplate`, `getNextTemplateAfterLastCompletedSession`; `TEMPLATE_ROTATION` push→pull→legs / upper→lower)
- `src/engines/exercisePrescriptionEngine.ts` (`applyStatusRules` — prescription assembler; enforces reentry productive-dose floor; merges training-mode × phase × readiness × deload × pain rules)
- `src/engines/effectiveTrainingPhaseEngine.ts` (gap state machine: 0–3 / 4–7 / 8–13 / 14–27 / 28+ days; `activePhase`, `reentry`, `restart`, `compactLabel`)
- `src/engines/focusModeStateEngine.ts` (focus step queue, `getCurrentFocusStep`, `completeFocusSet`, `endFocusRest`, set drafts, manual override, support steps)
- `src/engines/focusModeInteractionState.ts` (deterministic primary action resolver — UI-OS R2)
- `src/engines/effectiveSetEngine.ts` (`evaluateEffectiveSet`, `buildEffectiveVolumeSummary`, RIR-aware scoring, technique / pain penalties)
- `src/engines/dailyTrainingAdjustmentEngine.ts` (signal-only after V2; structured reason codes)
- `src/engines/adherenceAdjustmentEngine.ts` (weekly volume multiplier from adherence)
- `src/engines/autoDeloadTriggerEngine.ts` (4-week PR streak + fatigue ≥ 80 → propose deload)
- `src/engines/currentExerciseSelector.ts` (`CurrentExerciseIdentity`: original / actual / display / record IDs + invalid-identity guard)
- `src/engines/exercisePathEngine.ts` (regression / current / progression ladder)
- `src/engines/replacementEngine.ts` (replacement rank, equipment-aware reasons, `hasInvalidExerciseIdentity`)
- `src/engines/actionableLoadContract.ts` + `src/engines/equipmentAwareLoadModel.ts` + `src/engines/equipmentAwareActionablePrescription.ts` (theoretical → feasible → actionable load)
- `src/engines/unitConversionEngine.ts` (kg ↔ lb, `parseDisplayWeightToKg`, `convertKgToDisplayWeight`, increments)
- `src/engines/restTimerEngine.ts` (`RestTimerState`, pause/resume/extend semantics)
- `src/engines/sessionQualityEngine.ts`, `loadFeedbackEngine.ts`, `painPatternEngine.ts`, `plateauDetectionEngine.ts`, `volumeAdaptationEngine.ts`, `readinessEngine.ts`, `trainingLapseEngine.ts`
- `src/engines/trainingCompletionEngine.ts` (`buildIncompleteMainWorkGuard`, set normalization, `completionStatus`)

Presenters:
- `src/presenters/todayPresenter.ts` (`TodayViewModel`; recovery-aware recommendation override)
- `src/presenters/trainingPresenter.ts` (`TrainingFocusViewModel`)
- `src/presenters/planPresenter.ts` (weekly schedule, coach inbox, adjustment drafts)
- `src/presenters/recordPresenter.ts` (calendar / list / PR / stats / data tab structure)
- `src/presenters/profilePresenter.ts`, `coachActionPresenter.ts`, `sessionExplanationPresenter.ts`, `planAdviceAggregator.ts`, `dataHealthPresenter.ts`

User-facing surfaces:
- `src/features/TodayView.tsx`, `TrainingView.tsx`, `TrainingFocusView.tsx`, `PlanView.tsx`, `ProgressView.tsx`, `RecordView.tsx`, `ProfileView.tsx`
- `src/uiOs/today/`, `training/`, `history/`, `progress/`, `records/`, `settings/` (mobile-styled Web UI already evolved toward iOS look-and-feel)
- `src/ui/AddToHomeScreenHint.tsx` (Web/PWA artifact)

Models / data:
- `src/models/training-model.ts` (`AppData` interface at line 1362; `TrainingSession:775`; `ExercisePrescription:378`; `TrainingSetLog:255`; `ActualSetDraft:290`; `MesocyclePlan:1313`)
- `src/data/trainingData.ts`, `defaults.ts`, `defaultTemplates.ts`, `exerciseLibrary.ts`
- Schemas: `training-data.schema.json`, `training-program.schema.json`

Docs:
- `docs/TRAINING_RECOMMENDATION_HARD_REWRITE_V2.md` (SoT lock)
- `docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md` (branded factory boundary)
- `docs/TRAINING_CYCLE_GAP_REENTRY_AUDIT_V1.md` (reentry state machine)
- `docs/UI_OS_R2_FOCUS_MODE_INTERACTION_STATE_MACHINE_REWRITE.md` (focus interaction states)
- `docs/TODAY_TRAINING_FOCUS_OVERRIDE.md` (session-only focus override)

Tests inspected (behavioral anchors):
- `tests/trainingDecisionHardRewrite*.test.ts` (12 files; engine shape, reentry productive dose, legacy import boundary, forbidden copy, AppData stability, arbitration coherence, normal session, user-facing shape, today signal, daily adjustment, decision stability, plan aggregator)
- `tests/focusModePrimaryAction.test.ts`, `focusModeInteractionState.test.ts`, `focusModeActionBar.test.ts`, `uiOsR2FocusModeInteractionDocs.test.ts`
- `tests/sessionBuilder.test.ts`
- `tests/unitConversion.test.ts`, `actionableLoadAlignment.test.ts`, `uiOsR8_7AActionableLoadContract.test.ts`
- `tests/replacementEngine.test.ts`, `replacementChainIntegrity.test.ts`, `replacementEffectiveSetMapping.test.ts`, `pullReplacementEngine.test.ts`, `legReplacementEngine.test.ts`, `shoulderArmReplacementEngine.test.ts`, `crowdedGymReplacementStrategy.test.ts`
- `tests/legacyReplacementIdentityPollution.test.ts`
- `tests/trainingPhaseEffectiveMapping.test.ts`, `trainingPhaseGapWiringRecommendation.test.ts`
- `tests/practicalWarmupPolicy.test.ts`

## 3. Findings — iOS must-preserve training contracts

These are the contracts that an iOS rewrite **must replicate identically** (semantically; the data structures may be re-expressed in Swift). Each row identifies the load-bearing module and a behavior test that locks it.

### 3.1 TrainingDecision as the sole arbiter

The hard rewrite (V2, PR #384) deleted 9 legacy final-decision engines (`weeklyProgressionRecommendationEngine`, `progressClaritySummary`, `postWorkoutNextTimeRecommendationEngine`, `todayDecisionSurface`, `recommendationTraceEngine`, `recommendationExplanationPresenter`, `coachAutomationEngine`, `deloadSignalEngine`, `recommendationReasonSelector`) and converted 5 more to signal-only. **A single function `buildTrainingDecision(input) → TrainingDecision` now owns every per-surface user-facing payload.**

Contracts (`src/engines/trainingDecisionTypes.ts:413`):
- `activePhase` ∈ `{base, build, overload, deload, reentry, restart}`
- `sessionIntent` ∈ `{normal-session, reentry-productive, controlled-reload, deload-week, severe-rest}`
- `riskLevel` ∈ `{none, low, moderate, high, severe}`
- `progressionMode` ∈ `{progress, hold, pull-back, reload}`
- `volumeMode` ∈ `{expand, hold, trim, reentry-floor, severe-cut}`
- `intensityMode` ∈ `{expand, hold, cap, cut}`
- `userFacing: { today, plan, training, focus, progress, record, explanation }` — each surface has a fully structured payload (`TodayUserFacing`, `PlanUserFacing`, etc.) consumed by UI cards without further inference.
- `hiddenDebugSignals.arbitrationTrace: string[]` — every AR-1..AR-9 rule that fired this turn (test-only / dev-only).

Locked by: `tests/trainingDecisionHardRewriteEngineShape.test.ts`, `trainingDecisionHardRewriteUserFacingShape.test.ts`, `trainingDecisionHardRewriteLegacyImportBoundary.test.ts`, `trainingDecisionHardRewriteForbiddenCopyScan.test.ts`.

**iOS implication:** the native app must call **one** decision builder per render cycle and consume the structured `userFacing` payload. It must not re-derive copy at the View layer. If iOS UI starts inferring "your strength is improving" / "rest is recommended" / "keep weight" independently, it will re-introduce the V1 contradiction (the user-reported BLOCKING bug that V2 fixed: Today/Plan/Progress disagreed with each other).

### 3.2 Reentry / restart productive-dose floor (gap state machine)

`src/engines/effectiveTrainingPhaseEngine.ts:140` derives `activePhase` from days since last analytic session:

| gap days | activePhase | volumeMultiplier | intensityBias | compactLabel |
|---|---|---|---|---|
| 0–3 | persisted | persisted | persisted | persisted |
| 4–7 | persisted (mild severity) | persisted | persisted | persisted |
| 8–13 + overload/deload | `reentry` | 0.75 | conservative | `回归周` |
| 8–13 + base/build | persisted (reentry severity) | persisted | persisted | persisted |
| 14–27 | `reentry` | 0.65 | conservative | `回归周` |
| 28+ | `restart` | 0.50 | conservative | `重新开始` |
| no history | persisted | persisted | persisted | persisted |

The arbiter then applies the **role-aware floor** (`src/engines/trainingDecisionEngine.ts:82-94`):
- `ROLE_FLOORS_REENTRY`: main-compound 2 sets, secondary-compound 2, accessory 1, isolation 1.
- This guarantees compounds get at least 2 working sets even when the deload multiplier would otherwise compound to 1 (the 0.65 × 0.6 = 0.39 → 1-set bug killed in V2).

Locked by: `tests/trainingDecisionHardRewriteReentryProductiveDose.test.ts`, `trainingPhaseEffectiveMapping.test.ts` (20 tests covering all gap windows), `trainingPhaseGapWiringRecommendation.test.ts` (`applyStatusRules` 14d gap + deload no longer marks active deload).

**iOS implication:** this is *not* optional product polish. Without it, a user returning after 2 weeks sees an inappropriate deload-week prescription. The native app must compute `activePhase` at every Today / Plan / Training / Focus render. AppData / mesocyclePlan is **not** mutated — `activePhase` is a pure derivation (`effectiveWeek` is a synthetic `MesocycleWeek` for the run, `persistedPhase` stays for data integrity).

### 3.3 Focus Mode step queue + interaction state machine

`src/engines/focusModeStateEngine.ts:141` `buildFocusStepQueue(session)` is the authoritative ordering:

1. All `correction` support steps first.
2. For each main exercise: `warmup` steps (only if `warmupPolicy.shouldShowWarmupSets`), then `working` steps (`straight`, or `top` + `backoff` if top-backoff allowed).
3. All `functional` support steps last.
4. Terminal `completed` step.

Step ID grammar (`src/engines/focusModeStateEngine.ts:80`):
- main: `main:{exerciseId}:{stepType}:{setIndex}` where stepType ∈ `{warmup, working, completed}`
- support: `{blockType}:{moduleId}:{exerciseId}:{setIndex}`

Each step carries `plannedWeight`, `plannedReps`, `plannedRir`, `plannedRestSec`, `warmupPolicy`. The current step is resolved by `getCurrentFocusStep` (`focusModeStateEngine.ts:232`) which honors `currentFocusStepId`, `focusManualStepOverride`, and skips already-completed steps.

Interaction state (`src/engines/focusModeInteractionState.ts:100`) resolves a single primary action per `(sessionState, exerciseState, setState, recommendationState, safetyState)` tuple:

| Context | Primary action |
|---|---|
| `no_session` | 开始今天训练 |
| `unfinished_session` | 继续训练 |
| `warmup_set` / `working_set` no input | 记录本组 |
| `suggestion_applied` / `ready_to_complete` | 完成一组 |
| `correction_set` | 完成纠偏 (NOT 完成一组) |
| `mobility_task` | 完成动作 (NOT 完成一组) |
| `skipped_exercise` / `hasSkipReason` | 确认跳过 |
| `discomfort_flagged` | 选择处理方式 |
| `source_unclear` | 回到本地模式 |
| `session_end_requested` | 确认结束训练 (requires second confirmation) |
| `session_complete` | 查看训练总结 |

Locked by: `tests/focusModePrimaryAction.test.ts`, `focusModeInteractionState.test.ts`, `focusModeActionBar.test.ts`, `uiOsR2FocusModeInteractionDocs.test.ts`.

**iOS implication:** The bug R2 fixed was "correction step still says 完成一组." This must not regress. iOS must implement the state-machine **before** building the action bar, not after — otherwise the View will leak inappropriate primary actions back into the model.

### 3.4 Effective set / RIR / technique-quality scoring

`src/engines/effectiveSetEngine.ts:7` `evaluateEffectiveSet(set, exercise, context)` is the canonical scorer. Decision rules:

- `identityInvalid` → 0, low confidence, flag `identity_invalid`.
- `type === 'warmup'` → 0, flag `warmup`.
- Not completed / weight ≤ 0 / reps ≤ 0 → 0, flag `incomplete`.
- `techniqueQuality === 'poor'` → score ×= 0.45, flag `poor_technique`.
- `painFlag` → score ×= 0.5, flag `pain`.
- RIR = undefined → ×= 0.82, flag `unknown_rir`.
- RIR ≥ 5 → ×= 0.45, flag `too_easy`.
- RIR = 4 → ×= 0.65, flag `too_easy`.
- RIR ∈ [1, 3] → no penalty, flag `valid_effort`.
- RIR ≤ 0 → ×= 0.9 (failure penalty for fatigue cost).
- Reps below repMin → ×= 0.75.
- **Final**: `isEffective` iff `score ≥ 0.75`.

`countEffectiveSets` + `buildEffectiveVolumeSummary` (`effectiveSetEngine.ts:104, 141`) aggregate per session / per muscle (using `muscleContribution` weights from `ExerciseMetadata`).

**iOS implication:** the effective-set definition is the **product**. Hypertrophy training literature deviates on what counts; IronPath has shipped a specific, evidence-backed cutoff (≥ 0.75 score, RIR 1-3 sweet spot, technique penalty 0.45, pain penalty 0.5). Changing these constants changes the product. iOS must port the constants exactly.

### 3.5 kg / lb unit contract

`src/engines/unitConversionEngine.ts`:
- `KG_PER_LB = 0.45359237` (precise IEEE rational).
- **All persisted weights are in kg.** Display conversion is unidirectional render-time; `parseDisplayWeightToKg` is the only path that writes.
- `convertKgToDisplayWeight(kg, 'lb')` rounds to integer lb (no decimal lb display).
- Increments persisted both ways: `defaultIncrementKg: 2.5`, `defaultIncrementLb: 5`, plus `customIncrementsKg / customIncrementsLb` arrays.

Locked by: `tests/unitConversion.test.ts` (`100 kg → 220 lb`, `135 lb input → 61.2 kg stored`, `20.4117 kg → 45 lb` with no decimal noise).

**iOS implication:** native Swift code must use the same constant `0.45359237` (not `0.4536` rounded), must keep kg as canonical storage, and must not show decimal lb. Apple's `NSMeasurement` conversion path uses a different rounding internally — using it raw will diverge from existing user history.

### 3.6 Equipment-aware feasible load + actionable load contract

`src/engines/actionableLoadContract.ts:30` resolves theoretical load → actionable load via:

1. `buildActionableEquipmentAwarePrescription` → `EquipmentAwareActionablePrescriptionResult` with `actionableWeightKg`.
2. Equipment profile (`equipmentAwareLoadModel.ts:53`): `EquipmentKind ∈ {barbell, smith_machine, dumbbell, selectorized_machine, plate_loaded_machine, cable_stack, bodyweight, assisted_bodyweight, unknown}`; `LoadDisplayMode ∈ {total_weight, per_hand, per_side_plates, machine_stack, added_load, bodyweight_adjusted, total_plus_per_side}`; rounding by `RoundingPreference ∈ {conservative, nearest, progressive, readiness_based}`.
3. Empty-bar fallback: theoretical 17 lb resolves to empty Olympic bar / feasible 45 lb (~20.4 kg) — see `docs/UI_OS_R2_FOCUS_MODE_INTERACTION_STATE_MACHINE_REWRITE.md` §"UI Behavior".

Locked by: `tests/actionableLoadAlignment.test.ts`, `uiOsR8_7AActionableLoadContract.test.ts`, `equipmentAwareTrainingUiIntegration.test.ts`, `equipmentAwarePrimaryPrescriptionApplyFix.test.tsx`.

**iOS implication:** "this exercise needs 47 kg" rounded to "45 kg" with plate breakdown is a load-bearing piece of the product. iOS must port `EquipmentProfile`, the rounding algorithm, and the "set 套用建议 fills feasible weight + planned reps (no RIR)" behavior. Hardcoding plate sets in the View is the wrong abstraction.

### 3.7 Exercise identity + replacement semantics

`src/engines/currentExerciseSelector.ts:40` `getExerciseIdentityFromExercise` resolves four IDs per exercise:
- `originalExerciseId` (planned)
- `actualExerciseId` (what the user actually performed; may be a replacement)
- `displayExerciseId` (what to show in UI; favors actual if valid)
- `recordExerciseId` (what to use as the analytics / PR / e1RM key)
- + `isReplacement` flag

If `hasInvalidExerciseIdentity(exercise)` (from `replacementEngine.ts`), all derived IDs degrade to empty string and that set drops out of effective-set counting. This is the safety valve for legacy replacement pollution.

`src/engines/replacementEngine.ts` ranks alternatives by `priority / acceptable / angle / optional / equipment_fallback / fatigue_reduction / compound_fallback` with reason text and equipment-availability penalty.

Locked by: 25+ replacement test files (`replacementEngine`, `replacementChainIntegrity`, `replacementEffectiveSetMapping`, `replacementEquipmentContext`, `pullReplacementEngine`, `legReplacementEngine`, `shoulderArmReplacementEngine`, `crowdedGymReplacementStrategy`, `legacyReplacementIdentityPollution`, etc.).

**iOS implication:** PR / e1RM / effective-set keying must use `recordExerciseId`, NOT the planned ID. Users who substitute bench press → dumbbell bench press see the dumbbell set count correctly under the dumbbell exercise, not under bench. Getting this wrong silently corrupts every long-term PR chart.

### 3.8 Completion quality / partial completion / early end

`src/engines/trainingCompletionEngine.ts`:
- `TrainingSetLog.completionStatus` ∈ `{completed, incomplete, draft, legacy_completed}` (`training-model.ts:282`).
- `ExercisePrescription.completionStatus` ∈ `{completed, partial, not_started}`.
- `TrainingSession.earlyEndReason: 'incomplete_main_work' | string`.
- `buildIncompleteMainWorkGuard` blocks "finish session" if main lifts have undone working sets and the user didn't explicitly choose early end.

**iOS implication:** "finish workout" is **not** a simple button. It is a guarded transition. Native UI must call the same guard or it will lose the "did the user mean to skip the last set?" affordance the Web version has shipped.

### 3.9 Set ID + set draft + actual draft

`TrainingSetLog.id` is deterministic: `{exerciseId}-{setIndex+1}` for planned sets; warmups carry their own IDs via `focusWarmupSetLogs`. `ActualSetDraft` (`training-model.ts:290`) holds in-flight input (`actualWeightKg`, `actualReps`, `actualRir`, `techniqueQuality`, `painFlag`, `source: prescription | manual | copy_previous`) keyed by `stepId`. On `completeFocusSet`, the draft is merged into the persistent `TrainingSetLog` and the draft is preserved for set-anomaly detection and "copy previous" affordance.

**iOS implication:** the iOS "edit set" flow needs the same draft-then-commit pattern; otherwise the back button mid-edit will lose user input. SwiftUI `@State` does not auto-deliver this; it must be modeled explicitly.

### 3.10 Today focus override

`docs/TODAY_TRAINING_FOCUS_OVERRIDE.md` + `src/engines/todayTrainingFocusOverrideEngine.ts`:

Session-only choice from `{系统推荐, 胸, 背, 腿, 肩, 手臂, 核心, 全身, 恢复/活动度}`. When user picks non-default:
- Today keeps system recommendation visible as `原计划`.
- Maps to existing template where possible (胸 → push-a, 背 → pull-a).
- `核心` / `恢复/活动度` use **generated session-only templates** — not mutating the permanent template list.
- If override conflicts with soreness / readiness, shows advisory warning beginning with `可能影响恢复`; does NOT block start.
- Override resets to `系统推荐` on reload (React state, not persisted).
- If user completes a workout while override active, `TrainingSession.todayFocusOverride` records the choice + system template + applied time.

**iOS implication:** "I want to train chest today" must remain a session-level override that does not mutate templates. iOS Settings must not invent a "preferred focus" persistent setting that would conflict.

## 4. Findings — Core product logic vs Web UI artifacts

### 4.1 Core product logic (must port to iOS verbatim)

| Concept | Module | Notes |
|---|---|---|
| TrainingDecision arbiter (AR-1..AR-9) | `trainingDecisionEngine.ts:163-256` | Severe override > reentry floor > min-not-product > weekly cap > AR-5 triplet suppression. Single SoT. |
| Effective phase gap state machine | `effectiveTrainingPhaseEngine.ts` | Gap → activePhase, productive floors. |
| Effective set scoring | `effectiveSetEngine.ts:7-102` | RIR / technique / pain weights — load-bearing constants. |
| Equipment-aware actionable load | `actionableLoadContract.ts`, `equipmentAwareLoadModel.ts`, `equipmentAwareActionablePrescription.ts` | Including the empty-bar fallback. |
| Exercise identity resolution | `currentExerciseSelector.ts:40` | Four-ID model + invalid-identity guard. |
| Replacement engine | `replacementEngine.ts`, `smartReplacementEngine.ts` | Rank, equipment penalty, reason text. |
| Focus step queue + interaction state | `focusModeStateEngine.ts`, `focusModeInteractionState.ts` | Determines what is even shown / clickable. |
| Warmup policy | `warmupPolicyEngine.ts`, `practicalWarmupPolicy.ts` | `feeder_set` vs `full_warmup`; muscle / movement-pattern memoization. |
| Set anomaly detection | `setAnomalyEngine.ts` | Triggers second confirmation on improbable set values. |
| Auto-deload trigger | `autoDeloadTriggerEngine.ts` | 4 weekly PRs + fatigue ≥ 80 → propose deload. |
| Plateau detection | `plateauDetectionEngine.ts` | `plateau / possible_plateau / load_too_aggressive / technique_limited / fatigue_limited / volume_limited`. |
| Volume adaptation | `volumeAdaptationEngine.ts` | Per-muscle `increase / decrease / maintain / hold / insufficient_data`. |
| Readiness scoring | `readinessEngine.ts` | Sleep, energy, soreness → `level / score / trainingAdjustment`. |
| Pain pattern detection | `painPatternEngine.ts` | `watch / substitute / deload / seek_professional`. |
| Session quality | `sessionQualityEngine.ts` | High / medium / low / insufficient_data. |
| Adherence adjustment | `adherenceAdjustmentEngine.ts` | Weekly volume multiplier from completion rate. |
| Effective training phase compatibility field | `effectivePhase.phaseForCompatibility` | reentry/restart degrade to `base` for legacy CyclePhase consumers. |
| Template rotation push→pull→legs / upper→lower | `sessionBuilder.ts:30-40` (`TEMPLATE_ROTATION`) | Powers "next template" recommendation. |
| Today focus override | `todayTrainingFocusOverrideEngine.ts` | Session-only, no template mutation. |
| Completion quality / partial / early-end | `trainingCompletionEngine.ts` | Guards "finish session." |
| kg/lb unit contract | `unitConversionEngine.ts` | kg storage, lb display rounding. |
| Rest timer state machine | `restTimerEngine.ts` | Pause / resume / extend / expired. |
| Coach action engine | `coachActionEngine.ts`, `coachActionIdentityEngine.ts`, `coachActionDismissEngine.ts` | Time-bounded, dismissible. |
| Data health repair pipeline | `dataHealthEngine.ts`, `dataHealthRepairEngine.ts`, `cleanAppDataView.ts` | The clean-input boundary that TrainingDecision relies on. |
| Branded clean-input contract | `trainingDecisionCleanInput.ts` | Raw AppData cannot enter TrainingDecision. |

### 4.2 Web UI artifacts (do not blindly port)

| Concept | Location | iOS treatment |
|---|---|---|
| `AddToHomeScreenHint` PWA install prompt | `src/ui/AddToHomeScreenHint.tsx` | Delete. iOS native has App Store. |
| `display-mode: standalone` checks | `AddToHomeScreenHint.tsx:13` | Delete. Native app is always "standalone." |
| `navigator.userAgent` Safari detection | `AddToHomeScreenHint.tsx:5-11` | Delete. |
| React Router / browser history (if used for back) | `src/App.tsx`, feature views | Replace with native nav stack. Browser back button quirks (refresh = remount) don't exist in iOS. |
| `localStorage.getItem('ironpath.addToHomeScreen.dismissed')` etc. | Various UI-only flags | Move to `UserDefaults` or `SwiftData` only if user-facing; many can be in-memory. |
| `service worker`, `manifest.json` | `src/main.tsx`, `index.html`, `public/` | Delete. |
| `env(safe-area-inset-bottom)` CSS | Multiple components | Native equivalent: `safeAreaInsets`. Layout-only. |
| Tailwind responsive breakpoints `md:hidden` | Components | Re-express via `UITraitCollection` / SwiftUI environment. |
| `<input type="number">` keyboard quirks | Set input components | Native: dedicated number pad. |
| Touch / mouse hybrid event handling | Various | Native: gesture recognizers only. |
| Drag-to-reorder via HTML5 DnD | Plan / exercise reordering | Native: `UICollectionView` / SwiftUI move. |
| Toast / banner via React state | `Toast.tsx` | Native: `UIAlertController` / SwiftUI `.alert` / system banner. |
| `BottomSheet` / `Drawer` polyfill | `src/ui/BottomSheet.tsx`, `Drawer.tsx`, `src/uiOs/surfaces/BottomSheet.tsx` | Native: `UISheetPresentationController`. The *content* is product (must port); the *container* is artifact. |
| Tailwind class soup | Almost every `.tsx` | Re-styled. |
| `lucide-react` icons | Imports across views | Replace with SF Symbols (broadly equivalent set). |
| `setTimeout` / `setInterval` polling | Wherever present | Native: `Combine` / `AsyncSequence` / `Timer`. The *cadence* may be product (e.g. rest timer 1s tick); the *mechanism* is artifact. |

### 4.3 Already mobile-styled (helpful signal, not the spec)

`src/uiOs/` is the next-generation UI layer that has already evolved toward iOS look-and-feel:
- `uiOs/today/TodayDecisionHero.tsx`, `TodayReadinessSummary.tsx` — hero card layout
- `uiOs/training/TrainingFocusHero.tsx`, `FocusModeActionBar.tsx`, `FocusActualSetRecordSheet.tsx`, `FocusModeSecondaryActions.tsx` — Focus Mode layout
- `uiOs/progress/ProgressInsightHero.tsx`, `EffectiveSetsVolumeCard.tsx`, `WeeklyProgressionRecommendationCard.tsx` — Progress layout
- `uiOs/records/PostWorkoutNextTimeRecommendationCard.tsx`, `RecordOsCards.tsx` — Records layout
- `uiOs/settings/*` — settings cards including cloud / equipment profile / theme
- `uiOs/primitives/` — `ActionButton`, `GlassCard`, `SegmentedControl`, `StatusBadge`
- `uiOs/surfaces/` — `BottomSheet`, `SafetyStrip`, `FloatingBottomNav`

**iOS treatment:** Use these files as a layout reference for what data each screen needs, what cards exist, what their hierarchy is. Do **not** treat them as Swift specs — they are still Tailwind + React. The structured `userFacing` payloads from TrainingDecision are the actual data contract.

## 5. Findings — cannot-be-simplified contracts

These are contracts where "let's just simplify on iOS" would silently break product correctness. They are *not* technical debt; they are intentional.

### 5.1 Single decision per render

If iOS introduces a second decision path (e.g. "the Plan tab computes its own recommendation independently of TrainingDecision"), surfaces will diverge — the user-reported V1 BLOCKING bug. Lock: every UI consumer must consume `decision.userFacing.{surface}`.

### 5.2 Reentry productive-dose floor

Cannot be reduced to "if 14+ days, do deload." The floor is per-role (compound 2, accessory 1) AND volume-multiplier-capped at 0.65 AND AR-2/3/4 must trace in `hiddenDebugSignals.arbitrationTrace`. Skipping the floor recreates the all-1-set whole-session bug.

### 5.3 Effective-set scoring constants

The RIR brackets (1-3 = full, 4 = ×0.65, ≥5 = ×0.45) and technique (poor = ×0.45) / pain (= ×0.5) penalties are evidence-backed and have been tuned. Approximating them ("ignore RIR, count all completed sets") changes what counts as progress and invalidates every long-term Progress chart the user has built up.

### 5.4 Four-ID exercise identity

`originalExerciseId / actualExerciseId / displayExerciseId / recordExerciseId` cannot be merged to a single ID. The whole point of the system is that you can replace bench press with dumbbell bench press mid-workout and (a) the set still counts toward chest volume, (b) the PR rolls under dumbbell bench (not bench), (c) the display shows dumbbell bench, (d) next session's recommendation refers back to bench. Locked by `legacyReplacementIdentityPollution.test.ts` and the entire replacement test suite.

### 5.5 Equipment-aware feasible load

The empty-bar fallback (theoretical 17 lb → feasible 45 lb / 20.4 kg) is *required*. Showing the theoretical load alone to a user who walked into a gym with only an Olympic bar would be product malpractice. Same for plate breakdown: hardcoding "45/35/25/10/5/2.5 lb plates" in the View loses the user's custom plate set.

### 5.6 Branded clean-input boundary

The `CleanTrainingDecisionInput` brand (`trainingDecisionCleanInput.ts`) exists because three feature surfaces were caught passing raw, un-cleaned AppData into TrainingDecision after Real Data Health Repair V1 was deployed (`docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md` §2). In Swift / SwiftUI the equivalent is a non-`Sendable` type marker or a phantom-typed wrapper. iOS rewrite MUST replicate this — otherwise stale `todayStatus` from yesterday will silently enter the decision and produce wrong advice.

### 5.7 Today focus override is session-only

Cannot become a persistent "preferred focus" setting. The architectural decision is that template selection is governed by the program template + adherence + rotation; the user can override for one session but the override resets. Promoting it to persistent state would conflict with the program template engine and create a "why is the system not following my plan?" experience.

### 5.8 Rest timer is per-session state

`TrainingSession.restTimerState` is a `RestTimerState | null` (`restTimerEngine.ts:5`). It is **inside** the session, not a global app timer, so multiple device → same session → resumed-on-iPad shows the same remaining time. iOS must not move this to a `Timer` outside the session model or the timer will desync across reloads.

### 5.9 Coach actions are time-bounded + dismissible + de-duplicable

`AppData.dismissedCoachActions: DismissedCoachAction[]` is a persisted record of user dismissals. The coach engine consults this so a dismissed action doesn't immediately re-surface. iOS push notifications would naturally try to re-fire — they must respect this dismissal table.

### 5.10 Data health "clean view" is read-only

`buildCleanAppDataView` returns a *view* on AppData; it does not write back. The view's only consumer that may write is the explicit repair flow under user confirmation. iOS must not eagerly "fix" data the way an auto-migrator would, or it will silently delete user history.

## 6. Findings — flows to redesign natively

These flows exist on Web but their *implementation* is heavily Web-coupled. The *intent* must carry forward; the *mechanism* should be re-thought for iOS.

| Flow | Web mechanism | iOS-native redesign |
|---|---|---|
| PWA install nag | `AddToHomeScreenHint.tsx` | Delete entirely; App Store handles installs. |
| Browser back / refresh during workout | History API + session restore via `localStorage` | Native nav controller can't lose state mid-edit; the recovery path becomes a foreground-restoration check, not a refresh handler. |
| Add-to-home-screen onboarding copy | Inline UI banner | Native onboarding screen (one-time). |
| In-app keyboard for weight entry | `<input type="number" inputMode="decimal">` | Custom keypad with kg/lb toggle, common-increment shortcuts. The Web version cannot do this without a custom widget. |
| Rest timer expiry notification | `<Toast>` + visual cue, no sound | iOS local notification + haptic + optional sound; respects Focus mode. |
| "Add weight" steppers | Buttons with onClick + delta | Native `UIStepper` or custom haptic stepper; long-press to fast-step. |
| Set anomaly second confirmation | `<ConfirmDialog>` modal | Native `UIAlertController` with destructive style. |
| Cloud sync conflict resolution | React modal with diff | Should mirror the existing cloud audit but use iOS-native diff presentation. Decision logic stays the same. |
| Data backup / export / import | HTML5 `<input type="file">` | iOS document picker + Files / iCloud Drive entry points. Encoding stays the same. |
| Calendar view (Records → calendar) | Custom React calendar grid | Embed `UICalendarView` (iOS 16+) bound to `TrainingCalendarEngine`. |
| Drag-to-reorder exercises | HTML5 DnD | SwiftUI `.onMove` / `UICollectionViewDiffableDataSource` reorder. |
| Service worker offline cache | Web-only | Native offline is the default; the offline-first cloud queue (`offlineSyncQueueEngine.ts`) becomes the right primitive directly. |
| Theme preference | CSS class toggle + `localStorage` | `UITraitCollection.userInterfaceStyle` + persisted in `UserDefaults`. |
| Bottom sheet animation | CSS transform + `pointer-events` | `UISheetPresentationController` detents. |
| "Add to home screen" dismissal flag | `localStorage` | N/A — delete. |
| HealthKit-style import (already wired) | `appleHealthXmlImportEngine.ts` + file picker | Native `HKHealthStore` direct + remove the XML import path (or keep as power-user fallback). This is a *big* iOS win: real-time HRV / sleep / activity instead of XML drops. |

## 7. Recommendation — iOS training MVP shortlist

Prioritize **three** training flows for the iOS MVP. Each must be feature-complete with the existing engine contracts behind it. Hold everything else for later. This is the smallest cut that proves the rewrite is "a real training app," not a tech demo.

### MVP-1: Today → Start a planned session

Screens: Today decision hero → optional focus override → start.

Engines required:
- `buildTrainingDecisionFromCleanInput` (via `createCleanTrainingDecisionInput`)
- `effectiveTrainingPhaseEngine` (gap → activePhase)
- `todayStateEngine` (planned / in_progress / completed)
- `nextWorkoutScheduler` + `sessionBuilder.pickSuggestedTemplate`
- `readinessEngine` (sleep / energy / soreness inputs from `TodayStatus`)
- `todayTrainingFocusOverrideEngine`
- Today presenter (`todayPresenter.ts`)

Acceptance: matches Web Today smoke (productive reentry after 14-day gap, no `本周先控制风险`, no triplet, severe override message correct on `acutePainReported`).

### MVP-2: Focus Mode — execute a session set-by-set

Screens: Training Focus Hero → set card → record bottom sheet → rest timer → next set.

Engines required:
- `focusModeStateEngine` (entire queue + step navigation)
- `focusModeInteractionState` (primary-action resolver)
- `actionableLoadContract` + equipment-aware load model
- `restTimerEngine`
- `setAnomalyEngine`
- `replacementEngine` + `smartReplacementEngine`
- `focusNextSetRecommendationEngine`
- `effectiveSetEngine` (post-set scoring)
- `loadFeedbackEngine` (too_light / good / too_heavy capture)
- `currentExerciseSelector` (identity stays intact across replacements)
- Training presenter (`trainingPresenter.ts`)

Acceptance: matches Web Focus Mode smoke (correction step says `完成纠偏` not `完成一组`; substituting bench to DB bench preserves identity; empty-bar fallback works; set anomaly second confirmation fires).

### MVP-3: Records — finish session + see what happened

Screens: Finish session → session summary → records calendar → PR list.

Engines required:
- `trainingCompletionEngine` (incomplete main work guard, early-end reason)
- `sessionPostSummaryEngine` + `sessionDetailSummaryEngine`
- `sessionQualityEngine`
- `effectiveSetEngine` (session + monthly aggregates)
- `trainingCalendarEngine`
- `sessionHistoryEngine`
- `e1rmEngine` + `recentPRDeltaEngine`
- `dataHealthEngine` (post-save sanity)
- Record presenter (`recordPresenter.ts`)

Acceptance: completing a session correctly updates PRs by `recordExerciseId`, the calendar shows the session under today, the post-workout next-time hint matches `decision.userFacing.record.nextTimeHint`, partial completion is preserved (not dropped silently), and an unfinished main lift triggers the early-end guard.

### Explicitly OUT of MVP

- Plan tab (adjustment drafts, coach inbox aggregation) — complex; can be Phase 2.
- Progress tab (strength trend charts, recovery pressure card) — needs charting investment; can be Phase 2.
- Cloud sync — Phase 3 (see Data Safety Agent's report).
- Settings / Equipment Profile editor — minimal MVP is hardcoded sane defaults; full editor Phase 2.
- HealthKit deep integration — Phase 2 (replace XML import path).
- Apple Watch companion — Phase 3+.
- Multi-user / sharing — never (per repo decision history; IronPath is single-user).

## 8. Risks if iOS copies PWA blindly

| Risk | What breaks | Severity |
|---|---|---|
| Skipping the reentry productive-dose floor | Users returning after 14+ days see all-1-set sessions; "this app is broken" experience | Blocking |
| Reverting to per-surface independent decisions | Today / Plan / Progress disagree (the V1 BLOCKING bug); user trust gone | Blocking |
| Persisting weights in lb (not kg) on iOS | Cross-platform data import / export breaks; rounding cascades across sessions | Blocking |
| Merging the 4-ID exercise identity into a single ID | All-time PR charts get re-keyed wrong when replacements are used; silent corruption | High |
| Skipping the focus-mode step queue + interaction state machine | Correction steps say "完成一组"; mobility tasks act like working sets; the UI-OS R2 bug returns | High |
| Ignoring the effective-set scoring constants | Progress charts and weekly recommendations diverge from Web; user sees different "progress" on iOS vs Web | High |
| Dropping the `CleanAppDataView` boundary | Stale `todayStatus` from previous day enters TrainingDecision; wrong advice | High |
| Dropping the equipment-aware feasible-load step | User sees "lift 17 lb" with no Olympic bar fallback | High |
| Treating today focus override as persistent | Conflicts with program template engine; users wonder why their plan isn't followed | Medium |
| Implementing rest timer as global app timer | Timer desyncs across foreground/background transitions and across-device session resume | Medium |
| Hardcoding plates in UI | User's actual plate set is ignored; rounding lies to them | Medium |
| Auto-fixing data health issues without explicit user repair | User history silently mutated | High (data safety) |
| Re-introducing PWA install prompt logic | Wasted code; confusing | Low |
| Skipping the set anomaly second confirmation | 100 kg fat-finger on warmup destroys the set log | Medium |
| Auto-re-firing dismissed coach actions | Notification spam; user loses trust in notifications | Medium |
| Reading `TrainingSession.recordExerciseId` from `originalExerciseId` directly | Replacement PR / volume goes to the wrong exercise | High |

## 9. Non-goals (out of scope for this agent)

- Swift / SwiftUI / UIKit architecture recommendations — that is the Architecture Agent.
- Project file (Xcode) structure, module layout, dependency manager (SPM vs CocoaPods) — Architecture Agent.
- Data persistence migration (Core Data vs SwiftData vs custom JSON) — Data Safety Agent.
- Cloud sync re-implementation strategy on iOS (CloudKit vs continuing Supabase) — Data Safety Agent.
- UI re-design (this report explicitly does **not** re-design Today / Training / Plan / Records visually) — UI Agent.
- Recommendation algorithm changes — Recommendation Agent.
- Regression test plan / fixture porting — Regression Agent.
- Implementation sequencing across multiple iOS PRs — Implementation Agent.
- Whether to deprecate the existing PWA, fork it, or keep it as a fallback — orchestrator decision.
- Whether to add Apple Watch / iPad / macOS Catalyst — orchestrator decision.

## 10. Open questions

1. **Which `decisionVersion` does iOS launch with?** `trainingDecisionTypes.ts:429` locks `decisionVersion: 'v2'`. If iOS ships and Web bumps to v3 mid-flight, do we hold Web until iOS catches up, or do we version the engine output? — orchestrator + Architecture Agent.

2. **Can the engine code be shared via cross-platform compilation?** TypeScript → JavaScript bundled into iOS WKWebView is one path; TypeScript → Kotlin via Kotlin/JS is another; rewriting in Swift is a third. The engines are pure (no DOM, no I/O, deterministic) so all three are technically feasible. Implication for this report: my "must preserve" contracts hold regardless, but the cost of porting differs by 10x between approaches. — Architecture Agent.

3. **Does iOS start with English-only or zh-CN?** Current copy in `userFacing.*` payloads is hardcoded zh-CN (e.g. `phaseLabel: '回归周'`). If iOS launches in en-US, `formatExerciseName`, `formatMuscleName`, and every Chinese phrase emitted by TrainingDecision need an i18n layer. The engine architecture supports this (copy is centralized) but the work is non-trivial. — Implementation Agent / UI Agent.

4. **What is the iOS minimum supported version?** Affects which native APIs we can use (`UICalendarView` is iOS 16+; `SwiftData` is iOS 17+; HealthKit background delivery semantics differ pre-iOS 15). — orchestrator.

5. **Equipment Profile editor MVP scope.** The Web has a settings panel (`uiOs/settings/EquipmentProfileSettingsPanel.tsx`). For MVP-1/2/3, can we ship with `unknown` equipment profile and the conservative default rounding (preserving correctness, sacrificing accuracy)? Or is an empty profile a UX dealbreaker? — UI Agent.

6. **Healthkit-as-Readiness boundary.** Web has `useHealthDataForReadiness` setting (`AppSettings.healthIntegrationSettings`). With native HealthKit, users will *expect* automatic sleep / HRV integration. Do we ship MVP with manual `TodayStatus` entry only, or do we wire HealthKit on day one? Wiring HealthKit on day one significantly expands MVP-1 scope. — Architecture + Data Safety Agents.

7. **Browser-driven Cloud audit flow vs native equivalent.** Recent V3/V4/V5 cloud upload work uses HTTP routes that assume a fetch-based client. iOS will hit Supabase directly via URLSession or the official Swift SDK. The route contract (`POST /sessions/active/patches` etc.) holds; the question is whether to keep the existing HTTP wrapper or talk to Supabase directly. — Architecture + Data Safety Agents.

8. **The `legacyCompleted` set status fork.** `TrainingSetLog.completionStatus: 'legacy_completed'` exists for historical user data. iOS importing a Web user's history must preserve this status (not coerce to `completed`). Test coverage exists (`tests/legacy*`) but iOS import has not been designed. — Data Safety Agent.

9. **Adaptive calibration state lifetime.** `AdaptiveCalibrationState` (passed into TrainingDecision via metadata) decays on long lapses (`decayCalibrationStateForLapse` in `trainingLapseEngine.ts`). Does iOS get a fresh calibration on first install, or does it inherit the user's Web calibration via cloud restore? Affects MVP-1's "first session on iOS feels right" experience. — Architecture + Recommendation Agents.

10. **Push notifications for rest timer / coach actions.** Are we shipping any iOS push? If yes, the rest timer expiry notification is the most useful first one, but it must respect the iOS "do not disturb" / Focus mode, and must dedupe with the in-app timer. Out of scope for engines per se but couples to `restTimerEngine` + `coachActionEngine`. — UI + Architecture Agents.
