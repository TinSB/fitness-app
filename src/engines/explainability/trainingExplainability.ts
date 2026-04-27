import { DEFINITIONS } from '../../content/definitions';
import { getEvidenceRule } from '../../content/evidenceRules';
import { buildCoachSentence, professionalFallback, sanitizeCopy } from '../../content/professionalCopy';
import { DELOAD_LEVEL_LABELS, DELOAD_STRATEGY_LABELS, PHASE_LABELS, READINESS_ADJUSTMENT_LABELS, SKIP_REASON_LABELS } from '../../i18n/terms';
import type {
  AdherenceAdjustment,
  AdherenceReport,
  DeloadDecision,
  EstimatedOneRepMax,
  ExercisePrescription,
  ExplanationItem,
  PainPattern,
  ReadinessResult,
  ScreeningProfile,
  SupportPlan,
  TodayStatus,
  TrainingSession,
  TrainingTemplate,
  WeeklyMuscleBudget,
  WeeklyPrescription,
} from '../../models/training-model';
import { completedSets, number } from '../engineUtils';
import { formatAutoTrainingLevel, type TrainingLevelAssessment } from '../trainingLevelEngine';

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

const issueLabels: Record<string, string> = {
  upper_crossed: '上交叉倾向',
  scapular_control: '肩胛控制',
  thoracic_extension: '胸椎伸展',
  hip_stability: '髋稳定',
  anterior_pelvic_tilt: '骨盆前倾',
  core_control: '核心控制',
  ankle_mobility: '踝关节活动度',
  squat_lean_forward: '深蹲前倾',
  hip_flexor_tightness: '髋屈肌紧张',
  lumbar_compensation: '腰椎代偿',
  thoracic_rotation: '胸椎旋转',
  overhead_press_restriction: '过顶推受限',
  breathing_ribcage: '呼吸与肋骨位置',
};

const painActionLabels: Record<string, string> = {
  watch: '继续观察',
  substitute: '优先替代动作',
  deload: '提高保守等级',
  seek_professional: '建议咨询专业人士',
};

const formatMaybeDecimal = (value: number | undefined) => {
  if (!Number.isFinite(value)) return '0';
  const safe = number(value);
  return Number.isInteger(safe) ? String(safe) : safe.toFixed(1);
};

const buildTemplate = (conclusion: string, reason?: string, action?: string) => buildCoachSentence({ conclusion, reason, action });

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
    return buildTemplate(
      `今天 ${budget.muscle} 相关训练采用保守安排`,
      `本周已完成 ${formatMaybeDecimal(budget.sets)}/${formatMaybeDecimal(budget.target)} 组，恢复额度剩余 ${formatMaybeDecimal(budget.remainingCapacity)} 组`,
      '优先完成高质量主训练，辅助组数不强行补满'
    );
  }
  if (number(budget.remaining) > 0 && number(budget.todayBudget) > 0) {
    return buildTemplate(
      `今天优先补足 ${budget.muscle} 的有效训练量`,
      `本周该肌群还差 ${formatMaybeDecimal(budget.remaining)} 组`,
      `本次建议补 ${formatMaybeDecimal(budget.todayBudget)} 组左右，并根据动作质量微调`
    );
  }
  return '';
};

const buildSupportExplanation = (supportPlan: SupportPlan, screening?: ScreeningProfile) => {
  if (supportPlan.adherenceAdjustment?.reasons?.length) {
    return buildTemplate('本次辅助层做了可执行性调整', supportPlan.adherenceAdjustment.reasons[0], '先提高完成度，再逐步恢复完整补丁数量');
  }

  const boosted = supportPlan.correctionModules.find((module) => module.dose === 'boost');
  if (boosted) {
    const issueLabel = issueLabels[boosted.targetIssue] || boosted.targetIssue;
    const issueScore = number(screening?.adaptiveState?.issueScores?.[boosted.targetIssue]);
    return buildTemplate(
      `今天提高 ${boosted.name} 的剂量`,
      `${issueLabel} 的近期信号更高${issueScore ? `，当前评分 ${issueScore}` : ''}`,
      '先用纠偏模块改善动作准备，再进入主训练'
    );
  }

  const tapered = supportPlan.correctionModules.find((module) => module.dose === 'taper');
  if (tapered) {
    return buildTemplate(
      `今天将 ${tapered.name} 收回到维持剂量`,
      `${issueLabels[tapered.targetIssue] || tapered.targetIssue} 最近在改善`,
      '保留最低有效剂量，不占用过多主训练资源'
    );
  }

  const addon = supportPlan.functionalAddons.find((item) => item.dose === 'boost') || supportPlan.functionalAddons[0];
  if (addon) {
    return buildTemplate(`今天保留 ${addon.name}`, '它用于补足主训练之外的稳定性和能力短板', '剂量保持短小，避免影响主训练恢复');
  }

  return '';
};

const buildExerciseExplanation = (exercise: ExercisePrescription) => {
  const name = exercise.alias || exercise.name;
  const adaptiveReason = exercise.adaptiveReasons?.slice(0, 2).join('；');

  if (exercise.suggestion?.includes('动作质量较差')) {
    return buildTemplate(`本次 ${name} 不建议加重`, '虽然次数可能达标，但动作质量较差', '下次先维持重量，必要时降低重量或使用回退动作');
  }

  if (exercise.replacementSuggested) {
    return buildTemplate(
      `本次建议将 ${name} 替代为 ${exercise.replacementSuggested}`,
      adaptiveReason || '当前状态更适合低风险、可控性更高的动作',
      '替代动作仍计入对应肌群训练量，但不混入原动作最佳记录'
    );
  }

  if (exercise.adjustment?.includes('推荐重量偏重')) {
    return buildTemplate(
      `本次 ${name} 采用保守重量建议`,
      '你最近反馈该动作推荐重量偏重，系统不会直接改写 e1RM，而是先降低本次推进幅度',
      '优先完成动作质量稳定的工作组，再用后续反馈逐步校准推荐重量'
    );
  }

  if (exercise.progressLocked) {
    return buildTemplate(`本次 ${name} 先不加重`, adaptiveReason || '最近两次还没有形成稳定达标趋势', '先把目标次数和动作质量做稳，再进入下一次推进');
  }

  if (exercise.conservativeTopSet || number(exercise.adaptiveTopSetFactor) < 1 || number(exercise.adaptiveBackoffFactor) < 0.92) {
    return buildTemplate(
      `本次 ${name} 的顶组和回退组会更保守`,
      adaptiveReason || '当前恢复信号提示不适合强行提高训练压力',
      '保留动作练习和肌肉刺激，但降低疲劳成本'
    );
  }

  return '';
};

const buildDeloadExplanation = (decision?: DeloadDecision, readiness?: ReadinessSummary) => {
  if (!decision?.triggered) return '';
  const levelText = DELOAD_LEVEL_LABELS[decision.level];
  const strategyText = DELOAD_STRATEGY_LABELS[decision.strategy];
  const reasonText = decision.reasons.slice(0, 2).join('；');
  const readinessText = readiness?.reasons?.length ? `准备度信号：${readiness.reasons.join('；')}` : '';
  return buildTemplate(`当前疲劳等级为${levelText}`, [reasonText, readinessText].filter(Boolean).join('；'), `今天采用${strategyText}，避免把疲劳继续推高`);
};

const buildReadinessExplanation = (result?: ReadinessResult) => {
  if (!result) return '';
  const strategy = READINESS_ADJUSTMENT_LABELS[result.trainingAdjustment];
  if (result.trainingAdjustment === 'normal' || result.trainingAdjustment === 'push') {
    return buildTemplate(`准备度评分 ${result.score}，今天可${strategy}`, result.reasons.slice(0, 2).join('；'), '仍以 RIR 和动作质量决定是否真正推进');
  }
  return buildTemplate(`准备度评分 ${result.score}，今天采用${strategy}`, result.reasons.slice(0, 2).join('；'), '减少非必要辅助量，优先完成核心动作');
};

const buildMesocycleExplanation = (week?: AdjustedPlan['mesocycleWeek']) => {
  if (!week) return '';
  const phaseLabel = PHASE_LABELS[week.phase as keyof typeof PHASE_LABELS] || week.phase;
  if (week.phase === 'deload') {
    return buildTemplate(`当前处于第 ${week.weekIndex + 1} 周：${phaseLabel}`, week.notes || '周期安排进入主动恢复阶段', '训练量下修，动作质量和恢复优先');
  }
  return buildTemplate(`当前处于第 ${week.weekIndex + 1} 周：${phaseLabel}`, week.notes || `本周训练量系数为 ${week.volumeMultiplier}`, '按周期节奏推进，但会被准备度和不适信号覆盖');
};

const makeExplanationItem = (
  title: string,
  conclusion: string,
  reason: string,
  action: string,
  evidenceRuleIds: string[] = [],
  confidence: ExplanationItem['confidence'] = 'moderate'
): ExplanationItem => {
  const primaryRule = evidenceRuleIds.map(getEvidenceRule).find(Boolean);
  return {
    title,
    conclusion: sanitizeCopy(conclusion),
    reason: sanitizeCopy(reason || '当前记录没有明显限制信号。'),
    action: sanitizeCopy(action || professionalFallback),
    evidenceRuleIds,
    confidence,
    caveat: primaryRule?.caveat,
  };
};

export const formatExplanationItem = (item: ExplanationItem) =>
  buildCoachSentence({
    conclusion: item.conclusion,
    reason: item.reason,
    action: item.action,
  });

export const buildE1RMExplanation = (estimate: EstimatedOneRepMax | null, exerciseName = '该动作'): ExplanationItem => {
  if (!estimate) {
    return makeExplanationItem(
      '负荷依据',
      `${exerciseName} 暂不输出精确公斤建议`,
      '历史高质量工作组不足，估算 1RM 的置信度不够。',
      '先按目标次数和 RIR 选择可控重量，积累 2-3 次稳定记录后再估算负荷区间。',
      ['rir_effort_control', 'technique_quality_gate'],
      'moderate'
    );
  }

  return makeExplanationItem(
    '负荷依据',
    `${exerciseName} 当前估算 1RM 为 ${estimate.e1rmKg}kg`,
    `来源组为 ${estimate.sourceSet.weightKg}kg x ${estimate.sourceSet.reps}，置信度为${estimate.confidence === 'high' ? '高' : estimate.confidence === 'medium' ? '中' : '低'}。${estimate.notes.join('')}`,
    '训练推荐只使用近期同动作高质量记录；历史最高 e1RM 只用于进度回看，不能直接代表今天的可用负荷。',
    ['progressive_overload', 'rir_effort_control'],
    estimate.confidence === 'high' ? 'high' : estimate.confidence === 'medium' ? 'moderate' : 'low'
  );
};

export const buildTodayExplanationItems = (input: ExplainabilityInput): ExplanationItem[] => {
  const { template, adjustedPlan, supportPlan, weeklyPrescription, screening, todayStatus } = input;
  const items: ExplanationItem[] = [];

  if (adjustedPlan.deloadDecision?.triggered) {
    items.push(
      makeExplanationItem(
        '疲劳管理',
        `当前建议采用${DELOAD_LEVEL_LABELS[adjustedPlan.deloadDecision.level]}策略`,
        adjustedPlan.deloadDecision.reasons.slice(0, 2).join('；') || '近期疲劳信号升高。',
        `${DELOAD_STRATEGY_LABELS[adjustedPlan.deloadDecision.strategy]}，优先让表现和动作质量恢复。`,
        ['deload_volume_reduction'],
        'moderate'
      )
    );
  }

  if (adjustedPlan.readinessResult) {
    const result = adjustedPlan.readinessResult;
    items.push(
      makeExplanationItem(
        '准备度',
        `准备度评分 ${result.score}，本次采用${READINESS_ADJUSTMENT_LABELS[result.trainingAdjustment]}`,
        result.reasons.slice(0, 2).join('；') || '准备度信号处于可训练范围。',
        result.trainingAdjustment === 'recovery' || result.trainingAdjustment === 'conservative' ? '减少非必要辅助量，主训练以高质量完成为先。' : '按当前计划推进，但仍以 RIR 和动作质量控制负荷。',
        ['weekly_volume_distribution', 'rir_effort_control'],
        'moderate'
      )
    );
  }

  if (adjustedPlan.mesocycleWeek) {
    const week = adjustedPlan.mesocycleWeek;
    const phaseLabel = PHASE_LABELS[week.phase as keyof typeof PHASE_LABELS] || '当前周期';
    items.push(
      makeExplanationItem(
        '周期安排',
        `当前处于第 ${week.weekIndex + 1} 周：${phaseLabel}`,
        week.notes || `本周训练量系数为 ${week.volumeMultiplier}。`,
        week.phase === 'deload' ? '本周主动下修训练量，优先恢复和动作质量。' : '按周期节奏推进，但准备度和不适信号可以覆盖原计划。',
        week.phase === 'deload' ? ['deload_volume_reduction'] : ['progressive_overload', 'weekly_volume_distribution'],
        'moderate'
      )
    );
  }

  const constrainedBudget = pickMostConstrainedBudget(weeklyPrescription, adjustedPlan.exercises);
  if (constrainedBudget && (number(constrainedBudget.targetMultiplier) < 1 || number(constrainedBudget.remainingCapacity) < number(constrainedBudget.remaining))) {
    items.push(
      makeExplanationItem(
        '周剂量预算',
        `今天 ${constrainedBudget.muscle} 相关训练采用保守补量`,
        `本周已完成 ${formatMaybeDecimal(constrainedBudget.sets)}/${formatMaybeDecimal(constrainedBudget.target)} 组，恢复额度剩余 ${formatMaybeDecimal(constrainedBudget.remainingCapacity)} 组。`,
        '先保证主训练有效组，不强行补满所有辅助组。',
        ['weekly_volume_distribution'],
        'moderate'
      )
    );
  }

  const boosted = supportPlan.correctionModules.find((module) => module.dose === 'boost');
  const tapered = supportPlan.correctionModules.find((module) => module.dose === 'taper');
  if (supportPlan.adherenceAdjustment?.reasons?.length) {
    items.push(
      makeExplanationItem(
        '辅助层调整',
        '本次辅助层按完成度做了可执行性调整',
        supportPlan.adherenceAdjustment.reasons[0],
        '先提高完成度，再逐步恢复完整纠偏和功能补丁剂量。',
        ['weekly_volume_distribution'],
        'moderate'
      )
    );
  } else if (boosted || tapered) {
    const module = boosted || tapered;
    if (module) {
      items.push(
        makeExplanationItem(
          '纠偏剂量',
          boosted ? `今天提高 ${module.name} 的剂量` : `今天将 ${module.name} 收回到维持剂量`,
          boosted
            ? `${issueLabels[module.targetIssue] || module.targetIssue} 的近期信号仍较明显。`
            : `${issueLabels[module.targetIssue] || module.targetIssue} 最近在改善。`,
          boosted ? '先改善动作准备，再进入主训练。' : '保留最低有效剂量，避免占用过多主训练资源。',
          ['weekly_volume_distribution', 'technique_quality_gate'],
          'moderate'
        )
      );
    }
  }

  const flaggedExercise =
    adjustedPlan.exercises.find((exercise) => exercise.suggestion?.includes('动作质量较差')) ||
    adjustedPlan.exercises.find((exercise) => exercise.replacementSuggested) ||
    adjustedPlan.exercises.find((exercise) => exercise.progressLocked || exercise.conservativeTopSet) ||
    adjustedPlan.exercises.find((exercise) => number(exercise.adaptiveTopSetFactor) < 1 || number(exercise.adaptiveBackoffFactor) < 0.92);

  if (flaggedExercise) {
    const name = flaggedExercise.alias || flaggedExercise.name;
    if (flaggedExercise.suggestion?.includes('动作质量较差')) {
      items.push(
        makeExplanationItem(
          '进阶闸门',
          `${name} 本次不建议加重`,
          '虽然次数可能达标，但最近记录显示动作质量较差。',
          '先维持重量并提高控制质量，必要时降低重量或使用回退动作。',
          ['technique_quality_gate'],
          'moderate'
        )
      );
    } else if (flaggedExercise.replacementSuggested) {
      items.push(
        makeExplanationItem(
          '替代动作',
          `本次建议将 ${name} 替代为 ${flaggedExercise.replacementSuggested}`,
          flaggedExercise.adaptiveReasons?.slice(0, 2).join('；') || '当前状态更适合低风险、可控性更高的动作。',
          '替代动作仍计入对应肌群训练量，但不混入原动作高质量 PR 池。',
          ['pain_conservative_rule', 'technique_quality_gate'],
          'moderate'
        )
      );
    } else {
      items.push(
        makeExplanationItem(
          '负荷策略',
          `${name} 本次采用保守负荷策略`,
          flaggedExercise.adaptiveReasons?.slice(0, 2).join('；') || '近期趋势还没有形成稳定达标信号。',
          '优先把目标次数和动作质量做稳，再进入下一次推进。',
          ['progressive_overload', 'rir_effort_control'],
          'moderate'
        )
      );
    }
  }

  if (!items.length && todayStatus) {
    items.push(
      makeExplanationItem(
        '今日安排',
        `今天按 ${template.name} 正常推进`,
        `睡眠 ${todayStatus.sleep}、精力 ${todayStatus.energy}、可训练时间 ${todayStatus.time} 分钟。`,
        professionalFallback,
        ['progressive_overload'],
        'moderate'
      )
    );
  }

  if (!items.length) {
    items.push(makeExplanationItem('今日安排', '今天按当前计划正常推进', '没有明显疲劳、不适或完成度限制信号。', professionalFallback, ['progressive_overload'], 'moderate'));
  }

  return items.slice(0, 4);
};

export const buildTodayExplanations = ({ template, adjustedPlan, supportPlan, weeklyPrescription, screening, todayStatus }: ExplainabilityInput) => {
  return buildTodayExplanationItems({ template, adjustedPlan, supportPlan, weeklyPrescription, screening, todayStatus }).map(formatExplanationItem);
};

export const buildSessionExplanations = (session: TrainingSession) => {
  if (session.explanations?.length) return session.explanations.map(sanitizeCopy);

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

  return (reasons.length ? reasons : [professionalFallback]).map(sanitizeCopy).slice(0, 4);
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
  return { skippedCount: skipped.length, correctionSkipped: byBlock.correction, functionalSkipped: byBlock.functional, topReason };
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
      .map((set) => ({ exerciseName: exercise.alias || exercise.name, exerciseId: exercise.baseId || exercise.id, area: set.painArea || '' }))
  );

  if (!painSets.length) return null;
  const first = painSets[0];
  const matchedPattern = painPatterns?.find((item) => (item.exerciseId && item.exerciseId === first.exerciseId) || item.area === first.area);
  return { ...first, suggestedAction: matchedPattern?.suggestedAction };
};

export const buildSessionSummaryExplanations = ({ session, adherenceReport, adherenceAdjustment, painPatterns }: SessionSummaryInput) => {
  const lines: string[] = [];
  const completionRate = getSessionCompletionRate(session, adherenceReport);
  const mainCompleted = session.exercises.reduce((sum, exercise) => sum + completedSets(exercise).length, 0);
  const mainPlanned = session.exercises.reduce((sum, exercise) => sum + (Array.isArray(exercise.sets) ? exercise.sets.length : number(exercise.sets)), 0);

  lines.push(buildTemplate(`本次训练完成度 ${completionRate}%`, `主训练完成 ${mainCompleted}/${mainPlanned} 组`, '用完成度判断下次计划是否需要变得更现实'));

  const loadFeedback = session.loadFeedback || [];
  if (loadFeedback.length) {
    const tooHeavy = loadFeedback.filter((item) => item.feedback === 'too_heavy').length;
    const tooLight = loadFeedback.filter((item) => item.feedback === 'too_light').length;
    const good = loadFeedback.filter((item) => item.feedback === 'good').length;
    const dominant =
      tooHeavy >= tooLight && tooHeavy >= good
        ? '偏重'
        : tooLight >= good
          ? '偏轻'
          : '合适';
    lines.push(
      buildTemplate(
        `本次记录了 ${loadFeedback.length} 个推荐重量反馈`,
        `整体感觉以“${dominant}”为主`,
        dominant === '偏重'
          ? '下次同动作会先采用更保守建议，但不会直接篡改历史最佳 e1RM'
          : dominant === '偏轻'
            ? '如果动作质量继续良好，下次可允许小幅积极推进'
            : '继续沿用当前推荐规则'
      )
    );
  }

  const supportSummary = getSupportSkipSummary(session);
  if (supportSummary) {
    const reasonText = supportSummary.topReason ? `主要原因是 ${SKIP_REASON_LABELS[supportSummary.topReason as keyof typeof SKIP_REASON_LABELS] || supportSummary.topReason}` : '原因还没有记录';
    if (supportSummary.functionalSkipped > 0) {
      lines.push(buildTemplate(`功能补丁有 ${supportSummary.functionalSkipped} 项未完成`, reasonText, '下次优先保留最关键的功能补丁'));
    }
    if (supportSummary.correctionSkipped > 0) {
      lines.push(buildTemplate(`纠偏模块有 ${supportSummary.correctionSkipped} 项未做满`, reasonText, '下次可改为最低有效剂量'));
    }
  }

  const techniqueHold = getTechniqueHoldExercise(session);
  if (techniqueHold) {
    lines.push(buildTemplate(`${techniqueHold.alias || techniqueHold.name} 下次不建议加重`, '本次动作质量记录为较差或不稳定', '先维持重量，必要时使用回退动作'));
  }

  const painSummary = getSessionPainSummary(session, painPatterns);
  if (painSummary) {
    lines.push(
      buildTemplate(
        `${painSummary.exerciseName}${painSummary.area ? ` 的${painSummary.area}` : ''} 出现不适记录`,
        DEFINITIONS.painPattern.body,
        painSummary.suggestedAction ? painActionLabels[painSummary.suggestedAction] : '下次提高替代动作优先级'
      )
    );
  }

  if (adherenceAdjustment?.reasons?.length) {
    lines.push(buildTemplate('下次计划会做可执行性调整', adherenceAdjustment.reasons[0], '目标是先把训练完成度拉回稳定区间'));
  } else if (completionRate >= 85) {
    lines.push(buildTemplate('本次主训练执行稳定', '完成度较高且没有明显风险信号', '下次可以继续按当前主线推进'));
  }

  return lines.map(sanitizeCopy).slice(0, 5);
};

export const buildTrainingLevelExplanation = (assessment: TrainingLevelAssessment) => {
  if (assessment.level === 'unknown') {
    return buildTemplate(
      '系统正在建立训练基线',
      '当前真实训练记录不足，不能把新用户直接当作新手，也不能伪造 PR 或 e1RM',
      '继续完成 2–3 次训练后，系统会开始估算当前力量、有效组和训练等级'
    );
  }

  const hasTechniqueOrPainLimit = assessment.limitations.some((item) => item.includes('动作质量') || item.includes('不适') || item.includes('poor'));
  if (hasTechniqueOrPainLimit) {
    return buildTemplate(
      `当前自动等级为${formatAutoTrainingLevel(assessment.level)}`,
      '虽然部分表现信号较好，但动作质量或不适信号会限制高级推荐',
      '本次继续采用保守训练决策，不因单次大重量直接升级'
    );
  }

  if (assessment.readinessForAdvancedFeatures.topBackoff || assessment.readinessForAdvancedFeatures.higherVolume) {
    return buildTemplate(
      `当前自动等级为${formatAutoTrainingLevel(assessment.level)}`,
      '近期记录较稳定，完成度和有效组质量支持更完整的训练处方',
      '系统会逐步启用更完整的负荷建议，但仍受动作质量和不适信号约束'
    );
  }

  return buildTemplate(
    `当前自动等级为${formatAutoTrainingLevel(assessment.level)}`,
    '等级判断仍在积累证据，置信度还不高',
    '继续记录重量、次数、RIR、动作质量和不适信号'
  );
};
