import {
  CORRECTION_MODULES,
  DEFAULT_MESOCYCLE_PLAN,
  DEFAULT_PROGRAM_TEMPLATE,
  DEFAULT_SCREENING_PROFILE,
  DEFAULT_STATUS,
  DEFAULT_USER_PROFILE,
  FUNCTIONAL_ADDONS,
  INITIAL_TEMPLATES,
  STORAGE_VERSION,
  SUPPORT_EXERCISE_LIBRARY,
  TRAINING_MODE_META,
  validateSupportExerciseReferences,
} from '../data/trainingData';
import {
  CORRECTION_STRATEGIES,
  ENERGY_STATES,
  FUNCTIONAL_STRATEGIES,
  SEX_OPTIONS,
  SLEEP_STATES,
  SPLIT_TYPES,
  TRAINING_LEVELS,
  type AppData,
  type DataRepairLogEntry,
  type DismissedCoachAction,
  type DismissedDataHealthIssue,
  type HealthImportBatch,
  type HealthIntegrationSettings,
  type HealthMetricSample,
  type ImportedWorkoutSample,
  type LoadFeedback,
  type MesocyclePlan,
  type PendingSessionPatch,
  type ProgramAdjustmentDraft,
  type ProgramAdjustmentHistoryItem,
  type ProgramTemplate,
  type RestTimerState,
  type ScreeningProfile,
  type SupportExerciseLog,
  type TodayStatus,
  type TrainingSession,
  type UserProfile,
} from '../models/training-model';
import { clamp, hydrateTemplates, normalizeSoreness, number } from '../engines/engineUtils';
import { reconcileScreeningProfile } from '../engines/adaptiveFeedbackEngine';
import { createMesocyclePlan, sanitizeMesocyclePlan } from '../engines/mesocycleEngine';
import { DEFAULT_UNIT_SETTINGS, sanitizeUnitSettings } from '../engines/unitConversionEngine';
import {
  buildPlanAdjustmentFingerprintFromDraft,
  buildPlanAdjustmentFingerprintFromHistory,
} from '../engines/planAdjustmentIdentityEngine';
import { migrateTrainingData } from './appDataMigration';
import { validateAppDataSchema, validateProgramSchema } from './appDataValidation';
import {
  HEALTH_DATA_SOURCES,
  HEALTH_METRIC_TYPES,
  LOAD_FEEDBACK_VALUES,
  SESSION_DATA_FLAGS,
  editAffectedStats,
  finiteNumber,
  isPlainObject,
  normalizeExerciseIdentity,
  normalizePrimaryGoal,
  normalizeTextValue,
  normalizeTrainingMode,
  pickArray,
  pickDoseRecord,
  pickEnum,
  pickNumberRecord,
  pickRecord,
  pickString,
  pickStringArray,
  pickStringRecord,
  sanitizeSessionEditSummarySnapshot,
  sessionEditTypes,
} from './appDataStorageUtils';

export const DEFAULT_HEALTH_INTEGRATION_SETTINGS: HealthIntegrationSettings = {
  useHealthDataForReadiness: true,
  showExternalWorkoutsInCalendar: true,
};

const SUPPORT_SKIP_REASONS = new Set(['time', 'pain', 'equipment', 'forgot', 'too_tired', 'not_needed', 'other']);
const isSupportSkipReason = (value: string): value is NonNullable<SupportExerciseLog['skippedReason']> =>
  SUPPORT_SKIP_REASONS.has(value);

export const sanitizeHealthIntegrationSettings = (settings: unknown): HealthIntegrationSettings => {
  const raw = pickRecord(settings);
  return {
    useHealthDataForReadiness:
      typeof raw.useHealthDataForReadiness === 'boolean'
        ? raw.useHealthDataForReadiness
        : DEFAULT_HEALTH_INTEGRATION_SETTINGS.useHealthDataForReadiness,
    showExternalWorkoutsInCalendar:
      typeof raw.showExternalWorkoutsInCalendar === 'boolean'
        ? raw.showExternalWorkoutsInCalendar
        : DEFAULT_HEALTH_INTEGRATION_SETTINGS.showExternalWorkoutsInCalendar,
  };
};

export const validateSupportLibraryShape = () => {
  const problems: string[] = [];

  CORRECTION_MODULES.forEach((module) => {
    if (!module.id || !module.targetIssue || !Array.isArray(module.exercises) || !module.exercises.length) {
      problems.push(`correction:${module.id || 'unknown'}`);
    }
  });

  FUNCTIONAL_ADDONS.forEach((addon) => {
    if (!addon.id || !addon.targetAbility || !Array.isArray(addon.exercises) || !addon.exercises.length) {
      problems.push(`functional:${addon.id || 'unknown'}`);
    }
  });

  if (problems.length) {
    console.warn('IronPath support library validation warnings:', problems.join(', '));
  }
};

export const validateSupportLibraryReferences = () => {
  const missing = validateSupportExerciseReferences([...CORRECTION_MODULES, ...FUNCTIONAL_ADDONS]);
  if (!SUPPORT_EXERCISE_LIBRARY.length) {
    console.warn('IronPath support exercise library is empty.');
  }
  return missing;
};

export const sanitizeUserProfile = (profile: unknown): UserProfile => {
  const raw = pickRecord(profile);
  return {
    ...DEFAULT_USER_PROFILE,
    ...raw,
    sex: pickEnum(raw.sex, SEX_OPTIONS, DEFAULT_USER_PROFILE.sex),
    age: clamp(number(raw.age) || DEFAULT_USER_PROFILE.age, 14, 90),
    heightCm: clamp(number(raw.heightCm) || DEFAULT_USER_PROFILE.heightCm, 100, 240),
    weightKg: clamp(number(raw.weightKg) || DEFAULT_USER_PROFILE.weightKg, 30, 250),
    trainingLevel: pickEnum(raw.trainingLevel, TRAINING_LEVELS, DEFAULT_USER_PROFILE.trainingLevel),
    primaryGoal: normalizePrimaryGoal(raw.primaryGoal, DEFAULT_USER_PROFILE.primaryGoal),
    weeklyTrainingDays: clamp(number(raw.weeklyTrainingDays) || DEFAULT_USER_PROFILE.weeklyTrainingDays, 1, 7),
    sessionDurationMin: clamp(number(raw.sessionDurationMin) || DEFAULT_USER_PROFILE.sessionDurationMin, 20, 180),
    secondaryPreferences: pickStringArray(raw.secondaryPreferences, DEFAULT_USER_PROFILE.secondaryPreferences) as UserProfile['secondaryPreferences'],
    equipmentAccess: pickStringArray(raw.equipmentAccess, DEFAULT_USER_PROFILE.equipmentAccess) as UserProfile['equipmentAccess'],
    injuryFlags: pickStringArray(raw.injuryFlags),
    painNotes: pickStringArray(raw.painNotes),
  };
};

const repairProgramTemplateCandidate = (programTemplate: unknown): ProgramTemplate => {
  const raw = pickRecord(programTemplate);
  return {
    ...DEFAULT_PROGRAM_TEMPLATE,
    ...raw,
    primaryGoal: normalizePrimaryGoal(raw.primaryGoal, DEFAULT_PROGRAM_TEMPLATE.primaryGoal),
    splitType: pickEnum(raw.splitType, SPLIT_TYPES, DEFAULT_PROGRAM_TEMPLATE.splitType),
    daysPerWeek: clamp(number(raw.daysPerWeek) || DEFAULT_PROGRAM_TEMPLATE.daysPerWeek, 1, 7),
    correctionStrategy: pickEnum(raw.correctionStrategy, CORRECTION_STRATEGIES, DEFAULT_PROGRAM_TEMPLATE.correctionStrategy),
    functionalStrategy: pickEnum(raw.functionalStrategy, FUNCTIONAL_STRATEGIES, DEFAULT_PROGRAM_TEMPLATE.functionalStrategy),
    weeklyMuscleTargets: {
      ...DEFAULT_PROGRAM_TEMPLATE.weeklyMuscleTargets,
      ...pickNumberRecord(raw.weeklyMuscleTargets),
    },
    dayTemplates: pickArray(raw.dayTemplates),
  };
};

export const sanitizeProgramTemplate = (programTemplate: unknown): ProgramTemplate => {
  const candidate = repairProgramTemplateCandidate(programTemplate);

  if (validateProgramSchema(candidate)) return candidate;

  const repaired = repairProgramTemplateCandidate(candidate);
  if (validateProgramSchema(repaired)) {
    console.warn('IronPath program template schema validation required repair.', validateProgramSchema.errors);
    return repaired;
  }

  console.warn('IronPath program template schema validation still failed after repair.', validateProgramSchema.errors);
  return {
    ...DEFAULT_PROGRAM_TEMPLATE,
    ...repaired,
    weeklyMuscleTargets: {
      ...DEFAULT_PROGRAM_TEMPLATE.weeklyMuscleTargets,
      ...repaired.weeklyMuscleTargets,
    },
    dayTemplates: pickArray(repaired.dayTemplates),
  };
};

export const sanitizeScreeningProfile = (screening: unknown, history: TrainingSession[]): ScreeningProfile => {
  const raw = pickRecord(screening);
  const merged = {
    ...DEFAULT_SCREENING_PROFILE,
    ...raw,
    postureFlags: { ...DEFAULT_SCREENING_PROFILE.postureFlags, ...pickRecord(raw.postureFlags) },
    movementFlags: { ...DEFAULT_SCREENING_PROFILE.movementFlags, ...pickRecord(raw.movementFlags) },
    painTriggers: pickStringArray(raw.painTriggers),
    restrictedExercises: pickStringArray(raw.restrictedExercises),
    correctionPriority: pickStringArray(raw.correctionPriority, DEFAULT_SCREENING_PROFILE.correctionPriority),
    adaptiveState: {
      ...DEFAULT_SCREENING_PROFILE.adaptiveState,
      ...pickRecord(raw.adaptiveState),
      issueScores: pickNumberRecord(pickRecord(raw.adaptiveState).issueScores),
      painByExercise: pickNumberRecord(pickRecord(raw.adaptiveState).painByExercise),
      performanceDrops: pickStringArray(pickRecord(raw.adaptiveState).performanceDrops),
      improvingIssues: pickStringArray(pickRecord(raw.adaptiveState).improvingIssues),
      moduleDose: pickDoseRecord(pickRecord(raw.adaptiveState).moduleDose),
      lastUpdated: pickString(pickRecord(raw.adaptiveState).lastUpdated),
    },
  };

  return reconcileScreeningProfile(merged, history);
};

const sanitizeSet = (set: unknown, fallbackId: string, fallbackType = 'straight') => {
  const raw = pickRecord(set);
  const rawWeightSource = raw.actualWeightKg ?? raw.weight;
  const hasWeightSource = raw.actualWeightKg !== undefined || (raw.weight !== undefined && number(raw.weight) > 0);
  const parsedWeight = Number(rawWeightSource);
  const weight = hasWeightSource && Number.isFinite(parsedWeight) ? Math.max(0, number(rawWeightSource)) : 0;
  const parsedDisplayWeight = Number(raw.displayWeight);
  const reps = Math.max(0, number(raw.reps));
  const done = typeof raw.done === 'boolean' ? raw.done : undefined;
  const completedAt = pickString(raw.completedAt);
  const rawCompletionStatus = pickString(raw.completionStatus);
  const completionStatus =
    rawCompletionStatus === 'completed' || rawCompletionStatus === 'incomplete' || rawCompletionStatus === 'draft' || rawCompletionStatus === 'legacy_completed'
      ? rawCompletionStatus
      : done === true
        ? 'completed'
        : done === false
          ? 'incomplete'
          : completedAt
            ? 'legacy_completed'
            : 'draft';
  return {
    id: pickString(raw.id, fallbackId),
    exerciseId: pickString(raw.exerciseId) || undefined,
    originalExerciseId: pickString(raw.originalExerciseId) || undefined,
    actualExerciseId: pickString(raw.actualExerciseId) || undefined,
    legacyActualExerciseId: pickString(raw.legacyActualExerciseId) || undefined,
    legacyReplacementExerciseId: pickString(raw.legacyReplacementExerciseId) || undefined,
    legacyOriginalExerciseId: pickString(raw.legacyOriginalExerciseId) || undefined,
    identityInvalid: raw.identityInvalid === true || undefined,
    identityReviewReason: pickString(raw.identityReviewReason) || undefined,
    type: pickString(raw.type || raw.setType || raw.stepType, fallbackType),
    warmupType:
      typeof raw.warmupType === 'string'
        ? pickEnum(raw.warmupType, ['full_warmup', 'feeder_set', 'unknown'] as const, 'unknown')
        : undefined,
    setIndex: Number.isFinite(number(raw.setIndex)) ? Math.max(0, Math.floor(number(raw.setIndex))) : undefined,
    weight,
    actualWeightKg: hasWeightSource && Number.isFinite(parsedWeight) ? weight : undefined,
    displayWeight: raw.displayWeight !== undefined && Number.isFinite(parsedDisplayWeight) ? Math.max(0, number(raw.displayWeight)) : undefined,
    displayUnit: raw.displayUnit === 'kg' || raw.displayUnit === 'lb' ? raw.displayUnit : undefined,
    reps,
    rpe: raw.rpe ?? '',
    rir: raw.rir ?? '',
    note: pickString(raw.note),
    painFlag: Boolean(raw.painFlag),
    painArea: pickString(raw.painArea),
    painSeverity: Math.max(0, Math.min(5, number(raw.painSeverity) || 0)),
    techniqueQuality: pickString(raw.techniqueQuality, 'acceptable'),
    ...(done !== undefined ? { done } : {}),
    completedAt,
    completionStatus,
    incompleteReason: pickString(raw.incompleteReason) || undefined,
  };
};

const sanitizeSupportExerciseLog = (entry: unknown): SupportExerciseLog | null => {
  const raw = pickRecord(entry);
  const moduleId = pickString(raw.moduleId);
  const exerciseId = pickString(raw.exerciseId);
  if (!moduleId || !exerciseId) return null;
  const blockType = pickString(raw.blockType, 'correction');
  const skippedReason = pickString(raw.skippedReason);

  return {
    moduleId,
    exerciseId,
    exerciseName: pickString(raw.exerciseName),
    blockType: blockType === 'functional' ? 'functional' : 'correction',
    plannedSets: Math.max(0, number(raw.plannedSets)),
    completedSets: Math.max(0, number(raw.completedSets)),
    ...(isSupportSkipReason(skippedReason) ? { skippedReason } : {}),
    notes: pickString(raw.notes),
  };
};

const sanitizeExerciseLog = (exercise: unknown) => {
  const raw = pickRecord(exercise);
  const rawId = pickString(raw.id) || pickString(raw.baseId) || 'exercise';
  const identity = normalizeExerciseIdentity(raw, rawId);
  return {
    ...raw,
    ...identity,
    sameTemplateSlot: Boolean(raw.sameTemplateSlot) || Boolean(identity.replacementExerciseId),
    replacementReason: pickString(raw.replacementReason),
    prIndependent: Boolean(raw.prIndependent) || Boolean(identity.replacementExerciseId),
    name: pickString(raw.name),
    muscle: pickString(raw.muscle),
    kind: pickString(raw.kind, 'compound'),
    repMin: Math.max(1, number(raw.repMin || 6)),
    repMax: Math.max(number(raw.repMin || 6), number(raw.repMax || 8)),
    rest: Math.max(30, number(raw.rest || 90)),
    startWeight: Math.max(0, number(raw.startWeight || 0)),
    muscleContribution: isPlainObject(raw.muscleContribution)
      ? Object.fromEntries(Object.entries(raw.muscleContribution).map(([key, value]) => [key, Math.max(0, number(value))]))
      : undefined,
    sets: Array.isArray(raw.sets)
      ? raw.sets.map((set, index) => sanitizeSet(set, `${identity.id}-${index + 1}`))
      : raw.sets,
    completionStatus:
      raw.completionStatus === 'completed' || raw.completionStatus === 'partial' || raw.completionStatus === 'not_started'
        ? raw.completionStatus
        : undefined,
    incompleteReason: pickString(raw.incompleteReason) || undefined,
  };
};

const sanitizeDeloadDecision = (decision: unknown) => {
  const raw = pickRecord(decision);
  if (!Object.keys(raw).length) return undefined;
  return {
    level: pickString(raw.level, 'none'),
    triggered: Boolean(raw.triggered),
    reasons: pickArray(raw.reasons),
    title: pickString(raw.title),
    strategy: pickString(raw.strategy, 'none'),
    volumeMultiplier: Math.max(0.4, Math.min(1, number(raw.volumeMultiplier) || 1)),
    options: pickArray(raw.options),
    autoSwitchTemplateId: pickString(raw.autoSwitchTemplateId),
  };
};

const sanitizeLoadFeedback = (entry: unknown): LoadFeedback | null => {
  const raw = pickRecord(entry);
  const exerciseId = pickString(raw.exerciseId);
  const sessionId = pickString(raw.sessionId);
  const date = pickString(raw.date);
  if (!exerciseId || !sessionId || !date) return null;

  return {
    exerciseId,
    sessionId,
    date,
    feedback: pickEnum(raw.feedback, LOAD_FEEDBACK_VALUES, 'good'),
    note: pickString(raw.note),
  };
};

const sanitizeRestTimerState = (timer: unknown): RestTimerState | null => {
  const raw = pickRecord(timer);
  const exerciseId = pickString(raw.exerciseId);
  const startedAt = pickString(raw.startedAt);
  if (!exerciseId || !startedAt) return null;

  return {
    exerciseId,
    setIndex: Math.max(0, Math.floor(number(raw.setIndex))),
    startedAt,
    durationSec: Math.max(0, Math.round(number(raw.durationSec))),
    isRunning: Boolean(raw.isRunning),
    pausedRemainingSec: Math.max(0, Math.round(number(raw.pausedRemainingSec))),
    label: pickString(raw.label),
  };
};

const ADJUSTMENT_STATUSES = [
  'recommendation',
  'draft_created',
  'ready_to_apply',
  'applied',
  'dismissed',
  'expired',
  'rolled_back',
  'draft',
  'previewed',
  'stale',
] as const;
const ADJUSTMENT_HISTORY_STATUSES = [
  'recommendation',
  'draft_created',
  'ready_to_apply',
  'applied',
  'dismissed',
  'expired',
  'rolled_back',
] as const;
const ADJUSTMENT_CHANGE_TYPES = ['add_sets', 'remove_sets', 'add_new_exercise', 'swap_exercise', 'reduce_support', 'increase_support', 'keep'] as const;

const sanitizeAdjustmentChange = (entry: unknown, fallbackId: string) => {
  const raw = pickRecord(entry);
  return {
    id: pickString(raw.id, fallbackId),
    type: pickEnum(raw.type, ADJUSTMENT_CHANGE_TYPES, 'keep'),
    dayTemplateId: pickString(raw.dayTemplateId) || undefined,
    dayTemplateName: pickString(raw.dayTemplateName) || undefined,
    exerciseId: pickString(raw.exerciseId) || undefined,
    exerciseName: pickString(raw.exerciseName) || undefined,
    replacementExerciseId: pickString(raw.replacementExerciseId) || undefined,
    replacementExerciseName: pickString(raw.replacementExerciseName) || undefined,
    muscleId: pickString(raw.muscleId) || undefined,
    setsDelta: Number.isFinite(number(raw.setsDelta)) ? Math.round(number(raw.setsDelta)) : undefined,
    sets: Number.isFinite(number(raw.sets)) ? Math.max(1, Math.round(number(raw.sets))) : undefined,
    repMin: Number.isFinite(number(raw.repMin)) ? Math.max(1, Math.round(number(raw.repMin))) : undefined,
    repMax: Number.isFinite(number(raw.repMax)) ? Math.max(1, Math.round(number(raw.repMax))) : undefined,
    restSec: Number.isFinite(number(raw.restSec)) ? Math.max(30, Math.round(number(raw.restSec))) : undefined,
    insertAfterExerciseId: pickString(raw.insertAfterExerciseId) || undefined,
    insertPositionLabel: pickString(raw.insertPositionLabel) || undefined,
    previewNote: pickString(raw.previewNote) || undefined,
    skipped: Boolean(raw.skipped),
    skipReason: pickString(raw.skipReason) || undefined,
    reason: pickString(raw.reason),
    sourceRecommendationId: pickString(raw.sourceRecommendationId) || undefined,
  };
};

const sanitizeProgramAdjustmentDrafts = (drafts: unknown): ProgramAdjustmentDraft[] =>
  pickArray(drafts).map((draft, draftIndex) => {
    const raw = pickRecord(draft);
    const id = pickString(raw.id, `adjustment-draft-${draftIndex + 1}`);
    const sanitizedDraft: ProgramAdjustmentDraft = {
      id,
      parentDraftId: pickString(raw.parentDraftId) || undefined,
      draftRevision: Number.isFinite(number(raw.draftRevision)) ? Math.max(1, Math.round(number(raw.draftRevision))) : undefined,
      createdAt: pickString(raw.createdAt, new Date().toISOString()),
      status: pickEnum(raw.status, ADJUSTMENT_STATUSES, 'draft'),
      sourceProgramTemplateId: pickString(raw.sourceProgramTemplateId),
      sourceTemplateId: pickString(raw.sourceTemplateId) || undefined,
      sourceCoachActionId: pickString(raw.sourceCoachActionId) || undefined,
      sourceRecommendationId: pickString(raw.sourceRecommendationId) || undefined,
      sourceFingerprint: pickString(raw.sourceFingerprint) || undefined,
      experimentalProgramTemplateId: pickString(raw.experimentalProgramTemplateId) || undefined,
      experimentalTemplateName: pickString(raw.experimentalTemplateName) || undefined,
      appliedAt: pickString(raw.appliedAt) || undefined,
      rolledBackAt: pickString(raw.rolledBackAt) || undefined,
      sourceTemplateSnapshotHash: pickString(raw.sourceTemplateSnapshotHash) || undefined,
      sourceTemplateUpdatedAt: pickString(raw.sourceTemplateUpdatedAt) || undefined,
      title: pickString(raw.title, '下周实验调整'),
      summary: pickString(raw.summary),
      selectedRecommendationIds: pickStringArray(raw.selectedRecommendationIds),
      changes: pickArray(raw.changes).map((change, index) => sanitizeAdjustmentChange(change, `${id}-change-${index + 1}`)),
      confidence: pickEnum(raw.confidence, ['low', 'medium', 'high'] as const, 'low'),
      riskLevel: pickEnum(raw.riskLevel, ['low', 'medium', 'high'] as const, 'low'),
      explanation: pickString(raw.explanation) || undefined,
      notes: pickStringArray(raw.notes),
    };
    return {
      ...sanitizedDraft,
      sourceFingerprint: sanitizedDraft.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(sanitizedDraft),
    };
  });

const sanitizeProgramAdjustmentHistory = (history: unknown): ProgramAdjustmentHistoryItem[] =>
  pickArray(history)
    .map((item, itemIndex) => {
      const raw = pickRecord(item);
      const sourceProgramTemplateId = pickString(raw.sourceProgramTemplateId);
      const experimentalProgramTemplateId = pickString(raw.experimentalProgramTemplateId);
      if (!sourceProgramTemplateId || !experimentalProgramTemplateId) return null;
      const id = pickString(raw.id, `adjustment-history-${itemIndex + 1}`);
      const sanitizedItem: ProgramAdjustmentHistoryItem = {
        id,
        appliedAt: pickString(raw.appliedAt, new Date().toISOString()),
        sourceProgramTemplateId,
        experimentalProgramTemplateId,
        sourceCoachActionId: pickString(raw.sourceCoachActionId) || undefined,
        sourceFingerprint: pickString(raw.sourceFingerprint) || undefined,
        sourceProgramTemplateName: pickString(raw.sourceProgramTemplateName) || undefined,
        experimentalProgramTemplateName: pickString(raw.experimentalProgramTemplateName) || undefined,
        mainChangeSummary: pickString(raw.mainChangeSummary) || undefined,
        selectedRecommendationIds: pickStringArray(raw.selectedRecommendationIds),
        changes: pickArray(raw.changes).map((change, index) => sanitizeAdjustmentChange(change, `${id}-change-${index + 1}`)),
        status: pickEnum(raw.status, ADJUSTMENT_HISTORY_STATUSES, 'applied'),
        explanation: pickString(raw.explanation) || undefined,
        rollbackAvailable: Boolean(raw.rollbackAvailable) && !raw.rolledBackAt,
        rolledBackAt: pickString(raw.rolledBackAt) || undefined,
        sourceProgramSnapshot: isPlainObject(raw.sourceProgramSnapshot) ? sanitizeProgramTemplate(raw.sourceProgramSnapshot) : undefined,
        effectReview: isPlainObject(raw.effectReview)
          ? (() => {
              const effect = pickRecord(raw.effectReview);
              const metrics = pickRecord(effect.metrics);
              return {
                historyItemId: pickString(effect.historyItemId, id),
                status: pickString(effect.status, 'neutral') as NonNullable<ProgramAdjustmentHistoryItem['effectReview']>['status'],
                confidence: pickString(effect.confidence, 'low') as NonNullable<ProgramAdjustmentHistoryItem['effectReview']>['confidence'],
                summary: pickString(effect.summary),
                metrics: {
                  targetMuscleChange: Number.isFinite(number(metrics.targetMuscleChange)) ? number(metrics.targetMuscleChange) : undefined,
                  adherenceChange: Number.isFinite(number(metrics.adherenceChange)) ? number(metrics.adherenceChange) : undefined,
                  painSignalChange: Number.isFinite(number(metrics.painSignalChange)) ? number(metrics.painSignalChange) : undefined,
                  effectiveVolumeChange: Number.isFinite(number(metrics.effectiveVolumeChange)) ? number(metrics.effectiveVolumeChange) : undefined,
                  beforeSessionCount: Number.isFinite(number(metrics.beforeSessionCount)) ? number(metrics.beforeSessionCount) : undefined,
                  afterSessionCount: Number.isFinite(number(metrics.afterSessionCount)) ? number(metrics.afterSessionCount) : undefined,
                },
                recommendation: pickString(effect.recommendation, 'collect_more_data') as NonNullable<ProgramAdjustmentHistoryItem['effectReview']>['recommendation'],
              };
            })()
          : undefined,
      };
      return {
        ...sanitizedItem,
        sourceFingerprint: sanitizedItem.sourceFingerprint || buildPlanAdjustmentFingerprintFromHistory(sanitizedItem),
      };
    })
    .filter(Boolean) as ProgramAdjustmentHistoryItem[];

export const sanitizeSessionLog = (session: unknown): TrainingSession | null => {
  const raw = pickRecord(session);
  if (!Object.keys(raw).length) return null;
  if (!Array.isArray(raw.exercises)) return null;

  return {
    ...raw,
    id: pickString(raw.id, `session-${Date.now()}`),
    date: pickString(raw.date),
    templateId: pickString(raw.templateId),
    templateName: pickString(raw.templateName),
    programTemplateId: pickString(raw.programTemplateId) || pickString(raw.templateId) || undefined,
    programTemplateName: pickString(raw.programTemplateName) || pickString(raw.templateName) || undefined,
    isExperimentalTemplate: Boolean(raw.isExperimentalTemplate),
    sourceProgramTemplateId: pickString(raw.sourceProgramTemplateId) || undefined,
    sourceProgramTemplateName: pickString(raw.sourceProgramTemplateName) || undefined,
    dataFlag: pickEnum(raw.dataFlag, SESSION_DATA_FLAGS, 'normal'),
    trainingMode: normalizeTrainingMode(raw.trainingMode, 'hybrid'),
    status: sanitizeTodayStatus(raw.status),
    exercises: raw.exercises.map(sanitizeExerciseLog),
    correctionBlock: pickArray(raw.correctionBlock),
    functionalBlock: pickArray(raw.functionalBlock),
    supportExerciseLogs: pickArray(raw.supportExerciseLogs).map(sanitizeSupportExerciseLog).filter(Boolean) as SupportExerciseLog[],
    focusWarmupSetLogs: pickArray(raw.focusWarmupSetLogs).map((set, index) => sanitizeSet(set, `warmup-${index + 1}`, 'warmup')),
    focusCompletedWarmupPatterns: pickStringArray(raw.focusCompletedWarmupPatterns),
    focusCompletedStepIds: pickStringArray(raw.focusCompletedStepIds),
    focusSkippedStepIds: pickStringArray(raw.focusSkippedStepIds),
    loadFeedback: pickArray(raw.loadFeedback).map(sanitizeLoadFeedback).filter(Boolean) as LoadFeedback[],
    restTimerState: sanitizeRestTimerState(raw.restTimerState),
    feedbackSummary: isPlainObject(raw.feedbackSummary)
      ? {
          painExercises: pickArray(raw.feedbackSummary.painExercises),
          performanceDrops: pickArray(raw.feedbackSummary.performanceDrops),
          improvingIssues: pickArray(raw.feedbackSummary.improvingIssues),
        }
      : { painExercises: [], performanceDrops: [], improvingIssues: [] },
    deloadDecision: sanitizeDeloadDecision(raw.deloadDecision),
    explanations: pickArray(raw.explanations).map(String),
    editedAt: pickString(raw.editedAt) || undefined,
    editHistory: pickArray(raw.editHistory)
      .map((item) => {
        const entry = pickRecord(item);
        const editedAt = pickString(entry.editedAt);
        if (!editedAt) return null;
        const fields = pickArray(entry.fields).map(String).filter(Boolean);
        const editedFields = pickArray(entry.editedFields, fields).map(String).filter(Boolean);
        const changedFields = pickArray(entry.changedFields).map(String).filter(Boolean);
        const editType =
          typeof entry.editType === 'string' && sessionEditTypes.includes(entry.editType as (typeof sessionEditTypes)[number])
            ? entry.editType
            : undefined;
        return {
          id: pickString(entry.id) || undefined,
          editedAt,
          editType,
          fields: fields.length ? fields : editedFields,
          editedFields: editedFields.length ? editedFields : fields,
          changedFields: changedFields.length ? changedFields : undefined,
          note: pickString(entry.note) || undefined,
          reason: pickString(entry.reason) || undefined,
          beforeSummaryText: pickString(entry.beforeSummaryText) || undefined,
          afterSummaryText: pickString(entry.afterSummaryText) || undefined,
          beforeSummary: sanitizeSessionEditSummarySnapshot(entry.beforeSummary),
          afterSummary: sanitizeSessionEditSummarySnapshot(entry.afterSummary),
          affectedStats: pickArray(entry.affectedStats)
            .map(String)
            .filter((stat): stat is (typeof editAffectedStats)[number] => editAffectedStats.includes(stat as (typeof editAffectedStats)[number])),
        };
      })
      .filter(Boolean) as TrainingSession['editHistory'],
  } as TrainingSession;
};

const sanitizeTemplates = (templates: unknown) => {
  const source = Array.isArray(templates) && templates.length ? templates : INITIAL_TEMPLATES;
  const defaultsByTemplate = new Map(INITIAL_TEMPLATES.map((template) => [template.id, template]));
  const normalized = source.map((template) => {
    const raw = pickRecord(template);
    const defaultTemplate = defaultsByTemplate.get(pickString(raw.id));
    if (!defaultTemplate) return raw;
    const defaultsByExercise = new Map(defaultTemplate.exercises.map((exercise) => [exercise.id, exercise]));
    return {
      ...raw,
      name: defaultTemplate.name,
      focus: defaultTemplate.focus,
      note: defaultTemplate.note,
      sourceTemplateId: pickString(raw.sourceTemplateId) || undefined,
      sourceTemplateName: pickString(raw.sourceTemplateName) || undefined,
      updatedAt: pickString(raw.updatedAt) || undefined,
      appliedAt: pickString(raw.appliedAt) || undefined,
      adjustmentSummary: pickString(raw.adjustmentSummary) || undefined,
      isExperimentalTemplate: Boolean(raw.isExperimentalTemplate),
      exercises: pickArray(raw.exercises, defaultTemplate.exercises).map((exercise) => {
        const exerciseRaw = pickRecord(exercise);
        const clean = defaultsByExercise.get(pickString(exerciseRaw.id));
        return clean
          ? {
              ...exerciseRaw,
              name: clean.name,
              alias: clean.alias,
              muscle: clean.muscle,
              alternatives: clean.alternatives,
              alternativeIds: clean.alternativeIds,
              alternativePriorities: clean.alternativePriorities,
            }
          : exerciseRaw;
      }),
    };
  });
  return hydrateTemplates(normalized as never);
};

// Bug #12 修复：sanitizeBodyWeights 原先未校验 date 格式，
// "yesterday" / "2024-13-45" 等非法值能通过 truthy 检查并参与 localeCompare 排序，
// 导致体重曲线按字典序错乱，进而污染热量/进度建议。
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T|$)/;

const sanitizeBodyWeights = (entries: unknown) =>
  pickArray(entries)
    .map((entry) => {
      const raw = pickRecord(entry);
      return {
        date: pickString(raw.date),
        value: Math.max(0, number(raw.value)),
      };
    })
    .filter((entry) => entry.date && entry.value && ISO_DATE_PATTERN.test(entry.date))
    .sort((a, b) => b.date.localeCompare(a.date));

const HEALTH_RAW_BLOCKED_KEYS = new Set(['xmlText', 'fileText', 'rawXml', 'xml', 'document', 'content']);

const sanitizeHealthRaw = (value: unknown, depth = 0): unknown => {
  if (value === undefined || value === null || depth > 2) return undefined;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 24).map((item) => sanitizeHealthRaw(item, depth + 1)).filter((item) => item !== undefined);
  if (!isPlainObject(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !HEALTH_RAW_BLOCKED_KEYS.has(key))
      .map(([key, entry]) => [key, sanitizeHealthRaw(entry, depth + 1)])
      .filter(([, entry]) => entry !== undefined)
  );
};

const sanitizeHealthMetricSamples = (entries: unknown): HealthMetricSample[] =>
  pickArray(entries)
    .map((entry, index) => {
      const raw = pickRecord(entry);
      const metricType = pickString(raw.metricType);
      const value = finiteNumber(raw.value);
      if (!HEALTH_METRIC_TYPES.includes(metricType as (typeof HEALTH_METRIC_TYPES)[number]) || value === undefined) return null;
      const startDate = pickString(raw.startDate);
      if (!startDate) return null;
      return {
        id: pickString(raw.id, `health-sample-${index}`),
        source: pickEnum(raw.source, HEALTH_DATA_SOURCES, 'unknown'),
        sourceName: pickString(raw.sourceName) || undefined,
        deviceSourceName: pickString(raw.deviceSourceName) || undefined,
        metricType: metricType as HealthMetricSample['metricType'],
        startDate,
        endDate: pickString(raw.endDate) || undefined,
        value: Math.max(0, value),
        unit: pickString(raw.unit, ''),
        importedAt: pickString(raw.importedAt, startDate),
        batchId: pickString(raw.batchId) || undefined,
        dataFlag: pickEnum(raw.dataFlag, SESSION_DATA_FLAGS, 'normal'),
        raw: sanitizeHealthRaw(raw.raw),
      };
    })
    .filter(Boolean) as HealthMetricSample[];

const sanitizeImportedWorkoutSamples = (entries: unknown): ImportedWorkoutSample[] =>
  pickArray(entries)
    .map((entry, index) => {
      const raw = pickRecord(entry);
      const startDate = pickString(raw.startDate);
      const endDate = pickString(raw.endDate, startDate);
      const durationMin = finiteNumber(raw.durationMin);
      if (!startDate || !endDate || durationMin === undefined) return null;
      return {
        id: pickString(raw.id, `health-workout-${index}`),
        source: pickEnum(raw.source, HEALTH_DATA_SOURCES, 'unknown'),
        sourceName: pickString(raw.sourceName) || undefined,
        deviceSourceName: pickString(raw.deviceSourceName) || undefined,
        workoutType: pickString(raw.workoutType, '外部活动'),
        startDate,
        endDate,
        durationMin: Math.max(0, durationMin),
        activeEnergyKcal: finiteNumber(raw.activeEnergyKcal),
        avgHeartRate: finiteNumber(raw.avgHeartRate),
        maxHeartRate: finiteNumber(raw.maxHeartRate),
        distanceMeters: finiteNumber(raw.distanceMeters),
        importedAt: pickString(raw.importedAt, startDate),
        batchId: pickString(raw.batchId) || undefined,
        dataFlag: pickEnum(raw.dataFlag, SESSION_DATA_FLAGS, 'normal'),
        raw: sanitizeHealthRaw(raw.raw),
      };
    })
    .filter(Boolean) as ImportedWorkoutSample[];

const sanitizeHealthImportBatches = (entries: unknown): HealthImportBatch[] =>
  pickArray(entries)
    .map((entry, index) => {
      const raw = pickRecord(entry);
      const importedAt = pickString(raw.importedAt);
      if (!importedAt) return null;
      return {
        id: pickString(raw.id, `health-batch-${index}`),
        importedAt,
        source: pickEnum(raw.source, HEALTH_DATA_SOURCES, 'unknown'),
        fileName: pickString(raw.fileName) || undefined,
        sampleCount: Math.max(0, number(raw.sampleCount)),
        workoutCount: Math.max(0, number(raw.workoutCount)),
        newSampleCount: Math.max(0, number(raw.newSampleCount)),
        duplicateSampleCount: Math.max(0, number(raw.duplicateSampleCount)),
        skippedSampleCount: Math.max(0, number(raw.skippedSampleCount)),
        newWorkoutCount: Math.max(0, number(raw.newWorkoutCount)),
        duplicateWorkoutCount: Math.max(0, number(raw.duplicateWorkoutCount)),
        skippedWorkoutCount: Math.max(0, number(raw.skippedWorkoutCount)),
        notes: pickArray(raw.notes).map(String),
        dataFlag: pickEnum(raw.dataFlag, SESSION_DATA_FLAGS, 'normal'),
      };
    })
    .filter(Boolean) as HealthImportBatch[];

const sanitizeDismissedCoachActions = (entries: unknown): DismissedCoachAction[] =>
  pickArray(entries)
    .map((entry) => {
      const raw = pickRecord(entry);
      const actionId = pickString(raw.actionId);
      const dismissedAt = pickString(raw.dismissedAt);
      if (!actionId || !dismissedAt || raw.scope !== 'today') return null;
      return { actionId, dismissedAt, scope: 'today' as const };
    })
    .filter(Boolean) as DismissedCoachAction[];

const sanitizeDismissedDataHealthIssues = (entries: unknown): DismissedDataHealthIssue[] =>
  pickArray(entries)
    .map((entry) => {
      const raw = pickRecord(entry);
      const issueId = pickString(raw.issueId);
      const dismissedAt = pickString(raw.dismissedAt);
      if (!issueId || !dismissedAt || raw.scope !== 'today') return null;
      return { issueId, dismissedAt, scope: 'today' as const };
    })
    .filter(Boolean) as DismissedDataHealthIssue[];

const PENDING_SESSION_PATCH_STATUSES = ['pending', 'consumed', 'dismissed', 'expired'] as const;
const SESSION_PATCH_TYPES = [
  'reduce_support',
  'main_only',
  'reduce_intensity',
  'reduce_volume',
  'substitute_exercise',
  'extend_rest',
  'skip_optional',
] as const;

const sanitizePendingSessionPatches = (entries: unknown): PendingSessionPatch[] =>
  pickArray(entries)
    .map((entry) => {
      const raw = pickRecord(entry);
      const id = pickString(raw.id);
      const createdAt = pickString(raw.createdAt);
      const status = pickEnum(raw.status, PENDING_SESSION_PATCH_STATUSES, 'pending');
      const patches = pickArray(raw.patches)
        .map((patch) => {
          const patchRaw = pickRecord(patch);
          const patchId = pickString(patchRaw.id);
          const patchType = typeof patchRaw.type === 'string' && SESSION_PATCH_TYPES.includes(patchRaw.type as typeof SESSION_PATCH_TYPES[number])
            ? patchRaw.type as typeof SESSION_PATCH_TYPES[number]
            : '';
          const title = pickString(patchRaw.title);
          const description = pickString(patchRaw.description);
          const reason = pickString(patchRaw.reason);
          if (!patchId || !patchType || !title || !description || !reason) return null;
          return {
            id: patchId,
            type: patchType,
            targetId: pickString(patchRaw.targetId) || undefined,
            title,
            description,
            reason,
            reversible: typeof patchRaw.reversible === 'boolean' ? patchRaw.reversible : true,
          };
        })
        .filter(Boolean) as PendingSessionPatch['patches'];
      if (!id || !createdAt || !patches.length) return null;
      return {
        id,
        createdAt,
        sourceCoachActionId: pickString(raw.sourceCoachActionId) || undefined,
        sourceFingerprint: pickString(raw.sourceFingerprint) || undefined,
        targetTemplateId: pickString(raw.targetTemplateId) || undefined,
        patches,
        status,
        consumedAt: pickString(raw.consumedAt) || undefined,
        dismissedAt: pickString(raw.dismissedAt) || undefined,
        expiredAt: pickString(raw.expiredAt) || undefined,
      };
    })
    .filter(Boolean) as PendingSessionPatch[];

const sanitizeDataRepairLogs = (entries: unknown): DataRepairLogEntry[] =>
  pickArray(entries)
    .map((entry) => {
      const raw = pickRecord(entry);
      const id = pickString(raw.id);
      const createdAt = pickString(raw.createdAt);
      const category = pickString(raw.category);
      const action = pickString(raw.action);
      if (!id || !createdAt || !category || !action) return null;
      return {
        id,
        createdAt,
        repairId: pickString(raw.repairId) || undefined,
        repairedAt: pickString(raw.repairedAt) || undefined,
        sourceFileName: pickString(raw.sourceFileName) || undefined,
        category,
        action,
        affectedIds: pickStringArray(raw.affectedIds).slice(0, 100),
        beforeSummary: pickString(raw.beforeSummary) || undefined,
        afterSummary: pickString(raw.afterSummary) || undefined,
        before: raw.before,
        after: raw.after,
      };
    })
    .filter(Boolean)
    .slice(-200) as DataRepairLogEntry[];

const sanitizeTodayStatus = (status: unknown): TodayStatus => {
  const raw = pickRecord(status);
  return {
    ...DEFAULT_STATUS,
    ...raw,
    sleep: pickEnum(normalizeTextValue(raw.sleep), SLEEP_STATES, DEFAULT_STATUS.sleep),
    energy: pickEnum(normalizeTextValue(raw.energy), ENERGY_STATES, DEFAULT_STATUS.energy),
    soreness: normalizeSoreness(pickArray(raw.soreness, DEFAULT_STATUS.soreness).map(normalizeTextValue)),
    time: pickString(raw.time, DEFAULT_STATUS.time) as TodayStatus['time'],
    date: pickString(raw.date),
  };
};

export const sanitizeData = (saved: unknown): AppData => {
  const migrated = migrateTrainingData(saved);
  const history = pickArray(migrated.history).map(sanitizeSessionLog).filter(Boolean) as TrainingSession[];
  const activeSession = sanitizeSessionLog(migrated.activeSession);
  const templates = sanitizeTemplates(migrated.templates);
  const selectedCandidate = pickString(migrated.selectedTemplateId, 'push-a');
  const selectedTemplateId = templates.some((template) => template.id === selectedCandidate) ? selectedCandidate : templates[0]?.id || 'push-a';
  const activeCandidate = pickString(migrated.activeProgramTemplateId, pickString(pickRecord(migrated.settings).activeProgramTemplateId));
  const activeProgramTemplateId = templates.some((template) => template.id === activeCandidate) ? activeCandidate : selectedTemplateId;
  const trainingMode = normalizeTrainingMode(migrated.trainingMode, 'hybrid');
  const unitSettings = sanitizeUnitSettings(migrated.unitSettings ?? pickRecord(migrated.settings).unitSettings ?? DEFAULT_UNIT_SETTINGS);
  const programAdjustmentDrafts = sanitizeProgramAdjustmentDrafts(migrated.programAdjustmentDrafts);
  const programAdjustmentHistory = sanitizeProgramAdjustmentHistory(migrated.programAdjustmentHistory);
  const healthMetricSamples = sanitizeHealthMetricSamples(migrated.healthMetricSamples ?? pickRecord(migrated.settings).healthMetricSamples);
  const importedWorkoutSamples = sanitizeImportedWorkoutSamples(migrated.importedWorkoutSamples ?? pickRecord(migrated.settings).importedWorkoutSamples);
  const healthImportBatches = sanitizeHealthImportBatches(migrated.healthImportBatches ?? pickRecord(migrated.settings).healthImportBatches);
  const healthIntegrationSettings = sanitizeHealthIntegrationSettings(pickRecord(migrated.settings).healthIntegrationSettings);
  const dismissedCoachActions = sanitizeDismissedCoachActions(
    migrated.dismissedCoachActions ?? pickRecord(migrated.settings).dismissedCoachActions,
  );
  const dismissedDataHealthIssues = sanitizeDismissedDataHealthIssues(
    migrated.dismissedDataHealthIssues ?? pickRecord(migrated.settings).dismissedDataHealthIssues,
  );
  const pendingSessionPatches = sanitizePendingSessionPatches(
    migrated.pendingSessionPatches ?? pickRecord(migrated.settings).pendingSessionPatches,
  );
  const dataRepairLogs = sanitizeDataRepairLogs(pickRecord(migrated.settings).dataRepairLogs);
  const sanitized: AppData = {
    schemaVersion: STORAGE_VERSION,
    templates,
    history,
    bodyWeights: sanitizeBodyWeights(migrated.bodyWeights),
    activeSession: activeSession?.completed ? null : activeSession,
    selectedTemplateId,
    trainingMode,
    unitSettings,
    todayStatus: sanitizeTodayStatus(migrated.todayStatus),
    userProfile: sanitizeUserProfile(migrated.userProfile),
    screeningProfile: sanitizeScreeningProfile(migrated.screeningProfile, history),
    programTemplate: sanitizeProgramTemplate(migrated.programTemplate),
    mesocyclePlan: sanitizeMesocyclePlan(migrated.mesocyclePlan as MesocyclePlan | undefined),
    programAdjustmentDrafts,
    programAdjustmentHistory,
    activeProgramTemplateId,
    healthMetricSamples,
    importedWorkoutSamples,
    healthImportBatches,
    dismissedCoachActions,
    dismissedDataHealthIssues,
    pendingSessionPatches,
    settings: {
      ...pickRecord(migrated.settings),
      schemaVersion: STORAGE_VERSION,
      selectedTemplateId,
      trainingMode,
      unitSettings,
      healthIntegrationSettings,
      activeProgramTemplateId,
      dismissedCoachActions,
      dismissedDataHealthIssues,
      pendingSessionPatches,
      dataRepairLogs,
    },
  };

  if (!validateAppDataSchema(sanitized)) {
    console.warn('IronPath app data schema validation required repair.', validateAppDataSchema.errors);
    sanitized.templates = sanitizeTemplates(sanitized.templates);
    sanitized.history = pickArray(sanitized.history).map(sanitizeSessionLog).filter(Boolean) as TrainingSession[];
    sanitized.activeSession = sanitizeSessionLog(sanitized.activeSession);
    sanitized.todayStatus = sanitizeTodayStatus(sanitized.todayStatus);
    sanitized.bodyWeights = sanitizeBodyWeights(sanitized.bodyWeights);
    sanitized.userProfile = sanitizeUserProfile(sanitized.userProfile);
    sanitized.screeningProfile = sanitizeScreeningProfile(sanitized.screeningProfile, sanitized.history);
    sanitized.programTemplate = sanitizeProgramTemplate(sanitized.programTemplate);
    sanitized.mesocyclePlan = sanitizeMesocyclePlan(sanitized.mesocyclePlan);
    sanitized.programAdjustmentDrafts = sanitizeProgramAdjustmentDrafts(sanitized.programAdjustmentDrafts);
    sanitized.programAdjustmentHistory = sanitizeProgramAdjustmentHistory(sanitized.programAdjustmentHistory);
    sanitized.healthMetricSamples = sanitizeHealthMetricSamples(sanitized.healthMetricSamples);
    sanitized.importedWorkoutSamples = sanitizeImportedWorkoutSamples(sanitized.importedWorkoutSamples);
    sanitized.healthImportBatches = sanitizeHealthImportBatches(sanitized.healthImportBatches);
    sanitized.dismissedCoachActions = sanitizeDismissedCoachActions(sanitized.dismissedCoachActions);
    sanitized.dismissedDataHealthIssues = sanitizeDismissedDataHealthIssues(sanitized.dismissedDataHealthIssues);
    sanitized.pendingSessionPatches = sanitizePendingSessionPatches(sanitized.pendingSessionPatches);
    sanitized.settings.dataRepairLogs = sanitizeDataRepairLogs(sanitized.settings.dataRepairLogs);
    sanitized.settings.healthIntegrationSettings = sanitizeHealthIntegrationSettings(sanitized.settings.healthIntegrationSettings);
    sanitized.activeProgramTemplateId = sanitized.templates.some((template) => template.id === sanitized.activeProgramTemplateId)
      ? sanitized.activeProgramTemplateId
      : sanitized.selectedTemplateId;
    sanitized.settings = {
      ...pickRecord(sanitized.settings),
      schemaVersion: STORAGE_VERSION,
      selectedTemplateId: sanitized.selectedTemplateId,
      trainingMode: sanitized.trainingMode,
      unitSettings: sanitized.unitSettings,
      healthIntegrationSettings: sanitized.settings.healthIntegrationSettings,
      activeProgramTemplateId: sanitized.activeProgramTemplateId,
      dismissedCoachActions: sanitized.dismissedCoachActions,
      dismissedDataHealthIssues: sanitized.dismissedDataHealthIssues,
      pendingSessionPatches: sanitized.pendingSessionPatches,
      dataRepairLogs: sanitized.settings.dataRepairLogs,
    };
  }

  return sanitized;
};

export const emptyData = (): AppData =>
  sanitizeData({
    schemaVersion: STORAGE_VERSION,
    templates: INITIAL_TEMPLATES,
    history: [],
    bodyWeights: [],
    activeSession: null,
    selectedTemplateId: 'push-a',
    trainingMode: 'hybrid',
    unitSettings: DEFAULT_UNIT_SETTINGS,
    todayStatus: DEFAULT_STATUS,
    userProfile: DEFAULT_USER_PROFILE,
    screeningProfile: DEFAULT_SCREENING_PROFILE,
    programTemplate: DEFAULT_PROGRAM_TEMPLATE,
    mesocyclePlan: DEFAULT_MESOCYCLE_PLAN,
    programAdjustmentDrafts: [],
    programAdjustmentHistory: [],
    activeProgramTemplateId: undefined,
    healthMetricSamples: [],
    importedWorkoutSamples: [],
    healthImportBatches: [],
    dismissedCoachActions: [],
    dismissedDataHealthIssues: [],
    pendingSessionPatches: [],
    settings: { healthIntegrationSettings: DEFAULT_HEALTH_INTEGRATION_SETTINGS, dataRepairLogs: [] },
  });
