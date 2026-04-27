import {
  CORRECTION_MODULES,
  DEFAULT_PROGRAM_TEMPLATE,
  DEFAULT_SCREENING_PROFILE,
  FUNCTIONAL_ADDONS,
  MUSCLE_ORDER,
  MUSCLE_RECOVERY_CAPACITY,
} from '../data/trainingData';
import type {
  AppData,
  CorrectionDoseLevel,
  CorrectionModule,
  ExercisePrescription,
  FunctionalAddon,
  ScreeningProfile,
  TrainingSession,
  TrainingTemplate,
  WeeklyMuscleBudget,
  WeeklyPrescription,
} from '../models/training-model';
import { formatCyclePhase } from '../i18n/formatters';
import { buildAdherenceAdjustment } from './adherenceAdjustmentEngine';
import { clamp, completedSets, number, resolveMode, todayKey } from './engineUtils';
import { buildAdaptiveDeloadDecision, getAdaptiveBudgetAdjustment } from './adaptiveFeedbackEngine';
import { buildAdherenceReport } from './analytics';
import { evaluateEffectiveSet, getMuscleContribution } from './effectiveSetEngine';
import { getCurrentMesocycleWeek } from './mesocycleEngine';
import { inferCorrectionPriority, inferFunctionalPriorities } from './screeningEngine';

type WeeklyStat = {
  muscle: string;
  sets: number;
  directSets: number;
  indirectSets: number;
  dates: Set<string>;
};

type PlannedSessionLike = Pick<TrainingSession, 'date'> & {
  exercises?: ExercisePrescription[];
};

const EMPTY_WEEKLY_STAT = (muscle: string): WeeklyStat => ({
  muscle,
  sets: 0,
  directSets: 0,
  indirectSets: 0,
  dates: new Set<string>(),
});

const STATUS_LABELS = {
  exhausted: '恢复额度已满',
  complete: '已完成',
  needsFrequency: '需要补频率',
  needsVolume: '需要补量',
} as const;

const setCountForExercise = (exercise: ExercisePrescription, planned = false) => {
  const rawSets = exercise?.sets;
  if (Array.isArray(rawSets)) {
    return planned ? rawSets.length : rawSets.filter((set) => Boolean((set as { done?: boolean }).done)).length;
  }
  return number(rawSets);
};

const addMuscleCredit = (stats: Record<string, WeeklyStat>, muscle: string, sets: number, date?: string, credit = 1) => {
  if (!stats[muscle]) stats[muscle] = EMPTY_WEEKLY_STAT(muscle);

  const creditedSets = Math.round(sets * credit * 10) / 10;
  stats[muscle].sets += creditedSets;
  if (credit === 1) stats[muscle].directSets += creditedSets;
  else stats[muscle].indirectSets += creditedSets;
  if (creditedSets > 0 && date) stats[muscle].dates.add(date);
};

const addWeightedExerciseCredit = (stats: Record<string, WeeklyStat>, exercise: ExercisePrescription, sets: number, date?: string) => {
  Object.entries(getMuscleContribution(exercise)).forEach(([muscle, contribution]) => addMuscleCredit(stats, muscle, sets, date, contribution));
};

const addSessionToWeeklyStats = (stats: Record<string, WeeklyStat>, session: PlannedSessionLike | null | undefined, planned = false) => {
  (session?.exercises || []).forEach((exercise) => {
    if (planned) {
      const sets = setCountForExercise(exercise, true);
      if (sets) addWeightedExerciseCredit(stats, exercise, sets, session?.date);
      return;
    }

    if (Array.isArray(exercise.sets)) {
      completedSets(exercise).forEach((set) => {
        const result = evaluateEffectiveSet(set, exercise);
        if (result.isEffective) addWeightedExerciseCredit(stats, exercise, result.score, session?.date);
      });
      return;
    }

    const sets = setCountForExercise(exercise, false);
    if (sets) addWeightedExerciseCredit(stats, exercise, sets, session?.date);
  });
};

const getWeekStart = (date = new Date()) => {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const dateKey = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const weekStartKey = () => dateKey(getWeekStart());

const applyExerciseDose = <T extends { sets: number }>(exercise: T, dose: CorrectionDoseLevel, delta = 1) => {
  if (dose === 'boost') return { ...exercise, sets: Math.max(1, number(exercise.sets) + delta) };
  if (dose === 'taper') return { ...exercise, sets: Math.max(1, number(exercise.sets) - delta) };
  return exercise;
};

const toMinimumEffectiveModule = (module: CorrectionModule): CorrectionModule => ({
  ...module,
  dose: 'taper',
  durationMin: Math.max(4, number(module.minimumEffectiveDose) || Math.min(number(module.durationMin), 6)),
  exercises: module.exercises.map((exercise, index) => ({
    ...exercise,
    sets: index === 0 ? 1 : Math.max(1, Math.min(1, number(exercise.sets))),
  })),
});

const toMinimumEffectiveAddon = (addon: FunctionalAddon): FunctionalAddon => ({
  ...addon,
  dose: 'taper',
  durationMin: Math.max(4, number(addon.minimumEffectiveDose) || Math.min(number(addon.durationMin), 6)),
  exercises: addon.exercises.map((exercise, index) => ({
    ...exercise,
    sets: index === 0 ? 1 : Math.max(1, Math.min(1, number(exercise.sets))),
  })),
});

const applyModuleDose = (module: CorrectionModule, screening: ScreeningProfile): CorrectionModule => {
  const dose = screening.adaptiveState?.moduleDose?.[module.targetIssue] || 'baseline';
  const minimumDose = number(module.minimumEffectiveDose) || Math.max(4, number(module.durationMin) - 2);
  const maximumDose = number(module.maxRecommendedDose) || Math.max(number(module.durationMin), number(module.durationMin) + 2);
  const baseDuration = number(module.durationMin);
  const durationMin =
    module.doseStrategy === 'adaptive'
      ? dose === 'boost'
        ? clamp(baseDuration + 2, minimumDose, maximumDose)
        : dose === 'taper'
          ? clamp(baseDuration - 2, minimumDose, maximumDose)
          : clamp(baseDuration, minimumDose, maximumDose)
      : baseDuration;

  return {
    ...module,
    stage: module.insertionStage || module.stage,
    dose,
    durationMin,
    exercises: module.exercises.map((exercise, index) => applyExerciseDose(exercise, dose, index === 0 ? 1 : 0)),
  };
};

const applyAddonDose = (addon: FunctionalAddon, screening: ScreeningProfile, priorities: string[]): FunctionalAddon => {
  const adaptiveDropCount = (screening.adaptiveState?.performanceDrops || []).length;
  const rankedIndex = priorities.indexOf(addon.targetAbility);
  const dose: CorrectionDoseLevel =
    rankedIndex === 0 || adaptiveDropCount >= 2 ? 'boost' : rankedIndex >= 0 ? 'baseline' : 'taper';
  const minimumDose = number(addon.minimumEffectiveDose) || Math.max(4, number(addon.durationMin) - 2);
  const maximumDose = number(addon.maxRecommendedDose) || Math.max(number(addon.durationMin), number(addon.durationMin) + 2);
  const baseDuration = number(addon.durationMin);
  const durationMin =
    addon.doseStrategy === 'adaptive'
      ? dose === 'boost'
        ? clamp(baseDuration + 2, minimumDose, maximumDose)
        : dose === 'taper'
          ? clamp(baseDuration - 2, minimumDose, maximumDose)
          : clamp(baseDuration, minimumDose, maximumDose)
      : baseDuration;

  return {
    ...addon,
    insertionStage: addon.insertionStage || (addon.insertionRule === 'replace_accessory' ? 'after_main' : addon.insertionRule),
    dose,
    durationMin,
    exercises: addon.exercises.map((exercise, index) => applyExerciseDose(exercise, dose, index === 0 ? 1 : 0)),
  };
};

const isUpperDay = (template: Pick<TrainingTemplate, 'id' | 'name' | 'focus'>) => {
  const haystack = [template.id, template.name, template.focus].join(' ').toLowerCase();
  return ['push', 'pull', 'upper', '上肢', '推', '拉'].some((keyword) => haystack.includes(keyword));
};

const findDayTemplateConfig = (
  program: AppData['programTemplate'],
  template: Pick<TrainingTemplate, 'id' | 'name'> & { sourceTemplateId?: string }
) =>
  program.dayTemplates.find(
    (day) => day.id === template.id || (template.sourceTemplateId ? day.id === template.sourceTemplateId : false)
  );

export const selectCorrectionModules = (
  screening: ScreeningProfile,
  template: Pick<TrainingTemplate, 'id' | 'name' | 'focus'>,
  strategy: AppData['programTemplate']['correctionStrategy'] = 'moderate'
) => {
  const priorities = inferCorrectionPriority(screening);
  const limitBase = strategy === 'aggressive' ? 3 : strategy === 'light' ? 1 : 2;
  const boostedCount = priorities.filter((issue) => screening.adaptiveState?.moduleDose?.[issue] === 'boost').length;
  const limit = clamp(limitBase + Math.min(1, boostedCount), 1, 4);

  const prioritized = priorities
    .map((issue) => CORRECTION_MODULES.find((module) => module.targetIssue === issue))
    .filter((module): module is CorrectionModule => Boolean(module))
    .map((module) => applyModuleDose(module, screening))
    .filter((module) => {
      if (module.dose === 'boost' || module.dose === 'baseline') return true;
      return number(screening.adaptiveState?.issueScores?.[module.targetIssue]) > 1;
    });

  if (isUpperDay(template) && !prioritized.some((module) => module.id === 'corr_upper_crossed_01')) {
    const upperCrossed = CORRECTION_MODULES.find((module) => module.id === 'corr_upper_crossed_01');
    if (upperCrossed) prioritized.unshift(applyModuleDose(upperCrossed, screening));
  }

  return prioritized.slice(0, limit);
};

export const selectFunctionalAddons = (
  screening: ScreeningProfile,
  _template: Pick<TrainingTemplate, 'id' | 'name' | 'focus'>,
  strategy: AppData['programTemplate']['functionalStrategy'] = 'standard'
) => {
  const priorities = inferFunctionalPriorities(screening);
  const limitBase = strategy === 'enhanced' ? 2 : 1;
  const adaptiveBoost = (screening.adaptiveState?.performanceDrops || []).length >= 2 ? 1 : 0;
  const limit = clamp(limitBase + adaptiveBoost, 1, 3);

  return priorities
    .map((ability) => FUNCTIONAL_ADDONS.find((addon) => addon.targetAbility === ability))
    .filter((addon): addon is FunctionalAddon => Boolean(addon))
    .map((addon) => applyAddonDose(addon, screening, priorities))
    .slice(0, limit);
};

export const buildSupportPlan = (
  data: Partial<AppData> & { screeningProfile?: ScreeningProfile; programTemplate?: AppData['programTemplate'] },
  template: Pick<TrainingTemplate, 'id' | 'name' | 'focus' | 'duration'> & { sourceTemplateId?: string }
) => {
  const program = data.programTemplate || DEFAULT_PROGRAM_TEMPLATE;
  const screening = data.screeningProfile || DEFAULT_SCREENING_PROFILE;
  const history = data.history || [];
  const adherenceReport = buildAdherenceReport(history);
  const adherenceAdjustment = buildAdherenceAdjustment(adherenceReport, program, screening.adaptiveState);
  const mesocycleWeek = getCurrentMesocycleWeek(data.mesocyclePlan);
  const deloadDecision = buildAdaptiveDeloadDecision(data);

  let correctionModules = selectCorrectionModules(screening, template, program.correctionStrategy);
  let functionalAddons = selectFunctionalAddons(screening, template, program.functionalStrategy);
  const dayConfig = findDayTemplateConfig(program, template);

  if (dayConfig?.correctionBlockIds?.length) {
    correctionModules = dayConfig.correctionBlockIds
      .map((id) => CORRECTION_MODULES.find((module) => module.id === id))
      .filter((module): module is CorrectionModule => Boolean(module))
      .map((module) => applyModuleDose(module, screening));
  }

  if (dayConfig?.functionalBlockIds?.length) {
    const functionalPriorities = inferFunctionalPriorities(screening);
    functionalAddons = dayConfig.functionalBlockIds
      .map((id) => FUNCTIONAL_ADDONS.find((addon) => addon.id === id))
      .filter((addon): addon is FunctionalAddon => Boolean(addon))
      .map((addon) => applyAddonDose(addon, screening, functionalPriorities));
  }

  if (adherenceAdjustment.correctionDoseAdjustment === 'reduce') {
    correctionModules = correctionModules.map((module) => ({
      ...module,
      durationMin: Math.max(4, number(module.durationMin) - 2),
      exercises: module.exercises.map((exercise) => ({ ...exercise, sets: Math.max(1, number(exercise.sets) - 1) })),
    }));
  } else if (adherenceAdjustment.correctionDoseAdjustment === 'minimal') {
    correctionModules = correctionModules.slice(0, 1).map(toMinimumEffectiveModule);
  }

  if (adherenceAdjustment.functionalDoseAdjustment === 'reduce') {
    functionalAddons = functionalAddons.slice(0, 1).map((addon) => ({
      ...addon,
      durationMin: Math.max(4, number(addon.durationMin) - 2),
      exercises: addon.exercises.map((exercise) => ({ ...exercise, sets: Math.max(1, number(exercise.sets) - 1) })),
    }));
  } else if (adherenceAdjustment.functionalDoseAdjustment === 'remove_optional') {
    functionalAddons = functionalAddons.slice(0, 1).map(toMinimumEffectiveAddon);
  }

  if (mesocycleWeek.phase === 'deload' || deloadDecision.level === 'red') {
    correctionModules = correctionModules.slice(0, 1).map(toMinimumEffectiveModule);
    functionalAddons = functionalAddons.slice(0, 1).map(toMinimumEffectiveAddon);
  }

  const mainlineDurationMin = number(dayConfig?.estimatedDurationMin) || number(template.duration);
  const correctionMinutes = correctionModules.reduce((sum, module) => sum + number(module.durationMin), 0);
  const functionalMinutes = functionalAddons.reduce((sum, addon) => sum + number(addon.durationMin), 0);
  const durationHint = number(adherenceAdjustment.sessionDurationHint) || 0;
  const totalDurationMin = durationHint
    ? Math.max(1, Math.min(durationHint, mainlineDurationMin + correctionMinutes + functionalMinutes))
    : Math.max(1, mainlineDurationMin + correctionMinutes + functionalMinutes);
  const correctionRatio = Math.round((correctionMinutes / totalDurationMin) * 100);
  const functionalRatio = Math.round((functionalMinutes / totalDurationMin) * 100);

  return {
    primaryGoal: program.primaryGoal,
    mainline: {
      name: template.name,
      splitType: program.splitType,
      durationMin: mainlineDurationMin,
      ratio: Math.max(0, 100 - correctionRatio - functionalRatio),
    },
    correctionModules,
    functionalAddons,
    totalDurationMin,
    ratios: {
      mainline: Math.max(0, 100 - correctionRatio - functionalRatio),
      correction: correctionRatio,
      functional: functionalRatio,
    },
    adherenceAdjustment,
  };
};

const recoveryMultiplierForMuscle = (data: Partial<AppData>, muscle: string) => {
  const status = data.todayStatus as Partial<AppData['todayStatus']> | undefined;
  let multiplier = 1;

  if (status?.sleep === '差') multiplier -= 0.15;
  if (status?.energy === '低') multiplier -= 0.15;
  if ((status?.soreness || []).includes(muscle as never)) multiplier -= 0.25;

  const recentSessions = (data.history || []).slice(0, 6);
  const sorenessHits = recentSessions.filter((session) => (session.status?.soreness || []).includes(muscle as never)).length;
  if (sorenessHits >= 2) multiplier -= 0.15;

  const adaptiveState = data.screeningProfile?.adaptiveState;
  recentSessions.forEach((session) => {
    (session.exercises || []).forEach((exercise) => {
      const baseId = exercise.baseId || exercise.id;
      if (exercise.muscle !== muscle) return;
      if ((adaptiveState?.performanceDrops || []).includes(baseId)) multiplier -= 0.08;
      if (number(adaptiveState?.painByExercise?.[baseId]) >= 2) multiplier -= 0.12;
    });
  });

  return clamp(multiplier, 0.4, 1.1);
};

export const buildWeeklyPrescription = (
  data: Partial<AppData> & { history?: TrainingSession[]; activeSession?: TrainingSession | null },
  extraPlan: PlannedSessionLike | null = null
): WeeklyPrescription => {
  const mode = resolveMode(data.trainingMode || 'hybrid');
  const start = weekStartKey();
  const deloadDecision = buildAdaptiveDeloadDecision(data);
  const mesocycleWeek = getCurrentMesocycleWeek(data.mesocyclePlan);
  const adherenceAdjustment = buildAdherenceAdjustment(
    buildAdherenceReport(data.history || []),
    data.programTemplate || DEFAULT_PROGRAM_TEMPLATE,
    data.screeningProfile?.adaptiveState
  );
  const stats = MUSCLE_ORDER.reduce<Record<string, WeeklyStat>>((acc, muscle) => {
    acc[muscle] = EMPTY_WEEKLY_STAT(muscle);
    return acc;
  }, {});

  (data.history || [])
    .filter((session) => session.date >= start)
    .forEach((session) => addSessionToWeeklyStats(stats, session));

  if (data.activeSession) addSessionToWeeklyStats(stats, data.activeSession);
  if (extraPlan) addSessionToWeeklyStats(stats, extraPlan, true);

  const muscles: WeeklyMuscleBudget[] = MUSCLE_ORDER.map((muscle) => {
    const item = stats[muscle];
    const baseTarget = number(mode.weeklyTargets[muscle]) || 8;
    const { targetMultiplier, reasons } = getAdaptiveBudgetAdjustment(data, muscle, deloadDecision);
    const phaseMultiplier = mesocycleWeek.volumeMultiplier || 1;
    const adherenceMultiplier = adherenceAdjustment.weeklyVolumeMultiplier || 1;
    const deloadMultiplier = deloadDecision.level === 'red' ? 0.85 : 1;
    const target = Math.max(1, Math.round(baseTarget * targetMultiplier * phaseMultiplier * adherenceMultiplier * deloadMultiplier * 10) / 10);
    const sets = Math.round(item.sets * 10) / 10;
    const frequency = item.dates.size;
    const recoveryMultiplier = recoveryMultiplierForMuscle(data, muscle);
    const capacity = Math.round((number(MUSCLE_RECOVERY_CAPACITY[muscle]) || target + 4) * recoveryMultiplier * 10) / 10;
    const remaining = Math.max(0, Math.round((target - sets) * 10) / 10);
    const remainingCapacity = Math.max(0, Math.round((capacity - sets) * 10) / 10);
    const todayBudget = Math.max(0, Math.min(remaining, remainingCapacity));

    return {
      muscle,
      baseTarget,
      target,
      sets,
      remaining,
      capacity,
      remainingCapacity,
      todayBudget,
      targetMultiplier: Math.round(targetMultiplier * phaseMultiplier * adherenceMultiplier * deloadMultiplier * 100) / 100,
      adjustmentReasons: [
        ...reasons,
        ...(phaseMultiplier !== 1 ? [`当前周期 ${formatCyclePhase(mesocycleWeek.phase)}，周剂量倍率 ${phaseMultiplier}`] : []),
        ...(adherenceMultiplier !== 1 ? adherenceAdjustment.reasons : []),
      ],
      recoveryMultiplier,
      frequency,
      targetFrequency: 2,
      directSets: Math.round(item.directSets * 10) / 10,
      indirectSets: Math.round(item.indirectSets * 10) / 10,
      status:
        remainingCapacity <= 0
          ? STATUS_LABELS.exhausted
          : sets >= target
            ? STATUS_LABELS.complete
            : frequency < 2
              ? STATUS_LABELS.needsFrequency
              : STATUS_LABELS.needsVolume,
    };
  });

  const priorityMuscles = muscles
    .filter((item) => item.remaining > 0 && number(item.todayBudget) > 0)
    .sort((left, right) => right.remaining / Math.max(1, right.target) - left.remaining / Math.max(1, left.target))
    .map((item) => item.muscle);

  return {
    mode,
    weekStart: start || todayKey(),
    muscles,
    priorityMuscles,
  };
};

export const getMuscleRemaining = (weeklyPrescription: WeeklyPrescription | null | undefined, muscle: string) =>
  weeklyPrescription?.muscles.find((item) => item.muscle === muscle)?.remaining ?? Infinity;

export const getMuscleBudget = (weeklyPrescription: WeeklyPrescription | null | undefined, muscle: string) =>
  weeklyPrescription?.muscles.find((item) => item.muscle === muscle) || null;
