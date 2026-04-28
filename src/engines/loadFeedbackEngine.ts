import type { LoadFeedback, LoadFeedbackValue, TrainingSession } from '../models/training-model';

export type LoadFeedbackAdjustment = {
  direction: 'normal' | 'conservative' | 'slightly_aggressive';
  dominantFeedback?: LoadFeedbackValue;
  reasons: string[];
};

export type LoadFeedbackSummary = {
  exerciseId?: string;
  total: number;
  counts: Record<LoadFeedbackValue, number>;
  dominantFeedback?: LoadFeedbackValue;
  adjustment: LoadFeedbackAdjustment;
};

const EMPTY_COUNTS: Record<LoadFeedbackValue, number> = {
  too_light: 0,
  good: 0,
  too_heavy: 0,
};

const normalizePoolId = (exerciseId: string) => exerciseId;

const sortRecent = (items: LoadFeedback[]) => [...items].sort((left, right) => right.date.localeCompare(left.date));

export const upsertLoadFeedback = (
  session: TrainingSession,
  exerciseId: string,
  feedback: LoadFeedbackValue,
  note?: string,
): TrainingSession => {
  const poolId = normalizePoolId(exerciseId);
  const nextFeedback: LoadFeedback = {
    exerciseId: poolId,
    sessionId: session.id,
    date: session.date,
    feedback,
    note,
  };
  const previous = Array.isArray(session.loadFeedback) ? session.loadFeedback : [];
  const withoutCurrent = previous.filter((item) => item.exerciseId !== poolId);
  return {
    ...session,
    loadFeedback: [...withoutCurrent, nextFeedback],
  };
};

export const collectLoadFeedback = (history: TrainingSession[], exerciseId?: string): LoadFeedback[] =>
  sortRecent(
    history
      .filter((session) => session.dataFlag !== 'test' && session.dataFlag !== 'excluded')
      .flatMap((session) => session.loadFeedback || [])
      .filter((item) => !exerciseId || item.exerciseId === exerciseId)
  );

export const buildLoadFeedbackSummary = (history: TrainingSession[], exerciseId?: string): LoadFeedbackSummary => {
  const items = collectLoadFeedback(history, exerciseId).slice(0, exerciseId ? 5 : 20);
  const counts = items.reduce<Record<LoadFeedbackValue, number>>(
    (acc, item) => {
      acc[item.feedback] += 1;
      return acc;
    },
    { ...EMPTY_COUNTS }
  );
  const dominantFeedback = (Object.entries(counts) as Array<[LoadFeedbackValue, number]>).sort((left, right) => right[1] - left[1])[0]?.[0];
  const adjustment = getLoadFeedbackAdjustment(history, exerciseId);
  return {
    exerciseId,
    total: items.length,
    counts,
    dominantFeedback: items.length ? dominantFeedback : undefined,
    adjustment,
  };
};

export const getLoadFeedbackAdjustment = (history: TrainingSession[], exerciseId?: string): LoadFeedbackAdjustment => {
  const recent = collectLoadFeedback(history, exerciseId).slice(0, 3);
  const counts = recent.reduce<Record<LoadFeedbackValue, number>>(
    (acc, item) => {
      acc[item.feedback] += 1;
      return acc;
    },
    { ...EMPTY_COUNTS }
  );

  if (counts.too_heavy >= 2) {
    return {
      direction: 'conservative',
      dominantFeedback: 'too_heavy',
      reasons: ['最近多次反馈推荐重量偏重，本次建议采用更保守的重量推进。'],
    };
  }

  if (counts.too_light >= 2) {
    return {
      direction: 'slightly_aggressive',
      dominantFeedback: 'too_light',
      reasons: ['最近多次反馈推荐重量偏轻；若动作质量良好，可允许小幅积极推进。'],
    };
  }

  if (counts.good > 0) {
    return {
      direction: 'normal',
      dominantFeedback: 'good',
      reasons: ['最近反馈显示推荐重量基本合适，继续按当前规则推进。'],
    };
  }

  return {
    direction: 'normal',
    reasons: ['暂无推荐重量反馈，继续使用训练表现和动作质量校准。'],
  };
};
