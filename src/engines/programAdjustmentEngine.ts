import { EXERCISE_DISPLAY_NAMES } from '../data/exerciseLibrary';
import type {
  AdjustmentChange,
  AdjustmentChangeType,
  EstimateConfidence,
  ExerciseTemplate,
  ProgramAdjustmentDiff,
  ProgramAdjustmentDraft,
  ProgramAdjustmentHistoryItem,
  TrainingTemplate,
  WeeklyActionRecommendation,
} from '../models/training-model';
import { number } from './engineUtils';

const confidenceRank: Record<EstimateConfidence, number> = { low: 0, medium: 1, high: 2 };

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cloneTemplate = (template: TrainingTemplate): TrainingTemplate =>
  JSON.parse(JSON.stringify(template)) as TrainingTemplate;

const changeTypeLabel: Record<AdjustmentChangeType, string> = {
  add_sets: '增加组数',
  remove_sets: '减少组数',
  swap_exercise: '替代动作',
  reduce_support: '降低辅助层剂量',
  increase_support: '提高辅助层剂量',
  keep: '维持结构',
};

const exerciseLabel = (exerciseId?: string, fallback?: string) =>
  (exerciseId && EXERCISE_DISPLAY_NAMES[exerciseId]) || fallback || exerciseId || '待选择动作';

const matchesMuscle = (exercise: ExerciseTemplate, muscleId?: string) => {
  if (!muscleId) return false;
  return (
    exercise.muscle === muscleId ||
    exercise.primaryMuscles?.includes(muscleId) ||
    exercise.secondaryMuscles?.includes(muscleId) ||
    Boolean(exercise.muscleContribution?.[muscleId])
  );
};

const findExerciseIndex = (template: TrainingTemplate, change: AdjustmentChange) => {
  const direct = change.exerciseId
    ? template.exercises.findIndex((exercise) => exercise.id === change.exerciseId || exercise.baseId === change.exerciseId || exercise.canonicalExerciseId === change.exerciseId)
    : -1;
  if (direct >= 0) return direct;
  return template.exercises.findIndex((exercise) => matchesMuscle(exercise, change.muscleId));
};

const highestConfidence = (recommendations: WeeklyActionRecommendation[]): EstimateConfidence =>
  recommendations.reduce<EstimateConfidence>(
    (best, item) => (confidenceRank[item.confidence] > confidenceRank[best] ? item.confidence : best),
    'low',
  );

const changeFromRecommendation = (recommendation: WeeklyActionRecommendation, index: number): AdjustmentChange[] => {
  const change = recommendation.suggestedChange;
  if (!change) return [];

  const base = {
    id: `${recommendation.id}-change-${index + 1}`,
    muscleId: change.muscleId,
    reason: recommendation.recommendation,
    sourceRecommendationId: recommendation.id,
  };

  if (number(change.setsDelta) > 0) {
    return [
      {
        ...base,
        type: 'add_sets',
        exerciseId: change.exerciseIds?.[0],
        setsDelta: Math.max(1, Math.round(number(change.setsDelta))),
      },
    ];
  }

  if (number(change.setsDelta) < 0) {
    return [
      {
        ...base,
        type: 'remove_sets',
        exerciseId: change.exerciseIds?.[0],
        setsDelta: Math.min(-1, Math.round(number(change.setsDelta))),
      },
    ];
  }

  if (change.removeExerciseIds?.length) {
    return change.removeExerciseIds.map((exerciseId, removeIndex) => ({
      ...base,
      id: `${recommendation.id}-swap-${removeIndex + 1}`,
      type: 'swap_exercise',
      exerciseId,
    }));
  }

  if (change.supportDoseAdjustment === 'reduce' || change.supportDoseAdjustment === 'minimal') {
    return [
      {
        ...base,
        type: 'reduce_support',
      },
    ];
  }

  return [
    {
      ...base,
      type: 'keep',
      setsDelta: 0,
    },
  ];
};

export const createAdjustmentDraftFromRecommendations = (
  recommendations: WeeklyActionRecommendation[],
  sourceProgramTemplate: Pick<TrainingTemplate, 'id' | 'name'>,
): ProgramAdjustmentDraft => {
  const actionable = recommendations.filter((item) => item.suggestedChange);
  const changes = actionable.flatMap(changeFromRecommendation);
  const notes = actionable.length
    ? []
    : ['当前建议更适合人工参考，暂不生成自动调整。'];

  return {
    id: makeId('adjustment-draft'),
    createdAt: new Date().toISOString(),
    status: 'draft',
    sourceProgramTemplateId: sourceProgramTemplate.id,
    title: `${sourceProgramTemplate.name} 下周实验调整`,
    summary: changes.length
      ? `基于 ${actionable.length} 条已选择建议生成实验模板草案，应用前需要确认差异。`
      : '当前没有可安全自动应用的训练模板调整。',
    selectedRecommendationIds: recommendations.map((item) => item.id),
    changes,
    confidence: highestConfidence(recommendations),
    notes,
  };
};

export const buildAdjustmentDiff = (
  draft: ProgramAdjustmentDraft,
  sourceProgramTemplate: TrainingTemplate,
): ProgramAdjustmentDiff => {
  const changes = draft.changes.map((change) => {
    const index = findExerciseIndex(sourceProgramTemplate, change);
    const exercise = index >= 0 ? sourceProgramTemplate.exercises[index] : undefined;
    const currentSets = number(exercise?.sets);
    const nextSets = Math.max(1, currentSets + number(change.setsDelta));
    let before = '当前结构不变';
    let after = '保持当前安排';
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (change.type === 'add_sets' || change.type === 'remove_sets') {
      if (!exercise) {
        before = '未找到可自动调整的动作';
        after = change.setsDelta && change.setsDelta > 0
          ? `建议人工为 ${change.muscleId || '目标肌群'} 增加 ${change.setsDelta} 组`
          : `建议人工减少 ${Math.abs(number(change.setsDelta))} 组`;
        riskLevel = 'high';
      } else {
        before = `${sourceProgramTemplate.name}：${exercise.name} ${currentSets} 组`;
        after = `${sourceProgramTemplate.name}：${exercise.name} ${nextSets} 组`;
        riskLevel = Math.abs(number(change.setsDelta)) >= 4 ? 'medium' : 'low';
      }
    }

    if (change.type === 'swap_exercise') {
      before = exercise ? `${sourceProgramTemplate.name}：${exercise.name}` : exerciseLabel(change.exerciseId);
      after = change.replacementExerciseId
        ? `${exerciseLabel(change.replacementExerciseId)}（实验替代）`
        : '需要人工选择安全替代动作';
      riskLevel = change.replacementExerciseId ? 'medium' : 'high';
    }

    if (change.type === 'reduce_support' || change.type === 'increase_support') {
      before = '当前纠偏 / 功能补丁剂量';
      after = change.type === 'reduce_support' ? '下周采用更低辅助层剂量' : '下周提高辅助层剂量';
      riskLevel = 'low';
    }

    return {
      changeId: change.id,
      type: change.type,
      label: changeTypeLabel[change.type],
      before,
      after,
      reason: change.reason,
      riskLevel,
    };
  });

  return {
    title: draft.title,
    summary: draft.summary,
    changes,
  };
};

const applyChangeToTemplate = (template: TrainingTemplate, change: AdjustmentChange) => {
  const index = findExerciseIndex(template, change);

  if ((change.type === 'add_sets' || change.type === 'remove_sets') && index >= 0) {
    const exercise = template.exercises[index];
    const nextSets = Math.max(1, number(exercise.sets) + number(change.setsDelta));
    template.exercises[index] = { ...exercise, sets: nextSets };
    return true;
  }

  if (change.type === 'swap_exercise' && index >= 0 && change.replacementExerciseId) {
    const exercise = template.exercises[index];
    template.exercises[index] = {
      ...exercise,
      id: change.replacementExerciseId,
      name: exerciseLabel(change.replacementExerciseId, exercise.name),
      alias: exerciseLabel(change.replacementExerciseId, exercise.alias || exercise.name),
    };
    return true;
  }

  return change.type === 'keep' || change.type === 'reduce_support' || change.type === 'increase_support';
};

export const applyAdjustmentDraft = (
  draft: ProgramAdjustmentDraft,
  sourceProgramTemplate: TrainingTemplate,
): {
  experimentalTemplate: TrainingTemplate;
  historyItem: ProgramAdjustmentHistoryItem;
} => {
  const experimentalTemplate = cloneTemplate(sourceProgramTemplate);
  const experimentalId = `${sourceProgramTemplate.id}-experiment-${draft.id.slice(-6)}`;
  const appliedChanges: AdjustmentChange[] = [];
  const skippedNotes: string[] = [];

  experimentalTemplate.id = experimentalId;
  experimentalTemplate.name = `${sourceProgramTemplate.name} 下周实验版`;
  experimentalTemplate.note = `${sourceProgramTemplate.note || ''}\n实验调整：${draft.summary}`.trim();

  draft.changes.forEach((change) => {
    if (applyChangeToTemplate(experimentalTemplate, change)) {
      appliedChanges.push(change);
    } else {
      skippedNotes.push(`未能安全应用：${change.reason}`);
    }
  });

  if (skippedNotes.length) {
    experimentalTemplate.note = `${experimentalTemplate.note}\n${skippedNotes.join('\n')}`;
  }

  const historyItem: ProgramAdjustmentHistoryItem = {
    id: makeId('adjustment-history'),
    appliedAt: new Date().toISOString(),
    sourceProgramTemplateId: sourceProgramTemplate.id,
    experimentalProgramTemplateId: experimentalTemplate.id,
    selectedRecommendationIds: draft.selectedRecommendationIds,
    changes: appliedChanges,
    rollbackAvailable: true,
  };

  return { experimentalTemplate, historyItem };
};

export const rollbackAdjustment = (
  historyItem: ProgramAdjustmentHistoryItem,
): {
  restoredTemplateId: string;
  updatedHistoryItem: ProgramAdjustmentHistoryItem;
} => ({
  restoredTemplateId: historyItem.sourceProgramTemplateId,
  updatedHistoryItem: {
    ...historyItem,
    rollbackAvailable: false,
    rolledBackAt: new Date().toISOString(),
  },
});
