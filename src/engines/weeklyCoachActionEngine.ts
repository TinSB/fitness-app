import { EXERCISE_DISPLAY_NAMES, EXERCISE_KNOWLEDGE_OVERRIDES } from '../data/exerciseLibrary';
import type {
  AdherenceReport,
  E1RMProfile,
  ExerciseRecommendation,
  ExerciseTemplate,
  MesocycleWeek,
  MuscleVolumeDashboardRow,
  PainPattern,
  ProgramAdjustmentPreview,
  ProgramTemplate,
  ScreeningProfile,
  TrainingSession,
  WeeklyActionRecommendation,
  WeeklyActionPriority,
} from '../models/training-model';
import { number } from './engineUtils';
import type { LoadFeedbackSummary } from './loadFeedbackEngine';

type ExerciseLibraryLike = Record<string, Partial<ExerciseTemplate> & Record<string, unknown>>;
type ExerciseRecommendationCandidate = ExerciseRecommendation & { contribution: number };
type ProgramPreviewChange = ProgramAdjustmentPreview['changes'][number];

export interface WeeklyCoachActionInput {
  muscleVolumeDashboard: MuscleVolumeDashboardRow[];
  adherenceReport?: AdherenceReport;
  loadFeedbackSummary?: LoadFeedbackSummary;
  painPatterns?: PainPattern[];
  e1rmProfiles?: E1RMProfile[];
  mesocycleWeek?: MesocycleWeek | null;
  programTemplate?: ProgramTemplate | null;
  exerciseLibrary?: ExerciseLibraryLike;
  screeningProfile?: ScreeningProfile | null;
  history?: TrainingSession[];
}

export interface ExerciseRecommendationContext {
  exerciseLibrary?: ExerciseLibraryLike;
  painPatterns?: PainPattern[];
  restrictedExercises?: string[];
  loadFeedbackByExercise?: Record<string, LoadFeedbackSummary | undefined>;
  recentLowAdherenceExerciseIds?: string[];
}

const priorityScore: Record<WeeklyActionPriority, number> = { high: 0, medium: 1, low: 2 };

const roundOne = (value: number) => Math.round(value * 10) / 10;
const clampDelta = (value: number) => Math.max(2, Math.min(4, Math.ceil(value)));

const defaultExerciseLibrary = () => EXERCISE_KNOWLEDGE_OVERRIDES as ExerciseLibraryLike;

const exerciseLabel = (id: string, exercise?: Partial<ExerciseTemplate>) =>
  exercise?.alias || exercise?.name || EXERCISE_DISPLAY_NAMES[id] || id;

const getContribution = (muscleId: string, exercise: Partial<ExerciseTemplate> & Record<string, unknown>) => {
  const contribution = exercise.muscleContribution as Record<string, number> | undefined;
  if (contribution?.[muscleId]) return number(contribution[muscleId]);
  if ((exercise.primaryMuscles || []).includes(muscleId)) return 1;
  if ((exercise.secondaryMuscles || []).includes(muscleId)) return 0.5;
  if (exercise.muscle === muscleId) return 1;
  return 0;
};

const painActionForExercise = (painPatterns: PainPattern[] = [], exerciseId: string) =>
  painPatterns.find((pattern) => pattern.exerciseId === exerciseId)?.suggestedAction;

const hasPainRisk = (painPatterns: PainPattern[] = [], exerciseId: string) => {
  const action = painActionForExercise(painPatterns, exerciseId);
  return action === 'substitute' || action === 'seek_professional' || action === 'deload';
};

const recentFeedbackIsHeavy = (summary?: LoadFeedbackSummary) =>
  Boolean(summary && summary.counts.too_heavy >= 2 && summary.counts.too_heavy >= summary.counts.good);

const fatigueScore = (fatigueCost: unknown) => (fatigueCost === 'low' ? 0 : fatigueCost === 'medium' ? 1 : 2);

export const recommendExercisesForMuscleGap = (
  muscleId: string,
  context: ExerciseRecommendationContext = {},
): ExerciseRecommendation[] => {
  const library = context.exerciseLibrary || defaultExerciseLibrary();
  const restricted = new Set(context.restrictedExercises || []);

  return Object.entries(library)
    .map(([exerciseId, exercise]) => {
      const contribution = getContribution(muscleId, exercise);
      if (contribution <= 0) return null;

      const fatigueCost = (exercise.fatigueCost || 'medium') as ExerciseRecommendation['fatigueCost'];
      const restrictedExercise = restricted.has(exerciseId);
      const painRisk = hasPainRisk(context.painPatterns, exerciseId);
      const heavyFeedback = recentFeedbackIsHeavy(context.loadFeedbackByExercise?.[exerciseId]);
      const lowAdherence = (context.recentLowAdherenceExerciseIds || []).includes(exerciseId);

      let priority: ExerciseRecommendation['priority'] = 'primary';
      const reasons: string[] = [];

      if (restrictedExercise || painRisk) {
        priority = 'avoid';
        reasons.push(restrictedExercise ? '该动作已被当前筛查限制。' : '该动作近期有重复不适信号。');
      } else {
        if (fatigueCost === 'high' || heavyFeedback || lowAdherence) priority = 'secondary';
        if (contribution >= 0.9 && fatigueCost !== 'high') reasons.push(`能直接补充${muscleId}训练量。`);
        if (fatigueCost === 'low' || fatigueCost === 'medium') reasons.push('疲劳成本较低，适合用作下周补量。');
        if (fatigueCost === 'high') reasons.push('疲劳成本较高，补量时不作为首选。');
        if (heavyFeedback) reasons.push('最近该动作有推荐重量偏重反馈，先降低优先级。');
        if (lowAdherence) reasons.push('该动作近期完成度偏低，先作为备选。');
      }

      return {
        exerciseId,
        label: exerciseLabel(exerciseId, exercise),
        reason: reasons.join(' ') || `可为${muscleId}提供训练量。`,
        fatigueCost,
        priority,
        contribution,
      };
    })
    .filter((item): item is ExerciseRecommendationCandidate => Boolean(item))
    .sort((left, right) => {
      if (!left || !right) return 0;
      const priorityOrder = { primary: 0, secondary: 1, avoid: 2 };
      return (
        priorityOrder[left.priority] - priorityOrder[right.priority] ||
        fatigueScore(left.fatigueCost) - fatigueScore(right.fatigueCost) ||
        number(right.contribution) - number(left.contribution)
      );
    })
    .map(({ contribution: _contribution, ...item }) => item);
};

const makeRecommendation = (item: Omit<WeeklyActionRecommendation, 'id'> & { id?: string }): WeeklyActionRecommendation => ({
  id: item.id || `${item.category}-${item.targetType}-${item.targetId || item.targetLabel}`,
  ...item,
});

const hasLowHighConfidence = (row: MuscleVolumeDashboardRow) =>
  row.completedSets >= Math.max(3, row.targetSets * 0.6) &&
  row.highConfidenceEffectiveSets < Math.max(1, row.effectiveSets * 0.6);

const volumeRecommendationForRow = (
  row: MuscleVolumeDashboardRow,
  input: WeeklyCoachActionInput,
): WeeklyActionRecommendation[] => {
  const deloadWeek = input.mesocycleWeek?.phase === 'deload';
  const painRisk = (input.painPatterns || []).some((pattern) => pattern.area === row.muscleId && pattern.suggestedAction !== 'watch');
  const exerciseRecommendations = recommendExercisesForMuscleGap(row.muscleId, {
    exerciseLibrary: input.exerciseLibrary,
    painPatterns: input.painPatterns,
    restrictedExercises: input.screeningProfile?.restrictedExercises,
  }).filter((item) => item.priority !== 'avoid');
  const exerciseIds = exerciseRecommendations.slice(0, 3).map((item) => item.exerciseId);
  const exerciseText = exerciseRecommendations.slice(0, 2).map((item) => item.label).join(' / ');
  const recommendations: WeeklyActionRecommendation[] = [];

  if (row.status === 'low') {
    const setsDelta = clampDelta(row.remainingSets);
    if (deloadWeek) {
      recommendations.push(
        makeRecommendation({
          priority: 'medium',
          category: 'mesocycle',
          targetType: 'muscle',
          targetId: row.muscleId,
          targetLabel: row.muscleName,
          issue: `${row.muscleName} 本周低于目标，但当前处于减量周。`,
          recommendation: '下周先按减量周完成恢复，不强行补量。',
          reason: '减量周的优先级是降低疲劳，训练量不足先记录为后续周期的补量参考。',
          suggestedChange: { muscleId: row.muscleId, setsDelta: 0, volumeMultiplier: 0.6 },
          evidenceRuleIds: ['deload_volume_reduction', 'weekly_volume_distribution'],
          confidence: 'medium',
        })
      );
    } else {
      recommendations.push(
        makeRecommendation({
          priority: painRisk ? 'medium' : 'high',
          category: 'volume',
          targetType: 'muscle',
          targetId: row.muscleId,
          targetLabel: row.muscleName,
          issue: `${row.muscleName} 本周加权有效组明显低于目标。`,
          recommendation: exerciseText
            ? `下周优先补 ${setsDelta} 组${row.muscleName}训练量，可放在 ${exerciseText}。`
            : `下周优先补 ${setsDelta} 组${row.muscleName}训练量。`,
          reason: `目标 ${row.targetSets} 组，目前加权有效组 ${row.weightedEffectiveSets}，还差约 ${row.remainingSets} 组。`,
          suggestedChange: { muscleId: row.muscleId, setsDelta, exerciseIds },
          evidenceRuleIds: ['weekly_volume_distribution', 'progressive_overload'],
          confidence: row.effectiveSets > 0 ? 'high' : 'medium',
        })
      );
    }
  }

  if (row.status === 'near_target' || row.status === 'on_target') {
    recommendations.push(
      makeRecommendation({
        priority: 'low',
        category: 'volume',
        targetType: 'muscle',
        targetId: row.muscleId,
        targetLabel: row.muscleName,
        issue: `${row.muscleName} 本周训练量已${row.status === 'near_target' ? '接近目标' : '达标'}。`,
        recommendation: `下周维持${row.muscleName}当前训练量，不需要额外加量。`,
        reason: `当前加权有效组 ${row.weightedEffectiveSets}/${row.targetSets}，继续提高动作质量比堆组数更重要。`,
        suggestedChange: { muscleId: row.muscleId, setsDelta: 0 },
        evidenceRuleIds: ['weekly_volume_distribution'],
        confidence: 'medium',
      })
    );
  }

  if (row.status === 'high') {
    recommendations.push(
      makeRecommendation({
        priority: 'medium',
        category: 'recovery',
        targetType: 'muscle',
        targetId: row.muscleId,
        targetLabel: row.muscleName,
        issue: `${row.muscleName} 本周训练量可能偏高。`,
        recommendation: `下周不建议继续增加${row.muscleName}辅助动作，可减少 1–2 组或维持现状。`,
        reason: `当前加权有效组 ${row.weightedEffectiveSets} 已超过目标 ${row.targetSets}，继续加量可能提高疲劳成本。`,
        suggestedChange: { muscleId: row.muscleId, setsDelta: -2 },
        evidenceRuleIds: ['weekly_volume_distribution', 'deload_volume_reduction'],
        confidence: 'medium',
      })
    );
  }

  if (hasLowHighConfidence(row)) {
    recommendations.push(
      makeRecommendation({
        priority: row.status === 'low' ? 'medium' : 'high',
        category: 'technique',
        targetType: 'muscle',
        targetId: row.muscleId,
        targetLabel: row.muscleName,
        issue: `${row.muscleName} 完成组不少，但高置信有效组偏低。`,
        recommendation: '下周优先记录 RIR 和动作质量，先把工作组做成高置信有效组，而不是盲目加量。',
        reason: `完成 ${row.completedSets} 组，但高置信有效组只有 ${row.highConfidenceEffectiveSets} 组。`,
        suggestedChange: { muscleId: row.muscleId, setsDelta: 0 },
        evidenceRuleIds: ['technique_quality_gate', 'rir_effort_control'],
        confidence: 'high',
      })
    );
  }

  return recommendations;
};

export const buildWeeklyActionRecommendations = (input: WeeklyCoachActionInput): WeeklyActionRecommendation[] => {
  const recommendations: WeeklyActionRecommendation[] = [];

  if (!input.muscleVolumeDashboard.length) {
    return [
      makeRecommendation({
        priority: 'low',
        category: 'adherence',
        targetType: 'program',
        targetLabel: '训练记录',
        issue: '当前训练记录还不足以生成高置信行动建议。',
        recommendation: '继续记录 2–3 次完整训练，尤其是 RIR、动作质量和实际完成组数。',
        reason: '肌群训练量、完成度和动作质量数据不足时，系统不会假装给出精确调整。',
        evidenceRuleIds: ['weekly_volume_distribution'],
        confidence: 'low',
      }),
    ];
  }

  input.muscleVolumeDashboard.forEach((row) => recommendations.push(...volumeRecommendationForRow(row, input)));

  if (input.adherenceReport && input.adherenceReport.overallRate < 70) {
    recommendations.push(
      makeRecommendation({
        priority: 'high',
        category: 'adherence',
        targetType: 'program',
        targetLabel: '计划可执行性',
        issue: `最近训练完成度只有 ${input.adherenceReport.overallRate}%。`,
        recommendation: '下周先减少计划复杂度，优先保留主训练和最关键的 1 个辅助模块。',
        reason: '完成度偏低时，继续加内容通常会让计划更难执行。',
        suggestedChange: { volumeMultiplier: 0.9, supportDoseAdjustment: 'reduce' },
        evidenceRuleIds: ['weekly_volume_distribution'],
        confidence: input.adherenceReport.confidence,
      })
    );
  }

  const heavyFeedback = input.loadFeedbackSummary && input.loadFeedbackSummary.counts.too_heavy >= 2;
  if (heavyFeedback) {
    recommendations.push(
      makeRecommendation({
        priority: 'medium',
        category: 'load_feedback',
        targetType: 'program',
        targetLabel: '推荐重量',
        issue: '最近多次反馈推荐重量偏重。',
        recommendation: '下周相关动作先采用保守推进，不直接提高当前 e1RM。',
        reason: '重量反馈是校准信号，不应直接覆盖训练表现数据。',
        suggestedChange: { volumeMultiplier: 0.95 },
        evidenceRuleIds: ['progressive_overload', 'rir_effort_control'],
        confidence: 'medium',
      })
    );
  }

  (input.painPatterns || []).slice(0, 2).forEach((pattern) => {
    if (pattern.suggestedAction === 'watch') return;
    recommendations.push(
      makeRecommendation({
        priority: pattern.suggestedAction === 'seek_professional' ? 'high' : 'medium',
        category: 'pain',
        targetType: pattern.exerciseId ? 'exercise' : 'program',
        targetId: pattern.exerciseId,
        targetLabel: pattern.exerciseId || pattern.area,
        issue: `${pattern.area} 近期出现重复不适信号。`,
        recommendation: pattern.exerciseId ? '下周避免把该动作作为补量首选，优先使用更稳定的替代动作。' : '下周降低相关部位训练压力，并观察不适是否持续。',
        reason: `频率 ${pattern.frequency}，平均强度 ${pattern.severityAvg.toFixed(1)}，系统建议采取保守训练处理。`,
        suggestedChange: pattern.exerciseId ? { removeExerciseIds: [pattern.exerciseId] } : { volumeMultiplier: 0.9 },
        evidenceRuleIds: ['pain_conservative_rule'],
        confidence: 'medium',
      })
    );
  });

  (input.e1rmProfiles || []).forEach((profile) => {
    if (!profile.current || !profile.best || profile.best.e1rmKg <= profile.current.e1rmKg + 5) return;
    recommendations.push(
      makeRecommendation({
        priority: 'low',
        category: 'recovery',
        targetType: 'exercise',
        targetId: profile.exerciseId,
        targetLabel: EXERCISE_DISPLAY_NAMES[profile.exerciseId] || profile.exerciseId,
        issue: '历史最佳 e1RM 明显高于当前稳定估算。',
        recommendation: '下周训练重量继续以当前 e1RM 为准，不追历史最高。',
        reason: `当前估算 ${profile.current.e1rmKg}kg，历史最佳 ${profile.best.e1rmKg}kg；近期能力比历史峰值更能代表下周可用负荷。`,
        evidenceRuleIds: ['progressive_overload'],
        confidence: profile.current.confidence,
      })
    );
  });

  return recommendations
    .sort((left, right) => priorityScore[left.priority] - priorityScore[right.priority] || left.targetLabel.localeCompare(right.targetLabel, 'zh-CN'))
    .slice(0, 10);
};

export const buildProgramAdjustmentPreview = (
  recommendations: WeeklyActionRecommendation[],
  programTemplate?: ProgramTemplate | null,
): ProgramAdjustmentPreview[] => {
  const actionable = recommendations.filter((item) => item.suggestedChange);
  if (!actionable.length) {
    return [
      {
        id: 'preview-keep',
        title: '暂不调整计划结构',
        summary: '当前建议以观察和记录为主，暂时不生成训练模板改动。',
        changes: [{ type: 'keep', reason: '没有足够高置信的结构调整信号。' }],
        confidence: 'low',
      },
    ];
  }

  const changes: ProgramPreviewChange[] = actionable.flatMap<ProgramPreviewChange>((item) => {
    const change = item.suggestedChange;
    if (!change) return [];
    if (number(change.setsDelta) > 0) {
      return [{
        type: 'add_sets' as const,
        muscleId: change.muscleId,
        exerciseId: change.exerciseIds?.[0],
        setsDelta: change.setsDelta,
        reason: item.recommendation,
      }];
    }
    if (number(change.setsDelta) < 0) {
      return [{
        type: 'remove_sets' as const,
        muscleId: change.muscleId,
        setsDelta: change.setsDelta,
        reason: item.recommendation,
      }];
    }
    if (change.removeExerciseIds?.length) {
      return change.removeExerciseIds.map((exerciseId) => ({
        type: 'swap_exercise' as const,
        exerciseId,
        reason: item.recommendation,
      }));
    }
    if (change.supportDoseAdjustment && change.supportDoseAdjustment !== 'keep') {
      return [{
        type: 'reduce_support' as const,
        reason: item.recommendation,
      }];
    }
    return [{
      type: 'keep' as const,
      muscleId: change.muscleId,
      reason: item.recommendation,
    }];
  });

  return [
    {
      id: 'preview-next-week',
      title: '下周计划调整预览',
      summary: programTemplate
        ? `基于当前数据，建议先预览 ${programTemplate.splitType} 计划的微调，不自动应用。`
        : '基于当前数据生成下周微调预览，不自动应用。',
      changes: changes.slice(0, 6),
      confidence: recommendations.some((item) => item.confidence === 'high') ? 'high' : 'medium',
    },
  ];
};
