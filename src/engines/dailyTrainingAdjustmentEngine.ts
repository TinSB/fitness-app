import { formatExerciseName, formatMuscleName, formatTemplateName } from '../i18n/formatters';
import type { PainPattern, ReadinessResult, TrainingSession, TrainingTemplate } from '../models/training-model';
import type { HealthSummary } from './healthSummaryEngine';
import type { LoadFeedbackSummary } from './loadFeedbackEngine';
import type { AutoTrainingLevel } from './trainingLevelEngine';
import { number, sessionCompletedSets, sessionVolume } from './engineUtils';

export type DailyTrainingAdjustmentType =
  | 'normal'
  | 'conservative'
  | 'deload_like'
  | 'main_only'
  | 'reduce_support'
  | 'substitute_risky_exercises'
  | 'rest_or_recovery';

export type DailyTrainingAdjustment = {
  type: DailyTrainingAdjustmentType;
  title: string;
  summary: string;
  reasons: string[];
  suggestedChanges: Array<{
    type:
      | 'reduce_volume'
      | 'reduce_support'
      | 'keep_main_lifts'
      | 'substitute_exercise'
      | 'extend_rest'
      | 'skip_optional';
    targetId?: string;
    reason: string;
  }>;
  confidence: 'low' | 'medium' | 'high';
  requiresUserConfirmation: boolean;
};

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
  loadFeedbackSummary?: LoadFeedbackSummary | LoadFeedbackSummary[] | Record<string, LoadFeedbackSummary> | null;
  trainingLevel?: AutoTrainingLevel | string;
  activeTemplate?: TrainingTemplate | null;
};

type Signal = {
  id: string;
  priority: number;
  reason: string;
  change?: DailyTrainingAdjustment['suggestedChanges'][number];
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
      reason: `昨晚睡眠约 ${Math.round(healthSummary.latestSleepHours * 10) / 10} 小时，今天建议保守训练。`,
      change: { type: 'extend_rest', reason: '组间休息可以略延长，优先保证动作质量。' },
    });
  }
  const notes = (healthSummary.notes || []).join(' ');
  if (/HRV.*低|低于/.test(notes)) {
    signals.push({
      id: 'low-hrv',
      priority: 65,
      reason: '导入健康数据提示 HRV 偏低，今天只作为恢复参考，不做医疗判断。',
      change: { type: 'reduce_volume', reason: '把训练量保持在计划下沿，避免主动加量。' },
    });
  }
  if (/静息心率.*高|高于/.test(notes)) {
    signals.push({
      id: 'high-resting-heart-rate',
      priority: 65,
      reason: '导入健康数据提示静息心率偏高，今天建议避免激进推进。',
      change: { type: 'extend_rest', reason: '延长休息并观察主观状态。' },
    });
  }
  return signals;
};

const readinessSignals = (readinessResult?: ReadinessResult | null): Signal[] => {
  if (!readinessResult) return [];
  const reason = readinessResult.reasons?.[0] ? `准备度 ${readinessResult.score}/100：${readinessResult.reasons[0]}。` : `准备度 ${readinessResult.score}/100。`;
  if (readinessResult.trainingAdjustment === 'recovery' || readinessResult.score < 45) {
    return [
      {
        id: 'readiness-recovery',
        priority: 100,
        reason: `${reason} 今天更适合作为恢复或低负荷日。`,
        change: { type: 'reduce_volume', reason: '如仍训练，建议明显降低训练量并保留退出空间。' },
      },
    ];
  }
  if (readinessResult.trainingAdjustment === 'conservative' || readinessResult.score < 65) {
    return [
      {
        id: 'readiness-conservative',
        priority: 80,
        reason: `${reason} 今天建议保守执行，不主动加量。`,
        change: { type: 'reduce_volume', reason: '正式组保留，但减少额外加组和冲重量。' },
      },
    ];
  }
  return [];
};

const activitySignals = (previous24hActivity?: Previous24hActivityInput | null, healthSummary?: HealthSummary | null): Signal[] => {
  if (!isHighActivity(previous24hActivity, healthSummary)) return [];
  const minutes = activityMinutes(previous24hActivity, healthSummary);
  return [
    {
      id: 'previous-24h-high-activity',
      priority: 75,
      reason: minutes ? `过去 24 小时外部活动约 ${Math.round(minutes)} 分钟，今天建议减少辅助动作。` : '过去 24 小时外部活动偏高，今天建议减少辅助动作。',
      change: { type: 'reduce_support', reason: '优先完成主训练，辅助动作按状态减少或跳过。' },
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
      reason: `${formatMuscleName(pattern.area)}近期有不适记录，今天应避免硬顶相关动作。`,
      change: {
        type: 'substitute_exercise' as const,
        targetId: pattern.exerciseId,
        reason: pattern.exerciseId
          ? `${formatExerciseName(pattern.exerciseId)}近期出现不适，建议改用更可控的替代动作。`
          : `${formatMuscleName(pattern.area)}相关动作建议降低风险或选择替代。`,
      },
    }));
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
      reason: summary.exerciseId
        ? `${formatExerciseName(summary.exerciseId)}近期反馈偏重，今天相关动作略保守。`
        : '近期重量反馈偏重，今天不建议激进加重。',
      change: {
        type: 'reduce_volume' as const,
        targetId: summary.exerciseId,
        reason: '相关动作采用计划下沿重量或减少额外冲重量。',
      },
    }));
};

const trainingLevelSignals = (trainingLevel?: AutoTrainingLevel | string): Signal[] => {
  if (trainingLevel !== 'unknown') return [];
  return [
    {
      id: 'unknown-training-level',
      priority: 55,
      reason: '系统仍在建立训练基线，今天不启用激进推进。',
      change: { type: 'keep_main_lifts', reason: '先完成主训练和稳定记录，再逐步提高推进幅度。' },
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
        reason: '最新一场正式训练量较高，今天建议保留主训练质量，避免堆叠额外疲劳。',
        change: { type: 'skip_optional', reason: '可跳过非必要辅助动作，把恢复留给后续训练。' },
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
  if (signals.some((signal) => signal.id.startsWith('pain-'))) return 'substitute_risky_exercises';
  if (signals.some((signal) => signal.id === 'previous-24h-high-activity')) return 'reduce_support';
  if (signals.some((signal) => signal.id === 'recent-high-volume')) return 'main_only';
  if (signals.some((signal) => signal.id === 'readiness-conservative' || signal.id === 'low-sleep' || signal.id === 'low-hrv' || signal.id === 'high-resting-heart-rate' || signal.id.startsWith('load-feedback-') || signal.id === 'unknown-training-level')) {
    return 'conservative';
  }
  return 'normal';
};

const titleAndSummary = (type: DailyTrainingAdjustmentType, template?: TrainingTemplate | null) => {
  const templateName = template ? formatTemplateName(template.id || template.name, '当前训练') : '当前训练';
  const map: Record<DailyTrainingAdjustmentType, { title: string; summary: string }> = {
    normal: {
      title: '照常训练',
      summary: `${templateName} 可以按计划执行，继续关注动作质量和余力（RIR）。`,
    },
    conservative: {
      title: '保守训练',
      summary: `${templateName} 建议保守执行，不主动加量或冲重量。`,
    },
    deload_like: {
      title: '接近减量日',
      summary: `${templateName} 建议明显降低训练压力，优先恢复和动作质量。`,
    },
    main_only: {
      title: '只做主训练',
      summary: `${templateName} 建议优先完成主训练，非必要内容可跳过。`,
    },
    reduce_support: {
      title: '减少辅助',
      summary: `${templateName} 建议保留主训练，减少辅助动作和功能补丁。`,
    },
    substitute_risky_exercises: {
      title: '替代风险动作',
      summary: `${templateName} 中如有不适相关动作，建议选择更可控的替代动作。`,
    },
    rest_or_recovery: {
      title: '恢复或低负荷',
      summary: '今天更适合恢复、低负荷训练，或把正式训练推迟到状态更好时。',
    },
  };
  return map[type];
};

export const buildDailyTrainingAdjustment = ({
  readinessResult,
  healthSummary,
  previous24hActivity,
  recentHistory = [],
  painPatterns = [],
  loadFeedbackSummary,
  trainingLevel,
  activeTemplate,
}: BuildDailyTrainingAdjustmentInput): DailyTrainingAdjustment => {
  const signals = [
    ...readinessSignals(readinessResult),
    ...healthSignals(healthSummary),
    ...activitySignals(previous24hActivity, healthSummary),
    ...painSignals(painPatterns, activeTemplate),
    ...loadFeedbackSignals(loadFeedbackSummary, activeTemplate),
    ...trainingLevelSignals(trainingLevel),
    ...historySignals(recentHistory),
  ].sort((left, right) => right.priority - left.priority);

  const type = typeForSignals(signals);
  const { title, summary } = titleAndSummary(type, activeTemplate);
  const suggestedChanges = signals.flatMap((signal) => (signal.change ? [signal.change] : []));

  return {
    type,
    title,
    summary,
    reasons: signals.length
      ? unique(signals.map((signal) => signal.reason)).slice(0, 4)
      : ['当前准备度和近期记录没有明显限制，按计划训练即可。'],
    suggestedChanges,
    confidence: confidenceFor(signals, healthSummary),
    requiresUserConfirmation: type !== 'normal',
  };
};
