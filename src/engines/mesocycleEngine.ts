import { DEFAULT_MESOCYCLE_PLAN } from '../data/trainingData';
import type { CyclePhase, IntensityBias, MesocyclePlan, MesocycleWeek, PrimaryGoal } from '../models/training-model';
import { number, todayKey } from './engineUtils';

const addWeeks = (dateString: string, weeks: number) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return todayKey();
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
};

const clampWeekIndex = (weekIndex: number, lengthWeeks: number) => Math.max(0, Math.min(lengthWeeks - 1, number(weekIndex)));

const makeWeek = (weekIndex: number, phase: CyclePhase, volumeMultiplier: number, intensityBias: IntensityBias, notes?: string): MesocycleWeek => ({
  weekIndex,
  phase,
  volumeMultiplier,
  intensityBias,
  notes,
});

const buildWeeks = (lengthWeeks: 4 | 5 | 6): MesocycleWeek[] => {
  if (lengthWeeks === 4) {
    return [
      makeWeek(0, 'base', 0.9, 'normal', '重新建立节奏。'),
      makeWeek(1, 'build', 1, 'normal', '回到标准推进。'),
      makeWeek(2, 'overload', 1.1, 'aggressive', '恢复允许时轻推一周。'),
      makeWeek(3, 'deload', 0.6, 'conservative', '主动减量恢复。'),
    ];
  }

  if (lengthWeeks === 5) {
    return [
      makeWeek(0, 'base', 0.9, 'normal', '重新建立节奏。'),
      makeWeek(1, 'build', 1, 'normal', '回到标准推进。'),
      makeWeek(2, 'overload', 1.1, 'aggressive', '轻推一周。'),
      makeWeek(3, 'build', 1.05, 'normal', '巩固而不过冲。'),
      makeWeek(4, 'deload', 0.6, 'conservative', '恢复周。'),
    ];
  }

  return [
    makeWeek(0, 'base', 0.9, 'normal', '重新建立节奏。'),
    makeWeek(1, 'build', 1, 'normal', '回到标准推进。'),
    makeWeek(2, 'build', 1.05, 'normal', '把容量稳住。'),
    makeWeek(3, 'overload', 1.1, 'aggressive', '最后一周冲量。'),
    makeWeek(4, 'overload', 1.1, 'aggressive', '保持但不要失控。'),
    makeWeek(5, 'deload', 0.6, 'conservative', '恢复周。'),
  ];
};

export const createMesocyclePlan = (
  primaryGoal: PrimaryGoal = 'hypertrophy',
  startDate = todayKey(),
  lengthWeeks: 4 | 5 | 6 = 4
): MesocyclePlan => ({
  ...DEFAULT_MESOCYCLE_PLAN,
  id: `meso-${lengthWeeks}-${startDate}`,
  startDate,
  lengthWeeks,
  currentWeekIndex: 0,
  primaryGoal,
  weeks: buildWeeks(lengthWeeks),
});

export const getMesocycleWeekIndex = (plan: MesocyclePlan, referenceDate = todayKey()) => {
  const start = new Date(plan.startDate);
  const current = new Date(referenceDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) return clampWeekIndex(plan.currentWeekIndex, plan.lengthWeeks);
  const diffDays = Math.floor((current.getTime() - start.getTime()) / 86400000);
  return Math.max(0, Math.floor(diffDays / 7));
};

export const getCurrentMesocycleWeek = (plan?: MesocyclePlan | null, referenceDate = todayKey()) => {
  const resolved = plan || DEFAULT_MESOCYCLE_PLAN;
  const weekIndex = clampWeekIndex(getMesocycleWeekIndex(resolved, referenceDate), resolved.lengthWeeks);
  return resolved.weeks[weekIndex] || resolved.weeks[resolved.weeks.length - 1];
};

export const sanitizeMesocyclePlan = (plan?: Partial<MesocyclePlan> | null): MesocyclePlan => {
  if (!plan) return createMesocyclePlan();
  const lengthWeeks = [4, 5, 6].includes(number(plan.lengthWeeks)) ? (number(plan.lengthWeeks) as 4 | 5 | 6) : 4;
  const fallback = createMesocyclePlan((plan.primaryGoal as PrimaryGoal) || 'hypertrophy', plan.startDate || todayKey(), lengthWeeks);

  return {
    ...fallback,
    ...plan,
    lengthWeeks,
    currentWeekIndex: clampWeekIndex(number(plan.currentWeekIndex), lengthWeeks),
    weeks:
      Array.isArray(plan.weeks) && plan.weeks.length
        ? plan.weeks.slice(0, lengthWeeks).map((week, index) => ({
            ...fallback.weeks[index],
            ...week,
            weekIndex: index,
            phase: (week.phase || fallback.weeks[index].phase) as CyclePhase,
            intensityBias: (week.intensityBias || fallback.weeks[index].intensityBias) as IntensityBias,
            volumeMultiplier: number(week.volumeMultiplier) || fallback.weeks[index].volumeMultiplier,
          }))
        : fallback.weeks,
  };
};

export const advanceMesocycleIfNeeded = (plan: MesocyclePlan, referenceDate = todayKey()) => {
  const weekIndex = getMesocycleWeekIndex(plan, referenceDate);
  if (weekIndex < plan.lengthWeeks) return { ...plan, currentWeekIndex: weekIndex };
  return createMesocyclePlan(plan.primaryGoal, addWeeks(plan.startDate, plan.lengthWeeks), plan.lengthWeeks);
};
