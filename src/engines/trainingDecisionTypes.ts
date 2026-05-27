// TrainingDecision — sole source of truth for final user-facing training advice.
// See docs/TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_REWRITE_PLAN_V1.md.

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

export interface UserFacingPerSurface {
  surfaceId: SurfaceId;
  headline: string;
  oneLineAdvice?: string;
  riskBadge?: RiskBadge;
  primaryActionLabel?: string;
  micro?: Record<string, string>;
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
  userFacing: Partial<Record<SurfaceId, UserFacingPerSurface>>;
  hiddenDebugSignals: HiddenDebugSignals;
  computedAtIso: string;
  decisionVersion: 'v1';
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
