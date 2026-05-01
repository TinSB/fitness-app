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
import type { TechniqueQualitySummary } from './trainingLevelEngine';
import { completedSets, number, setWeightKg } from './engineUtils';
import { filterAnalyticsHistory } from './sessionHistoryEngine';

export type PlateauStatus =
  | 'none'
  | 'possible_plateau'
  | 'plateau'
  | 'fatigue_limited'
  | 'technique_limited'
  | 'volume_limited'
  | 'load_too_aggressive'
  | 'insufficient_data';

export type PlateauSignal = {
  id: string;
  label: string;
  reason: string;
  severity: 'info' | 'warning' | 'serious';
};

export type PlateauDetectionResult = {
  exerciseId: string;
  status: PlateauStatus;
  title: string;
  summary: string;
  signals: PlateauSignal[];
  suggestedActions: string[];
  confidence: 'low' | 'medium' | 'high';
};

type LoadFeedbackInput =
  | LoadFeedback[]
  | LoadFeedbackSummary
  | LoadFeedbackSummary[]
  | Record<string, LoadFeedbackSummary | LoadFeedbackValue | undefined>
  | null
  | undefined;

export type DetectExercisePlateauParams = {
  exerciseId: string;
  history?: TrainingSession[];
  e1rmProfile?: E1RMProfile | EstimatedOneRepMax | null;
  loadFeedback?: LoadFeedbackInput;
  effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null;
  techniqueQualitySummary?: TechniqueQualitySummary | null;
  painPatterns?: PainPattern[] | null;
};

type SessionPerformance = {
  sessionId: string;
  date: string;
  exerciseName: string;
  completedSetCount: number;
  topWeightKg: number;
  topReps: number;
  topVolume: number;
};

const signal = (
  id: string,
  label: string,
  reason: string,
  severity: PlateauSignal['severity'] = 'info',
): PlateauSignal => ({ id, label, reason, severity });

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

const exerciseIds = (exercise: TrainingSession['exercises'][number]) =>
  new Set(
    [
      exercise.id,
      exercise.baseId,
      exercise.canonicalExerciseId,
      exercise.actualExerciseId,
      exercise.replacementExerciseId,
      exercise.originalExerciseId,
      exercise.replacedFromId,
    ]
      .filter(Boolean)
      .map(String),
  );

const exerciseMatches = (exercise: TrainingSession['exercises'][number], exerciseId: string) =>
  exerciseIds(exercise).has(exerciseId);

const sessionDateKey = (session: TrainingSession) => session.finishedAt || session.startedAt || session.date || '';

const relevantSessions = (history: TrainingSession[], exerciseId: string) =>
  filterAnalyticsHistory(history)
    .filter((session) => (session.exercises || []).some((exercise) => exerciseMatches(exercise, exerciseId)))
    .sort((left, right) => sessionDateKey(right).localeCompare(sessionDateKey(left)));

const relevantExerciseSets = (sessions: TrainingSession[], exerciseId: string) =>
  sessions.flatMap((session) =>
    (session.exercises || [])
      .filter((exercise) => exerciseMatches(exercise, exerciseId))
      .flatMap((exercise) => completedSets(exercise).filter((set) => set.type !== 'warmup')),
  );

const firstExerciseName = (sessions: TrainingSession[], exerciseId: string) => {
  for (const session of sessions) {
    const exercise = (session.exercises || []).find((item) => exerciseMatches(item, exerciseId));
    if (exercise?.name) return exercise.name;
  }
  return '该动作';
};

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

const normalizeLoadFeedback = (input: LoadFeedbackInput, sessions: TrainingSession[], exerciseId: string) => {
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
    .filter((item) => item.exerciseId === exerciseId)
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
  const tooHeavy = values.filter((item) => item === 'too_heavy').length;
  const tooLight = values.filter((item) => item === 'too_light').length;
  const good = values.filter((item) => item === 'good').length;
  return {
    total,
    tooHeavy,
    tooLight,
    good,
    tooHeavyRate: total ? tooHeavy / total : 0,
  };
};

const e1rmValues = (profile?: E1RMProfile | EstimatedOneRepMax | null): number[] => {
  if (!profile) return [];
  if ('recentValues' in profile && Array.isArray(profile.recentValues)) return profile.recentValues.filter((value) => number(value) > 0);
  if ('current' in profile || 'best' in profile) {
    return [number(profile.current?.e1rmKg), number(profile.best?.e1rmKg)].filter((value) => value > 0);
  }
  if ('e1rmKg' in profile) return [number(profile.e1rmKg)].filter((value) => value > 0);
  return [];
};

const buildSessionPerformances = (sessions: TrainingSession[], exerciseId: string): SessionPerformance[] =>
  [...sessions]
    .reverse()
    .map((session) => {
      const exercise = (session.exercises || []).find((item) => exerciseMatches(item, exerciseId));
      const sets = exercise ? completedSets(exercise).filter((set) => set.type !== 'warmup') : [];
      const topWeightKg = Math.max(0, ...sets.map((set) => setWeightKg(set)));
      const topReps = Math.max(0, ...sets.map((set) => number(set.reps)));
      const topVolume = Math.max(0, ...sets.map((set) => setWeightKg(set) * number(set.reps)));
      return {
        sessionId: session.id,
        date: sessionDateKey(session),
        exerciseName: exercise?.name || '该动作',
        completedSetCount: sets.length,
        topWeightKg,
        topReps,
        topVolume,
      };
    })
    .filter((item) => item.completedSetCount > 0);

const isStableCompletion = (items: SessionPerformance[]) => {
  if (items.length < 4) return false;
  const counts = items.map((item) => item.completedSetCount);
  const average = counts.reduce((sum, value) => sum + value, 0) / counts.length;
  const min = Math.min(...counts);
  return min >= Math.max(1, average * 0.65);
};

const countFlatSessions = (items: SessionPerformance[]) => {
  let bestWeight = 0;
  let bestReps = 0;
  let bestVolume = 0;
  let flatCount = 0;

  items.forEach((item, index) => {
    if (index > 0) {
      const weightFlat = item.topWeightKg <= bestWeight * 1.01;
      const repsFlat = item.topReps <= bestReps;
      const volumeFlat = item.topVolume <= bestVolume * 1.02;
      if (weightFlat && repsFlat && volumeFlat) flatCount += 1;
    }
    bestWeight = Math.max(bestWeight, item.topWeightKg);
    bestReps = Math.max(bestReps, item.topReps);
    bestVolume = Math.max(bestVolume, item.topVolume);
  });

  return flatCount;
};

const isE1rmFlat = (values: number[]) => {
  if (values.length < 4) return false;
  const recent = values.slice(-4);
  const firstHalfBest = Math.max(...recent.slice(0, 2));
  const lastHalfBest = Math.max(...recent.slice(2));
  return lastHalfBest <= firstHalfBest * 1.01;
};

const buildLimitActions = (status: PlateauStatus) => {
  if (status === 'load_too_aggressive') {
    return ['下次先维持或小幅下调重量，确认不是重量推进过快。', '优先完成目标次数和动作质量，再考虑继续加重。'];
  }
  if (status === 'technique_limited') {
    return ['下次先把重量维持在可控范围，优先提高动作质量。', '如果动作变形明显，先减少加重频率。'];
  }
  if (status === 'fatigue_limited') {
    return ['下次先降低风险动作的压力，必要时选择更稳妥的替代动作。', '如果不适持续出现，先避免强行加重。'];
  }
  if (status === 'volume_limited') {
    return ['先提高有效组完成数量，再判断是否需要调整重量。', '下周计划调整草案可以优先检查该动作或相关肌群的训练量。'];
  }
  if (status === 'plateau') {
    return ['进入计划调整预览时，可以优先检查该动作的训练量、次数范围和替代动作选择。', '下次不急于加重，先确认完成率、动作质量和恢复状态。'];
  }
  if (status === 'possible_plateau') {
    return ['继续观察 1–2 次训练，确认是否只是短期波动。', '下次先维持重量，争取提高完成质量或目标次数。'];
  }
  if (status === 'insufficient_data') {
    return ['继续记录同动作的重量、次数、余力（RIR）和动作质量。'];
  }
  return ['继续按当前推荐执行，并保持重量、次数、余力（RIR）和动作质量记录。'];
};

const statusTitle = (status: PlateauStatus, exerciseName: string) => {
  if (status === 'insufficient_data') return `${exerciseName} 数据不足`;
  if (status === 'load_too_aggressive') return `${exerciseName} 可能推进过快`;
  if (status === 'technique_limited') return `${exerciseName} 受动作质量限制`;
  if (status === 'fatigue_limited') return `${exerciseName} 受疲劳或不适限制`;
  if (status === 'volume_limited') return `${exerciseName} 可能训练量不足`;
  if (status === 'plateau') return `${exerciseName} 进展停滞`;
  if (status === 'possible_plateau') return `${exerciseName} 进展放缓`;
  return `${exerciseName} 进展正常`;
};

const confidenceFromEvidence = (sessions: number, e1rmCount: number, status: PlateauStatus): PlateauDetectionResult['confidence'] => {
  if (status === 'insufficient_data' || sessions < 4) return 'low';
  if (sessions >= 8 || e1rmCount >= 5) return 'high';
  return 'medium';
};

export const detectExercisePlateau = ({
  exerciseId,
  history = [],
  e1rmProfile,
  loadFeedback,
  effectiveSetSummary,
  techniqueQualitySummary,
  painPatterns = [],
}: DetectExercisePlateauParams): PlateauDetectionResult => {
  const sessions = relevantSessions(history, exerciseId);
  const sets = relevantExerciseSets(sessions, exerciseId);
  const performances = buildSessionPerformances(sessions, exerciseId);
  const exerciseName = firstExerciseName(sessions, exerciseId);
  const technique = techniqueQualitySummary || buildTechniqueSummaryFromSets(sets);
  const feedback = normalizeLoadFeedback(loadFeedback, sessions, exerciseId);
  const values = e1rmValues(e1rmProfile);
  const matchedPainPatterns = (painPatterns || []).filter(
    (pattern) => pattern.exerciseId === exerciseId || number(pattern.severityAvg) >= 4,
  );
  const painSetCount = sets.filter((set) => set.painFlag).length;
  const painRate = sets.length ? painSetCount / sets.length : 0;
  const flatSessions = countFlatSessions(performances);
  const stableCompletion = isStableCompletion(performances);
  const flatPerformance = performances.length >= 4 && stableCompletion && flatSessions >= Math.max(3, performances.length - 2);
  const flatE1rm = isE1rmFlat(values);
  const completedForVolume = Math.max(number(effectiveSetSummary?.completedSets), sets.length);
  const effectiveSets = number(effectiveSetSummary?.effectiveSets);
  const highConfidenceEffectiveSets = number(effectiveSetSummary?.highConfidenceEffectiveSets);
  const effectiveRate = completedForVolume ? effectiveSets / completedForVolume : 0;
  const highConfidenceRate = effectiveSets ? highConfidenceEffectiveSets / effectiveSets : 0;
  const lowEffectiveVolume =
    completedForVolume >= 8 &&
    ((effectiveSetSummary && effectiveRate < 0.45) || (effectiveSetSummary && highConfidenceRate < 0.25));
  const tooAggressive = feedback.tooHeavy >= 2 && feedback.tooHeavyRate >= 0.4;
  const techniqueLimited = technique.totalSets >= 4 && (technique.poor >= 2 || technique.poorRate >= 0.25);
  const fatigueLimited = matchedPainPatterns.length > 0 || painSetCount >= 2 || painRate >= 0.2;
  const strongPlateau = performances.length >= 6 && stableCompletion && (flatE1rm || flatSessions >= 5);
  const possiblePlateau = performances.length >= 4 && (flatPerformance || flatE1rm);

  const signals: PlateauSignal[] = [];

  if (sessions.length < 3 || sets.length < 5 || performances.length < 3) {
    signals.push(
      signal(
        'data-depth',
        '记录数量不足',
        '同动作正式训练记录还不够，暂时不能稳定判断是否进入平台期。',
        'warning',
      ),
    );
    return {
      exerciseId,
      status: 'insufficient_data',
      title: statusTitle('insufficient_data', exerciseName),
      summary: '当前只能作为观察参考。继续记录几次同动作训练后，平台期判断会更可靠。',
      signals,
      suggestedActions: buildLimitActions('insufficient_data'),
      confidence: 'low',
    };
  }

  signals.push(
    signal(
      'history-depth',
      '历史记录可用于判断',
      `已找到 ${performances.length} 次同动作正式训练记录，系统会结合完成情况和趋势判断。`,
    ),
  );

  if (flatPerformance || flatE1rm) {
    signals.push(
      signal(
        'progress-flat',
        '近期进展放缓',
        flatE1rm
          ? '近期 e1RM 趋势没有明显上升，同时需要结合重量、次数和完成率一起判断。'
          : '近期多次训练的重量、次数和单组表现没有明显上升。',
        strongPlateau ? 'serious' : 'warning',
      ),
    );
  }

  if (stableCompletion) {
    signals.push(signal('completion-stable', '完成率稳定', '近期主要组完成情况较稳定，因此进展放缓更值得关注。'));
  }

  if (tooAggressive) {
    signals.push(
      signal('load-feedback-heavy', '重量反馈偏重', '最近多次反馈显示重量偏重，进展受限可能来自推进过快。', 'serious'),
    );
  } else if (feedback.good >= 2) {
    signals.push(signal('load-feedback-good', '重量反馈稳定', '近期重量反馈整体可接受，进展判断更可靠。'));
  }

  if (techniqueLimited) {
    signals.push(
      signal('technique-quality', '动作质量限制', '近期有多组动作质量偏低，建议先解决执行质量，再判断是否需要加重。', 'serious'),
    );
  }

  if (fatigueLimited) {
    signals.push(
      signal('pain-or-fatigue', '疲劳或不适记录', '近期出现不适标记或相关不适模式，建议把风险控制放在加重之前。', 'serious'),
    );
  }

  if (lowEffectiveVolume) {
    signals.push(
      signal('effective-volume-low', '有效训练量不足', '完成组存在，但高质量有效组不足，可能限制该动作继续进步。', 'warning'),
    );
  }

  let status: PlateauStatus = 'none';
  if (tooAggressive) status = 'load_too_aggressive';
  else if (techniqueLimited) status = 'technique_limited';
  else if (fatigueLimited) status = 'fatigue_limited';
  else if (lowEffectiveVolume) status = 'volume_limited';
  else if (strongPlateau) status = 'plateau';
  else if (possiblePlateau) status = 'possible_plateau';

  if (status === 'none') {
    signals.push(signal('progress-normal', '暂无平台迹象', '近期记录没有显示持续停滞，可以继续按当前建议执行。'));
  }

  const summaryByStatus: Record<PlateauStatus, string> = {
    none: '当前没有看到持续平台期迹象。继续保持记录，后续如果连续多次无进步再复查。',
    possible_plateau: '近期进展有放缓迹象，但还不足以直接判断为平台期。建议继续观察并优先提高完成质量。',
    plateau: '近期多次训练没有明显进步，且完成情况较稳定，可以把它作为计划调整草案中的重点观察项。',
    fatigue_limited: '当前更像是疲劳或不适限制了表现。建议先降低风险，再考虑增加重量或训练量。',
    technique_limited: '当前更像是动作质量限制了表现。建议先稳定动作质量，再判断是否需要继续推进。',
    volume_limited: '当前更像是有效训练量不足。建议先提高高质量有效组，再考虑更激进的推进。',
    load_too_aggressive: '当前更像是重量推进过快。建议下次先维持或小幅回退，避免把短期吃力误判为平台期。',
    insufficient_data: '当前同动作记录不足，暂时不能稳定判断平台期。',
  };

  return {
    exerciseId,
    status,
    title: statusTitle(status, exerciseName),
    summary: summaryByStatus[status],
    signals: unique(signals.map((item) => item.id)).map((id) => signals.find((item) => item.id === id) as PlateauSignal),
    suggestedActions: buildLimitActions(status),
    confidence: confidenceFromEvidence(performances.length, values.length, status),
  };
};
