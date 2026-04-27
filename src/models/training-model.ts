export const PRIMARY_GOALS = ['hypertrophy', 'strength', 'fat_loss'] as const;
export const TRAINING_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const TRAINING_MODES = ['hybrid', 'strength', 'hypertrophy'] as const;
export const CORRECTION_STRATEGIES = ['light', 'moderate', 'aggressive'] as const;
export const FUNCTIONAL_STRATEGIES = ['minimal', 'standard', 'enhanced'] as const;
export const SPLIT_TYPES = ['upper_lower', 'push_pull_legs', 'full_body', 'body_part'] as const;
export const POSTURE_SEVERITIES = ['none', 'mild', 'moderate', 'severe'] as const;
export const MOVEMENT_SEVERITIES = ['good', 'limited', 'poor'] as const;
export const CORRECTION_DOSE_LEVELS = ['taper', 'baseline', 'boost'] as const;
export const SEX_OPTIONS = ['male', 'female', 'other'] as const;
export const SECONDARY_PREFERENCES = ['posture', 'functional', 'mobility'] as const;
export const EQUIPMENT_OPTIONS = ['barbell', 'dumbbell', 'machine', 'cables', 'bands', 'bodyweight'] as const;
export const MUSCLE_GROUPS = ['胸', '背', '腿', '肩', '手臂'] as const;
export const SLEEP_STATES = ['差', '一般', '好'] as const;
export const ENERGY_STATES = ['低', '中', '高'] as const;
export const AVAILABLE_TIME_OPTIONS = ['30', '60', '90'] as const;
export const POSTURE_FLAG_KEYS = ['forwardHead', 'roundedShoulders', 'thoracicKyphosis', 'anteriorPelvicTilt', 'dynamicKneeValgus'] as const;
export const MOVEMENT_FLAG_KEYS = [
  'overheadMobility',
  'squatPattern',
  'hingePattern',
  'singleLegStability',
  'scapularControl',
  'trunkStability',
  'ankleMobility',
  'thoracicRotation',
  'hipFlexorLength',
  'lumbarControl',
  'ribCagePosition',
  'verticalPressTolerance',
] as const;
export const CORRECTION_ISSUES = [
  'upper_crossed',
  'scapular_control',
  'thoracic_extension',
  'hip_stability',
  'anterior_pelvic_tilt',
  'core_control',
  'ankle_mobility',
  'squat_lean_forward',
  'hip_flexor_tightness',
  'lumbar_compensation',
  'thoracic_rotation',
  'overhead_press_restriction',
  'breathing_ribcage',
] as const;
export const FUNCTIONAL_ABILITIES = [
  'single_leg_stability',
  'anti_rotation',
  'carry_capacity',
  'gait_bracing',
  'overhead_stability',
  'core_stability',
  'locomotion',
  'balance',
] as const;
export const CORRECTION_STAGES = ['warmup', 'between_sets', 'finisher'] as const;
export const FUNCTIONAL_INSERTION_RULES = ['after_main', 'replace_accessory', 'finisher'] as const;
export const TRAINING_SET_TYPES = ['warmup', 'top', 'backoff', 'straight', 'corrective', 'functional'] as const;
export const SESSION_STATUSES = ['planned', 'in_progress', 'completed', 'skipped'] as const;

export const PRIMARY_GOAL_LABELS: Record<(typeof PRIMARY_GOALS)[number], string> = {
  hypertrophy: '肌肥大',
  strength: '力量',
  fat_loss: '减脂',
};
export const TRAINING_LEVEL_LABELS: Record<(typeof TRAINING_LEVELS)[number], string> = {
  beginner: '新手',
  intermediate: '中级',
  advanced: '高级',
};
export const CORRECTION_STRATEGY_LABELS: Record<(typeof CORRECTION_STRATEGIES)[number], string> = {
  light: '轻量',
  moderate: '标准',
  aggressive: '强化',
};
export const FUNCTIONAL_STRATEGY_LABELS: Record<(typeof FUNCTIONAL_STRATEGIES)[number], string> = {
  minimal: '最小补丁',
  standard: '标准补丁',
  enhanced: '强化补丁',
};
export const POSTURE_FLAG_LABELS: Record<(typeof POSTURE_FLAG_KEYS)[number], string> = {
  forwardHead: '头前引',
  roundedShoulders: '圆肩',
  thoracicKyphosis: '胸椎后凸',
  anteriorPelvicTilt: '骨盆前倾',
  dynamicKneeValgus: '动态膝内扣',
};
export const MOVEMENT_FLAG_LABELS: Record<(typeof MOVEMENT_FLAG_KEYS)[number], string> = {
  overheadMobility: '过顶活动度',
  squatPattern: '深蹲模式',
  hingePattern: '髋铰链模式',
  singleLegStability: '单腿稳定',
  scapularControl: '肩胛控制',
  trunkStability: '躯干稳定',
  ankleMobility: '踝关节活动度',
  thoracicRotation: '胸椎旋转',
  hipFlexorLength: '髋屈肌长度',
  lumbarControl: '腰椎控制',
  ribCagePosition: '肋骨位置',
  verticalPressTolerance: '垂直推耐受',
};

export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];
export type TrainingMode = (typeof TRAINING_MODES)[number];
export type CorrectionStrategy = (typeof CORRECTION_STRATEGIES)[number];
export type FunctionalStrategy = (typeof FUNCTIONAL_STRATEGIES)[number];
export type SplitType = (typeof SPLIT_TYPES)[number];
export type PostureSeverity = (typeof POSTURE_SEVERITIES)[number];
export type MovementSeverity = (typeof MOVEMENT_SEVERITIES)[number];
export type CorrectionDoseLevel = (typeof CORRECTION_DOSE_LEVELS)[number];
export type Sex = (typeof SEX_OPTIONS)[number];
export type SecondaryPreference = (typeof SECONDARY_PREFERENCES)[number];
export type EquipmentAccess = (typeof EQUIPMENT_OPTIONS)[number];
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type SleepState = (typeof SLEEP_STATES)[number];
export type EnergyState = (typeof ENERGY_STATES)[number];
export type AvailableTime = (typeof AVAILABLE_TIME_OPTIONS)[number];
export type PostureFlagKey = (typeof POSTURE_FLAG_KEYS)[number];
export type MovementFlagKey = (typeof MOVEMENT_FLAG_KEYS)[number];
export type CorrectionIssue = (typeof CORRECTION_ISSUES)[number];
export type FunctionalAbility = (typeof FUNCTIONAL_ABILITIES)[number];
export type CorrectionStage = (typeof CORRECTION_STAGES)[number];
export type FunctionalInsertionRule = (typeof FUNCTIONAL_INSERTION_RULES)[number];
export type TrainingSetType = (typeof TRAINING_SET_TYPES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type DeloadLevel = 'none' | 'watch' | 'yellow' | 'red';
export type DeloadStrategy = 'none' | 'reduce_volume' | 'reduce_accessories' | 'recovery_template';
export type SupportDoseStrategy = 'fixed' | 'adaptive';
export type SupportExerciseCategory = 'corrective' | 'functional' | 'mobility' | 'activation';
export type ExerciseKind = 'compound' | 'machine' | 'isolation';
export type ExerciseFatigueCost = 'low' | 'medium' | 'high';
export type ExerciseSkillDemand = 'low' | 'medium' | 'high';
export type SupportBlockType = 'correction' | 'functional';
export type SupportSkipReason = 'time' | 'pain' | 'equipment' | 'forgot' | 'too_tired' | 'not_needed' | 'other';
export type CyclePhase = 'base' | 'build' | 'overload' | 'deload';
export type IntensityBias = 'conservative' | 'normal' | 'aggressive';
export type ReadinessLevel = 'low' | 'medium' | 'high';
export type ReadinessAdjustment = 'recovery' | 'conservative' | 'normal' | 'push';
export type AdherenceComplexityLevel = 'normal' | 'reduced' | 'minimal';
export type PainSuggestedAction = 'watch' | 'substitute' | 'deload' | 'seek_professional';
export type TechniqueQuality = 'good' | 'acceptable' | 'poor';
export type EstimateConfidence = 'low' | 'medium' | 'high';
export type EvidenceConfidence = 'high' | 'moderate' | 'low';
export type EffectiveSetFlag = 'warmup' | 'poor_technique' | 'pain' | 'too_easy' | 'incomplete' | 'valid_effort' | 'unknown_rir';
export type PersonalRecordQuality = 'standard' | 'high_quality' | 'low_confidence';
export type LoadFeedbackValue = 'too_light' | 'good' | 'too_heavy';

export type PostureFlags = Record<PostureFlagKey, PostureSeverity>;
export type MovementFlags = Record<MovementFlagKey, MovementSeverity>;
export type WeeklyMuscleTargets = Record<string, number>;

export interface AdaptiveState {
  issueScores: Partial<Record<CorrectionIssue, number>> & Record<string, number>;
  painByExercise: Record<string, number>;
  performanceDrops: string[];
  improvingIssues: string[];
  moduleDose: Partial<Record<CorrectionIssue, CorrectionDoseLevel>> & Record<string, CorrectionDoseLevel>;
  lastUpdated: string;
}

export interface UserProfile {
  id: string;
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  trainingLevel: TrainingLevel;
  primaryGoal: PrimaryGoal;
  secondaryPreferences: SecondaryPreference[];
  weeklyTrainingDays: number;
  sessionDurationMin: number;
  equipmentAccess: EquipmentAccess[];
  injuryFlags: string[];
  painNotes: string[];
}

export interface ScreeningProfile {
  userId: string;
  postureFlags: PostureFlags;
  movementFlags: MovementFlags;
  painTriggers: string[];
  restrictedExercises: string[];
  correctionPriority: string[];
  adaptiveState?: AdaptiveState;
}

export interface DayTemplate {
  id: string;
  name: string;
  focusMuscles: MuscleGroup[];
  correctionBlockIds: string[];
  mainExerciseIds: string[];
  functionalBlockIds: string[];
  estimatedDurationMin: number;
}

export interface ProgramTemplate {
  id: string;
  userId: string;
  primaryGoal: PrimaryGoal;
  splitType: SplitType;
  daysPerWeek: number;
  correctionStrategy: CorrectionStrategy;
  functionalStrategy: FunctionalStrategy;
  weeklyMuscleTargets: WeeklyMuscleTargets;
  dayTemplates: DayTemplate[];
}

export interface TechniqueStandard {
  rom: string;
  tempo: string;
  stopRule: string;
}

export interface ReadinessSignal {
  level: 'green' | 'yellow' | 'red';
  label: string;
  title: string;
  advice: string;
  reasons: string[];
  poorSleepDays: number;
}

export interface TrainingSetLog {
  id: string;
  type?: TrainingSetType | string;
  weight: number;
  reps: number;
  rpe?: number | string;
  rir?: number | string;
  note?: string;
  done?: boolean;
  painFlag?: boolean;
  painArea?: string;
  painSeverity?: number;
  techniqueQuality?: TechniqueQuality;
  completedAt?: string;
  targetRir?: [number, number];
}

export type FocusStepType = 'correction' | 'warmup' | 'working' | 'functional' | 'support' | 'completed';

export interface ActualSetDraft {
  exerciseId: string;
  stepId: string;
  stepType: Exclude<FocusStepType, 'completed'>;
  setIndex: number;
  actualWeightKg?: number;
  actualReps?: number;
  actualRir?: number;
  techniqueQuality?: TechniqueQuality;
  painFlag?: boolean;
}

export interface ExerciseEquivalenceChain {
  id?: string;
  label: string;
  primaryMuscle: string;
  pattern: string;
  members: string[];
}

export interface ExerciseMetadata {
  movementPattern?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  muscleContribution?: Record<string, number>;
  goalBias?: string[];
  equivalenceChainId?: string;
  canonicalExerciseId?: string;
  baseId?: string;
  fatigueCost?: ExerciseFatigueCost | string;
  skillDemand?: ExerciseSkillDemand | string;
  romPriority?: string;
  progressionUnit?: string;
  progressionUnitKg?: number;
  progressionPercent?: [number, number];
  targetRir?: [number, number];
  recommendedLoadRange?: string;
  recommendedRepRange?: [number, number];
  recommendedRestSec?: [number, number];
  orderPriority?: number;
  highFrequencyOk?: boolean;
  evidenceTags?: readonly string[];
  techniqueStandard?: TechniqueStandard;
  equivalence?: ExerciseEquivalenceChain;
  regressionIds?: string[];
  progressionIds?: string[];
  contraindications?: string[];
}

export interface ExerciseTemplate extends ExerciseMetadata {
  id: string;
  name: string;
  alias?: string;
  muscle: string;
  kind: ExerciseKind | string;
  sets: number;
  repMin: number;
  repMax: number;
  rest: number;
  startWeight: number;
  alternatives?: string[];
  orderPriority?: number;
  recommendedLoadRange?: string;
  recommendedRepRange?: [number, number];
  recommendedRestSec?: [number, number];
  adjustment?: string;
  warning?: string;
}

export interface ExercisePrescription extends Omit<ExerciseTemplate, 'sets'> {
  baseId?: string;
  originalName?: string;
  replacedFromId?: string;
  replacedFromName?: string;
  sets: number | TrainingSetLog[];
  painFlag?: boolean;
  targetRirText?: string;
  prescription?: {
    mode: TrainingMode | string;
    modeLabel: string;
    loadRange: string;
    repRange: [number, number];
    sets: number;
    restSec: number;
    targetRir: [number, number];
    rule: string;
    weeklyAdjustment?: string;
    sources?: string[];
  };
  suggestion?: string;
  lastSummary?: string;
  targetSummary?: string;
  adjustment?: string;
  warning?: string;
  progressLocked?: boolean;
  conservativeTopSet?: boolean;
  adaptiveTopSetFactor?: number;
  adaptiveBackoffFactor?: number;
  adaptiveRestPenaltySec?: number;
  adaptiveReasons?: string[];
  mesocyclePhase?: CyclePhase;
  mesocycleIntensityBias?: IntensityBias;
  readinessScore?: number;
  replacementSuggested?: string;
  autoReplaced?: boolean;
  warmupSets?: Array<{ weight: number; reps: number; label?: string }>;
  setPrescription?: {
    topWeight: number;
    topReps: number;
    backoffWeight: number;
    backoffReps: number;
    summary: string;
  };
}

export interface CorrectionExercise {
  exerciseId: string;
  name?: string;
  sets: number;
  repMin: number;
  repMax: number;
  holdSec?: number;
  restSec?: number;
  cue?: string;
}

export interface FunctionalExercise {
  exerciseId: string;
  name?: string;
  sets: number;
  repMin?: number;
  repMax?: number;
  distanceM?: number;
  timeSec?: number;
  holdSec?: number;
  restSec?: number;
  cue?: string;
}

export interface CorrectionModule {
  id: string;
  name: string;
  targetIssue: CorrectionIssue;
  stage: CorrectionStage;
  insertionStage?: CorrectionStage;
  durationMin: number;
  dose?: CorrectionDoseLevel;
  doseStrategy?: SupportDoseStrategy;
  taperRules?: string[];
  minimumEffectiveDose?: number;
  maxRecommendedDose?: number;
  exercises: CorrectionExercise[];
}

export interface FunctionalAddon {
  id: string;
  name: string;
  targetAbility: FunctionalAbility;
  insertionRule: FunctionalInsertionRule;
  insertionStage?: 'warmup' | 'after_main' | 'finisher';
  durationMin: number;
  dose?: CorrectionDoseLevel;
  doseStrategy?: SupportDoseStrategy;
  taperRules?: string[];
  minimumEffectiveDose?: number;
  maxRecommendedDose?: number;
  exercises: FunctionalExercise[];
}

export interface DeloadDecision {
  level: DeloadLevel;
  triggered: boolean;
  reasons: string[];
  title: string;
  strategy: DeloadStrategy;
  volumeMultiplier: number;
  options: string[];
  autoSwitchTemplateId?: string;
}

export interface TodayStatus {
  sleep: SleepState;
  energy: EnergyState;
  soreness: Array<'无' | MuscleGroup>;
  time: AvailableTime;
}

export interface TrainingTemplate {
  id: string;
  name: string;
  focus: string;
  duration: number;
  note: string;
  exercises: ExerciseTemplate[];
  updatedAt?: string;
  sourceTemplateId?: string;
  sourceTemplateName?: string;
  isExperimentalTemplate?: boolean;
  appliedAt?: string;
  adjustmentSummary?: string;
}

export interface PerformanceSnapshot {
  session: TrainingSession;
  exercise: ExercisePrescription;
  sets: TrainingSetLog[];
}

export interface FeedbackSummary {
  painExercises: string[];
  performanceDrops: string[];
  improvingIssues: CorrectionIssue[];
}

export interface LoadFeedback {
  exerciseId: string;
  sessionId: string;
  date: string;
  feedback: LoadFeedbackValue;
  note?: string;
}

export interface SupportPlan {
  primaryGoal: PrimaryGoal;
  mainline: {
    name?: string;
    splitType?: SplitType;
    durationMin: number;
    ratio: number;
  };
  correctionModules: CorrectionModule[];
  functionalAddons: FunctionalAddon[];
  totalDurationMin: number;
  ratios: {
    mainline: number;
    correction: number;
    functional: number;
  };
  adherenceAdjustment?: AdherenceAdjustment;
}

export interface BodyWeightEntry {
  date: string;
  value: number;
}

export interface RestTimerState {
  exerciseId: string;
  setIndex: number;
  startedAt: string;
  durationSec: number;
  isRunning: boolean;
  pausedRemainingSec?: number;
  label?: string;
}

export interface TrainingSession {
  id: string;
  date: string;
  templateId: string;
  templateName: string;
  programTemplateId?: string;
  programTemplateName?: string;
  isExperimentalTemplate?: boolean;
  trainingMode: TrainingMode;
  focus?: string;
  exercises: ExercisePrescription[];
  correctionBlock?: CorrectionModule[];
  functionalBlock?: FunctionalAddon[];
  supportPlan?: SupportPlan;
  status?: TodayStatus;
  startedAt?: string;
  finishedAt?: string;
  completed?: boolean;
  durationMin?: number;
  feedbackSummary?: FeedbackSummary;
  loadFeedback?: LoadFeedback[];
  supportExerciseLogs?: SupportExerciseLog[];
  restTimerState?: RestTimerState | null;
  currentExerciseId?: string;
  currentSetIndex?: number;
  currentFocusStepId?: string;
  currentFocusStepType?: FocusStepType;
  focusManualStepOverride?: boolean;
  focusSessionComplete?: boolean;
  focusActualSetDrafts?: ActualSetDraft[];
  focusCompletedStepIds?: string[];
  focusCompletedWarmupPatterns?: string[];
  focusSkippedStepIds?: string[];
  focusWarmupSetLogs?: TrainingSetLog[];
  deloadDecision?: DeloadDecision;
  explanations?: string[];
}

export interface WeeklyMuscleBudget {
  muscle: string;
  baseTarget?: number;
  target: number;
  sets: number;
  remaining: number;
  capacity?: number;
  remainingCapacity?: number;
  todayBudget?: number;
  targetMultiplier?: number;
  adjustmentReasons?: string[];
  recoveryMultiplier?: number;
  frequency: number;
  targetFrequency?: number;
  directSets?: number;
  indirectSets?: number;
  status?: string;
}

export interface WeeklyPrescription {
  weekStart: string;
  mode?: {
    id: TrainingMode;
    label: string;
    shortLabel: string;
    description: string;
    weeklyTargets: Record<MuscleGroup, number>;
  };
  muscles: WeeklyMuscleBudget[];
  priorityMuscles?: string[];
}

export interface SupportExerciseDefinition {
  id: string;
  name: string;
  category: SupportExerciseCategory;
  targetIssue?: CorrectionIssue;
  targetAbility?: FunctionalAbility;
  cues: string[];
  commonMistakes: string[];
  defaultPrescription: {
    sets: number;
    repMin?: number;
    repMax?: number;
    holdSec?: number;
    distanceM?: number;
    timeSec?: number;
    restSec?: number;
  };
  contraindications?: string[];
  regressionIds?: string[];
  progressionIds?: string[];
}

export interface AdherenceSkippedItem {
  id: string;
  name: string;
  skipCount: number;
}

export interface SupportExerciseLog {
  moduleId: string;
  exerciseId: string;
  exerciseName?: string;
  blockType: SupportBlockType;
  plannedSets: number;
  completedSets: number;
  skippedReason?: SupportSkipReason;
  notes?: string;
}

export interface AdherenceReport {
  recentSessionCount: number;
  plannedSets: number;
  actualSets: number;
  overallRate: number;
  mainlineRate: number;
  correctionRate?: number;
  functionalRate?: number;
  recentSessions: Array<{
    sessionId: string;
    date: string;
    templateName: string;
    plannedSets: number;
    actualSets: number;
    adherenceRate: number;
    mainPlannedSets: number;
    mainActualSets: number;
    correctionPlannedSets: number;
    correctionActualSets: number;
    functionalPlannedSets: number;
    functionalActualSets: number;
    hasSupportData: boolean;
  }>;
  skippedExercises: Array<{
    exerciseId: string;
    count: number;
    mostCommonReason?: string;
  }>;
  skippedSupportExercises: Array<{
    exerciseId: string;
    moduleId: string;
    blockType: SupportBlockType;
    count: number;
    mostCommonReason?: string;
  }>;
  suggestions: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface AdherenceAdjustment {
  complexityLevel: AdherenceComplexityLevel;
  correctionDoseAdjustment: 'keep' | 'reduce' | 'minimal';
  functionalDoseAdjustment: 'keep' | 'reduce' | 'remove_optional';
  weeklyVolumeMultiplier: number;
  sessionDurationHint?: number;
  reasons: string[];
}

export interface ReadinessInput {
  sleep: 'poor' | 'ok' | 'good';
  energy: 'low' | 'medium' | 'high';
  sorenessAreas: string[];
  painAreas?: string[];
  availableTimeMin: number;
  plannedTimeMin?: number;
}

export interface ReadinessResult {
  score: number;
  level: ReadinessLevel;
  trainingAdjustment: ReadinessAdjustment;
  reasons: string[];
}

export interface PainPattern {
  area: string;
  exerciseId?: string;
  frequency: number;
  severityAvg: number;
  lastOccurredAt: string;
  suggestedAction: PainSuggestedAction;
}

export interface EstimatedOneRepMax {
  exerciseId: string;
  e1rmKg: number;
  formula: 'epley' | 'brzycki';
  confidence: EstimateConfidence;
  sourceSet: {
    sessionId: string;
    date: string;
    weightKg: number;
    reps: number;
    rir?: number;
    techniqueQuality?: TechniqueQuality;
    painFlag?: boolean;
  };
  notes: string[];
}

export interface E1RMProfile {
  exerciseId: string;
  current?: EstimatedOneRepMax;
  best?: EstimatedOneRepMax;
  recentValues?: number[];
  method?: 'median_recent' | 'weighted_recent_average' | 'single_recent_low_confidence';
}

export interface MuscleVolumeDashboardRow {
  muscleId: string;
  muscleName: string;
  targetSets: number;
  completedSets: number;
  effectiveSets: number;
  highConfidenceEffectiveSets: number;
  weightedEffectiveSets: number;
  remainingSets: number;
  status: 'low' | 'near_target' | 'on_target' | 'high';
  notes: string[];
}

export type WeeklyActionPriority = 'high' | 'medium' | 'low';

export interface WeeklyActionRecommendation {
  id: string;
  priority: WeeklyActionPriority;
  category: 'volume' | 'recovery' | 'exercise_selection' | 'technique' | 'pain' | 'adherence' | 'load_feedback' | 'mesocycle';
  targetType: 'muscle' | 'exercise' | 'session' | 'program';
  targetId?: string;
  targetLabel: string;
  issue: string;
  recommendation: string;
  reason: string;
  suggestedChange?: {
    muscleId?: string;
    setsDelta?: number;
    exerciseIds?: string[];
    removeExerciseIds?: string[];
    volumeMultiplier?: number;
    supportDoseAdjustment?: 'keep' | 'reduce' | 'minimal' | 'increase' | 'boost';
  };
  evidenceRuleIds?: string[];
  confidence: EstimateConfidence;
}

export interface ExerciseRecommendation {
  exerciseId: string;
  label: string;
  reason: string;
  fatigueCost: ExerciseFatigueCost | 'low' | 'medium' | 'high';
  priority: 'primary' | 'secondary' | 'avoid';
}

export interface ProgramAdjustmentPreview {
  id: string;
  title: string;
  summary: string;
  changes: Array<{
    type: AdjustmentChangeType;
    dayTemplateId?: string;
    dayTemplateName?: string;
    exerciseId?: string;
    exerciseName?: string;
    muscleId?: string;
    setsDelta?: number;
    sets?: number;
    repMin?: number;
    repMax?: number;
    restSec?: number;
    reason: string;
  }>;
  confidence: EstimateConfidence;
}

export type AdjustmentApplicationStatus = 'draft' | 'previewed' | 'applied' | 'rolled_back' | 'dismissed' | 'stale';

export type AdjustmentChangeType =
  | 'add_sets'
  | 'remove_sets'
  | 'add_new_exercise'
  | 'swap_exercise'
  | 'reduce_support'
  | 'increase_support'
  | 'keep';

export interface AdjustmentChange {
  id: string;
  type: AdjustmentChangeType;
  dayTemplateId?: string;
  dayTemplateName?: string;
  exerciseId?: string;
  exerciseName?: string;
  replacementExerciseId?: string;
  replacementExerciseName?: string;
  muscleId?: string;
  setsDelta?: number;
  sets?: number;
  repMin?: number;
  repMax?: number;
  restSec?: number;
  insertAfterExerciseId?: string;
  insertPositionLabel?: string;
  previewNote?: string;
  skipped?: boolean;
  skipReason?: string;
  reason: string;
  sourceRecommendationId?: string;
}

export interface ProgramAdjustmentDraft {
  id: string;
  createdAt: string;
  status: AdjustmentApplicationStatus;
  sourceProgramTemplateId: string;
  experimentalProgramTemplateId?: string;
  sourceTemplateSnapshotHash?: string;
  sourceTemplateUpdatedAt?: string;
  title: string;
  summary: string;
  selectedRecommendationIds: string[];
  changes: AdjustmentChange[];
  confidence: EstimateConfidence;
  notes: string[];
}

export interface ProgramAdjustmentHistoryItem {
  id: string;
  appliedAt: string;
  sourceProgramTemplateId: string;
  experimentalProgramTemplateId: string;
  sourceProgramTemplateName?: string;
  experimentalProgramTemplateName?: string;
  mainChangeSummary?: string;
  selectedRecommendationIds: string[];
  changes: AdjustmentChange[];
  rollbackAvailable: boolean;
  rolledBackAt?: string;
  sourceProgramSnapshot?: ProgramTemplate;
  effectReview?: AdjustmentEffectReview;
}

export interface ProgramAdjustmentDiff {
  title: string;
  summary: string;
  changes: Array<{
    changeId: string;
    type: AdjustmentChangeType;
    label: string;
    before: string;
    after: string;
    reason: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
}

export interface AdjustmentEffectReview {
  historyItemId: string;
  status: 'too_early' | 'improved' | 'neutral' | 'worse' | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  metrics: {
    targetMuscleChange?: number;
    adherenceChange?: number;
    painSignalChange?: number;
    effectiveVolumeChange?: number;
    beforeSessionCount?: number;
    afterSessionCount?: number;
  };
  recommendation: 'keep' | 'rollback' | 'review_manually' | 'collect_more_data';
}

export interface EffectiveSetResult {
  isEffective: boolean;
  score: number;
  confidence: EstimateConfidence;
  reasons: string[];
  flags: EffectiveSetFlag[];
}

export interface EffectiveVolumeSummary {
  completedSets: number;
  effectiveSets: number;
  highConfidenceEffectiveSets: number;
  mediumConfidenceEffectiveSets: number;
  lowConfidenceEffectiveSets: number;
  effectiveScore: number;
  byMuscle: Record<
    string,
    {
      completedSets: number;
      effectiveSets: number;
      highConfidenceEffectiveSets: number;
      mediumConfidenceEffectiveSets: number;
      lowConfidenceEffectiveSets: number;
      effectiveScore: number;
      weightedEffectiveSets: number;
      highConfidenceWeightedSets: number;
    }
  >;
  reasons: string[];
}

export interface PersonalRecord {
  key?: string;
  exerciseId: string;
  value: number;
  metric: 'max_weight' | 'estimated_1rm' | 'reps_at_weight' | 'volume';
  quality: PersonalRecordQuality;
  reasons: string[];
  type?: string;
  exercise?: string;
  displayValue?: string;
  raw?: number;
  date?: string;
}

export interface ExplanationItem {
  title: string;
  conclusion: string;
  reason: string;
  action: string;
  evidenceRuleIds?: string[];
  confidence?: EvidenceConfidence;
  caveat?: string;
}

export interface MesocycleWeek {
  weekIndex: number;
  phase: CyclePhase;
  volumeMultiplier: number;
  intensityBias: IntensityBias;
  notes?: string;
}

export interface MesocyclePlan {
  id: string;
  startDate: string;
  lengthWeeks: 4 | 5 | 6;
  currentWeekIndex: number;
  primaryGoal: PrimaryGoal;
  weeks: MesocycleWeek[];
}

export interface AppSettings {
  schemaVersion?: number;
  selectedTemplateId?: string;
  trainingMode?: TrainingMode;
  [key: string]: unknown;
}

export interface AppData {
  schemaVersion: number;
  templates: TrainingTemplate[];
  history: TrainingSession[];
  bodyWeights: BodyWeightEntry[];
  activeSession: TrainingSession | null;
  selectedTemplateId: string;
  trainingMode: TrainingMode;
  todayStatus: TodayStatus;
  userProfile: UserProfile;
  screeningProfile: ScreeningProfile;
  programTemplate: ProgramTemplate;
  mesocyclePlan: MesocyclePlan;
  programAdjustmentDrafts?: ProgramAdjustmentDraft[];
  programAdjustmentHistory?: ProgramAdjustmentHistoryItem[];
  activeProgramTemplateId?: string;
  settings: AppSettings;
}
