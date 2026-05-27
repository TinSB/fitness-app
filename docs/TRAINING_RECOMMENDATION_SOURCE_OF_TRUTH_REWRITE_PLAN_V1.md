# Training Recommendation Source-of-Truth Rewrite Plan V1

Branch: `claude/training-recommendation-system-full-rewrite-v1`
Status: PLAN — implementation begins only after this document is committed.
Related prior audit: [TRAINING_CYCLE_GAP_REENTRY_AUDIT_V1.md](TRAINING_CYCLE_GAP_REENTRY_AUDIT_V1.md) (PR #381)

## 0. Why this rewrite

IronPath currently emits conflicting training advice. Concrete user-observed contradictions (4-day/week serious lifter, 14+ day gap, prior phase = deload):

- Today shows phase label `回归周`.
- TrainingFocus prescribes 1 working set for several exercises in the same session.
- Plan's weekly card says `本周先控制风险` and reduces 2 sets across back / legs / chest / shoulders / arms.
- Progress hero shows `力量有进步 / 恢复压力偏高 / 下次建议保持重量` as three independent badges.
- The cumulative effect is that the app behaves like a permanent risk-warning machine, even for a normal serious lifter.

The cause is not a single faulty formula. There are six independent "final-decision" emitters that each form opinions about phase, volume, intensity, weekly direction, and per-exercise prescription. Patching any one of them in isolation has been tried and will not converge: peers will continue to disagree.

This rewrite consolidates all final user-facing training advice behind a single source of truth: `TrainingDecision`, produced by `src/engines/trainingDecisionEngine.ts`. Other engines remain as signal providers but lose the right to emit user-facing decisions independently.

## 1. Full inventory of recommendation components

Derived from `/global-scan` and `/multi-agent-audit`. Grouped by current role.

### 1.1 Engines that currently emit final user-facing advice (must be downgraded)

| File | Final-decision output | Visible Chinese strings emitted |
|---|---|---|
| [src/engines/exercisePrescriptionEngine.ts](src/engines/exercisePrescriptionEngine.ts) | Per-exercise sets / reps / load / RIR / adjustment notes | `回归周：训练量收到约 65%。` / `减量周：训练量下修到约 X%，优先恢复。` |
| [src/engines/weeklyProgressionRecommendationEngine.ts](src/engines/weeklyProgressionRecommendationEngine.ts) | Per-muscle weekly direction + summary line; per-item user message | `本周先控制风险。` (line 660 & 664) / `下周可小幅推进。` / `下周维持当前节奏。` / per-item action labels |
| [src/engines/progressClaritySummary.ts](src/engines/progressClaritySummary.ts) | Hero state interpretation + primaryRecommendation + caution | `力量有进步，但恢复压力偏高` (line 144) / `保持重量` (line 146, 179) / `优先恢复` / `保守加重` |
| [src/engines/dailyTrainingAdjustmentEngine.ts](src/engines/dailyTrainingAdjustmentEngine.ts) | Daily adjustment type + title/summary/suggestedChanges | `保守训练` / `减量观察` / `恢复优先` |
| [src/engines/readinessEngine.ts](src/engines/readinessEngine.ts) | `trainingAdjustment ∈ {push, normal, conservative, recovery}` | `保守训练` / `正常推进` (line 46/50) |
| [src/engines/todayTrainingReadinessDecisionEngine.ts](src/engines/todayTrainingReadinessDecisionEngine.ts) | `decisionKind` + title + summary + userMessage | `今天按计划` / `建议保守` / `建议降量` / `建议恢复` / `动作优先` |
| [src/engines/postWorkoutNextTimeRecommendationEngine.ts](src/engines/postWorkoutNextTimeRecommendationEngine.ts) | Per-exercise next-time verdict (increase / keep / reduce) + summary | `下次建议` / `保持重量` / `主动加量` / `降重处理` |
| [src/engines/focusNextSetRecommendationEngine.ts](src/engines/focusNextSetRecommendationEngine.ts) | Real-time set-by-set verdict | `加重` / `保持` / `减重` / `减少次数` / `先停止` / `先不冲重量` / `延长休息` |

### 1.2 Engines that produce signals consumed by the above (kept as signal providers)

| File | Output | New role |
|---|---|---|
| [src/engines/effectiveTrainingPhaseEngine.ts](src/engines/effectiveTrainingPhaseEngine.ts) | `EffectiveTrainingPhase` (activePhase, mode, severity, compactLabel, gapDays, effectiveWeek) | Signal: phase + volumeMultiplier. UI must NOT read compactLabel directly. |
| [src/engines/trainingLapseEngine.ts](src/engines/trainingLapseEngine.ts) | `TrainingLapseSignal` (stage, decay, retention, suggestedStartingLoadFactor, rotationHint) | Signal: lapse-aware load decay. |
| [src/engines/adaptiveFeedbackEngine.ts](src/engines/adaptiveFeedbackEngine.ts) → `buildAdaptiveDeloadDecision` | DeloadDecision (triggered, level, strategy, volumeMultiplier) | Signal: deload trigger only. Final volume decision deferred to TrainingDecision. |
| [src/engines/autoDeloadTriggerEngine.ts](src/engines/autoDeloadTriggerEngine.ts) | Gate signal | Signal only. |
| [src/engines/recoveryAwareScheduler.ts](src/engines/recoveryAwareScheduler.ts) | Recovery kind + conflict level | Signal: template-recovery conflict. |
| [src/engines/adherenceAdjustmentEngine.ts](src/engines/adherenceAdjustmentEngine.ts) | weeklyVolumeMultiplier + complexity level | Signal: adherence-based dose hint. |
| [src/engines/supportPlanEngine.ts](src/engines/supportPlanEngine.ts) | WeeklyMuscleBudget + correction/functional dose | Signal: dose budget. Final dose deferred to TrainingDecision. |
| [src/engines/volumeAdaptationEngine.ts](src/engines/volumeAdaptationEngine.ts) | Per-muscle decision (increase/decrease/hold) + setsDelta | Signal: volume direction candidate. Final aggregation by TrainingDecision. |
| [src/engines/setByRirAdjustmentEngine.ts](src/engines/setByRirAdjustmentEngine.ts) | Set delta by RIR distribution | Signal. |
| [src/engines/setWeightFineTuneEngine.ts](src/engines/setWeightFineTuneEngine.ts) | Weight projection (8-week regression, ±4%/wk cap) | Signal. PR #377 trust-override logic preserved. |
| [src/engines/adaptiveRecommendationEngine.ts](src/engines/adaptiveRecommendationEngine.ts) | Load bias multiplier (0.85–1.15) | Signal. |
| [src/engines/effectiveSetEngine.ts](src/engines/effectiveSetEngine.ts) | Per-set effectiveness score | Signal. |
| [src/engines/recommendationConfidenceEngine.ts](src/engines/recommendationConfidenceEngine.ts) | Per-exercise confidence | Signal. |
| [src/engines/plateauDetectionEngine.ts](src/engines/plateauDetectionEngine.ts) | Plateau verdict | Signal. |
| [src/engines/painPatternEngine.ts](src/engines/painPatternEngine.ts) | Pain pattern map | Signal. |
| [src/engines/loadFeedbackEngine.ts](src/engines/loadFeedbackEngine.ts) | RIR/effort signal | Signal. |
| [src/engines/sessionQualityEngine.ts](src/engines/sessionQualityEngine.ts) | Per-session quality score | Signal. |
| [src/engines/trainingIntelligenceSummaryEngine.ts](src/engines/trainingIntelligenceSummaryEngine.ts) | keyInsights + recommendedActions | Aggregator: refactor to feed TrainingDecision; no direct UI emission. |
| [src/engines/coachActionEngine.ts](src/engines/coachActionEngine.ts) | CoachAction[] | Adjacent system: coach actions remain, but priority + filtering reads `decision.weeklyAdjustment` to avoid contradicting it. |
| [src/engines/coachActionDismissEngine.ts](src/engines/coachActionDismissEngine.ts), [src/engines/coachActionIdentityEngine.ts](src/engines/coachActionIdentityEngine.ts) | Filtering / fingerprint | Unchanged. |
| [src/engines/coachAutomationEngine.ts](src/engines/coachAutomationEngine.ts) | Older synth | Superseded by enginePipeline + coachActionEngine; candidate for delete after rewrite stabilises (out of scope here). |
| [src/engines/equipmentAwareActionablePrescription.ts](src/engines/equipmentAwareActionablePrescription.ts), [src/engines/equipmentAwareRecommendationDisplay.ts](src/engines/equipmentAwareRecommendationDisplay.ts) | Equipment translation | Pure formatting; unchanged. |
| [src/engines/deloadSignalEngine.ts](src/engines/deloadSignalEngine.ts) | Thin wrapper on adaptiveFeedback | Eliminated (call adaptiveFeedback directly). |

### 1.3 Presenters / aggregators (must become pure formatters)

| File | Current behaviour | After |
|---|---|---|
| [src/presenters/todayPresenter.ts](src/presenters/todayPresenter.ts) | Picks scattered fields from todayState + recoveryRecommendation + nextWorkout | Reads only `decision.userFacing.today` + raw template metadata |
| [src/presenters/planPresenter.ts](src/presenters/planPresenter.ts) | Aggregates coach inbox + advice | Reads only `decision.userFacing.plan` + coach actions filtered by decision |
| [src/presenters/planAdviceAggregator.ts](src/presenters/planAdviceAggregator.ts) | Owns per-muscle advice merging + priority | Becomes thin pass-through over `decision.weeklyAdjustment` |
| [src/presenters/trainingPresenter.ts](src/presenters/trainingPresenter.ts) | Formats focus view model | Reads `decision.userFacing.training` + `decision.exercisePrescriptions` |
| [src/presenters/recommendationExplanationPresenter.ts](src/presenters/recommendationExplanationPresenter.ts) | Owns factor priority ranking | Reads `decision.userFacing.explanation` + dev-only `hiddenDebugSignals` |
| [src/presenters/recordPresenter.ts](src/presenters/recordPresenter.ts) | Tabs + counts | Reads `decision.userFacing.record` |
| [src/presenters/coachActionPresenter.ts](src/presenters/coachActionPresenter.ts) | Maps action source → label + tone + surface filtering | Unchanged surface routing; priority capped by `decision.riskLevel`. |
| [src/presenters/coachReminderPresenter.ts](src/presenters/coachReminderPresenter.ts) | Dedup + tone ranking | Unchanged (semantic dedup only). |
| [src/presenters/dataHealthPresenter.ts](src/presenters/dataHealthPresenter.ts) | Data health aggregation | Unchanged (orthogonal domain). |
| [src/presenters/profilePresenter.ts](src/presenters/profilePresenter.ts) | Profile formatting | Unchanged. |

### 1.4 UI surfaces (must be rewired)

HIGH-impact (6): TodayDecisionHero, TodayReadinessDecisionSummary, ProgressInsightHero, WeeklyProgressionRecommendationCard, PostWorkoutNextTimeRecommendationCard, RecommendationExplanationPanel.

MEDIUM-impact (8): ReadinessPressureCard, EffectiveSetsVolumeCard, StrengthTrendCards, TrainingOsCards, EquipmentAwareLoadCard, FocusModeActionBar, TrainingFocusHero, TodayFocusOverridePanel.

LOW-impact (read-only) (7): TodaySevereRiskNotice, HistoryDaySummaryCard, PrErmQuickAccessCards, DailyTrainingStatusPanel, HistoryFrequencySummary, RecentTrainingTimeline, TrainingFrequencyCalendar.

Feature shells: TodayView, PlanView, TrainingView, TrainingFocusView, ProgressView, RecordView (each receives the same `TrainingDecision` via one hook).

### 1.5 Test surface

~42 existing test files touch recommendation domain. Most relevant pre-existing locks to preserve:

- `tests/trainingPhaseEffectiveMapping.test.ts` — PR #381 reentry gap state machine.
- `tests/trainingPhaseGapWiringRecommendation.test.ts` — PR #381 advisory wiring.
- `tests/fineTuneTrustOverride.test.ts` — PR #377 conservative-pipeline fusion.
- `tests/recommendationConsistency.test.ts` — idempotency.
- `tests/todayTrainingReadinessDecisionBoundary.test.ts` — engine isolation.
- `tests/recommendationConfidenceEngine.test.ts`, `progressClaritySummary.test.ts`, `weeklyProgressionRecommendationDisplayIntegration.test.ts`, `recommendationRecoveryExplanation.test.ts` — engine + display integration.
- `tests/appDataRoundTripRegression.test.ts`, `explicitOptInSyncPreflightBoundary.test.ts`, `offlineRollbackBoundary.test.ts` — data safety boundaries.

## 2. Current fragmented dataflow

```
AppData
  └── trainingDecisionContext (input normalizer)
        ├── effectiveTrainingPhaseEngine     (activePhase, compactLabel="回归周", effectiveWeek)
        ├── trainingLapseEngine              (stage, decayMultiplier, startingLoadFactor)
        ├── readinessEngine                  (score, level, trainingAdjustment="保守训练"/...)
        ├── dailyTrainingAdjustmentEngine    (type, title, summary, suggestedChanges)
        ├── recoveryAwareScheduler           (kind, conflictLevel)
        ├── volumeAdaptationEngine           (per-muscle decision, setsDelta)
        ├── adherenceAdjustmentEngine        (volumeMultiplier, complexityLevel)
        ├── weeklyProgressionRecommendationEngine
        │     └─ weeklySummary() returns "本周先控制风险。" when items have risk=high
        │        or recommendationKind ∈ {conservative_progress, deload}
        ├── progressClaritySummary
        │     └─ when trend='improving' AND pressure='high':
        │           heroTitle="力量有进步，但恢复压力偏高"
        │           primaryRecommendation="保持重量"  (independent emission)
        ├── exercisePrescriptionEngine.applyStatusRules
        │     ├─ line 347: volumeMultiplier = mesocycleWeek.volumeMultiplier (reentry→0.65)
        │     ├─ line 358: sets = Math.max(1, ceil(sets * max(0.6, volumeMultiplier)))
        │     └─ later: applyDeloadStrategy(exercise, deloadDecision)
        │           when deloadDecision.triggered && strategy='reduce_volume':
        │           sets = Math.max(1, ceil(sets * max(0.4, deloadDecision.volumeMultiplier)))
        │     └─ NET: reentry 0.65 × deload 0.60 ≈ 0.39 → 1-set sessions
        ├── postWorkoutNextTimeRecommendationEngine ("下次建议 / 保持重量")
        ├── focusNextSetRecommendationEngine (real-time)
        ├── todayTrainingReadinessDecisionEngine (final daily kind/title/summary)
        ├── todayDecisionSurface (formatting + decision state)
        └── coachActionEngine (cards)
              ↓
        enginePipeline (aggregates outputs into result)
              ↓
        presenters (each picks fragments from many engines)
              ↓
        UI surfaces (each renders independently)
```

Each of the bold-emitting engines (`weeklyProgressionRecommendationEngine`, `progressClaritySummary`, `exercisePrescriptionEngine` post-deload-stack, `postWorkoutNextTimeRecommendationEngine`, `todayTrainingReadinessDecisionEngine`) is unaware of the others. The result is independent voices on overlapping decisions.

## 3. Contradiction map

For the seed scenario (4 d/wk recently, 14+ day gap, prior phase = deload, no acute pain, normal soreness):

| Visible output | Producer (file:line) | Mechanism |
|---|---|---|
| Phase label `回归周` shown on Today/Plan | [effectiveTrainingPhaseEngine.ts:90](src/engines/effectiveTrainingPhaseEngine.ts:90) (`compactLabel: '回归周'`) | activePhase='reentry' on 14+ day gap. Correct. |
| 1-set whole-session prescription | [exercisePrescriptionEngine.ts:358](src/engines/exercisePrescriptionEngine.ts:358) ∗ [applyDeloadStrategy line 285-296](src/engines/exercisePrescriptionEngine.ts:285) | reentry trim × independent deload trim. No productive-floor enforcement per role. |
| Weekly card `本周先控制风险` -2 sets across muscles | [weeklyProgressionRecommendationEngine.ts:660](src/engines/weeklyProgressionRecommendationEngine.ts:660) and `:664` | `weeklySummary()` triggers on any risk=high or conservative_progress/deload item. Engine never reads `effectivePhase`. |
| Triplet `力量有进步 / 恢复压力偏高 / 下次建议保持重量` | [progressClaritySummary.ts:144-146](src/engines/progressClaritySummary.ts:144) and `:179` | trend=improving + pressure=high → hardcoded heroTitle + primaryRecommendation pair. Engine never reads `activePhase` or any other final decision. |
| "Permanent risk-warning machine" feel | Multiple: dailyTrainingAdjustmentEngine (conservative), readinessEngine.mapReadinessToSignal:46 ("保守训练"), weeklyProgressionRecommendationEngine:660 (risk-summary), exercisePrescriptionEngine.applyDeloadStrategy:285-296 (deload trim) | Each emits risk verdict independently. No global cap or downgrade. |

Patching any one of these alone has been tried — peers continue to disagree. The fix is structural.

## 4. New single-source-of-truth architecture

### 4.1 Layering

```
AppData
  └── trainingDecisionContext        (input normalizer; pure)
        └── { signal engines run here, producing typed signals only }
              ├── EffectivePhaseSignal
              ├── TrainingLapseSignal
              ├── DeloadTriggerSignal      (from adaptiveFeedbackEngine)
              ├── ReadinessSignal
              ├── DailyAdjustmentSignal
              ├── RecoverySignal
              ├── VolumeAdaptationSignal
              ├── AdherenceSignal
              ├── ProgressClaritySignal    (e1rmTrend, fatigueTrend; NO text)
              ├── WeeklyProgressionSignal  (per-item direction; NO text)
              ├── PostWorkoutNextTimeSignal (per-exercise verdict; NO text)
              ├── PlateauSignal / PainSignal / LoadFeedbackSignal / etc.
        ↓
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║ src/engines/trainingDecisionEngine.ts (NEW — sole final-decision owner)  ║
  ║   buildTrainingDecision(input, signals) → TrainingDecision               ║
  ║   Applies arbitration rules AR-1 … AR-9 (section 9).                     ║
  ║   Owns every user-facing decision and every user-facing string surface.  ║
  ╚══════════════════════════════════════════════════════════════════════════╝
        ↓
  enginePipeline  (adds `trainingDecision: TrainingDecision` to result)
        ↓
  presenters (PURE FORMATTERS: copy strings come verbatim from decision.userFacing.*)
        ↓
  UI surfaces (each reads from one place: trainingDecision)
```

### 4.2 Pure-function contract

- `buildTrainingDecision` is deterministic; inputs → output by reference equality on identical input.
- No clock, no random, no DOM, no localStorage, no cloud calls.
- Optional `nowIso` for time-of-day rules is passed in; otherwise read once at the boundary.

### 4.3 Single-direction-per-screen contract

`TrainingDecision.userFacing` is `Record<SurfaceId, UserFacingPerSurface>` where each surface has at most:
- one `headline` (≤ 60 chars)
- one `oneLineAdvice` (≤ 80 chars)
- one optional `riskBadge`
- one optional `primaryAction`

The engine asserts these caps; tests enforce. By construction it is impossible for a screen to render two contradictory headlines.

### 4.4 Signal engine wiring (which engines feed buildTrainingDecision)

`buildTrainingDecision(input, signals)` accepts a precomputed `signals` bag plus raw `input`. A single orchestrator function `assembleTrainingDecisionSignals(input)` lives next to `trainingDecisionEngine.ts` and is the **only** place that imports the legacy engines. `enginePipeline.ts` calls `assembleTrainingDecisionSignals` then `buildTrainingDecision`.

| Signal type | Producer | Read by TrainingDecision for |
|---|---|---|
| `EffectivePhaseSignal` | `effectiveTrainingPhaseEngine.getEffectiveTrainingPhase` | `activePhase`, `volumeMode`, AR-2 trigger |
| `TrainingLapseSignal` | `trainingLapseEngine.buildTrainingLapseSignal` | `intensityMode` (decay), AR-3 floor selection |
| `ReadinessSignal` | `readinessEngine.buildReadinessResult` + `mapReadinessToSignal` (string emission removed) | `riskLevel`, AR-5 fatigue side |
| `DailyAdjustmentSignal` | `dailyTrainingAdjustmentEngine.buildDailyTrainingAdjustment` (text fields removed) | Per-day multiplier candidate, AR-2 clamping |
| `RecoverySignal` | `recoveryAwareScheduler.buildRecoveryAwareRecommendation` | `sessionIntent` recovery branch, template conflict |
| `VolumeAdaptationSignal` | `volumeAdaptationEngine.buildVolumeAdaptationReport` | Per-muscle direction candidate, AR-4 gate |
| `AdherenceSignal` | `adherenceAdjustmentEngine.buildAdherenceAdjustment` | Weekly multiplier hint, AR-2 clamping |
| `ProgressClaritySignal` | `progressClaritySummary.buildProgressClaritySignal` (rewrite of buildProgressClaritySummary; enum only) | AR-5 trend side, `progressionMode` |
| `WeeklyProgressionSignal` | `weeklyProgressionRecommendationEngine.buildWeeklyProgressionSignal` (rewrite; per-item direction, no text) | `weeklyAdjustment`, AR-4 gate |
| `PostWorkoutNextTimeSignal` | `postWorkoutNextTimeRecommendationEngine.buildPostWorkoutNextTimeSignal` (rewrite; enum + numerics) | `userFacing.record`, `nextSetPolicy` |
| `DeloadTriggerSignal` | `adaptiveFeedbackEngine.buildAdaptiveDeloadDecision` | AR-2 clamping; never multiplied with reentry |
| `PlateauSignal` | `plateauDetectionEngine.detectPlateauResults` | `progressionMode`, AR-5 detect side |
| `PainSignal` | `painPatternEngine.buildPainPatterns` | Severe-flag inference for AR-1 |
| `LoadFeedbackSignal` | `loadFeedbackEngine.buildLoadFeedbackSummary` | `nextSetPolicy`, intensity tuning |
| `SessionQualitySignal` | `sessionQualityEngine.buildSessionQuality` | Confidence weighting |
| `EffectiveSetSignal` | `effectiveSetEngine.evaluateEffectiveSet` summary | Volume target enforcement |
| `RecommendationConfidenceSignal` | `recommendationConfidenceEngine.buildRecommendationConfidence` | Surface confidence label |
| `FineTuneSignal` | `setWeightFineTuneEngine.buildSetWeightFineTune` | Per-exercise load projection (PR #377 trust override flows through here; consumed by `ExercisePrescriptionDecision.loadKg` assembly) |
| `AdaptiveBiasSignal` | `adaptiveRecommendationEngine.getLoadBias` | Per-exercise load bias (calibration) |
| `SupportPlanSignal` | `supportPlanEngine.buildSupportPlan` | Correction/functional dose; clamped by `volumeMode` |
| `RotationSignal` | `trainingLapseEngine.rotationHint` | `MuscleGroupVolumeTarget` weighting |

**PR #377 fineTune unlock**: The fineTune trust-override gates (8+ weeks of stable progression → `conservativeTopSet=false`, `adaptiveTopSetFactor ≥ 1`) live in the prescription assembly step of `buildTrainingDecision`. When `FineTuneSignal.confidence === 'high'` and no severe signal fires, `intensityMode` is allowed to be `'expand'` and the assembler produces `ExercisePrescriptionDecision.loadKg` from the fineTune projection. The fineTune contract from `tests/fineTuneTrustOverride.test.ts` is preserved by routing the FineTuneSignal through TrainingDecision, not by mutating it.

## 5. Proposed TrainingDecision shape

```ts
// src/engines/trainingDecisionTypes.ts (new)

export type ActivePhase     = 'base' | 'build' | 'overload' | 'deload' | 'reentry' | 'restart';
export type TrainingMode    = 'hypertrophy' | 'strength' | 'hybrid' | 'recovery';
export type SessionIntent   =
  | 'normal-session'
  | 'reentry-productive'   // 14+ day gap, conservative but productive (NOT all-1-set)
  | 'controlled-reload'    // strength up + fatigue high → light reload, not rest
  | 'deload-week'          // explicit mesocycle deload assigned
  | 'severe-rest';         // acute pain / injury / illness only
export type RiskLevel       = 'none' | 'low' | 'moderate' | 'high' | 'severe';
export type ProgressionMode = 'progress' | 'hold' | 'pull-back' | 'reload';
export type VolumeMode      = 'expand' | 'hold' | 'trim' | 'reentry-floor' | 'severe-cut';
export type IntensityMode   = 'expand' | 'hold' | 'cap' | 'cut';

export type ExerciseRole    = 'main-compound' | 'secondary-compound' | 'accessory' | 'isolation';
export type SurfaceId       = 'today' | 'plan' | 'training' | 'focus' | 'progress' | 'record' | 'explanation';

export interface WorkingSetTarget {
  exerciseId: string;
  role: ExerciseRole;
  targetSets: number;                // post-arbitration, productive floor applied
  targetReps: [number, number];
  intensityCapPctE1rm?: number;
  rationaleCode: string;             // structured; presenter never synthesizes copy
}

export interface ExercisePrescriptionDecision {
  exerciseId: string;
  sets: number;
  reps: [number, number];
  loadKg?: number;
  restSec: number;
  rir?: [number, number];
  adjustmentCode: string;            // structured; presenter maps to short copy from userFacing
  alternativeIds?: string[];
}

export interface MuscleGroupVolumeTarget {
  muscleGroup: string;
  weeklyEffectiveSetsTarget: number;
  weeklyEffectiveSetsFloor: number;  // reentry/severe-aware floor
  weeklyEffectiveSetsCeiling: number;
}

export interface WeeklyAdjustment {
  direction: 'increase' | 'hold' | 'decrease';
  magnitudePct: number;              // 0..30
  appliesFromIsoDate: string;
  blockedBy?: 'reentry-floor' | 'severe-signal-required' | null;
}

export interface NextSetPolicy {
  enabled: boolean;
  loadDeltaKg?: number;
  rirTarget?: number;
  stopCriteria?: 'rir-0' | 'rep-target' | 'tonnage-cap';
}

export interface RiskBadge {
  level: RiskLevel;
  label: string;                     // ≤ 12 chars
  rationaleCode: string;
}

export interface UserFacingPerSurface {
  surfaceId: SurfaceId;
  headline: string;                  // ≤ 60 chars; ONE sentence
  oneLineAdvice?: string;            // ≤ 80 chars
  riskBadge?: RiskBadge;             // ≤ 1
  primaryActionLabel?: string;       // ≤ 12 chars
  micro?: Record<string, string>;    // tightly-scoped per-surface micro-strings
}

export interface HiddenDebugSignals {
  effectivePhase: EffectivePhaseSignal;
  lapse: TrainingLapseSignal;
  readiness: ReadinessSignal;
  dailyAdjustment: DailyAdjustmentSignal;
  recovery: RecoverySignal;
  volumeAdaptation: VolumeAdaptationSignal;
  adherence: AdherenceSignal;
  progressClarity: ProgressClaritySignal;
  weeklyProgression: WeeklyProgressionSignal;
  postWorkoutNextTime: PostWorkoutNextTimeSignal;
  deloadTrigger: DeloadTriggerSignal;
  arbitrationTrace: string[];        // ordered list of which AR-rules fired
}

export interface TrainingDecision {
  activePhase: ActivePhase;
  trainingMode: TrainingMode;
  sessionIntent: SessionIntent;
  riskLevel: RiskLevel;
  progressionMode: ProgressionMode;
  volumeMode: VolumeMode;
  intensityMode: IntensityMode;
  exercisePrescriptions: ExercisePrescriptionDecision[];
  workingSetTargets: WorkingSetTarget[];
  muscleGroupVolumeTargets: MuscleGroupVolumeTarget[];
  weeklyAdjustment: WeeklyAdjustment;
  nextSetPolicy?: NextSetPolicy;
  userFacing: Partial<Record<SurfaceId, UserFacingPerSurface>>;
  hiddenDebugSignals: HiddenDebugSignals;
  computedAtIso: string;
  decisionVersion: 'v1';
}

export interface TrainingDecisionInput {
  template: TrainingTemplate;
  todayStatus: TodayStatus;
  history: TrainingSession[];
  mesocyclePlan?: MesocyclePlan | null;
  screening?: ScreeningProfile;
  healthSummary?: HealthSummary;
  useHealthDataForReadiness?: boolean;
  adaptiveCalibration?: AdaptiveCalibrationState;
  trainingMode: TrainingMode | string;
  nowIso?: string;
  // Severe signals — only these allow further volume cut below reentry floor:
  acutePainReported?: boolean;
  injuryFlag?: boolean;
  illnessFlag?: boolean;
  explicitDeloadAssigned?: boolean;  // mesocyclePlan currently marks this week as 'deload'
}
```

## 6. Components deleted / replaced

| Action | File | Reason |
|---|---|---|
| Narrow (keep file, remove user-facing exports) | `weeklyProgressionRecommendationEngine.ts` | Convert to `buildWeeklyProgressionSignal`; remove `weeklySummary()` text + per-item user-facing strings. |
| Narrow | `progressClaritySummary.ts` | Convert to `buildProgressClaritySignal`; emit `e1rmTrend`, `volumeTrend`, `fatigueTrend` enums only. Remove `heroTitle`, `primaryRecommendation`, `caution`. |
| Narrow | `dailyTrainingAdjustmentEngine.ts` | Convert to `buildDailyAdjustmentSignal`; keep numeric multipliers + reasonCodes. Remove title/summary/suggestedChanges strings. |
| Narrow | `postWorkoutNextTimeRecommendationEngine.ts` | Convert to `buildPostWorkoutNextTimeSignal`; remove summary + per-exercise userMessage strings. |
| Narrow | `todayTrainingReadinessDecisionEngine.ts` | Convert to `buildTodayReadinessSignal`; remove title/summary/userMessage. |
| Narrow | `readinessEngine.ts` `mapReadinessToSignal` | Remove the `"保守训练"` / `"正常推进"` string emission; return enum only. |
| Refactor double-trim | `exercisePrescriptionEngine.ts` lines 285-296 and 347-358 | The two volume trims are merged into a single multiplier supplied by `TrainingDecision.volumeMode` + `MuscleGroupVolumeTarget`. Engine becomes prescription assembler that takes `volumeMultiplier` (already final) as a parameter. Productive-floor enforcement moved into TrainingDecision per `ExerciseRole`. **Concrete refactor**: lines 285-296 (`applyDeloadStrategy` per-exercise re-trim) are deleted; line 347's `volumeMultiplier` computation moves out (now a parameter). The new signature is `applyStatusRules(template, status, trainingMode, volumeMultiplier: number, exerciseRoleFloors: Record<ExerciseRole, number>, weeklyPrescription, history, screening, mesocyclePlan, context)`. The caller (`assembleTrainingDecisionSignals` → `buildTrainingDecision`) supplies the already-arbitrated multiplier. Old internal `deloadDecision` flow is dropped from this engine. |
| Refactor | `recommendationExplanationPresenter.ts` | Drop independent factor synthesis; render `decision.userFacing.explanation` + dev-mode `hiddenDebugSignals`. |
| Refactor | `planAdviceAggregator.ts` | Drop independent priority aggregation; thin pass-through over `decision.weeklyAdjustment` + coach actions filtered by `decision.riskLevel`. |
| Refactor | `todayPresenter.ts` | Drop independent kind selection; read `decision.userFacing.today`. |
| Eliminate | `deloadSignalEngine.ts` | Pure delegation to adaptiveFeedback. Callers switch to `adaptiveFeedbackEngine.buildAdaptiveDeloadDecision` directly. File deleted only if it has no external callers; otherwise re-export from the new module. |
| Keep unchanged | `coachActionEngine.ts`, `coachActionDismissEngine.ts`, `coachActionIdentityEngine.ts` | Coach cards remain; priority capped by `decision.riskLevel`. |
| Keep unchanged | All cloud/sync/storage modules, AppData schema, migration, sanitization. | Out of scope. Data Safety Agent verified no schema impact. |

## 7. Components retained as signal providers

(See §1.2 for the full list.) Each retains its current input/output shape minus user-facing copy fields. The TypeScript type signatures intentionally lose narrative fields so callers cannot accidentally render them as user-visible text. Existing tests for those engines are updated to drop user-facing-string assertions and keep enum/numeric assertions.

## 8. UI surfaces rewired

| Surface (file) | Old input | New input |
|---|---|---|
| [src/uiOs/today/TodayDecisionHero.tsx](src/uiOs/today/TodayDecisionHero.tsx) | todayDecisionSurface result | `decision.userFacing.today` (headline + advice + ≤1 risk + 1 action) |
| [src/uiOs/today/TodayReadinessDecisionSummary.tsx](src/uiOs/today/TodayReadinessDecisionSummary.tsx) | todayTrainingReadinessDecision | `decision.userFacing.today.oneLineAdvice` only; no independent body text |
| [src/uiOs/today/TodayFocusOverridePanel.tsx](src/uiOs/today/TodayFocusOverridePanel.tsx) | TodayTrainingFocusSelection | Unchanged (override is user-input, not advice); copy from `decision.userFacing.today.micro.overrideWarning` if any |
| [src/uiOs/today/TodaySevereRiskNotice.tsx](src/uiOs/today/TodaySevereRiskNotice.tsx) | severe blocker | Render only if `decision.riskLevel === 'severe'`; copy from `decision.userFacing.today.riskBadge` |
| [src/uiOs/training/TrainingFocusHero.tsx](src/uiOs/training/TrainingFocusHero.tsx) / [TrainingOsCards.tsx](src/uiOs/training/TrainingOsCards.tsx) | scattered | `decision.exercisePrescriptions` + `decision.userFacing.training` |
| [src/uiOs/training/EquipmentAwareLoadCard.tsx](src/uiOs/training/EquipmentAwareLoadCard.tsx) | equipment formatter | `decision.exercisePrescriptions[i]` (already equipment-aware via signal) |
| [src/uiOs/training/FocusModeActionBar.tsx](src/uiOs/training/FocusModeActionBar.tsx) | focus state | `decision.nextSetPolicy` (real-time policy gate) |
| [src/uiOs/progress/ProgressInsightHero.tsx](src/uiOs/progress/ProgressInsightHero.tsx) | progressClaritySummary | `decision.userFacing.progress` (single headline, NO triplet) |
| [src/uiOs/progress/ReadinessPressureCard.tsx](src/uiOs/progress/ReadinessPressureCard.tsx) | progressClarity | `decision.userFacing.progress.micro.readinessLabel` + `recoveryPressureLabel` (still two badges; no narrative) |
| [src/uiOs/progress/WeeklyProgressionRecommendationCard.tsx](src/uiOs/progress/WeeklyProgressionRecommendationCard.tsx) | weeklyProgression | `decision.userFacing.plan.weeklyDirection` + `decision.weeklyAdjustment` |
| [src/uiOs/progress/EffectiveSetsVolumeCard.tsx](src/uiOs/progress/EffectiveSetsVolumeCard.tsx) | effectiveSet summary | Effective-set counts from signal + `decision.userFacing.progress.micro.effectiveSetsLabel` |
| [src/uiOs/progress/StrengthTrendCards.tsx](src/uiOs/progress/StrengthTrendCards.tsx) | strength trend | Trend numerics unchanged; copy from `decision.userFacing.progress.micro.strengthTrendLabel` |
| [src/uiOs/records/PostWorkoutNextTimeRecommendationCard.tsx](src/uiOs/records/PostWorkoutNextTimeRecommendationCard.tsx) | postWorkout engine | `decision.userFacing.record` + per-exercise prescription numerics from signal |
| [src/ui/RecommendationExplanationPanel.tsx](src/ui/RecommendationExplanationPanel.tsx) | recommendationExplanationPresenter | `decision.userFacing.explanation` + dev-only `hiddenDebugSignals` toggle |
| Features ([TodayView](src/features/TodayView.tsx), [PlanView](src/features/PlanView.tsx), [TrainingView](src/features/TrainingView.tsx), [TrainingFocusView](src/features/TrainingFocusView.tsx), [ProgressView](src/features/ProgressView.tsx), [RecordView](src/features/RecordView.tsx)) | Multiple engine calls | One `useTrainingDecision()` hook (memoized) returning `TrainingDecision`. Threads to presenters/components. |

## 9. Arbitration rules (encoded in `buildTrainingDecision`)

Rules run in fixed precedence order. Each fired rule appends an entry to `hiddenDebugSignals.arbitrationTrace`.

| ID | Rule | Effect |
|---|---|---|
| AR-1 | **Severe override** | `acutePainReported \|\| injuryFlag \|\| illnessFlag` → `sessionIntent='severe-rest'`, `volumeMode='severe-cut'`, `riskLevel='severe'`. All other rules skipped. |
| AR-2 | **Reentry overrides deload trim (no double penalty)** | If `effectivePhase.activePhase ∈ {reentry, restart}`: `sessionIntent='reentry-productive'`, `volumeMode='reentry-floor'`. Daily-adjustment + adaptive-deload volume multipliers are **clamped to ≥ reentryFloor**, not multiplied together. Single multiplier supplied to `exercisePrescriptionEngine`. |
| AR-3 | **Productive-floor enforcement (when AR-2 fires)** | Per `ExerciseRole`: main-compound `targetSets ≥ 2` (typically 2–3); secondary-compound `≥ 2`; accessory `≥ 1`; isolation `1–2`. Whole-session all-1-set is **forbidden** — engine throws and tests catch. |
| AR-4 | **Weekly direction can further reduce volume ONLY on severe signal** | `WeeklyProgressionSignal.direction === 'decrease'` is applied only if `acutePainReported \|\| injuryFlag \|\| illnessFlag \|\| explicitDeloadAssigned`. Otherwise `weeklyAdjustment.blockedBy='severe-signal-required'`, `direction='hold'`. |
| AR-5 | **Strength-up + fatigue-high coherence** | `progressClaritySignal.e1rmTrend === 'up'` AND `readinessSignal.recoveryPressure === 'high'` → `sessionIntent='controlled-reload'`, `progressionMode='reload'`, `volumeMode='hold'`, `intensityMode='cap'`. Single user-facing line; the triplet (`力量有进步 / 恢复压力偏高 / 下次建议保持重量`) is structurally impossible. |
| AR-6 | **Risk-warning cap (one per surface)** | At most ONE `riskBadge` per `surfaceId`. Engine ranks `severe > high > moderate > low > none`. Same risk text MUST NOT appear in another surface's `oneLineAdvice`. |
| AR-7 | **Headline length cap** | `headline.length ≤ 60`, `oneLineAdvice.length ≤ 80`. Long paragraphs impossible. |
| AR-8 | **Permanent-warning anti-pattern downgrade** | If `riskLevel === 'high'` was emitted for ≥ 7 of the last 10 **analytics sessions** (i.e. `session.completed !== false && session.dataFlag !== 'test' && session.dataFlag !== 'excluded'` — same predicate used by `effectiveTrainingPhaseEngine.getDaysSinceLastTraining`), downgrade to `moderate` unless `acutePainReported \|\| injuryFlag \|\| illnessFlag` fires this turn. Trace logs `anti-permanent-warning-downgrade`. **Counter storage**: this is a pure-derived check — TrainingDecision walks `input.history` at call time, examines each analytics session's prior decision via the `recommendationSnapshots` field already present on `TrainingSession` (existing optional field; the engine only reads, never writes). No new persistent state. No AppData schema change. If `recommendationSnapshots` is absent or sparse (typical for older sessions), the rule simply does not fire (safe default → no downgrade). |
| AR-9 | **One coherent direction per screen** | For each `surfaceId` exactly one `headline` and at most one `oneLineAdvice`. Engine asserts; tests enforce. |

## 10. Product rules (explicit)

- Normal gym session: every main / secondary compound has ≥ 2 working sets. Whole-session all-1-set is forbidden unless `sessionIntent === 'severe-rest'` (acute pain / injury / illness / explicit user-selected minimal mode).
- Reentry (14+ day gap): conservative but productive. Main compound 2–3 sets; secondary 2; isolation 1–2.
- Reentry must not be re-penalized by weekly volume direction unless a severe signal exists.
- Strength improving + fatigue high → controlled reload week, single coherent decision.
- No permanent risk-warning machine: AR-8 caps recurring high warnings.
- One screen, one direction. No "原计划 vs 当前建议" wall. No long coaching paragraph. No standalone independent advice blocks.
- Debug signals live in `hiddenDebugSignals` and `RecommendationExplanationPanel` (dev mode), never in normal Today / Plan / Training / Focus / Progress / Record UI.

## 11. Test plan

All new tests live under `tests/` with prefix `trainingDecisionSourceOfTruth*`.

### 11.1 Engine contract tests

| Test file | Purpose |
|---|---|
| `tests/trainingDecisionSourceOfTruthEngineShape.test.ts` | `buildTrainingDecision()` returns object matching `TrainingDecision` interface with all owned fields present. |
| `tests/trainingDecisionSourceOfTruthDeterminism.test.ts` | Identical input twice → deep-equal output. (RGR-11) |
| `tests/trainingDecisionSourceOfTruthArbitrationTrace.test.ts` | Each fired AR-rule appears in `hiddenDebugSignals.arbitrationTrace` in fixed order. |

### 11.2 Arbitration / scenario tests

| Test file | Scenario | Assertion |
|---|---|---|
| `tests/trainingDecisionSourceOfTruthReentryProductiveDose.test.ts` | 14-day gap + prior deload + no severe flag | Every main-compound `targetSets ≥ 2`; no exercise has `sets === 1` AND `role ∈ {main-compound, secondary-compound}`; `sessionIntent === 'reentry-productive'`. |
| `tests/trainingDecisionSourceOfTruthNoDoublePenalty.test.ts` | reentry + WeeklyProgressionSignal.direction='decrease' + no severe flag | `weeklyAdjustment.direction === 'hold'`; `blockedBy === 'severe-signal-required'`; net per-exercise volume multiplier ≥ reentryFloor (≥ 0.65). |
| `tests/trainingDecisionSourceOfTruthArbitrationStrengthUpFatigueHigh.test.ts` | e1rmTrend='up' + recoveryPressure='high' + no acute pain | `sessionIntent === 'controlled-reload'`; concatenated user-facing text across all surfaces does NOT contain the legacy triplet substring. |
| `tests/trainingDecisionSourceOfTruthRiskWarningCap.test.ts` | Synthetic high-risk on every signal | At most ONE `riskBadge` per surface; same risk label not repeated across surfaces. |
| `tests/trainingDecisionSourceOfTruthPermanentWarningDowngrade.test.ts` | 7+ of last 10 sessions emitted high risk | New decision emits `riskLevel === 'moderate'`; trace contains `anti-permanent-warning-downgrade`. |
| `tests/trainingDecisionSourceOfTruthNormalActiveLifter.test.ts` | 4 d/wk recent, gap=2 days, no pain, normal sleep | `sessionIntent === 'normal-session'`; no risk badge; no `保守` text. |
| `tests/trainingDecisionSourceOfTruthShortGapPreserved.test.ts` | gap ≤ 3 days, any phase | `activePhase === persistedPhase`; AR-2 not fired. |
| `tests/trainingDecisionSourceOfTruthNoHistorySafeDefault.test.ts` | empty history, no mesocyclePlan, no AppData.trainingMode | No crash. Safe defaults: `activePhase === 'base'` (per `effectiveTrainingPhaseEngine` no-history rule), `trainingMode === 'hybrid'` (per IronPath app default), `sessionIntent === 'normal-session'`, `riskLevel === 'none'`, `weeklyAdjustment.direction === 'hold'` with `blockedBy='severe-signal-required'`, `userFacing[surface].headline` defined for every surface, no `riskBadge` emitted, no Chinese 保守/风险/控制 strings in any headline. |
| `tests/trainingDecisionSourceOfTruthSevereOverride.test.ts` | `acutePainReported=true` | `sessionIntent='severe-rest'`, `volumeMode='severe-cut'`, `riskLevel='severe'`; only AR-1 in trace. |
| `tests/trainingDecisionSourceOfTruthDeloadWeekExplicit.test.ts` | mesocyclePlan deload assigned + gap=2 days | `sessionIntent='deload-week'`; volume trim applied via single channel; one banner. |

### 11.3 Static boundary tests

| Test file | Purpose |
|---|---|
| `tests/trainingDecisionSourceOfTruthSignalOnlyBoundary.test.ts` | Static source scan: `src/features/**/*.tsx` and `src/uiOs/**/*.tsx` and `src/presenters/**/*.ts` must NOT import any of the legacy signal engines below. **Allowed importer**: exactly one file — `src/engines/trainingDecisionEngine.ts` (and its sibling `assembleTrainingDecisionSignals.ts`). Allowed re-exporters: none. Legacy engines covered: (1) `weeklyProgressionRecommendationEngine`, (2) `postWorkoutNextTimeRecommendationEngine`, (3) `dailyTrainingAdjustmentEngine`, (4) `todayTrainingReadinessDecisionEngine`, (5) `progressClaritySummary`, (6) `effectiveTrainingPhaseEngine`, (7) `trainingLapseEngine`, (8) `recoveryAwareScheduler`, (9) `volumeAdaptationEngine`, (10) `adherenceAdjustmentEngine`, (11) `adaptiveFeedbackEngine` (`buildAdaptiveDeloadDecision`), (12) `plateauDetectionEngine`, (13) `painPatternEngine`, (14) `loadFeedbackEngine` (read-only allowed in presenters for explanation panel telemetry; flagged separately), (15) `sessionQualityEngine`, (16) `effectiveSetEngine`, (17) `recommendationConfidenceEngine`, (18) `setWeightFineTuneEngine`, (19) `adaptiveRecommendationEngine`, (20) `supportPlanEngine`, (21) `readinessEngine.mapReadinessToSignal`. The test produces an inventory map `{engineName: [allowedImporter]}` and asserts equality. |
| `tests/trainingDecisionSourceOfTruthForbiddenCopyScan.test.ts` | Static source scan: `src/uiOs/**` must NOT contain literals `原计划 vs 当前建议`, `原计划阶段 vs 当前建议`, `系统判断`, `AI 教练`, or the three-string co-occurrence (`力量有进步` AND `恢复压力偏高` AND `下次建议保持重量`) in the same component. |
| `tests/trainingDecisionSourceOfTruthPureFormatterPresenter.test.ts` | Presenter outputs may contain user-facing strings only if those strings appear verbatim in `decision.userFacing.*`. (Allowlist: i18n format helpers for numbers/dates/template names.) |
| `tests/trainingDecisionSourceOfTruthNoCloudWrite.test.ts` | `trainingDecisionEngine.ts` static scan: no import of `cloudSync/`, `cloudProduction/`, `productionApi/`, `supabase`, `storage/` writers, `localStorage`, `IndexedDB`. |
| `tests/trainingDecisionSourceOfTruthDataSchemaStability.test.ts` | Snapshot of AppData schema + localStorage key list unchanged before/after rewrite. |
| `tests/trainingDecisionSourceOfTruthLegacyEngineImportInventory.test.ts` | Declarative inventory: each legacy final-decision engine must be imported by exactly one file (`trainingDecisionEngine.ts`) after rewrite. |

### 11.4 Regression matrix (RGR-1 … RGR-13)

| ID | Scenario | Lock against |
|---|---|---|
| RGR-1 | 14-day gap + prior deload | productive floor; no 1-set whole-session |
| RGR-2 | reentry + weekly decrease signal, no severe | no double penalty |
| RGR-3 | strength up + fatigue high | coherent single direction; no triplet |
| RGR-4 | normal 4-day/week active, gap=2 | no `保守` text unless justified |
| RGR-5 | short gap (≤ 3 days) | normal behavior preserved |
| RGR-6 | no history, no mesocyclePlan | safe defaults; no crash |
| RGR-7 | post-rewrite | old final-decision functions removed/downgraded; static scan green |
| RGR-8 | post-rewrite | forbidden visible strings absent in normal UI |
| RGR-9 | post-rewrite | completed history untouched |
| RGR-10 | post-rewrite | AppData schema untouched |
| RGR-11 | post-rewrite | localStorage / cloud sync untouched; sync-on receipt unchanged |
| RGR-12 | post-rewrite | kg / lb display unaffected |
| RGR-13 | post-rewrite | `package.json` / `package-lock.json` / `yarn.lock` unchanged; `pnpm-lock.yaml` absent |

All 13 packed into `tests/trainingDecisionSourceOfTruthRegressionRGR1to13.test.ts`.

### 11.5 Preserved-behaviour locks (must continue to pass)

- `trainingPhaseEffectiveMapping.test.ts` (PR #381 reentry state machine)
- `trainingPhaseGapWiringRecommendation.test.ts` (PR #381 wiring)
- `fineTuneTrustOverride.test.ts` (PR #377)
- `recommendationConsistency.test.ts`
- `todayTrainingReadinessDecisionBoundary.test.ts`
- `progressClaritySummary.test.ts` (assertions updated to enum-only; user-facing-string assertions migrated to new test file)
- `weeklyProgressionRecommendationDisplayIntegration.test.ts` (assertions updated)
- `appDataRoundTripRegression.test.ts`, `explicitOptInSyncPreflightBoundary.test.ts`, `offlineRollbackBoundary.test.ts`

## 12. Data safety plan

- TrainingDecision is computed in memory only; nothing is persisted by this rewrite.
- AppData schema: unchanged. No new fields. No migration. Schema-stability snapshot test guards this.
- localStorage: no new keys. Existing keys untouched. Audit test verifies.
- IndexedDB: not used by recommendation engines today; remains so.
- Cloud sync: `trainingDecisionEngine.ts` may not import `src/cloudSync/`, `src/cloudProduction/`, `src/sync/`, `src/productionApi/`, `supabase`, `storage/` writers, or any global mutation surface. Static scan test enforces.
- Completed history: read-only. Existing `appDataRoundTripRegression.test.ts` preserved.
- Sync-on receipt + per-account safety (PR #378, PR #374, PR #375, PR #376): orthogonal to this rewrite; preserved by their existing boundary tests.
- Production dist safety: `scripts/scan-production-dist-safety.mjs` extended to add the following entries to its forbidden-string list (added to the existing array after current entries like `系统判断`, `AI 教练`):
  ```js
  '原计划 vs 当前建议',
  '原计划阶段 vs 当前建议',
  '力量有进步，但恢复压力偏高',  // exact triplet heroTitle from old progressClaritySummary line 144
  ```
  The triplet co-occurrence (`力量有进步` AND `恢复压力偏高` AND `下次建议保持重量` in same built component string) is enforced by the test `trainingDecisionSourceOfTruthForbiddenCopyScan.test.ts` rather than the production dist scan (since the scan checks substrings, not co-occurrence across files). Existing forbidden tokens (`系统判断`, `AI 教练`, service-role / API-key patterns) unchanged. Existing fixtures under `tests/fixtures/**` and docs under `docs/**` are excluded from the scan by current scan logic — verified before adding.
- No package added. `package-lock.json` unchanged. `pnpm-lock.yaml` must remain absent.
- Tokens / env values / secrets: TrainingDecision never logs raw AppData or any cloud receipt; `hiddenDebugSignals` carries only structured engine outputs, no PII or auth material.

## 13. Implementation sequencing

Phase A (this document) → Phase B (failing tests `trainingDecisionSourceOfTruth*`) → Phase C (TrainingDecision engine + types) → Phase D (signal-narrowing of legacy engines) → Phase E (presenter refactor) → Phase F (UI rewiring) → Phase G (static guards + scan extensions) → Phase H (validation pipeline) → Phase I (browser smoke 14+ day gap) → Phase J (iPhone/PWA smoke if mobile UI changed) → Phase K (consolidation doc + PR + merge + deploy + handoff).

## 14. Validation chain

```bash
npm run api:dev:build
npm run typecheck
npm test
npm run build
node scripts/scan-production-dist-safety.mjs
git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml
test ! -e pnpm-lock.yaml
git diff --check
```

After merge:
```bash
git switch main
git pull --ff-only
npx vercel --prod
```

## 15. Risks and open questions

| # | Risk | Mitigation |
|---|---|---|
| R1 | Removing user-facing strings from legacy engines may break unrelated callers (e.g. `coachActionEngine`). | Phase D includes a `git grep` sweep + the legacy-engine-import inventory test. Callers either switch to `TrainingDecision.userFacing` or take structured signals and locally i18n-format. |
| R2 | `enginePipeline` ordering — TrainingDecision must run after all signals. | Pipeline test asserts ordering. |
| R3 | `useTrainingDecision()` memoization staleness on template edits. | Memo key: `(templateId, todayStatusHash, lastSessionIso, mesocycleHash, screeningHash)`. |
| R4 | Bundle-size regression from new types/engine. | `npm run build` size check in validation chain. |
| R5 | PWA cache may serve old bundle. | Browser/iPhone smoke include hard-reload + PWA reinstall verification. |
| R6 | Some test fixtures depend on the legacy triplet exact string. | Update the affected tests to assert the new single-line; preserve the triplet as a forbidden-substring assertion only. |

Open questions to confirm during Phase B → C:

| Q | Question | Default I will use |
|---|---|---|
| Q1 | `reentryFloor` value | 0.65 for main/secondary compound; 0.55 for isolation; min absolute floor `≥ 2 sets` for compounds, `≥ 1` for isolation. |
| Q2 | AR-8 lookback window | 10 analytics sessions. |
| Q3 | `severe-cut` minimum sets | 0 (severe-rest allowed to recommend skip entire exercise; banner explains). |
| Q4 | Headline phrasing for `controlled-reload` | "力量在进步，本周收一档恢复，下次再冲。" — placeholder; UI copy is the engine's responsibility, free to refine in Phase F. |
| Q5 | Dev toggle for `hiddenDebugSignals` | Surface in `RecommendationExplanationPanel` under a dev-mode flag; not visible in production builds. |

## 16. Done definition

This plan is "done" when all of the following land on main:

1. This plan committed.
2. Phase B tests committed and failing (RED).
3. Phase C-G code lands; Phase B tests now passing (GREEN).
4. Phase H validation chain green.
5. Phase I browser smoke green (screenshots attached to PR).
6. Phase J iPhone/PWA smoke green if any mobile surface touched (screenshots attached).
7. Companion doc `docs/TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_CONSOLIDATION_V1.md` committed with final results.
8. PR `Training Recommendation Source-of-Truth Full Rewrite V1` opened, reviewed, merged.
9. Production deploy `npx vercel --prod` succeeded and post-deploy verification passed.
10. `/handoff` produces final handoff report.
