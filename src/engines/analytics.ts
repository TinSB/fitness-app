import type { AdherenceReport, AppData, BodyWeightEntry, DeloadDecision, SupportSkipReason, TrainingSession, TrainingSetLog } from '../models/training-model';
import { buildAdaptiveDeloadDecision } from './adaptiveFeedbackEngine';
import { completedSets, formatDate, monthKey, number, sessionCompletedSets, sessionVolume, setVolume } from './engineUtils';

type ExerciseTrendPoint = {
  date: string;
  name: string;
  topWeight: number;
  topReps: number;
  volume: number;
};

type PrItem = {
  key: string;
  type: string;
  exercise: string;
  value: string;
  raw: number;
  date: string;
};

type DeloadSignal = Pick<DeloadDecision, 'triggered' | 'level' | 'strategy' | 'reasons' | 'title' | 'options' | 'autoSwitchTemplateId' | 'volumeMultiplier'>;

type SkipAggregate = {
  count: number;
  reasons: Record<string, number>;
};

const ratio = (actual: number, planned: number) => (planned > 0 ? Math.round((actual / planned) * 100) : 0);
const incrementReason = (aggregate: SkipAggregate, reason?: SupportSkipReason) => {
  if (!reason) return;
  aggregate.reasons[reason] = (aggregate.reasons[reason] || 0) + 1;
};
const mostCommonReason = (reasons: Record<string, number>) =>
  Object.entries(reasons).sort((left, right) => right[1] - left[1])[0]?.[0];

const setCountForExercise = (sessionExercise: TrainingSession['exercises'][number]) =>
  Array.isArray(sessionExercise.sets) ? sessionExercise.sets.length : number(sessionExercise.sets);

const supportPlannedFromBlock = (session: TrainingSession, blockType: 'correction' | 'functional') => {
  const blocks = blockType === 'correction' ? session.correctionBlock || [] : session.functionalBlock || [];
  return blocks.reduce(
    (sum, module) => sum + module.exercises.reduce((moduleSum, exercise) => moduleSum + Math.max(0, number(exercise.sets)), 0),
    0
  );
};

const completedHighQualitySets = (sessionExercise: TrainingSession['exercises'][number]) =>
  completedSets(sessionExercise).filter((set) => set.techniqueQuality !== 'poor');

export const CORE_TREND_EXERCISES = [
  { id: 'bench-press', label: '卧推' },
  { id: 'squat', label: '深蹲' },
  { id: 'romanian-deadlift', label: 'RDL' },
  { id: 'lat-pulldown', label: '下拉' },
] as const;

export const buildExerciseTrend = (history: TrainingSession[], exerciseId: string): ExerciseTrendPoint[] =>
  history
    .flatMap((session) =>
      (session.exercises || [])
        .filter((exercise) => exercise.baseId === exerciseId || exercise.id === exerciseId)
        .map((exercise) => {
          const sets = completedHighQualitySets(exercise);
          const topSet = sets.reduce<TrainingSetLog | null>((best, set) => {
            if (!best) return set;
            if (number(set.weight) > number(best.weight)) return set;
            if (number(set.weight) === number(best.weight) && number(set.reps) > number(best.reps)) return set;
            return best;
          }, null);

          return {
            date: session.date,
            name: exercise.name,
            topWeight: topSet ? number(topSet.weight) : 0,
            topReps: topSet ? number(topSet.reps) : 0,
            volume: sets.reduce((sum, set) => sum + setVolume(set), 0),
          };
        })
    )
    .filter((item) => item.topWeight || item.volume)
    .slice(0, 6);

export const trendStatus = (trend: ExerciseTrendPoint[]) => {
  if (trend.length < 3) return '数据不足';

  const recentBest = Math.max(...trend.slice(0, 2).map((item) => item.topWeight * item.topReps));
  const olderBest = Math.max(...trend.slice(2).map((item) => item.topWeight * item.topReps));
  if (recentBest > olderBest) return '推进中';
  if (recentBest < olderBest * 0.95) return '回落';
  return '可能停滞';
};

export const buildDeloadSignal = (data: Partial<AppData>): DeloadSignal => {
  const decision = buildAdaptiveDeloadDecision(data);
  return {
    triggered: decision.triggered,
    level: decision.level,
    strategy: decision.strategy,
    reasons: decision.reasons,
    title: decision.title,
    options: decision.options,
    autoSwitchTemplateId: decision.autoSwitchTemplateId,
    volumeMultiplier: decision.volumeMultiplier,
  };
};

export const buildPrs = (history: TrainingSession[]): PrItem[] => {
  const maxWeight = new Map<string, PrItem>();
  const fixedReps = new Map<string, PrItem>();
  const sessionTotals = new Map<string, PrItem>();

  history.forEach((session) => {
    session.exercises.forEach((exercise) => {
      const sets = completedHighQualitySets(exercise);
      const total = sets.reduce((sum, set) => sum + setVolume(set), 0);
      const sessionKey = `${exercise.baseId || exercise.id}-volume`;
      const currentSessionTotal = sessionTotals.get(sessionKey);

      if (total && (!currentSessionTotal || total > currentSessionTotal.raw)) {
        sessionTotals.set(sessionKey, {
          key: sessionKey,
          type: '单次训练总量 PR',
          exercise: exercise.name,
          value: `${Math.round(total)}kg`,
          raw: total,
          date: session.date,
        });
      }

      sets.forEach((set) => {
        const weight = number(set.weight);
        const reps = number(set.reps);
        const weightKey = `${exercise.baseId || exercise.id}-weight`;
        const repKey = `${exercise.baseId || exercise.id}-${weight}-reps`;
        const currentWeight = maxWeight.get(weightKey);
        if (!currentWeight || weight > currentWeight.raw) {
          maxWeight.set(weightKey, {
            key: weightKey,
            type: '最大重量 PR',
            exercise: exercise.name,
            value: `${weight}kg x ${reps}`,
            raw: weight,
            date: session.date,
          });
        }

        const currentReps = fixedReps.get(repKey);
        if (!currentReps || reps > currentReps.raw) {
          fixedReps.set(repKey, {
            key: repKey,
            type: '固定重量次数 PR',
            exercise: exercise.name,
            value: `${weight}kg x ${reps}`,
            raw: reps,
            date: session.date,
          });
        }
      });
    });
  });

  return [...maxWeight.values(), ...fixedReps.values(), ...sessionTotals.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
};

export const buildWeeklyReport = (history: TrainingSession[], bodyWeights: BodyWeightEntry[]) => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7);

  const sessions = history.filter((session) => new Date(session.date) >= start);
  const volume = sessions.reduce((sum, session) => sum + sessionVolume(session), 0);
  const sets = sessions.reduce((sum, session) => sum + sessionCompletedSets(session), 0);
  const latestWeight = bodyWeights[0]?.value;
  const focus = sessions.reduce<Record<string, number>>((acc, session) => {
    const key = session.focus || session.templateName;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const focusText = Object.entries(focus)
    .map(([key, value]) => `${key}${value}次`)
    .join(' / ') || '暂无';

  return [
    `训练次数：${sessions.length}`,
    `完成组数：${sets}`,
    `总训练量：${Math.round(volume)}kg`,
    `训练分布：${focusText}`,
    `当前体重：${latestWeight ? `${latestWeight}kg` : '未记录'}`,
  ].join('\n');
};

export const makeCsv = (history: TrainingSession[]) => {
  const rows: Array<Array<string | number>> = [['date', 'template', 'exercise', 'set', 'weight', 'reps', 'rpe', 'rir', 'pain_flag', 'technique_quality', 'note']];

  history.forEach((session) => {
    session.exercises.forEach((exercise) => {
      completedSets(exercise).forEach((set, index) => {
        rows.push([
          session.date,
          session.templateName,
          exercise.name,
          index + 1,
          set.weight,
          set.reps,
          String(set.rpe ?? ''),
          String(set.rir ?? ''),
          set.painFlag ? '1' : '0',
          set.techniqueQuality || '',
          set.note || '',
        ]);
      });
    });
  });

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? '');
          return text.includes(',') || text.includes('"') || text.includes('\n') ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(',')
    )
    .join('\n');
};

export const downloadText = (filename: string, text: string, type: string) => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const buildMonthStats = (history: TrainingSession[], bodyWeights: BodyWeightEntry[]) => {
  const currentMonth = monthKey();
  const monthSessions = history.filter((session) => session.date?.startsWith(currentMonth));
  const last7Date = new Date();
  last7Date.setDate(last7Date.getDate() - 7);
  const recentWeights = bodyWeights.filter((entry) => new Date(entry.date) >= last7Date);
  const sevenDayAverage = recentWeights.length
    ? recentWeights.reduce((sum, entry) => sum + number(entry.value), 0) / recentWeights.length
    : null;

  return {
    monthSessions,
    monthVolume: monthSessions.reduce((sum, session) => sum + sessionVolume(session), 0),
    monthMinutes: monthSessions.reduce((sum, session) => sum + number(session.durationMin), 0),
    sevenDayAverage,
    lastWeights: bodyWeights.slice(0, 5),
  };
};

export const buildRecentSessionBars = (history: TrainingSession[]) => {
  const lastEightSessions = history.slice(0, 8).reverse();
  const maxBar = Math.max(1, ...lastEightSessions.map((session) => sessionVolume(session)));

  return {
    lastEightSessions: lastEightSessions.map((session) => ({
      ...session,
      volume: sessionVolume(session),
      label: `${formatDate(session.date)} · ${session.templateName}`,
    })),
    maxBar,
  };
};

export const buildAdherenceReport = (history: TrainingSession[]): AdherenceReport => {
  const recentSessions = history.slice(0, 7);
  const skippedExercises = new Map<string, SkipAggregate>();
  const skippedSupportExercises = new Map<string, SkipAggregate>();
  const supportReasonCounts: Record<string, number> = {};

  let plannedSets = 0;
  let actualSets = 0;
  let mainPlannedSets = 0;
  let mainActualSets = 0;
  let correctionPlannedSets = 0;
  let correctionActualSets = 0;
  let functionalPlannedSets = 0;
  let functionalActualSets = 0;
  let supportDataSessions = 0;

  const sessionRows = recentSessions.map((session) => {
    const mainPlanned = session.exercises.reduce((sum, exercise) => sum + setCountForExercise(exercise), 0);
    const mainActual = session.exercises.reduce((sum, exercise) => sum + completedSets(exercise).length, 0);
    const supportLogs = Array.isArray(session.supportExerciseLogs) ? session.supportExerciseLogs : [];
    const hasSupportData = supportLogs.length > 0;

    const correctionPlanned = hasSupportData
      ? supportLogs.filter((item) => item.blockType === 'correction').reduce((sum, item) => sum + number(item.plannedSets), 0)
      : 0;
    const correctionActual = hasSupportData
      ? supportLogs.filter((item) => item.blockType === 'correction').reduce((sum, item) => sum + Math.min(number(item.completedSets), number(item.plannedSets)), 0)
      : 0;

    const functionalPlanned = hasSupportData
      ? supportLogs.filter((item) => item.blockType === 'functional').reduce((sum, item) => sum + number(item.plannedSets), 0)
      : 0;
    const functionalActual = hasSupportData
      ? supportLogs.filter((item) => item.blockType === 'functional').reduce((sum, item) => sum + Math.min(number(item.completedSets), number(item.plannedSets)), 0)
      : 0;

    plannedSets += mainPlanned + correctionPlanned + functionalPlanned;
    actualSets += mainActual + correctionActual + functionalActual;
    mainPlannedSets += mainPlanned;
    mainActualSets += mainActual;
    correctionPlannedSets += correctionPlanned;
    correctionActualSets += correctionActual;
    functionalPlannedSets += functionalPlanned;
    functionalActualSets += functionalActual;
    if (hasSupportData) supportDataSessions += 1;

    session.exercises.forEach((exercise) => {
      const planned = setCountForExercise(exercise);
      const actual = completedSets(exercise).length;
      if (planned > actual) {
        const key = exercise.baseId || exercise.id;
        const current = skippedExercises.get(key) || { count: 0, reasons: {} };
        current.count += 1;
        skippedExercises.set(key, current);
      }
    });

    supportLogs.forEach((item) => {
      if (number(item.completedSets) >= number(item.plannedSets)) return;
      const key = `${item.moduleId}:${item.exerciseId}:${item.blockType}`;
      const current = skippedSupportExercises.get(key) || { count: 0, reasons: {} };
      current.count += 1;
      incrementReason(current, item.skippedReason);
      incrementReason({ count: 0, reasons: supportReasonCounts }, item.skippedReason);
      skippedSupportExercises.set(key, current);
    });

    return {
      sessionId: session.id,
      date: session.date,
      templateName: session.templateName,
      plannedSets: mainPlanned + correctionPlanned + functionalPlanned,
      actualSets: mainActual + correctionActual + functionalActual,
      adherenceRate: ratio(mainActual + correctionActual + functionalActual, mainPlanned + correctionPlanned + functionalPlanned),
      mainPlannedSets: mainPlanned,
      mainActualSets: mainActual,
      correctionPlannedSets: correctionPlanned || (hasSupportData ? 0 : supportPlannedFromBlock(session, 'correction')),
      correctionActualSets: correctionActual,
      functionalPlannedSets: functionalPlanned || (hasSupportData ? 0 : supportPlannedFromBlock(session, 'functional')),
      functionalActualSets: functionalActual,
      hasSupportData,
    };
  });

  const overallRate = ratio(actualSets, plannedSets);
  const mainlineRate = ratio(mainActualSets, mainPlannedSets);
  const correctionRate = correctionPlannedSets > 0 ? ratio(correctionActualSets, correctionPlannedSets) : undefined;
  const functionalRate = functionalPlannedSets > 0 ? ratio(functionalActualSets, functionalPlannedSets) : undefined;

  const suggestions: string[] = [];
  const topSkipReason = mostCommonReason(supportReasonCounts);

  if (overallRate < 70) suggestions.push('最近整体完成率偏低，下周先降低复杂度，让计划更容易执行。');
  if (mainlineRate < 75) suggestions.push('主训练完成率也在下降，下周建议把周训练量下修 10%-20%。');
  if (correctionRate !== undefined && correctionRate < 60) suggestions.push('纠偏模块经常做不完，先缩到最小有效剂量。');
  if (functionalRate !== undefined && functionalRate < 60) suggestions.push('功能补丁完成率偏低，先只保留最关键的一项。');
  if (topSkipReason === 'time') suggestions.push('最近最常见的跳过原因是时间不足，优先缩短训练而不是继续堆内容。');
  if (topSkipReason === 'pain') suggestions.push('最近有较多因为不适而跳过的记录，下周应优先替代动作或降低负荷。');
  if (!suggestions.length) suggestions.push('最近完成度稳定，可以继续按当前结构推进。');

  const supportCoverage = recentSessions.length ? supportDataSessions / recentSessions.length : 1;
  const confidence: AdherenceReport['confidence'] = supportCoverage >= 0.75 ? 'high' : supportCoverage >= 0.35 ? 'medium' : 'low';

  return {
    recentSessionCount: recentSessions.length,
    plannedSets,
    actualSets,
    overallRate,
    mainlineRate,
    correctionRate,
    functionalRate,
    recentSessions: sessionRows,
    skippedExercises: [...skippedExercises.entries()]
      .map(([exerciseId, aggregate]) => ({
        exerciseId,
        count: aggregate.count,
        mostCommonReason: mostCommonReason(aggregate.reasons),
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    skippedSupportExercises: [...skippedSupportExercises.entries()]
      .map(([key, aggregate]) => {
        const [moduleId, exerciseId, blockType] = key.split(':');
        return {
          exerciseId,
          moduleId,
          blockType: blockType as 'correction' | 'functional',
          count: aggregate.count,
          mostCommonReason: mostCommonReason(aggregate.reasons),
        };
      })
      .sort((left, right) => right.count - left.count)
      .slice(0, 6),
    suggestions,
    confidence,
  };
};
