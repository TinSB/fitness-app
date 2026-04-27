import type {
  AdherenceReport,
  E1RMProfile,
  EffectiveVolumeSummary,
  EstimateConfidence,
  PainPattern,
  TechniqueQuality,
  TrainingSession,
} from '../models/training-model';
import { buildAdherenceReport } from './analytics';
import { buildE1RMProfile } from './e1rmEngine';
import { buildEffectiveVolumeSummary } from './effectiveSetEngine';
import { completedSets, number } from './engineUtils';
import { buildPainPatterns } from './painPatternEngine';
import { filterAnalyticsHistory } from './sessionHistoryEngine';
import type { TrainingCalendarData } from './trainingCalendarEngine';

export type AutoTrainingLevel = 'unknown' | 'beginner' | 'novice_plus' | 'intermediate' | 'advanced';

export type TrainingLevelSignal = {
  name: string;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
};

export type TrainingLevelAssessment = {
  level: AutoTrainingLevel;
  confidence: 'low' | 'medium' | 'high';
  readinessForAdvancedFeatures: {
    topBackoff: boolean;
    higherVolume: boolean;
    advancedExerciseSelection: boolean;
    aggressiveProgression: boolean;
  };
  signals: TrainingLevelSignal[];
  limitations: string[];
  nextDataNeeded: string[];
};

export type TechniqueQualitySummary = {
  totalSets: number;
  good: number;
  acceptable: number;
  poor: number;
  goodOrAcceptableRate: number;
  poorRate: number;
  rirRecordedRate: number;
};

type TrainingLevelAssessmentInput = {
  history?: TrainingSession[];
  e1rmProfiles?: E1RMProfile[];
  effectiveVolumeSummary?: EffectiveVolumeSummary;
  adherenceReport?: AdherenceReport;
  painPatterns?: PainPattern[];
  techniqueQualitySummary?: TechniqueQualitySummary;
  calendarData?: TrainingCalendarData;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const signal = (name: string, score: number, confidence: TrainingLevelSignal['confidence'], reason: string): TrainingLevelSignal => ({
  name,
  score: clampScore(score),
  confidence,
  reason,
});

const levelLabels: Record<AutoTrainingLevel, string> = {
  unknown: '数据不足',
  beginner: '新手阶段',
  novice_plus: '入门进阶',
  intermediate: '中阶',
  advanced: '高阶',
};

export const formatAutoTrainingLevel = (level: AutoTrainingLevel) => levelLabels[level] || '数据不足';

const confidenceFromSessionCount = (sessionCount: number): TrainingLevelAssessment['confidence'] => {
  if (sessionCount >= 12) return 'high';
  if (sessionCount >= 6) return 'medium';
  return 'low';
};

const uniqueExerciseIds = (history: TrainingSession[]) => [
  ...new Set(
    history.flatMap((session) =>
      (session.exercises || []).map((exercise) => exercise.canonicalExerciseId || exercise.baseId || exercise.id).filter(Boolean),
    ),
  ),
];

export const buildTechniqueQualitySummary = (history: TrainingSession[] = []): TechniqueQualitySummary => {
  const sets = filterAnalyticsHistory(history).flatMap((session) => (session.exercises || []).flatMap((exercise) => completedSets(exercise)));
  const totalSets = sets.length;
  const count = (quality: TechniqueQuality) => sets.filter((set) => set.techniqueQuality === quality).length;
  const good = count('good');
  const acceptable = count('acceptable');
  const poor = count('poor');
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

const buildFallbackE1RMProfiles = (history: TrainingSession[]) =>
  uniqueExerciseIds(history)
    .slice(0, 8)
    .map((exerciseId) => buildE1RMProfile(history, exerciseId));

const e1rmConfidenceScore = (confidence?: EstimateConfidence) => {
  if (confidence === 'high') return 1;
  if (confidence === 'medium') return 0.65;
  if (confidence === 'low') return 0.25;
  return 0;
};

const buildFrequencyScore = (history: TrainingSession[], calendarData?: TrainingCalendarData) => {
  const counts = calendarData?.weeklyFrequency?.map((week) => week.sessionCount).filter(Number.isFinite) || [];
  const fallbackCounts = (() => {
    const weekCounts = new Map<string, number>();
    history.forEach((session) => {
      const date = new Date(`${session.date || session.startedAt}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      const day = date.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + offset);
      const key = date.toISOString().slice(0, 10);
      weekCounts.set(key, (weekCounts.get(key) || 0) + 1);
    });
    return [...weekCounts.values()].slice(-4);
  })();
  const weeklyCounts = counts.length ? counts : fallbackCounts;
  const average = weeklyCounts.length ? weeklyCounts.reduce((sum, item) => sum + item, 0) / weeklyCounts.length : 0;
  if (average >= 4) return { score: 85, average };
  if (average >= 3) return { score: 72, average };
  if (average >= 2) return { score: 58, average };
  if (average >= 1) return { score: 38, average };
  return { score: 0, average };
};

export const buildTrainingLevelAssessment = ({
  history: rawHistory = [],
  e1rmProfiles,
  effectiveVolumeSummary,
  adherenceReport,
  painPatterns,
  techniqueQualitySummary,
  calendarData,
}: TrainingLevelAssessmentInput): TrainingLevelAssessment => {
  const history = filterAnalyticsHistory(rawHistory);
  const sessionCount = history.length;
  const resolvedTechnique = techniqueQualitySummary || buildTechniqueQualitySummary(history);
  const resolvedEffective = effectiveVolumeSummary || buildEffectiveVolumeSummary(history);
  const resolvedAdherence = adherenceReport || buildAdherenceReport(history);
  const resolvedPainPatterns = painPatterns || buildPainPatterns(history);
  const resolvedE1rmProfiles = e1rmProfiles || buildFallbackE1RMProfiles(history);
  const limitations: string[] = [];
  const nextDataNeeded: string[] = [];

  const dataDepthScore = sessionCount >= 12 ? 90 : sessionCount >= 6 ? 68 : sessionCount >= 3 ? 42 : sessionCount >= 1 ? 18 : 0;
  const signals: TrainingLevelSignal[] = [
    signal(
      '训练记录数量',
      dataDepthScore,
      confidenceFromSessionCount(sessionCount),
      sessionCount
        ? `已有 ${sessionCount} 次正式训练记录；等级判断会随记录增加而变稳。`
        : '尚无正式训练记录，系统只能显示数据不足。',
    ),
  ];

  const currentE1rms = resolvedE1rmProfiles.map((profile) => profile.current).filter(Boolean);
  const highOrMediumE1rms = currentE1rms.filter((estimate) => estimate && estimate.confidence !== 'low');
  const stableE1rms = currentE1rms.filter((estimate) => estimate?.confidence === 'high').length;
  const strengthScore =
    currentE1rms.length === 0 ? 0 : Math.min(90, highOrMediumE1rms.length * 22 + stableE1rms * 18 + Math.min(sessionCount, 12) * 2);
  signals.push(
    signal(
      '力量稳定性',
      strengthScore,
      stableE1rms >= 2 ? 'high' : highOrMediumE1rms.length >= 2 ? 'medium' : 'low',
      highOrMediumE1rms.length
        ? `有 ${highOrMediumE1rms.length} 个动作具备中高置信 currentE1RM；不会用单次最高重量直接判断等级。`
        : 'currentE1RM 还缺少高质量来源组。',
    ),
  );

  const techniqueScore =
    resolvedTechnique.totalSets === 0
      ? 0
      : resolvedTechnique.poorRate >= 0.25
        ? 25
        : resolvedTechnique.poorRate >= 0.12
          ? 48
          : resolvedTechnique.goodOrAcceptableRate >= 0.9
            ? 82
            : 62;
  signals.push(
    signal(
      '动作质量',
      techniqueScore,
      resolvedTechnique.totalSets >= 24 ? 'high' : resolvedTechnique.totalSets >= 10 ? 'medium' : 'low',
      resolvedTechnique.totalSets
        ? `good/acceptable 占比 ${Math.round(resolvedTechnique.goodOrAcceptableRate * 100)}%，poor 占比 ${Math.round(resolvedTechnique.poorRate * 100)}%。`
        : '还没有足够动作质量记录。',
    ),
  );

  const painSeverity = resolvedPainPatterns.reduce((sum, pattern) => sum + number(pattern.frequency) * Math.max(1, number(pattern.severityAvg)), 0);
  const painScore = painSeverity >= 8 ? 25 : painSeverity >= 4 ? 48 : resolvedPainPatterns.length ? 65 : 88;
  signals.push(
    signal(
      '不适信号',
      painScore,
      resolvedPainPatterns.length >= 2 ? 'medium' : sessionCount >= 6 ? 'medium' : 'low',
      resolvedPainPatterns.length
        ? `近期有 ${resolvedPainPatterns.length} 个不适模式，训练建议会保持保守。`
        : '没有明显重复不适模式。',
    ),
  );

  const adherenceScore =
    resolvedAdherence.recentSessionCount === 0
      ? 0
      : resolvedAdherence.overallRate >= 88
        ? 85
        : resolvedAdherence.overallRate >= 75
          ? 68
          : resolvedAdherence.overallRate >= 60
            ? 45
            : 25;
  signals.push(
    signal(
      '完成度',
      adherenceScore,
      resolvedAdherence.confidence,
      resolvedAdherence.recentSessionCount
        ? `最近完成率 ${resolvedAdherence.overallRate}%，主训练完成率 ${resolvedAdherence.mainlineRate}%。`
        : '还没有完成度数据。',
    ),
  );

  const frequency = buildFrequencyScore(history, calendarData);
  signals.push(
    signal(
      '训练频率',
      frequency.score,
      sessionCount >= 6 ? 'medium' : 'low',
      frequency.average ? `最近训练频率约每周 ${frequency.average.toFixed(1)} 次。` : '还没有可用于频率判断的训练周。',
    ),
  );

  const effectiveQualityRatio = resolvedEffective.effectiveSets
    ? resolvedEffective.highConfidenceEffectiveSets / Math.max(1, resolvedEffective.effectiveSets)
    : 0;
  const effectiveQualityScore =
    resolvedEffective.completedSets === 0
      ? 0
      : effectiveQualityRatio >= 0.65 && resolvedTechnique.rirRecordedRate >= 0.7
        ? 82
        : effectiveQualityRatio >= 0.4
          ? 62
          : 38;
  signals.push(
    signal(
      '有效组质量',
      effectiveQualityScore,
      resolvedEffective.completedSets >= 30 ? 'high' : resolvedEffective.completedSets >= 12 ? 'medium' : 'low',
      resolvedEffective.completedSets
        ? `高置信有效组 ${resolvedEffective.highConfidenceEffectiveSets}/${resolvedEffective.effectiveSets}，RIR 记录率 ${Math.round(resolvedTechnique.rirRecordedRate * 100)}%。`
        : '还没有有效组数据。',
    ),
  );

  if (sessionCount < 3) nextDataNeeded.push('至少完成 2–3 次正式训练，建立初始训练基线。');
  if (sessionCount < 6) nextDataNeeded.push('继续记录到 6 次以上，系统才能给出中等置信判断。');
  if (currentE1rms.length < 2) nextDataNeeded.push('为核心动作记录重量、次数、RIR 和动作质量，用于 currentE1RM。');
  if (resolvedTechnique.rirRecordedRate < 0.6) nextDataNeeded.push('更多 RIR 记录会提高有效组和等级判断置信度。');

  const averageScore = signals.reduce((sum, item) => sum + item.score, 0) / signals.length;
  const highPain = painScore < 50;
  const poorTechnique = resolvedTechnique.poorRate >= 0.15;
  const lowAdherence = resolvedAdherence.recentSessionCount > 0 && resolvedAdherence.overallRate < 75;
  const unstableFrequency = frequency.average > 0 && frequency.average < 2;

  if (highPain) limitations.push('近期不适信号偏高，高级训练功能保持关闭或保守。');
  if (poorTechnique) limitations.push('poor technique 比例偏高，不允许判定为高阶。');
  if (lowAdherence) limitations.push('完成率不足，暂不启用高训练量建议。');
  if (unstableFrequency) limitations.push('训练频率还不稳定，暂不建议高容量模板。');

  let level: AutoTrainingLevel = 'unknown';
  if (sessionCount === 0) level = 'unknown';
  else if (sessionCount <= 2) level = 'unknown';
  else if (sessionCount < 6) level = averageScore >= 50 && !highPain && !poorTechnique ? 'novice_plus' : 'beginner';
  else if (
    sessionCount >= 12 &&
    averageScore >= 78 &&
    stableE1rms >= 2 &&
    resolvedAdherence.overallRate >= 85 &&
    !highPain &&
    !poorTechnique &&
    frequency.average >= 3
  ) {
    level = 'advanced';
  } else if (sessionCount >= 6 && averageScore >= 58 && !highPain && resolvedAdherence.overallRate >= 70) {
    level = 'intermediate';
  } else if (averageScore >= 42) {
    level = 'novice_plus';
  } else {
    level = 'beginner';
  }

  if (level === 'advanced' && (highPain || poorTechnique || lowAdherence)) level = 'intermediate';
  if ((highPain || poorTechnique) && level === 'intermediate' && sessionCount < 12) level = 'novice_plus';

  const confidence = level === 'unknown' ? 'low' : confidenceFromSessionCount(sessionCount);
  const canUseIntermediateFeatures = level === 'intermediate' || level === 'advanced';
  const isAdvanced = level === 'advanced';

  return {
    level,
    confidence,
    readinessForAdvancedFeatures: {
      topBackoff: canUseIntermediateFeatures && !highPain && !poorTechnique,
      higherVolume: canUseIntermediateFeatures && !highPain && !lowAdherence && frequency.average >= 2,
      advancedExerciseSelection: canUseIntermediateFeatures && !highPain && !poorTechnique,
      aggressiveProgression: isAdvanced && !highPain && !poorTechnique && !lowAdherence && resolvedAdherence.overallRate >= 88,
    },
    signals,
    limitations: limitations.length ? limitations : ['等级判断会继续随真实训练记录更新。'],
    nextDataNeeded: nextDataNeeded.length ? nextDataNeeded : ['继续保持重量、次数、RIR、动作质量和不适标记的完整记录。'],
  };
};
