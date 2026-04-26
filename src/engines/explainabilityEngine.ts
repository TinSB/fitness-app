import type {
  AdherenceAdjustment,
  AdherenceReport,
  DeloadDecision,
  ExercisePrescription,
  PainPattern,
  ReadinessResult,
  ScreeningProfile,
  SupportPlan,
  TodayStatus,
  TrainingSession,
  TrainingTemplate,
  WeeklyMuscleBudget,
  WeeklyPrescription,
} from '../models/training-model';
import { completedSets, number } from './engineUtils';

type ReadinessSummary = {
  level: 'green' | 'yellow' | 'red';
  title: string;
  advice: string;
  reasons: string[];
};

type AdjustedPlan = Pick<TrainingTemplate, 'id' | 'name' | 'focus'> & {
  duration?: number;
  exercises: ExercisePrescription[];
  readiness?: ReadinessSummary;
  readinessResult?: ReadinessResult;
  mesocycleWeek?: { weekIndex: number; phase: string; volumeMultiplier: number; intensityBias: string; notes?: string };
  deloadDecision?: DeloadDecision;
};

interface ExplainabilityInput {
  template: Pick<TrainingTemplate, 'id' | 'name' | 'focus'>;
  adjustedPlan: AdjustedPlan;
  supportPlan: SupportPlan;
  weeklyPrescription: WeeklyPrescription;
  screening?: ScreeningProfile;
  todayStatus?: TodayStatus;
}

interface SessionSummaryInput {
  session: TrainingSession;
  adherenceReport?: AdherenceReport;
  adherenceAdjustment?: AdherenceAdjustment;
  painPatterns?: PainPattern[];
}

interface WeeklyCoachReviewInput {
  history: TrainingSession[];
  weeklyPrescription: WeeklyPrescription;
  adherenceReport: AdherenceReport;
  adherenceAdjustment: AdherenceAdjustment;
  painPatterns?: PainPattern[];
  plannedSessionsPerWeek?: number;
}

const issueLabels: Record<string, string> = {
  upper_crossed: '上交叉倾向',
  scapular_control: '肩胛控制',
  thoracic_extension: '胸椎伸展',
  hip_stability: '髋稳定',
  anterior_pelvic_tilt: '骨盆前倾',
  core_control: '核心控制',
  ankle_mobility: '踝活动度',
  squat_lean_forward: '深蹲前倾',
  hip_flexor_tightness: '髋屈肌紧张',
  lumbar_compensation: '腰椎代偿',
  thoracic_rotation: '胸椎旋转',
  overhead_press_restriction: '过顶受限',
  breathing_ribcage: '呼吸与肋骨位置',
};

const deloadLevelLabels: Record<DeloadDecision['level'], string> = {
  none: '正常推进',
  watch: '观察',
  yellow: '减量观察',
  red: '恢复优先',
};

const strategyCopy: Record<DeloadDecision['strategy'], string> = {
  none: '按原计划推进',
  reduce_accessories: '先收一部分辅助动作',
  reduce_volume: '先把总训练量降下来',
  recovery_template: '直接切到恢复优先模板',
};

const skipReasonLabels: Record<string, string> = {
  time: '时间不足',
  pain: '不适',
  equipment: '器械问题',
  forgot: '忘记了',
  too_tired: '太累',
  not_needed: '今天没必要',
  other: '其他原因',
};

const formatMaybeDecimal = (value: number | undefined) => {
  if (!Number.isFinite(value)) return '0';
  const safe = number(value);
  return Number.isInteger(safe) ? String(safe) : safe.toFixed(1);
};

const pickMostConstrainedBudget = (weeklyPrescription: WeeklyPrescription, exercises: ExercisePrescription[]) => {
  const seen = new Set<string>();
  const budgets = exercises
    .flatMap((exercise) => exercise.primaryMuscles || [exercise.muscle])
    .filter((muscle): muscle is string => Boolean(muscle))
    .filter((muscle) => {
      if (seen.has(muscle)) return false;
      seen.add(muscle);
      return true;
    })
    .map((muscle) => weeklyPrescription.muscles.find((item) => item.muscle === muscle))
    .filter((item): item is WeeklyMuscleBudget => Boolean(item));

  return budgets.sort((left, right) => {
    const leftPressure = number(left.remaining) - number(left.remainingCapacity);
    const rightPressure = number(right.remaining) - number(right.remainingCapacity);
    if (leftPressure !== rightPressure) return rightPressure - leftPressure;
    return number(left.targetMultiplier) - number(right.targetMultiplier);
  })[0];
};

const buildBudgetExplanation = (budget?: WeeklyMuscleBudget) => {
  if (!budget) return '';

  if (number(budget.targetMultiplier) < 1 || number(budget.remainingCapacity) < number(budget.remaining)) {
    return `今天 ${budget.muscle} 的安排更保守，因为本周已完成 ${formatMaybeDecimal(budget.sets)}/${formatMaybeDecimal(
      budget.target
    )} 组，恢复额度只剩 ${formatMaybeDecimal(budget.remainingCapacity)} 组。`;
  }

  if (number(budget.remaining) > 0 && number(budget.todayBudget) > 0) {
    return `今天优先补 ${budget.muscle}，因为这周还差 ${formatMaybeDecimal(budget.remaining)} 组。`;
  }

  return '';
};

const buildSupportExplanation = (supportPlan: SupportPlan, screening?: ScreeningProfile) => {
  if (supportPlan.adherenceAdjustment?.reasons?.length) {
    return `本周 support 层做了可执行性调整：${supportPlan.adherenceAdjustment.reasons[0]}。`;
  }

  const boosted = supportPlan.correctionModules.find((module) => module.dose === 'boost');
  if (boosted) {
    const issueLabel = issueLabels[boosted.targetIssue] || boosted.targetIssue;
    const issueScore = number(screening?.adaptiveState?.issueScores?.[boosted.targetIssue]);
    return `今天提高了 ${boosted.name} 的剂量，因为 ${issueLabel} 最近的风险信号更高${issueScore ? `（当前分值 ${issueScore}）` : ''}。`;
  }

  const tapered = supportPlan.correctionModules.find((module) => module.dose === 'taper');
  if (tapered) {
    return `今天把 ${tapered.name} 收回到维持剂量，因为 ${issueLabels[tapered.targetIssue] || tapered.targetIssue} 最近在改善。`;
  }

  const addon = supportPlan.functionalAddons.find((item) => item.dose === 'boost') || supportPlan.functionalAddons[0];
  if (addon) {
    return `今天保留了 ${addon.name}，用来补主训练之外的稳定性和能力短板。`;
  }

  return '';
};

const buildExerciseExplanation = (exercise: ExercisePrescription) => {
  const name = exercise.alias || exercise.name;
  const adaptiveReason = exercise.adaptiveReasons?.slice(0, 2).join('，');

  if (exercise.suggestion?.includes('动作质量较差')) {
    return `今天 ${name} 暂时不加重，因为虽然次数达标，但动作质量还不够稳。`;
  }

  if (exercise.replacementSuggested) {
    return `今天 ${name} 更适合换成 ${exercise.replacementSuggested}，因为${adaptiveReason || '当前状态更适合更稳一点的替代动作'}。`;
  }

  if (exercise.progressLocked) {
    return `今天 ${name} 先不加重，因为${adaptiveReason || '最近两次还没有形成稳定达标趋势'}。`;
  }

  if (exercise.conservativeTopSet || number(exercise.adaptiveTopSetFactor) < 1 || number(exercise.adaptiveBackoffFactor) < 0.92) {
    return `今天 ${name} 的顶组和回退组会更保守，因为${adaptiveReason || '当前恢复信号提示先稳住输出更划算'}。`;
  }

  return '';
};

const buildDeloadExplanation = (decision?: DeloadDecision, readiness?: ReadinessSummary) => {
  if (!decision?.triggered) return '';
  const levelText = deloadLevelLabels[decision.level];
  const reasonText = decision.reasons.slice(0, 2).join('，');
  const readinessText = readiness?.reasons?.length ? `今天状态信号：${readiness.reasons.join('，')}。` : '';
  return `当前疲劳等级是 ${levelText}，所以今天会${strategyCopy[decision.strategy]}。${reasonText ? `触发原因：${reasonText}。` : ''}${readinessText}`;
};

const getSessionCompletionRate = (session: TrainingSession, adherenceReport?: AdherenceReport) => {
  const row = adherenceReport?.recentSessions.find((item) => item.sessionId === session.id);
  if (row) return row.adherenceRate;

  const planned = session.exercises.reduce((sum, exercise) => sum + (Array.isArray(exercise.sets) ? exercise.sets.length : number(exercise.sets)), 0);
  const actual = session.exercises.reduce((sum, exercise) => sum + completedSets(exercise).length, 0);
  return planned > 0 ? Math.round((actual / planned) * 100) : 0;
};

const getSupportSkipSummary = (session: TrainingSession) => {
  const logs = Array.isArray(session.supportExerciseLogs) ? session.supportExerciseLogs : [];
  const skipped = logs.filter((item) => number(item.completedSets) < number(item.plannedSets));
  if (!skipped.length) return null;

  const byBlock = skipped.reduce<Record<'correction' | 'functional', number>>(
    (acc, item) => {
      acc[item.blockType] += 1;
      return acc;
    },
    { correction: 0, functional: 0 }
  );

  const reasonCounts = skipped.reduce<Record<string, number>>((acc, item) => {
    if (!item.skippedReason) return acc;
    acc[item.skippedReason] = (acc[item.skippedReason] || 0) + 1;
    return acc;
  }, {});

  const topReason = Object.entries(reasonCounts).sort((left, right) => right[1] - left[1])[0]?.[0];
  return {
    skippedCount: skipped.length,
    correctionSkipped: byBlock.correction,
    functionalSkipped: byBlock.functional,
    topReason,
  };
};

const getTechniqueHoldExercise = (session: TrainingSession) =>
  session.exercises.find((exercise) => {
    const sets = completedSets(exercise);
    if (!sets.length) return false;
    const lastSet = sets[sets.length - 1];
    return lastSet.techniqueQuality === 'poor' || exercise.suggestion?.includes('动作质量较差');
  });

const getSessionPainSummary = (session: TrainingSession, painPatterns?: PainPattern[]) => {
  const painSets = session.exercises.flatMap((exercise) =>
    completedSets(exercise)
      .filter((set) => set.painFlag || number(set.painSeverity) > 0 || Boolean(set.painArea))
      .map((set) => ({
        exerciseName: exercise.alias || exercise.name,
        area: set.painArea || '',
      }))
  );

  if (!painSets.length) return null;

  const first = painSets[0];
  const matchedPattern = painPatterns?.find(
    (item) => (item.exerciseId && item.exerciseId === session.exercises.find((exercise) => (exercise.alias || exercise.name) === first.exerciseName)?.baseId) || item.area === first.area
  );

  return {
    exerciseName: first.exerciseName,
    area: first.area,
    suggestedAction: matchedPattern?.suggestedAction,
  };
};

export const buildTodayExplanations = ({ template, adjustedPlan, supportPlan, weeklyPrescription, screening, todayStatus }: ExplainabilityInput) => {
  const reasons: string[] = [];

  const deloadText = buildDeloadExplanation(adjustedPlan.deloadDecision, adjustedPlan.readiness);
  if (deloadText) reasons.push(deloadText);

  const budgetText = buildBudgetExplanation(pickMostConstrainedBudget(weeklyPrescription, adjustedPlan.exercises));
  if (budgetText) reasons.push(budgetText);

  const supportText = buildSupportExplanation(supportPlan, screening);
  if (supportText) reasons.push(supportText);

  const flaggedExercise =
    adjustedPlan.exercises.find((exercise) => exercise.suggestion?.includes('动作质量较差')) ||
    adjustedPlan.exercises.find((exercise) => exercise.progressLocked || exercise.replacementSuggested || exercise.conservativeTopSet) ||
    adjustedPlan.exercises.find((exercise) => number(exercise.adaptiveTopSetFactor) < 1 || number(exercise.adaptiveBackoffFactor) < 0.92);
  if (flaggedExercise) {
    const exerciseText = buildExerciseExplanation(flaggedExercise);
    if (exerciseText) reasons.push(exerciseText);
  }

  if (!reasons.length && adjustedPlan.readiness) {
    reasons.push(
      `今天按 ${template.name} 正常推进${adjustedPlan.readinessResult ? `，readiness score ${adjustedPlan.readinessResult.score}` : ''}，当前状态是 ${adjustedPlan.readiness.title}。`
    );
  }

  if (!reasons.length && todayStatus) {
    reasons.push(`今天状态是睡眠 ${todayStatus.sleep}、精力 ${todayStatus.energy}、可训练时间 ${todayStatus.time} 分钟，所以先按当前模板正常推进。`);
  }

  return reasons.slice(0, 4);
};

export const buildSessionExplanations = (session: TrainingSession) => {
  if (session.explanations?.length) return session.explanations;

  const reasons: string[] = [];
  const deloadText = buildDeloadExplanation(session.deloadDecision);
  if (deloadText) reasons.push(deloadText);

  const flaggedExercise =
    session.exercises.find((exercise) => exercise.suggestion?.includes('动作质量较差')) ||
    session.exercises.find((exercise) => exercise.progressLocked || exercise.replacementSuggested || exercise.conservativeTopSet) ||
    session.exercises.find((exercise) => number(exercise.adaptiveTopSetFactor) < 1 || number(exercise.adaptiveBackoffFactor) < 0.92);
  if (flaggedExercise) {
    const exerciseText = buildExerciseExplanation(flaggedExercise);
    if (exerciseText) reasons.push(exerciseText);
  }

  if (!reasons.length && session.supportPlan) {
    const supportText = buildSupportExplanation(session.supportPlan);
    if (supportText) reasons.push(supportText);
  }

  return reasons.slice(0, 4);
};

export const buildSessionSummaryExplanations = ({ session, adherenceReport, adherenceAdjustment, painPatterns }: SessionSummaryInput) => {
  const lines: string[] = [];
  const completionRate = getSessionCompletionRate(session, adherenceReport);
  const mainCompleted = session.exercises.reduce((sum, exercise) => sum + completedSets(exercise).length, 0);
  const mainPlanned = session.exercises.reduce((sum, exercise) => sum + (Array.isArray(exercise.sets) ? exercise.sets.length : number(exercise.sets)), 0);

  lines.push(`今天完成度 ${completionRate}%，主训练完成 ${mainCompleted}/${mainPlanned} 组。`);

  const supportSummary = getSupportSkipSummary(session);
  if (supportSummary) {
    const reasonText = supportSummary.topReason ? `，主要因为${skipReasonLabels[supportSummary.topReason] || supportSummary.topReason}` : '';
    if (supportSummary.functionalSkipped > 0) {
      lines.push(`功能补丁跳过了 ${supportSummary.functionalSkipped} 项${reasonText}。`);
    }
    if (supportSummary.correctionSkipped > 0) {
      lines.push(`纠偏动作还有 ${supportSummary.correctionSkipped} 项没做满${reasonText}。`);
    }
  }

  const techniqueHold = getTechniqueHoldExercise(session);
  if (techniqueHold) {
    lines.push(`${techniqueHold.alias || techniqueHold.name} 虽然次数够了，但动作质量偏差，所以下次先不加重。`);
  }

  const painSummary = getSessionPainSummary(session, painPatterns);
  if (painSummary) {
    lines.push(
      `${painSummary.exerciseName}${painSummary.area ? ` 的 ${painSummary.area}` : ''} 出现了不适记录，系统会提高替代动作优先级${
        painSummary.suggestedAction ? `，并偏向 ${painSummary.suggestedAction}` : ''
      }。`
    );
  }

  if (adherenceAdjustment?.reasons?.length) {
    lines.push(`下次训练会更现实一些：${adherenceAdjustment.reasons[0]}。`);
  } else if (completionRate >= 85) {
    lines.push('这次主训练执行得比较稳，下一次可以继续按当前主线推进。');
  }

  return lines.slice(0, 5);
};

export const buildWeeklyCoachReview = ({
  history,
  weeklyPrescription,
  adherenceReport,
  adherenceAdjustment,
  painPatterns,
  plannedSessionsPerWeek = 4,
}: WeeklyCoachReviewInput) => {
  const recentSessions = history.slice(0, 7);
  const lines: string[] = [];

  lines.push(`本周完成 ${recentSessions.length} / ${plannedSessionsPerWeek} 次训练，主训练完成率 ${adherenceReport.mainlineRate}%。`);

  if (typeof adherenceReport.correctionRate === 'number' || typeof adherenceReport.functionalRate === 'number') {
    lines.push(
      `纠偏完成率 ${typeof adherenceReport.correctionRate === 'number' ? `${adherenceReport.correctionRate}%` : '数据不足'}，功能补丁完成率 ${
        typeof adherenceReport.functionalRate === 'number' ? `${adherenceReport.functionalRate}%` : '数据不足'
      }。`
    );
  }

  const biggestGap = [...weeklyPrescription.muscles]
    .filter((item) => number(item.remaining) > 0)
    .sort((left, right) => number(right.remaining) - number(left.remaining))
    .slice(0, 2);
  if (biggestGap.length) {
    lines.push(`周剂量还没补齐的重点是 ${biggestGap.map((item) => `${item.muscle} 还差 ${formatMaybeDecimal(item.remaining)} 组`).join('，')}。`);
  } else {
    lines.push('这周主要肌群剂量基本达标，可以把注意力放回动作质量和恢复。');
  }

  const poorTechniqueExercises = recentSessions
    .flatMap((session) =>
      session.exercises
        .filter((exercise) => completedSets(exercise).some((set) => set.techniqueQuality === 'poor'))
        .map((exercise) => exercise.alias || exercise.name)
    )
    .slice(0, 2);
  if (poorTechniqueExercises.length) {
    lines.push(`${poorTechniqueExercises.join('、')} 最近更像是动作质量问题，不是单纯力量不够。`);
  }

  const dominantPainPattern = painPatterns?.[0];
  if (dominantPainPattern) {
    lines.push(
      `${dominantPainPattern.area} 最近出现了重复不适信号，建议下一周优先使用更稳的替代动作，并把保守度再提高一点。`
    );
  }

  if (adherenceAdjustment.reasons.length) {
    lines.push(`下周自动调整：${adherenceAdjustment.reasons[0]}。`);
  } else if (adherenceReport.overallRate >= 85) {
    lines.push('最近执行度稳定，下周可以继续按当前结构推进，不需要额外收缩内容。');
  }

  return lines.slice(0, 6);
};
