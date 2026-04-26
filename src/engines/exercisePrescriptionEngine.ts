import { DEFAULT_SCREENING_PROFILE, DEFAULT_TECHNIQUE_STANDARD, PRESCRIPTION_SOURCES } from '../data/trainingData';
import type {
  DeloadDecision,
  ExercisePrescription,
  ExerciseTemplate,
  MesocyclePlan,
  ReadinessSignal,
  ReadinessResult,
  ScreeningProfile,
  TodayStatus,
  TrainingMode,
  TrainingSession,
  TrainingTemplate,
  WeeklyPrescription,
} from '../models/training-model';
import { applyAdaptiveExerciseRules, buildAdaptiveConservativeDecision, buildAdaptiveDeloadDecision } from './adaptiveFeedbackEngine';
import { buildAdherenceReport } from './analytics';
import { clamp, clone, enrichExercise, getPrimaryMuscles, number, resolveMode, safeNumber } from './engineUtils';
import { getCurrentMesocycleWeek } from './mesocycleEngine';
import { buildPainPatterns, getExercisePainPattern } from './painPatternEngine';
import { buildTodayReadiness } from './readinessEngine';
import { getMuscleBudget, getMuscleRemaining } from './supportPlanEngine';

const NONE_SORENESS: TodayStatus['soreness'][number] = '无';
const POOR_SLEEP: TodayStatus['sleep'] = '差';
const LOW_ENERGY: TodayStatus['energy'] = '低';

const statusHitsMuscle = (status: TodayStatus, muscle: string) => (status.soreness || []).includes(muscle as never);
const hasPoorSleep = (status: TodayStatus) => status.sleep === POOR_SLEEP;
const hasLowEnergy = (status: TodayStatus) => status.energy === LOW_ENERGY;

const mapReadinessToSignal = (result: ReadinessResult, poorSleepDays: number): ReadinessSignal => {
  const level: ReadinessSignal['level'] = result.level === 'high' ? 'green' : result.level === 'medium' ? 'yellow' : 'red';
  const title =
    result.trainingAdjustment === 'recovery'
      ? '恢复优先'
      : result.trainingAdjustment === 'conservative'
        ? '保守推进'
        : result.trainingAdjustment === 'push'
          ? '状态不错'
          : '正常推进';
  const advice =
    result.trainingAdjustment === 'recovery'
      ? '今天优先把训练做得更轻、更短、更稳。'
      : result.trainingAdjustment === 'conservative'
        ? '今天可以训练，但把顶组和辅助动作先收一点。'
        : result.trainingAdjustment === 'push'
          ? '恢复状态较好，可以正常推进，但不需要强行冲重量。'
          : '当前状态允许按计划推进。';

  return {
    level,
    label: `${result.score} / 100`,
    title,
    advice,
    reasons: result.reasons,
    poorSleepDays,
  };
};

const recentPoorSleepDays = (status: TodayStatus, history: TrainingSession[] = []) => {
  let count = hasPoorSleep(status) ? 1 : 0;
  for (const session of history) {
    if (session.status?.sleep === POOR_SLEEP) count += 1;
    else break;
  }
  return count;
};

const prioritizeAlternatives = (
  exercise: ExercisePrescription,
  screening: ScreeningProfile,
  readinessLevel: ReadinessSignal['level'] = 'green',
  deloadLevel: DeloadDecision['level'] = 'none',
  painPreference: 'watch' | 'substitute' | 'deload' | 'seek_professional' = 'watch'
) => {
  const alternatives = Array.isArray(exercise.alternatives) ? [...exercise.alternatives] : [];
  if (!alternatives.length) return alternatives;

  const adaptiveDecision = buildAdaptiveConservativeDecision(exercise, screening, readinessLevel, deloadLevel);
  const suggestedName = String(exercise.replacementSuggested || '').toLowerCase();

  const scoreAlternative = (name: string) => {
    const normalized = String(name || '').toLowerCase();
    let score = 0;

    if (adaptiveDecision.preferStableAlternatives) {
      if (/(machine|smith|cable|landmine|鍣ㄦ|鍙插瘑鏂?|缁崇储|鍦伴浄鏉?)/i.test(normalized)) score += 5;
      if (/(dumbbell|db|鍝戦搩)/i.test(normalized)) score += 2;
      if (/(barbell|鏉犻搩)/i.test(normalized)) score -= 2;
    }

    if (adaptiveDecision.preferRegression && /(machine|cable|landmine|bodyweight|鍣ㄦ|缁崇储|鍦伴浄鏉?|鑷噸)/i.test(normalized)) {
      score += 3;
    }

    if (adaptiveDecision.linkedIssues.includes('overhead_press_restriction') && /(press|push|鎺ㄤ妇|涓婁妇)/i.test(normalized)) {
      if (/(landmine|machine|鍣ㄦ|鍦伴浄鏉?)/i.test(normalized)) score += 2;
      else score -= 2;
    }

    if (
      (adaptiveDecision.linkedIssues.includes('upper_crossed') || adaptiveDecision.linkedIssues.includes('scapular_control')) &&
      /(cable|machine|smith|缁崇储|鍣ㄦ|鍙插瘑鏂?)/i.test(normalized)
    ) {
      score += 1;
    }

    if (painPreference === 'substitute') {
      if (/(machine|smith|cable|landmine|bodyweight)/i.test(normalized)) score += 3;
      if (/(barbell)/i.test(normalized)) score -= 2;
    }

    if (suggestedName && normalized.includes(suggestedName)) score += 4;
    return score;
  };

  return alternatives.sort((left, right) => scoreAlternative(right) - scoreAlternative(left));
};

const prescribeExercise = (
  exercise: ExerciseTemplate,
  trainingMode: TrainingMode | string,
  weeklyPrescription: WeeklyPrescription | null
): ExercisePrescription => {
  const mode = resolveMode(trainingMode);
  const mainCompound = exercise.kind === 'compound' && number(exercise.orderPriority) <= 1;
  const secondaryCompound = exercise.kind === 'compound' || exercise.kind === 'machine';
  const isolation = exercise.kind === 'isolation';

  let sets = number(exercise.sets);
  let repMin = number(exercise.repMin);
  let repMax = number(exercise.repMax);
  let rest = number(exercise.rest);
  let targetRir: [number, number] = exercise.targetRir || [1, 3];
  let loadRange = exercise.recommendedLoadRange || '60-80% 1RM';
  let rule = '鎸夋ā鏉垮鏂规墽琛屻€?';

  if (mode.id === 'strength') {
    if (mainCompound) {
      sets = clamp(sets, 3, 5);
      repMin = 3;
      repMax = 6;
      rest = clamp(rest, 180, 300);
      targetRir = [1, 3];
      loadRange = '>=80% 1RM';
      rule = '鍔涢噺浼樺厛锛氫富鍔ㄤ綔鏇撮噸锛屼紤鎭洿闀裤€?';
    } else if (secondaryCompound) {
      sets = clamp(sets, 2, 4);
      repMin = 5;
      repMax = 8;
      rest = clamp(rest, 150, 240);
      targetRir = [1, 3];
      loadRange = '75-85% 1RM';
      rule = '娆＄骇澶嶅悎鍔ㄤ綔淇濈暀鍔涢噺杞Щ锛屼絾鎺у埗鐤插姵銆?';
    } else {
      sets = clamp(sets, 2, 3);
      repMin = 8;
      repMax = 12;
      rest = clamp(rest, 60, 120);
      targetRir = [1, 2];
      loadRange = '55-75% 1RM';
      rule = '瀛ょ珛鍔ㄤ綔鍙ˉ蹇呰璁粌閲忋€?';
    }
  } else if (mode.id === 'hypertrophy') {
    if (isolation) {
      sets = clamp(sets, 2, 4);
      repMin = 8;
      repMax = 15;
      rest = clamp(rest, 60, 120);
      targetRir = [1, 2];
      loadRange = '50-75% 1RM';
      rule = '澧炶倢浼樺厛锛氬绔嬪姩浣滅敤鏇撮珮娆℃暟鍫嗘湁鏁堢粍銆?';
    } else {
      sets = clamp(sets, 2, 4);
      repMin = 6;
      repMax = 10;
      rest = clamp(rest, 120, 180);
      targetRir = [1, 3];
      loadRange = '60-80% 1RM';
      rule = '澧炶倢浼樺厛锛氬鍚堝姩浣滀腑绛夊亸閲嶏紝浼樺厛淇濊瘉鍛ㄦ€婚噺銆?';
    }
  } else if (mainCompound) {
    sets = clamp(sets, 3, 4);
    repMin = 3;
    repMax = 6;
    rest = clamp(rest, 180, 240);
    targetRir = [1, 3];
    loadRange = '75-85% 1RM';
    rule = '娣峰悎妯″紡锛氫富鍔ㄤ綔鍋忓姏閲忋€?';
  } else if (isolation) {
    sets = clamp(sets, 2, 4);
    repMin = 8;
    repMax = 15;
    rest = clamp(rest, 60, 120);
    targetRir = [1, 2];
    loadRange = '50-75% 1RM';
    rule = '娣峰悎妯″紡锛氬绔嬪姩浣滃亸澧炶倢鍜屼綆鐤插姵銆?';
  } else {
    sets = clamp(sets, 2, 4);
    repMin = 6;
    repMax = 10;
    rest = clamp(rest, 120, 180);
    targetRir = [1, 3];
    loadRange = '65-80% 1RM';
    rule = '娣峰悎妯″紡锛氭绾у鍚堝吋椤惧紶鍔涘拰鍙寔缁帹杩涖€?';
  }

  const primary = getPrimaryMuscles(exercise)[0];
  const remaining = getMuscleRemaining(weeklyPrescription, primary);
  const budget = getMuscleBudget(weeklyPrescription, primary);
  let weeklyAdjustment = '';

  if (budget && budget.remainingCapacity !== undefined && budget.remainingCapacity <= 0) {
    sets = Math.max(1, Math.min(sets, secondaryCompound ? 2 : 1));
    weeklyAdjustment = `${primary} 鏈懆鎭㈠棰濆害宸叉弧锛屼粖澶╁彧淇濈暀鏈€浣庢湁鏁堥噺銆?`;
  } else if (budget && Number.isFinite(budget.todayBudget) && number(budget.todayBudget) > 0 && number(budget.todayBudget) < sets) {
    sets = Math.max(1, Math.ceil(number(budget.todayBudget)));
    weeklyAdjustment = `${primary} 浠婃棩棰勭畻杩樺墿 ${budget.todayBudget} 缁勶紝鎸夊懆鍓傞噺鏀舵暃銆?`;
  } else if (Number.isFinite(remaining) && remaining <= 0 && isolation) {
    sets = Math.max(1, sets - 1);
    weeklyAdjustment = `${primary} 鏈懆鐩爣鍩烘湰瀹屾垚锛屽绔嬪姩浣滈粯璁ゅ噺涓€缁勩€?`;
  } else if (budget?.adjustmentReasons?.length) {
    weeklyAdjustment = budget.adjustmentReasons[0];
  }

  return {
    ...exercise,
    sets,
    repMin,
    repMax,
    rest,
    targetRir,
    targetRirText: `${targetRir[0]}-${targetRir[1]} RIR`,
    recommendedLoadRange: loadRange,
    recommendedRepRange: [repMin, repMax],
    recommendedRestSec: [Math.max(45, rest - 30), rest],
    prescription: {
      mode: mode.id,
      modeLabel: mode.label,
      loadRange,
      repRange: [repMin, repMax],
      sets,
      restSec: rest,
      targetRir,
      rule,
      weeklyAdjustment,
      sources: [...PRESCRIPTION_SOURCES],
    },
    adjustment: weeklyAdjustment || exercise.adjustment,
  };
};

export const buildReadinessSignal = (status: TodayStatus, history: TrainingSession[] = []): ReadinessSignal => {
  const poorSleepDays = recentPoorSleepDays(status, history);
  const readiness = buildTodayReadiness(
    {
      todayStatus: status,
      history,
    },
    undefined,
    {
      adherenceHigh: buildAdherenceReport(history).overallRate >= 85,
    }
  );

  return mapReadinessToSignal(readiness, poorSleepDays);
};

const applyDeloadStrategy = (exercise: ExercisePrescription, deloadDecision: DeloadDecision): ExercisePrescription => {
  if (deloadDecision.level === 'none') return exercise;

  if (deloadDecision.strategy === 'reduce_accessories' && exercise.kind === 'isolation') {
    return {
      ...exercise,
      sets: Math.max(1, number(exercise.sets) - 1),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, '鐤插姵绛夌骇涓婂崌锛氳緟鍔ㄤ綔鍑忎竴缁勫苟鏆傚仠鍔犻噸銆?'].filter(Boolean).join(' / '),
    };
  }

  if (deloadDecision.strategy === 'reduce_volume' || deloadDecision.strategy === 'recovery_template') {
    const setMultiplier = exercise.kind === 'isolation' ? deloadDecision.volumeMultiplier - 0.05 : deloadDecision.volumeMultiplier;
    return {
      ...exercise,
      sets: Math.max(1, Math.ceil(number(exercise.sets) * Math.max(0.4, setMultiplier))),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, `褰撳墠鐤插姵绛夌骇瑙﹀彂鍑忛噺锛屾寜 ${Math.round(deloadDecision.volumeMultiplier * 100)}% 璁粌閲忔墽琛屻€?`]
        .filter(Boolean)
        .join(' / '),
    };
  }

  return exercise;
};

export const applyStatusRules = (
  template: TrainingTemplate,
  status: TodayStatus,
  trainingMode: TrainingMode | string = 'hybrid',
  weeklyPrescription: WeeklyPrescription | null = null,
  history: TrainingSession[] = [],
  screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE,
  mesocyclePlan?: MesocyclePlan | null
) => {
  const adherenceReport = buildAdherenceReport(history);
  const readinessResult = buildTodayReadiness(
    {
      todayStatus: status,
      history,
    },
    template,
    {
      adherenceHigh: adherenceReport.overallRate >= 85,
    }
  );
  const readiness = mapReadinessToSignal(readinessResult, recentPoorSleepDays(status, history));
  const deloadDecision = buildAdaptiveDeloadDecision({
    history,
    todayStatus: status,
    screeningProfile: screening,
    templates: [template],
    selectedTemplateId: template.id,
    trainingMode: trainingMode as TrainingMode,
  });
  const mesocycleWeek = getCurrentMesocycleWeek(mesocyclePlan);
  const painPatterns = buildPainPatterns(history);

  let exercises: ExercisePrescription[] = clone(template.exercises || []).map((exercise: ExerciseTemplate) =>
    prescribeExercise(enrichExercise(exercise), trainingMode, weeklyPrescription)
  );
  const timeLimit = Number(status.time);
  const volumeMultiplier = mesocycleWeek.phase === 'deload' ? Math.min(mesocycleWeek.volumeMultiplier, 0.8) : mesocycleWeek.volumeMultiplier;

  exercises = exercises.map((exercise) => ({
    ...exercise,
    sets: Math.max(1, Math.ceil(number(exercise.sets) * Math.max(0.6, volumeMultiplier))),
    mesocyclePhase: mesocycleWeek.phase,
    mesocycleIntensityBias: mesocycleWeek.intensityBias,
    adjustment:
      mesocycleWeek.phase === 'deload'
        ? [exercise.adjustment, `当前处于 ${mesocycleWeek.phase} 周，整体训练量先收回到 ${Math.round(volumeMultiplier * 100)}%。`].filter(Boolean).join(' / ')
        : exercise.adjustment,
  }));

  if (timeLimit <= 30) {
    exercises = exercises.slice(0, 4).map((exercise) => ({
      ...exercise,
      sets: Math.min(2, number(exercise.sets)),
      rest: Math.min(number(exercise.rest), 120),
      adjustment: [exercise.adjustment, '鏃堕棿鐭細鍒囧埌浠婂ぉ鐨勬渶浣庢湁鏁堢増鏈€?'].filter(Boolean).join(' / '),
    }));
  }

  if (readinessResult.trainingAdjustment === 'conservative' || status.energy === LOW_ENERGY) {
    exercises = exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.kind === 'compound' ? number(exercise.sets) : Math.max(1, number(exercise.sets) - 1),
      adjustment:
        exercise.kind === 'compound'
          ? exercise.adjustment
          : [exercise.adjustment, '绮惧姏浣庯細瀛ょ珛鍔ㄤ綔鍑忎竴缁勩€?'].filter(Boolean).join(' / '),
    }));
  }

  if (hasPoorSleep(status) && hasLowEnergy(status)) {
    exercises = exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.kind === 'isolation' ? Math.max(1, number(exercise.sets) - 1) : number(exercise.sets),
      progressLocked: exercise.kind !== 'isolation',
      conservativeTopSet: exercise.kind !== 'isolation',
      adjustment:
        exercise.kind === 'isolation'
          ? [exercise.adjustment, '鐫＄湢宸?+ 绮惧姏浣庯細瀛ょ珛鍔ㄤ綔鍑忛噺銆?'].filter(Boolean).join(' / ')
          : [exercise.adjustment, '鐫＄湢宸?+ 绮惧姏浣庯細澶嶅悎鍔ㄤ綔涓嶅姞閲嶃€?'].filter(Boolean).join(' / '),
    }));
  }

  if (hasPoorSleep(status) && timeLimit <= 30) {
    exercises = exercises.slice(0, 4).map((exercise) => ({
      ...exercise,
      sets: Math.max(1, Math.min(number(exercise.sets), exercise.kind === 'isolation' ? 1 : 2)),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, '鐫＄湢宸?+ 鏃堕棿鐭細鐩存帴鍒囧埌淇濆簳璁粌鐗堟湰銆?'].filter(Boolean).join(' / '),
    }));
  }

  if (readiness.poorSleepDays >= 2) {
    exercises = exercises.slice(0, 4).map((exercise) => ({
      ...exercise,
      sets: Math.max(1, Math.min(number(exercise.sets), exercise.kind === 'isolation' ? 1 : 2)),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, '杩炵画涓ゅぉ鐫＄湢宸細浠婂ぉ璧拌交閲忕淮鎸佺増鏈€?'].filter(Boolean).join(' / '),
    }));
  }

  if (readinessResult.trainingAdjustment === 'recovery') {
    exercises = exercises.slice(0, 3).map((exercise) => ({
      ...exercise,
      sets: Math.max(1, Math.min(number(exercise.sets), exercise.kind === 'isolation' ? 1 : 2)),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, 'readiness score 偏低：今天优先恢复和保底完成。'].filter(Boolean).join(' / '),
    }));
  }

  exercises = exercises.map((exercise) => {
    let next = applyAdaptiveExerciseRules(exercise, screening, {
      readinessLevel: readiness.level,
      deloadLevel: deloadDecision.level,
    });

    if (mesocycleWeek.intensityBias === 'conservative') {
      next = {
        ...next,
        progressLocked: true,
        conservativeTopSet: true,
        adaptiveTopSetFactor: Math.min(number(next.adaptiveTopSetFactor) || 1, 0.96),
        adaptiveBackoffFactor: Math.min(number(next.adaptiveBackoffFactor) || 0.92, 0.88),
      };
    } else if (mesocycleWeek.intensityBias === 'aggressive' && readinessResult.score >= 75 && !next.progressLocked) {
      next = {
        ...next,
        adaptiveTopSetFactor: Math.max(number(next.adaptiveTopSetFactor) || 1, 1),
        adaptiveBackoffFactor: Math.max(number(next.adaptiveBackoffFactor) || 0.92, 0.92),
      };
    }

    next = applyDeloadStrategy(next, deloadDecision);

    const painPattern = getExercisePainPattern(painPatterns, next.baseId || next.id);
    if (painPattern?.suggestedAction === 'substitute') {
      next = {
        ...next,
        progressLocked: true,
        conservativeTopSet: true,
        warning: [next.warning, `该动作近期在 ${painPattern.area} 反复出现不适，今天优先走替代动作。`].filter(Boolean).join(' / '),
      };
    } else if (painPattern?.suggestedAction === 'deload' || painPattern?.suggestedAction === 'seek_professional') {
      next = {
        ...next,
        sets: Math.max(1, number(next.sets) - 1),
        progressLocked: true,
        conservativeTopSet: true,
        warning: [next.warning, `近期 ${painPattern.area} 的不适频率偏高，今天先按保守版本执行。`].filter(Boolean).join(' / '),
      };
    }

    const alternatives = prioritizeAlternatives(
      next,
      screening,
      readiness.level,
      deloadDecision.level,
      painPattern?.suggestedAction || 'watch'
    );
    if (alternatives.length) {
      next = {
        ...next,
        alternatives,
        replacementSuggested:
          next.replacementSuggested ||
          ((next.conservativeTopSet || next.progressLocked || readiness.level === 'red' || deloadDecision.level === 'red') ? alternatives[0] : ''),
      };
    }

    if (statusHitsMuscle(status, next.muscle)) {
      next = {
        ...next,
        sets: Math.max(1, number(next.sets) - 1),
        conservativeTopSet: next.kind !== 'isolation' || next.conservativeTopSet,
        warning: [next.warning, `${next.muscle} 浠婂ぉ閰哥棝锛岄粯璁ゅ噺涓€缁勫苟鏀炬參鎺ㄨ繘銆?`].filter(Boolean).join(' / '),
      };
    }

    return next;
  });

  return {
    ...template,
    exercises,
    duration:
      deloadDecision.level === 'red'
        ? Math.min(timeLimit || template.duration, 35)
        : readinessResult.trainingAdjustment === 'recovery'
          ? Math.min(30, timeLimit || template.duration)
          : timeLimit <= 30 || readiness.poorSleepDays >= 2
          ? 30
          : template.duration,
    readiness,
    readinessResult,
    mesocycleWeek,
    deloadDecision,
  };
};

export const normalizeTemplateExerciseInput = (
  exercise: ExerciseTemplate,
  field: keyof ExerciseTemplate | 'rom' | 'tempo' | 'stopRule' | string,
  value: unknown
) => {
  const next: ExerciseTemplate = { ...exercise };

  if (field === 'sets') next.sets = Math.round(safeNumber(value, number(exercise.sets), 1, 8));
  else if (field === 'repMin') next.repMin = Math.round(safeNumber(value, exercise.repMin, 1, 50));
  else if (field === 'repMax') next.repMax = Math.round(safeNumber(value, exercise.repMax, 1, 80));
  else if (field === 'rest') next.rest = Math.round(safeNumber(value, exercise.rest, 15, 600));
  else if (field === 'startWeight') next.startWeight = safeNumber(value, exercise.startWeight, 0, 500);
  else if (field === 'rom' || field === 'tempo' || field === 'stopRule') {
    next.techniqueStandard = {
      ...(exercise.techniqueStandard || DEFAULT_TECHNIQUE_STANDARD),
      [field]: String(value || ''),
    };
  } else {
    (next as unknown as Record<string, unknown>)[field] = value;
  }

  if (next.repMin > next.repMax) {
    if (field === 'repMin') next.repMax = next.repMin;
    else next.repMin = next.repMax;
  }

  return next;
};
