// dailyTrainingAdjustmentEngine — signal-only after Training Recommendation
// Hard Rewrite V2. Legacy user-facing text fields (`title`, `summary`, and
// the user-facing `reason` text array) are deleted; the engine now returns
// structured reason codes and numeric / enum suggestedChanges only.
//
// See docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md §2.2.

import type { PainPattern, ReadinessResult, TrainingSession, TrainingTemplate } from '../models/training-model';
import type { HealthSummary } from './healthSummaryEngine';
import type { LoadFeedbackSummary } from './loadFeedbackEngine';
import type { AutoTrainingLevel } from './trainingLevelEngine';
import { number, sessionCompletedSets, sessionVolume } from './engineUtils';
import { buildTemplateBodyPartConflictScore } from './recoveryAwareScheduler';

export type DailyTrainingAdjustmentType =
  | 'normal'
  | 'conservative'
  | 'deload_like'
  | 'main_only'
  | 'reduce_support'
  | 'substitute_risky_exercises'
  | 'rest_or_recovery';

export type DailyTrainingAdjustmentChangeType =
  | 'reduce_volume'
  | 'reduce_support'
  | 'keep_main_lifts'
  | 'substitute_exercise'
  | 'extend_rest'
  | 'skip_optional';

export interface DailyTrainingAdjustmentChange {
  type: DailyTrainingAdjustmentChangeType;
  targetId?: string;
  /** Structured reason code (no user-facing text). */
  code: string;
}

export interface DailyTrainingAdjustment {
  type: DailyTrainingAdjustmentType;
  /** Structured reason codes. No user-facing copy. */
  reasons: string[];
  suggestedChanges: DailyTrainingAdjustmentChange[];
  confidence: 'low' | 'medium' | 'high';
  requiresUserConfirmation: boolean;
}

export type Previous24hActivityInput =
  | number
  | Partial<{
      workoutMinutes: number;
      activeEnergyKcal: number;
      highActivity: boolean;
    }>;

export type BuildDailyTrainingAdjustmentInput = {
  readinessResult?: ReadinessResult | null;
  healthSummary?: HealthSummary | null;
  previous24hActivity?: Previous24hActivityInput | null;
  recentHistory?: TrainingSession[];
  painPatterns?: PainPattern[];
  sorenessAreas?: string[];
  painAreas?: string[];
  loadFeedbackSummary?: LoadFeedbackSummary | LoadFeedbackSummary[] | Record<string, LoadFeedbackSummary> | null;
  trainingLevel?: AutoTrainingLevel | string;
  activeTemplate?: TrainingTemplate | null;
};

type Signal = {
  id: string;
  priority: number;
  code: string;
  change?: DailyTrainingAdjustmentChange;
};

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

const templateExerciseIds = (template?: TrainingTemplate | null) =>
  new Set((template?.exercises || []).flatMap((exercise) => [exercise.id, exercise.baseId, exercise.canonicalExerciseId].filter(Boolean).map(String)));

const activityMinutes = (value?: Previous24hActivityInput | null, healthSummary?: HealthSummary | null) => {
  if (typeof value === 'number') return value;
  if (value?.workoutMinutes !== undefined) return number(value.workoutMinutes);
  return number(healthSummary?.activityLoad?.previous24hWorkoutMinutes);
};

const activityKcal = (value?: Previous24hActivityInput | null, healthSummary?: HealthSummary | null) => {
  if (typeof value === 'number') return 0;
  if (value?.activeEnergyKcal !== undefined) return number(value.activeEnergyKcal);
  return number(healthSummary?.activityLoad?.previous24hActiveEnergyKcal);
};

const isHighActivity = (value?: Previous24hActivityInput | null, healthSummary?: HealthSummary | null) => {
  if (typeof value === 'object' && value?.highActivity === true) return true;
  const minutes = activityMinutes(value, healthSummary);
  const kcal = activityKcal(value, healthSummary);
  return Boolean(healthSummary?.activityLoad?.previous24hHighActivity) || minutes >= 60 || kcal >= 500;
};

const healthSignals = (healthSummary?: HealthSummary | null): Signal[] => {
  const signals: Signal[] = [];
  if (!healthSummary) return signals;
  if (healthSummary.latestSleepHours !== undefined && healthSummary.latestSleepHours < 6) {
    signals.push({
      id: 'low-sleep',
      priority: 70,
      code: 'low_sleep',
      change: { type: 'extend_rest', code: 'extend_rest_low_sleep' },
    });
  }
  const notes = (healthSummary.notes || []).join(' ');
  if (/HRV.*低|低于/.test(notes)) {
    signals.push({
      id: 'low-hrv',
      priority: 65,
      code: 'low_hrv',
      change: { type: 'reduce_volume', code: 'reduce_volume_low_hrv' },
    });
  }
  if (/静息心率.*高|高于/.test(notes)) {
    signals.push({
      id: 'high-resting-heart-rate',
      priority: 65,
      code: 'high_resting_heart_rate',
      change: { type: 'extend_rest', code: 'extend_rest_high_rhr' },
    });
  }
  return signals;
};

const readinessSignals = (readinessResult?: ReadinessResult | null): Signal[] => {
  if (!readinessResult) return [];
  if (readinessResult.trainingAdjustment === 'recovery' || readinessResult.score < 45) {
    return [
      {
        id: 'readiness-recovery',
        priority: 100,
        code: 'readiness_recovery',
        change: { type: 'reduce_volume', code: 'reduce_volume_recovery' },
      },
    ];
  }
  if (readinessResult.trainingAdjustment === 'conservative' || readinessResult.score < 65) {
    return [
      {
        id: 'readiness-conservative',
        priority: 80,
        code: 'readiness_conservative',
        change: { type: 'reduce_volume', code: 'reduce_volume_conservative' },
      },
    ];
  }
  return [];
};

const activitySignals = (previous24hActivity?: Previous24hActivityInput | null, healthSummary?: HealthSummary | null): Signal[] => {
  if (!isHighActivity(previous24hActivity, healthSummary)) return [];
  return [
    {
      id: 'previous-24h-high-activity',
      priority: 75,
      code: 'previous_24h_high_activity',
      change: { type: 'reduce_support', code: 'reduce_support_high_activity' },
    },
  ];
};

const painSignals = (painPatterns: PainPattern[] = [], activeTemplate?: TrainingTemplate | null): Signal[] => {
  const ids = templateExerciseIds(activeTemplate);
  return painPatterns
    .filter((pattern) => {
      if (pattern.suggestedAction === 'watch' && number(pattern.severityAvg) < 3) return false;
      if (!pattern.exerciseId) return true;
      return !ids.size || ids.has(pattern.exerciseId);
    })
    .slice(0, 3)
    .map((pattern, index) => ({
      id: `pain-${pattern.exerciseId || pattern.area || index}`,
      priority: pattern.suggestedAction === 'seek_professional' || pattern.suggestedAction === 'deload' ? 95 : 85,
      code: pattern.suggestedAction === 'seek_professional' ? 'pain_seek_professional' : pattern.suggestedAction === 'deload' ? 'pain_deload' : 'pain_recurring',
      change: {
        type: 'substitute_exercise' as const,
        targetId: pattern.exerciseId,
        code: 'substitute_pain_risk',
      },
    }));
};

const recoveryConflictSignals = (
  activeTemplate?: TrainingTemplate | null,
  sorenessAreas: string[] = [],
  painAreas: string[] = [],
): Signal[] => {
  if (!activeTemplate || (!sorenessAreas.length && !painAreas.length)) return [];
  const conflict = buildTemplateBodyPartConflictScore({ template: activeTemplate, sorenessAreas, painAreas });
  if (conflict.level === 'none' || conflict.level === 'low') return [];
  if (conflict.level === 'high') {
    return [
      {
        id: 'recovery-template-high-conflict',
        priority: 98,
        code: 'recovery_template_high_conflict',
        change: { type: 'reduce_volume', code: 'reduce_volume_high_conflict' },
      },
    ];
  }
  return [
    {
      id: 'recovery-template-moderate-conflict',
      priority: 82,
      code: 'recovery_template_moderate_conflict',
      change: { type: 'reduce_support', code: 'reduce_support_moderate_conflict' },
    },
  ];
};

const normalizeLoadFeedbackSummaries = (
  value?: LoadFeedbackSummary | LoadFeedbackSummary[] | Record<string, LoadFeedbackSummary> | null,
) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (isLoadFeedbackSummary(value)) return [value];
  return Object.values(value).filter(isLoadFeedbackSummary);
};

const isLoadFeedbackSummary = (value: unknown): value is LoadFeedbackSummary =>
  typeof value === 'object' &&
  value !== null &&
  'adjustment' in value &&
  'counts' in value;

const loadFeedbackSignals = (
  loadFeedbackSummary?: LoadFeedbackSummary | LoadFeedbackSummary[] | Record<string, LoadFeedbackSummary> | null,
  activeTemplate?: TrainingTemplate | null,
): Signal[] => {
  const ids = templateExerciseIds(activeTemplate);
  return normalizeLoadFeedbackSummaries(loadFeedbackSummary)
    .filter((summary) => summary.adjustment.direction === 'conservative' || summary.dominantFeedback === 'too_heavy' || summary.counts.too_heavy >= 2)
    .filter((summary) => !summary.exerciseId || !ids.size || ids.has(summary.exerciseId))
    .slice(0, 3)
    .map((summary, index) => ({
      id: `load-feedback-${summary.exerciseId || index}`,
      priority: 60,
      code: 'load_feedback_too_heavy',
      change: {
        type: 'reduce_volume' as const,
        targetId: summary.exerciseId,
        code: 'reduce_volume_load_feedback',
      },
    }));
};

const trainingLevelSignals = (trainingLevel?: AutoTrainingLevel | string): Signal[] => {
  if (trainingLevel !== 'unknown') return [];
  return [
    {
      id: 'unknown-training-level',
      priority: 55,
      code: 'unknown_training_level',
      change: { type: 'keep_main_lifts', code: 'keep_main_lifts_unknown_level' },
    },
  ];
};

const historySortKey = (session: TrainingSession) => session.finishedAt || session.startedAt || session.date || '';

const historySignals = (recentHistory: TrainingSession[] = []): Signal[] => {
  const normal = [...recentHistory]
    .filter((session) => session.dataFlag !== 'test' && session.dataFlag !== 'excluded')
    .filter((session) => session.completed !== false)
    .sort((left, right) => String(historySortKey(right)).localeCompare(String(historySortKey(left))));
  const latest = normal.find((session) => sessionCompletedSets(session) > 0 || sessionVolume(session) > 0);
  if (!latest) return [];
  const sets = sessionCompletedSets(latest);
  const volume = sessionVolume(latest);
  if (sets >= 18 || volume >= 8000) {
    return [
      {
        id: 'recent-high-volume',
        priority: 58,
        code: 'recent_high_volume',
        change: { type: 'skip_optional', code: 'skip_optional_high_volume' },
      },
    ];
  }
  return [];
};

const confidenceFor = (signals: Signal[], healthSummary?: HealthSummary | null): DailyTrainingAdjustment['confidence'] => {
  if (signals.length >= 2 && healthSummary?.confidence === 'high') return 'high';
  if (signals.length >= 2 || healthSummary?.confidence === 'medium') return 'medium';
  return signals.length ? 'medium' : 'high';
};

const typeForSignals = (signals: Signal[]): DailyTrainingAdjustmentType => {
  if (!signals.length) return 'normal';
  if (signals.some((signal) => signal.id === 'readiness-recovery')) return 'rest_or_recovery';
  if (signals.some((signal) => signal.id === 'recovery-template-high-conflict')) return 'rest_or_recovery';
  if (signals.some((signal) => signal.id === 'recovery-template-moderate-conflict')) return 'conservative';
  if (signals.some((signal) => signal.id.startsWith('pain-'))) return 'substitute_risky_exercises';
  if (signals.some((signal) => signal.id === 'previous-24h-high-activity')) return 'reduce_support';
  if (signals.some((signal) => signal.id === 'recent-high-volume')) return 'main_only';
  if (signals.some((signal) =>
    signal.id === 'readiness-conservative' ||
    signal.id === 'low-sleep' ||
    signal.id === 'low-hrv' ||
    signal.id === 'high-resting-heart-rate' ||
    signal.id.startsWith('load-feedback-') ||
    signal.id === 'unknown-training-level',
  )) {
    return 'conservative';
  }
  return 'normal';
};

export const buildDailyTrainingAdjustment = ({
  readinessResult,
  healthSummary,
  previous24hActivity,
  recentHistory = [],
  painPatterns = [],
  sorenessAreas = [],
  painAreas = [],
  loadFeedbackSummary,
  trainingLevel,
  activeTemplate,
}: BuildDailyTrainingAdjustmentInput): DailyTrainingAdjustment => {
  const signals = [
    ...readinessSignals(readinessResult),
    ...healthSignals(healthSummary),
    ...activitySignals(previous24hActivity, healthSummary),
    ...recoveryConflictSignals(activeTemplate, sorenessAreas, painAreas),
    ...painSignals(painPatterns, activeTemplate),
    ...loadFeedbackSignals(loadFeedbackSummary, activeTemplate),
    ...trainingLevelSignals(trainingLevel),
    ...historySignals(recentHistory),
  ].sort((left, right) => right.priority - left.priority);

  const type = typeForSignals(signals);
  const suggestedChanges = signals.flatMap((signal) => (signal.change ? [signal.change] : []));

  return {
    type,
    reasons: signals.length ? unique(signals.map((signal) => signal.code)).slice(0, 6) : ['no_constraints'],
    suggestedChanges,
    confidence: confidenceFor(signals, healthSummary),
    requiresUserConfirmation: type !== 'normal',
  };
};
