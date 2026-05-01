import type {
  E1RMProfile,
  EffectiveVolumeSummary,
  EstimatedOneRepMax,
  LoadFeedback,
  LoadFeedbackValue,
  PainPattern,
  TrainingSession,
  TrainingSetLog,
} from '../models/training-model';
import type { LoadFeedbackSummary } from './loadFeedbackEngine';
import type { AutoTrainingLevel, TechniqueQualitySummary } from './trainingLevelEngine';
import { completedSets, number } from './engineUtils';
import { filterAnalyticsHistory } from './sessionHistoryEngine';

export type RecommendationConfidenceLevel = 'low' | 'medium' | 'high';

export type RecommendationConfidenceReason = {
  id: string;
  label: string;
  effect: 'raise_confidence' | 'lower_confidence' | 'informational';
  reason: string;
};

export type RecommendationConfidenceResult = {
  level: RecommendationConfidenceLevel;
  score: number;
  title: string;
  summary: string;
  reasons: RecommendationConfidenceReason[];
  missingData: string[];
};

type RecentEditInput = Array<{ editedAt?: string; fields?: string[] } | string> | number | null | undefined;

type LoadFeedbackInput =
  | LoadFeedback[]
  | LoadFeedbackSummary
  | LoadFeedbackSummary[]
  | Record<string, LoadFeedbackSummary | LoadFeedbackValue | undefined>
  | null
  | undefined;

export type BuildRecommendationConfidenceParams = {
  exerciseId?: string;
  history?: TrainingSession[];
  e1rmProfile?: E1RMProfile | EstimatedOneRepMax | null;
  effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null;
  loadFeedback?: LoadFeedbackInput;
  techniqueQualitySummary?: TechniqueQualitySummary | null;
  painPatterns?: PainPattern[] | null;
  trainingLevel?: AutoTrainingLevel | string | null;
  recentEdits?: RecentEditInput;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const reason = (
  id: string,
  label: string,
  effect: RecommendationConfidenceReason['effect'],
  text: string,
): RecommendationConfidenceReason => ({
  id,
  label,
  effect,
  reason: text,
});

const completedTrainingSets = (session: TrainingSession) =>
  (session.exercises || []).flatMap((exercise) => completedSets(exercise).filter((set) => set.type !== 'warmup'));

const getExerciseIds = (exercise: TrainingSession['exercises'][number]) =>
  new Set(
    [
      exercise.id,
      exercise.baseId,
      exercise.actualExerciseId,
      exercise.replacementExerciseId,
      exercise.originalExerciseId,
      exercise.canonicalExerciseId,
      exercise.replacedFromId,
    ]
      .filter(Boolean)
      .map(String),
  );

const exerciseMatches = (exercise: TrainingSession['exercises'][number], exerciseId?: string) => {
  if (!exerciseId) return true;
  return getExerciseIds(exercise).has(exerciseId);
};

const relevantSessions = (history: TrainingSession[], exerciseId?: string) =>
  filterAnalyticsHistory(history)
    .filter((session) => (session.exercises || []).some((exercise) => exerciseMatches(exercise, exerciseId)))
    .sort((left, right) => (right.finishedAt || right.startedAt || right.date || '').localeCompare(left.finishedAt || left.startedAt || left.date || ''));

const relevantSets = (sessions: TrainingSession[], exerciseId?: string) =>
  sessions.flatMap((session) =>
    (session.exercises || [])
      .filter((exercise) => exerciseMatches(exercise, exerciseId))
      .flatMap((exercise) => completedSets(exercise).filter((set) => set.type !== 'warmup')),
  );

const buildTechniqueSummaryFromSets = (sets: TrainingSetLog[]): TechniqueQualitySummary => {
  const totalSets = sets.length;
  const good = sets.filter((set) => set.techniqueQuality === 'good').length;
  const acceptable = sets.filter((set) => set.techniqueQuality === 'acceptable').length;
  const poor = sets.filter((set) => set.techniqueQuality === 'poor').length;
  const rirRecorded = sets.filter((set) => set.rir !== undefined && set.rir !== '').length;
  return {
    totalSets,
    good,
    acceptable,
    poor,
    goodOrAcceptableRate: totalSets ? (good + acceptable) / totalSets : 0,
    poorRate: totalSets ? poor / totalSets : 0,
    rirRecordedRate: totalSets ? rirRecorded / totalSets : 0,
  };
};

const isLoadFeedbackSummary = (value: unknown): value is LoadFeedbackSummary =>
  typeof value === 'object' && value !== null && 'counts' in value && 'adjustment' in value;

const normalizeLoadFeedback = (input: LoadFeedbackInput, sessions: TrainingSession[], exerciseId?: string) => {
  const values: LoadFeedbackValue[] = [];
  const addValue = (value?: unknown, count = 1) => {
    if (value === 'too_heavy' || value === 'too_light' || value === 'good') {
      for (let index = 0; index < count; index += 1) values.push(value);
    }
  };
  const addSummary = (summary?: LoadFeedbackSummary) => {
    if (!summary) return;
    addValue('too_heavy', number(summary.counts?.too_heavy));
    addValue('too_light', number(summary.counts?.too_light));
    addValue('good', number(summary.counts?.good));
    addValue(summary.dominantFeedback);
    addValue(summary.adjustment?.dominantFeedback);
  };

  sessions
    .flatMap((session) => session.loadFeedback || [])
    .filter((item) => !exerciseId || item.exerciseId === exerciseId)
    .forEach((item) => addValue(item.feedback));

  if (Array.isArray(input)) {
    input.forEach((item) => {
      if ('feedback' in item) addValue(item.feedback);
      else addSummary(item);
    });
  } else if (isLoadFeedbackSummary(input)) {
    addSummary(input);
  } else if (input && typeof input === 'object') {
    Object.values(input).forEach((item) => {
      if (typeof item === 'string') addValue(item);
      else addSummary(item);
    });
  }

  const total = values.length;
  const counts = {
    too_heavy: values.filter((item) => item === 'too_heavy').length,
    too_light: values.filter((item) => item === 'too_light').length,
    good: values.filter((item) => item === 'good').length,
  };
  return {
    total,
    counts,
    stable:
      total >= 2 &&
      (counts.good / total >= 0.65 || counts.too_heavy / total >= 0.75 || counts.too_light / total >= 0.75),
    volatile: counts.too_heavy > 0 && counts.too_light > 0,
  };
};

const resolveCurrentE1rm = (profile?: E1RMProfile | EstimatedOneRepMax | null): EstimatedOneRepMax | undefined => {
  if (!profile) return undefined;
  if ('current' in profile || 'best' in profile) return profile.current || profile.best;
  if ('e1rmKg' in profile && 'sourceSet' in profile) return profile;
  return undefined;
};

const countRecentEdits = (input: RecentEditInput, sessions: TrainingSession[]) => {
  const directCount = typeof input === 'number' ? input : Array.isArray(input) ? input.length : 0;
  const sessionEditCount = sessions.reduce(
    (sum, session) => sum + (session.editedAt ? 1 : 0) + (session.editHistory?.length || 0),
    0,
  );
  return directCount + sessionEditCount;
};

const hasRecentReplacement = (sessions: TrainingSession[], exerciseId?: string) =>
  sessions.slice(0, 3).some((session) =>
    (session.exercises || []).some((exercise) => {
      if (!exerciseMatches(exercise, exerciseId)) return false;
      const original = exercise.originalExerciseId || exercise.baseId;
      const actual = exercise.actualExerciseId || exercise.replacementExerciseId;
      return Boolean(actual && original && actual !== original) || Boolean(exercise.replacedFromId || exercise.replacementExerciseId);
    }),
  );

const hasMixedUnitsWithSparseHistory = (sets: TrainingSetLog[], sessionCount: number) => {
  if (sessionCount > 3) return false;
  const units = new Set(sets.map((set) => set.displayUnit).filter(Boolean));
  return units.size > 1;
};

const levelFromScore = (score: number): RecommendationConfidenceLevel => {
  if (score >= 78) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

const levelLabel = (level: RecommendationConfidenceLevel) => {
  if (level === 'high') return '高';
  if (level === 'medium') return '中等';
  return '低';
};

export const buildRecommendationConfidence = ({
  exerciseId,
  history = [],
  e1rmProfile,
  effectiveSetSummary,
  loadFeedback,
  techniqueQualitySummary,
  painPatterns = [],
  trainingLevel,
  recentEdits,
}: BuildRecommendationConfidenceParams): RecommendationConfidenceResult => {
  const sessions = relevantSessions(history, exerciseId);
  const sets = relevantSets(sessions, exerciseId);
  const technique = techniqueQualitySummary || buildTechniqueSummaryFromSets(sets);
  const feedback = normalizeLoadFeedback(loadFeedback, sessions, exerciseId);
  const currentE1rm = resolveCurrentE1rm(e1rmProfile);
  const edits = countRecentEdits(recentEdits, sessions.slice(0, 5));
  const matchedPainPatterns = (painPatterns || []).filter((pattern) =>
    (exerciseId && pattern.exerciseId === exerciseId) || number(pattern.severityAvg) >= 3.5,
  );
  const effectiveCompleted = Math.max(number(effectiveSetSummary?.completedSets), sets.length);
  const effectiveSets = number(effectiveSetSummary?.effectiveSets);
  const highConfidenceEffectiveSets = number(effectiveSetSummary?.highConfidenceEffectiveSets);
  const completionRate = effectiveCompleted ? effectiveSets / effectiveCompleted : 0;
  const highConfidenceRate = effectiveSets ? highConfidenceEffectiveSets / effectiveSets : 0;
  const reasons: RecommendationConfidenceReason[] = [];
  const missingData: string[] = [];
  let score = 55;

  if (sessions.length <= 1) {
    score -= sessions.length === 0 ? 32 : 24;
    reasons.push(reason('history-sparse', '训练记录不足', 'lower_confidence', '同动作近期记录太少，这条推荐建议保守参考。'));
    missingData.push('继续记录同动作的重量、次数、余力（RIR）和动作质量。');
  } else if (sessions.length >= 5 && sets.length >= 10) {
    score += 14;
    reasons.push(reason('history-stable', '近期记录稳定', 'raise_confidence', `已有 ${sessions.length} 次同动作正式记录，可用于校准推荐。`));
  } else {
    score += 2;
    reasons.push(reason('history-building', '记录正在积累', 'informational', '已有一些同动作记录，但样本量仍在积累中。'));
  }

  if (technique.totalSets <= 0) {
    score -= 12;
    reasons.push(reason('technique-missing', '动作质量缺失', 'lower_confidence', '缺少动作质量记录，系统无法判断推荐是否建立在稳定动作上。'));
    missingData.push('补充动作质量记录。');
  } else if (technique.goodOrAcceptableRate >= 0.9 && technique.poorRate === 0) {
    score += 10;
    reasons.push(reason('technique-stable', '动作质量稳定', 'raise_confidence', '动作质量记录整体稳定，推荐可信度提高。'));
  } else if (technique.poorRate >= 0.25 || technique.poor >= 2) {
    score -= 18;
    reasons.push(reason('technique-poor', '动作质量偏低', 'lower_confidence', '近期动作质量偏差较多，推荐需要保守参考。'));
  }

  if (technique.totalSets <= 0 || technique.rirRecordedRate === 0) {
    score -= 14;
    reasons.push(reason('rir-missing', '余力记录缺失', 'lower_confidence', '缺少余力（RIR）记录，系统难以判断实际接近力竭程度。'));
    if (!missingData.includes('补充余力（RIR）记录。')) missingData.push('补充余力（RIR）记录。');
  } else if (technique.rirRecordedRate >= 0.85) {
    score += 10;
    reasons.push(reason('rir-complete', '余力记录完整', 'raise_confidence', '余力（RIR）记录较完整，推荐可信度提高。'));
  } else if (technique.rirRecordedRate < 0.5) {
    score -= 9;
    reasons.push(reason('rir-incomplete', '余力记录不完整', 'lower_confidence', '部分正式组缺少余力（RIR），推荐可信度下调。'));
  }

  if (matchedPainPatterns.length) {
    score -= 18;
    reasons.push(reason('pain-pattern', '不适记录明显', 'lower_confidence', '近期不适记录与当前推荐相关，建议优先保守执行。'));
  } else if (sets.length >= 4 && sets.every((set) => !set.painFlag)) {
    score += 8;
    reasons.push(reason('no-pain', '无明显不适', 'raise_confidence', '近期同动作记录没有明显不适标记。'));
  }

  if (feedback.volatile) {
    score -= 12;
    reasons.push(reason('load-feedback-volatile', '重量反馈波动', 'lower_confidence', '近期既有偏重也有偏轻反馈，说明推荐重量仍需校准。'));
  } else if (feedback.stable) {
    score += feedback.counts.good >= Math.max(feedback.counts.too_heavy, feedback.counts.too_light) ? 8 : 4;
    reasons.push(reason('load-feedback-stable', '重量反馈稳定', 'raise_confidence', '推荐重量反馈方向比较稳定。'));
  } else if (feedback.total === 0) {
    missingData.push('记录推荐重量反馈。');
  }

  if (currentE1rm) {
    if (currentE1rm.confidence === 'high' && currentE1rm.sourceSet.techniqueQuality !== 'poor' && !currentE1rm.sourceSet.painFlag) {
      score += 10;
      reasons.push(reason('e1rm-high-quality', '力量基准可靠', 'raise_confidence', '当前力量估算来自较高质量记录，推荐可信度提高。'));
    } else if (currentE1rm.confidence === 'low') {
      score -= 14;
      reasons.push(reason('e1rm-low-confidence', '力量基准置信度低', 'lower_confidence', '当前力量估算置信度偏低，推荐应保守参考。'));
    } else {
      reasons.push(reason('e1rm-medium', '力量基准可参考', 'informational', '已有力量估算，但仍需要更多稳定记录提高可信度。'));
    }
  } else {
    score -= 8;
    missingData.push('继续积累可用于力量估算的高质量正式组。');
  }

  if (completionRate >= 0.8 && highConfidenceRate >= 0.65 && effectiveCompleted >= 4) {
    score += 9;
    reasons.push(reason('effective-sets-stable', '有效组稳定', 'raise_confidence', '近期有效组和高置信有效组比例较稳定。'));
  } else if (effectiveCompleted > 0 && (completionRate < 0.45 || highConfidenceRate < 0.35)) {
    score -= 9;
    reasons.push(reason('effective-sets-weak', '有效组证据偏弱', 'lower_confidence', '有效组或高置信有效组不足，推荐可信度下调。'));
  }

  if (hasRecentReplacement(sessions, exerciseId)) {
    score -= 12;
    reasons.push(reason('recent-replacement', '近期替代动作', 'lower_confidence', '近期刚发生动作替代，原动作和实际执行动作的数据还需要重新稳定。'));
  }

  if (edits > 0) {
    score -= Math.min(16, edits * 6);
    reasons.push(reason('recent-edits', '历史记录刚修正', 'lower_confidence', '最近修正过历史记录，推荐会等待数据重新稳定。'));
  }

  if (hasMixedUnitsWithSparseHistory(sets, sessions.length)) {
    score -= 8;
    reasons.push(reason('unit-history-sparse', '单位记录需要稳定', 'lower_confidence', '近期单位显示不完全一致，且历史记录较少，建议先保守参考。'));
  }

  if (trainingLevel === 'unknown' || trainingLevel === 'beginner') {
    score -= 6;
    reasons.push(reason('training-baseline', '训练基线仍在建立', 'lower_confidence', '训练基线仍在建立，系统不会把推荐解释为高置信推进。'));
  }

  if (matchedPainPatterns.length) score = Math.min(score, 74);
  if (edits > 0) score = Math.min(score, 92);

  const finalScore = clampScore(score);
  const level = sessions.length <= 1 ? 'low' : levelFromScore(finalScore);
  const title = `推荐可信度：${levelLabel(level)}`;
  const loweringReasons = reasons.filter((item) => item.effect === 'lower_confidence');
  const raisingReasons = reasons.filter((item) => item.effect === 'raise_confidence');
  const summary =
    level === 'low'
      ? `这条推荐建议保守参考。${loweringReasons[0]?.reason || '当前数据还不足以支持高置信判断。'}`
      : level === 'high'
        ? `这条推荐可信度较高。${raisingReasons[0]?.reason || '近期记录比较完整稳定。'}`
        : matchedPainPatterns.length || feedback.volatile || edits > 0
          ? `这条推荐可信度中等，建议保守参考。${loweringReasons[0]?.reason || '仍有部分记录需要继续积累。'}`
          : `这条推荐可信度中等。已有可参考数据，但仍有部分记录需要继续积累。`;

  return {
    level,
    score: finalScore,
    title,
    summary,
    reasons: reasons.slice(0, 8),
    missingData: [...new Set(missingData)].slice(0, 5),
  };
};
