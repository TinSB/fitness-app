// TrainingDecision — sole source of truth for final user-facing training advice.
// See docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md.
//
// Phase 2 of the hard rewrite: types previously living in deleted legacy
// modules (progressClaritySummary, weeklyProgressionRecommendationEngine,
// postWorkoutNextTimeRecommendationEngine, todayDecisionSurface,
// recommendationTraceEngine, recommendationExplanationPresenter) now live
// here so UI cards can keep their visual shape while consuming a single
// arbitrated SoT.

import type {
  AdaptiveCalibrationState,
  DeloadDecision,
  ExercisePrescription,
  MesocyclePlan,
  ReadinessResult,
  ScreeningProfile,
  TodayStatus,
  TrainingMode,
  TrainingSession,
  TrainingTemplate,
} from '../models/training-model';
import type { HealthSummary } from './healthSummaryEngine';
import type { EffectiveTrainingPhase, EffectivePhaseKind } from './effectiveTrainingPhaseEngine';
import type { TrainingLapseSignal } from './trainingLapseEngine';

export type ActivePhase = EffectivePhaseKind;

export type SessionIntent =
  | 'normal-session'
  | 'reentry-productive'
  | 'controlled-reload'
  | 'deload-week'
  | 'severe-rest';

export type RiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'severe';
export type ProgressionMode = 'progress' | 'hold' | 'pull-back' | 'reload';
export type VolumeMode = 'expand' | 'hold' | 'trim' | 'reentry-floor' | 'severe-cut';
export type IntensityMode = 'expand' | 'hold' | 'cap' | 'cut';
export type ExerciseRole = 'main-compound' | 'secondary-compound' | 'accessory' | 'isolation';
export type SurfaceId = 'today' | 'plan' | 'training' | 'focus' | 'progress' | 'record' | 'explanation';

export interface RiskBadge {
  level: RiskLevel;
  label: string;
  rationaleCode: string;
}

// ---------------------------------------------------------------------------
// Progress surface — supersedes progressClaritySummary.ProgressClaritySummaryResult
// ---------------------------------------------------------------------------

export type ProgressInsightState =
  | 'improving'
  | 'stable'
  | 'fatigue_risk'
  | 'recovery_recommended'
  | 'data_insufficient'
  | 'mixed';

export type ProgressTrendDirection = 'improving' | 'stable' | 'declining' | 'mixed' | 'unknown';
export type ProgressRecoveryPressure = 'normal' | 'high' | 'recovery' | 'unknown';

export interface ProgressStrengthTrendItem {
  id: string;
  label: string;
  currentLabel: string;
  bestLabel?: string;
  trend: ProgressTrendDirection;
  explanation: string;
}

export interface ProgressUserFacing {
  surfaceId: 'progress';
  headline: string;
  oneLineAdvice?: string;
  riskBadge?: RiskBadge;
  primaryActionLabel?: string;
  micro?: Record<string, string>;
  // Structured payload replacing ProgressClaritySummaryResult
  insightState: ProgressInsightState;
  heroTitle: string;
  heroExplanation: string;
  primaryRecommendation: string;
  readinessLabel: string;
  recoveryPressureLabel: string;
  caution?: string;
  effectiveSetExplanation: string;
  volumeExplanation: string;
  dataCoverageHint: string;
  strengthTrendItems: ProgressStrengthTrendItem[];
}

// ---------------------------------------------------------------------------
// Plan surface — supersedes weeklyProgressionRecommendationEngine
// ---------------------------------------------------------------------------

export type WeeklyProgressionRecommendationKind =
  | 'maintain'
  | 'progress'
  | 'conservative_progress'
  | 'deload'
  | 'review_volume'
  | 'review_exercise'
  | 'technique_focus'
  | 'pain_review'
  | 'insufficient_data';

export type WeeklyProgressionActionType =
  | 'keep_plan'
  | 'increase_volume'
  | 'reduce_volume'
  | 'review_volume'
  | 'review_exercise'
  | 'review_technique'
  | 'review_pain'
  | 'generate_plan_candidate'
  | 'keep_observing'
  | 'insufficient_data';

export type WeeklyProgressionConfidence = 'low' | 'medium' | 'high';
export type WeeklyProgressionRiskLevel = 'low' | 'medium' | 'high';

export interface WeeklyProgressionItemView {
  id: string;
  targetType: 'muscle' | 'exercise' | 'session' | 'week';
  targetId?: string;
  targetLabel: string;
  recommendationKind: WeeklyProgressionRecommendationKind;
  actionType: WeeklyProgressionActionType;
  actionLabel: string;
  title: string;
  summary: string;
  userMessage: string;
  confidence: WeeklyProgressionConfidence;
  riskLevel: WeeklyProgressionRiskLevel;
  reasonCodes: string[];
  riskFlags: string[];
  blockedReasons: string[];
  suggestedActions: string[];
  setsDelta?: number;
  previewSummary: string;
  reason: string;
  risk: string;
  nextStep: string;
  confidenceLabel: string;
  riskLevelLabel: string;
}

export interface PlanUserFacing {
  surfaceId: 'plan';
  headline: string;
  oneLineAdvice?: string;
  riskBadge?: RiskBadge;
  primaryActionLabel?: string;
  micro?: Record<string, string>;
  // Structured payload replacing WeeklyProgressionRecommendation
  title: string;
  summary: string;
  weeklyDirection: string;
  weeklyItems: WeeklyProgressionItemView[];
}

// ---------------------------------------------------------------------------
// Record surface — supersedes postWorkoutNextTimeRecommendationEngine
// ---------------------------------------------------------------------------

export type PostWorkoutRecommendationKind =
  | 'no_change'
  | 'increase_load'
  | 'decrease_load'
  | 'keep_load'
  | 'reduce_reps'
  | 'increase_reps'
  | 'add_set'
  | 'reduce_set'
  | 'deload'
  | 'repeat_next_time'
  | 'technique_review'
  | 'pain_review'
  | 'insufficient_data';

export interface PostWorkoutItemView {
  id: string;
  exerciseId: string;
  exerciseName: string;
  recommendationKind: PostWorkoutRecommendationKind;
  actionableLoadKg?: number;
  plannedReps?: number;
  setDelta?: number;
  confidence: WeeklyProgressionConfidence;
  reasonCodes: string[];
  riskFlags: string[];
  blockedReasons: string[];
  userMessage: string;
  summary?: string;
}

export interface RecordUserFacing {
  surfaceId: 'record';
  headline: string;
  oneLineAdvice?: string;
  riskBadge?: RiskBadge;
  primaryActionLabel?: string;
  micro?: Record<string, string>;
  // Structured payload replacing PostWorkoutNextTimeRecommendation
  nextTimeHint: string;
  perExercise: PostWorkoutItemView[];
}

// ---------------------------------------------------------------------------
// Today surface — supersedes todayDecisionSurface + buildTodayReadinessHeroDecision
// ---------------------------------------------------------------------------

export type TodayDecisionState =
  | 'train_recommended'
  | 'train_conservative'
  | 'recovery_recommended'
  | 'continue_unfinished'
  | 'blocked_by_severe_risk'
  | 'source_unclear'
  | 'no_plan_available';

export interface TodaySevereNotice {
  title: string;
  message: string;
}

export interface TodayUserFacing {
  surfaceId: 'today';
  headline: string;
  oneLineAdvice?: string;
  riskBadge?: RiskBadge;
  primaryActionLabel?: string;
  micro?: Record<string, string>;
  // Structured payload replacing TodayDecisionSurfaceResult
  decisionState: TodayDecisionState;
  heroLabel: string;
  heroTitle: string;
  heroExplanation: string;
  decisionStateLabel: string;
  readinessLabel: string;
  focusLabel: string;
  safetyLabel: string;
  secondaryActionLabel?: string;
  severeNotice?: TodaySevereNotice;
  showFocusOverride: boolean;
  showDataHealthSummary: boolean;
}

// ---------------------------------------------------------------------------
// Explanation surface — supersedes recommendationTraceEngine + recommendationExplanationPresenter
// ---------------------------------------------------------------------------

export type RecommendationFactorTone = 'positive' | 'negative' | 'neutral' | 'warning';
export type RecommendationFactorSource =
  | 'primaryGoal'
  | 'trainingMode'
  | 'trainingLevel'
  | 'readiness'
  | 'history'
  | 'muscleVolume'
  | 'loadFeedback'
  | 'techniqueQuality'
  | 'soreness'
  | 'recoveryConflict'
  | 'painPattern'
  | 'screeningRestriction'
  | 'healthData'
  | 'template'
  | 'defaultPolicy';

export type RecommendationFactorEffect =
  | 'increase'
  | 'decrease'
  | 'maintain'
  | 'block'
  | 'informational';

export interface RecommendationFactorView {
  id: string;
  label: string;
  effectLabel: string;
  effectTone: RecommendationFactorTone;
  reason: string;
  priority: number;
  source: RecommendationFactorSource;
  effect: RecommendationFactorEffect;
}

export interface RecommendationWarningView {
  id: string;
  title: string;
  message: string;
}

export interface ExplanationUserFacing {
  surfaceId: 'explanation';
  headline: string;
  oneLineAdvice?: string;
  riskBadge?: RiskBadge;
  primaryActionLabel?: string;
  micro?: Record<string, string>;
  // Structured payload replacing RecommendationExplanationViewModel
  title: string;
  summary: string;
  primaryFactors: RecommendationFactorView[];
  secondaryFactors: RecommendationFactorView[];
  warnings: RecommendationWarningView[];
}

// ---------------------------------------------------------------------------
// Training + focus surfaces — superseded buildSessionRecommendationTrace
// ---------------------------------------------------------------------------

export interface TrainingUserFacing {
  surfaceId: 'training';
  headline: string;
  oneLineAdvice?: string;
  riskBadge?: RiskBadge;
  primaryActionLabel?: string;
  micro?: Record<string, string>;
  explanationTitle: string;
  explanationSummary: string;
  explanationFactors: RecommendationFactorView[];
}

export interface FocusUserFacing {
  surfaceId: 'focus';
  headline: string;
  oneLineAdvice?: string;
  riskBadge?: RiskBadge;
  primaryActionLabel?: string;
  micro?: Record<string, string>;
  explanationTitle: string;
  explanationSummary: string;
  explanationFactors: RecommendationFactorView[];
}

// ---------------------------------------------------------------------------
// Generic UserFacingPerSurface (kept for backward compatibility)
// ---------------------------------------------------------------------------

export interface UserFacingPerSurface {
  surfaceId: SurfaceId;
  headline: string;
  oneLineAdvice?: string;
  riskBadge?: RiskBadge;
  primaryActionLabel?: string;
  micro?: Record<string, string>;
}

export interface UserFacingMap {
  today?: TodayUserFacing;
  plan?: PlanUserFacing;
  training?: TrainingUserFacing;
  focus?: FocusUserFacing;
  progress?: ProgressUserFacing;
  record?: RecordUserFacing;
  explanation?: ExplanationUserFacing;
}

export interface WorkingSetTarget {
  exerciseId: string;
  role: ExerciseRole;
  targetSets: number;
  targetReps: [number, number];
  intensityCapPctE1rm?: number;
  rationaleCode: string;
}

export interface MuscleGroupVolumeTarget {
  muscleGroup: string;
  weeklyEffectiveSetsTarget: number;
  weeklyEffectiveSetsFloor: number;
  weeklyEffectiveSetsCeiling: number;
}

export interface WeeklyAdjustmentDecision {
  direction: 'increase' | 'hold' | 'decrease';
  magnitudePct: number;
  appliesFromIsoDate: string;
  blockedBy?: 'reentry-floor' | 'severe-signal-required' | null;
}

export interface NextSetPolicy {
  enabled: boolean;
  loadDeltaKg?: number;
  rirTarget?: number;
  stopCriteria?: 'rir-0' | 'rep-target' | 'tonnage-cap';
}

/**
 * Hidden, dev/test-only signal bag. Never read by production UI.
 */
export interface HiddenDebugSignals {
  effectivePhase: EffectiveTrainingPhase;
  lapse: TrainingLapseSignal | null;
  readiness: ReadinessResult;
  deloadDecision: DeloadDecision;
  /** Ordered list of arbitration rules that fired this turn (AR-1..AR-9). */
  arbitrationTrace: string[];
  /** Final per-exercise volume multiplier supplied to prescription assembler. */
  finalVolumeMultiplier: number;
  /** Floor map by exercise role (productive dose). */
  exerciseRoleFloors: Record<ExerciseRole, number>;
  /** Reasons WeeklyProgression direction was blocked (if any). */
  weeklyBlockReasons: string[];
  /** Whether progressClarity narrative was suppressed because TrainingDecision chose another direction. */
  progressClarityTripletSuppressed: boolean;
}

export interface TrainingDecision {
  activePhase: ActivePhase;
  trainingMode: TrainingMode | string;
  sessionIntent: SessionIntent;
  riskLevel: RiskLevel;
  progressionMode: ProgressionMode;
  volumeMode: VolumeMode;
  intensityMode: IntensityMode;
  exercisePrescriptions: ExercisePrescription[];
  workingSetTargets: WorkingSetTarget[];
  muscleGroupVolumeTargets: MuscleGroupVolumeTarget[];
  weeklyAdjustment: WeeklyAdjustmentDecision;
  nextSetPolicy?: NextSetPolicy;
  userFacing: UserFacingMap;
  hiddenDebugSignals: HiddenDebugSignals;
  computedAtIso: string;
  decisionVersion: 'v2';
}

export interface TrainingDecisionInput {
  template: TrainingTemplate;
  todayStatus: TodayStatus;
  history?: TrainingSession[];
  mesocyclePlan?: MesocyclePlan | null;
  screening?: ScreeningProfile;
  healthSummary?: HealthSummary;
  useHealthDataForReadiness?: boolean;
  adaptiveCalibration?: AdaptiveCalibrationState;
  trainingMode?: TrainingMode | string;
  nowIso?: string;
  // Severe signals — only these allow volume cut below reentry floor:
  acutePainReported?: boolean;
  injuryFlag?: boolean;
  illnessFlag?: boolean;
  explicitDeloadAssigned?: boolean;
}
