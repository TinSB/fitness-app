import type {
  AdaptiveState,
  AppData,
  ExercisePrescription,
  HealthIntegrationSettings,
  HealthMetricSample,
  ImportedWorkoutSample,
  ScreeningProfile,
  TrainingSession,
} from '../models/training-model';
import {
  DATA_HEALTH_HEALTH_DATA_STALE_DAYS,
  DATA_HEALTH_IMPOSSIBLE_DURATION_MIN,
  DATA_HEALTH_ISSUE_SCORE_HARD_CAP,
  DATA_HEALTH_ISSUE_SCORE_SOFT_CAP,
  DATA_HEALTH_TODAY_STATUS_STALE_DAYS,
  type DataHealthRuntimeFlags,
} from './appDataRepairTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RuntimeGuardClock {
  now: () => Date;
}

export const defaultGuardClock: RuntimeGuardClock = { now: () => new Date() };

const parseIso = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const daysBetween = (later: Date, earlier: Date): number =>
  Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);

export interface SessionLifecycleGuardOutcome {
  session: TrainingSession;
  changed: boolean;
}

export const applySessionLifecycleGuard = (session: TrainingSession): SessionLifecycleGuardOutcome => {
  if (!session?.completed) return { session, changed: false };
  let changed = false;
  let next: TrainingSession = session;
  if (next.restTimerState && next.restTimerState.isRunning) {
    next = { ...next, restTimerState: { ...next.restTimerState, isRunning: false } };
    changed = true;
  }
  if (typeof next.currentExerciseId === 'string' && next.currentExerciseId.length > 0) {
    next = { ...next, currentExerciseId: '' };
    changed = true;
  }
  if (
    typeof next.currentFocusStepId === 'string' &&
    next.currentFocusStepId.length > 0 &&
    next.currentFocusStepId !== 'completed'
  ) {
    next = { ...next, currentFocusStepId: 'completed' };
    changed = true;
  }
  if (
    typeof next.currentSetIndex === 'number' &&
    next.currentSetIndex !== 0 &&
    next.currentSetIndex !== -1
  ) {
    next = { ...next, currentSetIndex: -1 };
    changed = true;
  }
  if (Array.isArray(next.focusActualSetDrafts) && next.focusActualSetDrafts.length > 0) {
    next = { ...next, focusActualSetDrafts: [] };
    changed = true;
  }
  return { session: next, changed };
};

export interface DurationGuardOutcome {
  derivedDurationMin?: number;
  durationInvalid: boolean;
  rawDurationMin?: number;
  rawSpanMin?: number;
}

export const applyDurationGuard = (session: TrainingSession): DurationGuardOutcome => {
  const rawDuration = typeof session.durationMin === 'number' ? session.durationMin : undefined;
  const started = parseIso(session.startedAt);
  const finished = parseIso(session.finishedAt);
  const rawSpanMin =
    started && finished
      ? Math.max(0, (finished.getTime() - started.getTime()) / 60000)
      : undefined;
  const durationOutOfRange =
    rawDuration !== undefined && rawDuration > DATA_HEALTH_IMPOSSIBLE_DURATION_MIN;
  const spanOutOfRange =
    rawSpanMin !== undefined && rawSpanMin > DATA_HEALTH_IMPOSSIBLE_DURATION_MIN * 1.5;
  if (!durationOutOfRange && !spanOutOfRange) {
    return {
      derivedDurationMin: rawDuration,
      durationInvalid: false,
      rawDurationMin: rawDuration,
      rawSpanMin,
    };
  }
  if (rawSpanMin !== undefined && rawSpanMin <= DATA_HEALTH_IMPOSSIBLE_DURATION_MIN) {
    return {
      derivedDurationMin: Math.round(rawSpanMin),
      durationInvalid: false,
      rawDurationMin: rawDuration,
      rawSpanMin,
    };
  }
  return {
    derivedDurationMin: undefined,
    durationInvalid: true,
    rawDurationMin: rawDuration,
    rawSpanMin,
  };
};

export interface TodayStatusGuardOutcome {
  ignoredForCurrentReadiness: boolean;
  daysOld?: number;
  observedDate?: string;
}

export const applyTodayStatusGuard = (
  appData: AppData,
  clock: RuntimeGuardClock = defaultGuardClock,
): TodayStatusGuardOutcome => {
  const status = appData.todayStatus;
  if (!status?.date) {
    return { ignoredForCurrentReadiness: false };
  }
  const parsed = parseIso(status.date);
  if (!parsed) {
    return { ignoredForCurrentReadiness: false, observedDate: status.date };
  }
  const today = clock.now();
  today.setUTCHours(0, 0, 0, 0);
  const daysOld = daysBetween(today, parsed);
  if (daysOld > DATA_HEALTH_TODAY_STATUS_STALE_DAYS) {
    return { ignoredForCurrentReadiness: true, daysOld, observedDate: status.date };
  }
  return { ignoredForCurrentReadiness: false, daysOld, observedDate: status.date };
};

export interface HealthDataGuardOutcome {
  staleForReadiness: boolean;
  latestSampleAt?: string;
  daysOld?: number;
  useHealthDataForReadiness: boolean;
}

const latestHealthDate = (
  samples: HealthMetricSample[] | undefined,
  workouts: ImportedWorkoutSample[] | undefined,
): Date | undefined => {
  const candidates: number[] = [];
  (samples || []).forEach((s) => {
    const parsed = parseIso(s.startDate);
    if (parsed) candidates.push(parsed.getTime());
  });
  (workouts || []).forEach((w) => {
    const parsed = parseIso(w.startDate);
    if (parsed) candidates.push(parsed.getTime());
  });
  if (!candidates.length) return undefined;
  return new Date(Math.max(...candidates));
};

export const applyHealthDataGuard = (
  appData: AppData,
  clock: RuntimeGuardClock = defaultGuardClock,
): HealthDataGuardOutcome => {
  const integration = (appData.settings?.healthIntegrationSettings || {}) as Partial<HealthIntegrationSettings>;
  const useHealthDataForReadiness = integration.useHealthDataForReadiness !== false;
  const latest = latestHealthDate(appData.healthMetricSamples, appData.importedWorkoutSamples);
  if (!latest) {
    return { staleForReadiness: false, useHealthDataForReadiness };
  }
  const today = clock.now();
  today.setUTCHours(0, 0, 0, 0);
  const daysOld = daysBetween(today, latest);
  const staleForReadiness =
    useHealthDataForReadiness && daysOld > DATA_HEALTH_HEALTH_DATA_STALE_DAYS;
  return {
    staleForReadiness,
    useHealthDataForReadiness,
    latestSampleAt: latest.toISOString(),
    daysOld,
  };
};

export interface IssueScoreCapOutcome {
  cappedScores: AdaptiveState['issueScores'];
  changes: Array<{ key: string; before: number; after: number }>;
  movementFlagsAllGood: boolean;
}

const movementFlagsAllGood = (screening: ScreeningProfile | undefined): boolean => {
  const flags = screening?.movementFlags || {};
  const values = Object.values(flags);
  if (!values.length) return false;
  return values.every((value) => value === 'good');
};

const noPainOrRestriction = (screening: ScreeningProfile | undefined): boolean => {
  if (!screening) return false;
  if ((screening.painTriggers || []).length > 0) return false;
  if ((screening.restrictedExercises || []).length > 0) return false;
  return true;
};

export const applyIssueScoreCap = (screening: ScreeningProfile | undefined): IssueScoreCapOutcome => {
  const baseScores = (screening?.adaptiveState?.issueScores || {}) as AdaptiveState['issueScores'];
  const allGood = movementFlagsAllGood(screening) && noPainOrRestriction(screening);
  const softCappable = allGood;
  const changes: Array<{ key: string; before: number; after: number }> = [];
  const next: AdaptiveState['issueScores'] = { ...baseScores };
  Object.entries(baseScores).forEach(([key, value]) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    if (softCappable && value > DATA_HEALTH_ISSUE_SCORE_SOFT_CAP) {
      next[key] = DATA_HEALTH_ISSUE_SCORE_SOFT_CAP;
      changes.push({ key, before: value, after: DATA_HEALTH_ISSUE_SCORE_SOFT_CAP });
      return;
    }
    if (value > DATA_HEALTH_ISSUE_SCORE_HARD_CAP) {
      next[key] = DATA_HEALTH_ISSUE_SCORE_HARD_CAP;
      changes.push({ key, before: value, after: DATA_HEALTH_ISSUE_SCORE_HARD_CAP });
    }
  });
  return { cappedScores: next, changes, movementFlagsAllGood: allGood };
};

export interface PerformanceDropOutcome {
  filteredDrops: string[];
  removed: string[];
}

export const applyPerformanceDropGuard = (
  screening: ScreeningProfile | undefined,
  history: TrainingSession[],
): PerformanceDropOutcome => {
  const drops = screening?.adaptiveState?.performanceDrops || [];
  if (!drops.length) return { filteredDrops: [], removed: [] };
  const recent = (history || []).slice(-4);
  const removed: string[] = [];
  const filteredDrops = drops.filter((exerciseId) => {
    let onTargetCount = 0;
    let observedCount = 0;
    recent.forEach((session) => {
      (session.exercises || []).forEach((exercise) => {
        if (exercise.actualExerciseId === exerciseId || exercise.id === exerciseId) {
          observedCount += 1;
          const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
          const completedSets = sets.filter((s) => s.done === true).length;
          if (completedSets >= 2) onTargetCount += 1;
        }
      });
    });
    if (observedCount >= 2 && onTargetCount >= 2) {
      removed.push(exerciseId);
      return false;
    }
    return true;
  });
  return { filteredDrops, removed };
};

export interface LegacyAdviceStripOutcome {
  exercise: ExercisePrescription;
  changed: boolean;
}

export const stripLegacyAdviceFromExercise = (exercise: ExercisePrescription): LegacyAdviceStripOutcome => {
  let changed = false;
  let next: ExercisePrescription = exercise;
  const fields: Array<keyof ExercisePrescription> = ['suggestion', 'adjustment', 'warning'];
  fields.forEach((field) => {
    if (typeof next[field] === 'string' && String(next[field]).length > 0) {
      next = { ...next, [field]: undefined };
      changed = true;
    }
  });
  const prescription = (next.prescription || {}) as Record<string, unknown>;
  if (prescription && typeof prescription.weeklyAdjustment === 'string') {
    const { weeklyAdjustment: _omit, ...rest } = prescription;
    next = { ...next, prescription: rest as ExercisePrescription['prescription'] };
    changed = true;
  }
  return { exercise: next, changed };
};

export interface LegacySessionStripOutcome {
  session: TrainingSession;
  changed: boolean;
}

export const stripLegacyAdviceFromSession = (session: TrainingSession): LegacySessionStripOutcome => {
  let changed = false;
  let next: TrainingSession = session;
  if (Array.isArray(next.explanations) && next.explanations.length > 0) {
    next = { ...next, explanations: [] };
    changed = true;
  }
  if (next.deloadDecision) {
    next = { ...next, deloadDecision: undefined };
    changed = true;
  }
  if (Array.isArray(next.exercises)) {
    let exercisesChanged = false;
    const nextExercises = next.exercises.map((exercise) => {
      const result = stripLegacyAdviceFromExercise(exercise);
      if (result.changed) exercisesChanged = true;
      return result.exercise;
    });
    if (exercisesChanged) {
      next = { ...next, exercises: nextExercises };
      changed = true;
    }
  }
  return { session: next, changed };
};

export const readRuntimeFlags = (appData: AppData): DataHealthRuntimeFlags => {
  const settings = (appData.settings || {}) as { dataHealthRuntimeFlags?: DataHealthRuntimeFlags };
  return settings.dataHealthRuntimeFlags || {};
};

export const writeRuntimeFlags = (
  appData: AppData,
  next: DataHealthRuntimeFlags,
): AppData => ({
  ...appData,
  settings: {
    ...(appData.settings || {}),
    dataHealthRuntimeFlags: next,
  },
});
