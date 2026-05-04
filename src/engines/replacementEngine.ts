import {
  EXERCISE_ALIASES,
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_EQUIVALENCE_CHAINS,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  formatExerciseDisplayName,
  getExerciseNameEntry,
} from '../data/exerciseLibrary';
import { formatFatigueCost, formatReplacementCategory } from '../i18n/formatters';
import { clone } from './engineUtils';
import type { ExercisePrescription, TrainingSession } from '../models/training-model';

export type ReplacementRank = 'priority' | 'acceptable' | 'angle' | 'optional' | 'equipment_fallback' | 'fatigue_reduction' | 'compound_fallback';
type ReplacementPriorityValue = ReplacementRank | 'not_recommended' | 'avoid' | string;

export interface ReplacementOption {
  id: string;
  name: string;
  rank: ReplacementRank;
  rankLabel: string;
  reason: string;
  fatigueCost: string;
  fatigueCostLabel: string;
  prIndependent: boolean;
}

const rankLabels: Record<ReplacementRank, string> = {
  priority: '优先',
  acceptable: '可接受',
  angle: '角度相近',
  optional: '可选',
  equipment_fallback: '器械不可用时',
  fatigue_reduction: '降低疲劳',
  compound_fallback: '复合动作替代',
};

const rankOrder: Record<ReplacementRank, number> = {
  priority: 0,
  acceptable: 1,
  angle: 1,
  optional: 2,
  equipment_fallback: 3,
  fatigue_reduction: 3,
  compound_fallback: 3,
};

const forbiddenBenchReplacementIds = new Set(['triceps-pushdown', 'shoulder-press', 'machine-shoulder-press', 'cable-fly']);

const displayName = (id: string, bilingual = false) => formatExerciseDisplayName(id, { bilingual, fallback: '未命名动作' });

export const isSyntheticReplacementExerciseId = (id: unknown) => /__(?:auto_)?alt(?:_|$)/.test(String(id || ''));

export const validateReplacementExerciseId = (id: unknown) => {
  const value = String(id || '').trim();
  if (!value || isSyntheticReplacementExerciseId(value)) return false;
  return Boolean(EXERCISE_DISPLAY_NAMES[value] || EXERCISE_KNOWLEDGE_OVERRIDES[value]);
};

export const isKnownExerciseId = (id: unknown) => validateReplacementExerciseId(id);

export type ExerciseIdentityLike = {
  id?: unknown;
  actualExerciseId?: unknown;
  replacementExerciseId?: unknown;
  originalExerciseId?: unknown;
  legacyActualExerciseId?: unknown;
  legacyReplacementExerciseId?: unknown;
  legacyOriginalExerciseId?: unknown;
  identityInvalid?: unknown;
};

export const hasInvalidExerciseIdentity = (exercise: ExerciseIdentityLike | null | undefined) => {
  if (!exercise) return false;
  if (exercise.identityInvalid === true) return true;
  return Boolean(
    exercise.legacyActualExerciseId ||
      exercise.legacyReplacementExerciseId ||
      exercise.legacyOriginalExerciseId ||
      isSyntheticReplacementExerciseId(exercise.id) ||
      isSyntheticReplacementExerciseId(exercise.actualExerciseId) ||
      isSyntheticReplacementExerciseId(exercise.replacementExerciseId) ||
      (exercise.actualExerciseId && !isKnownExerciseId(exercise.actualExerciseId)) ||
      (exercise.replacementExerciseId && !isKnownExerciseId(exercise.replacementExerciseId)) ||
      (exercise.originalExerciseId && !isKnownExerciseId(exercise.originalExerciseId))
  );
};

const baseExerciseId = (
  exercise: Pick<ExercisePrescription, 'baseId' | 'replacedFromId' | 'canonicalExerciseId' | 'id' | 'originalExerciseId' | 'actualExerciseId' | 'replacementExerciseId'>
) => exercise.originalExerciseId || exercise.replacedFromId || exercise.baseId || String(exercise.canonicalExerciseId || exercise.id).split('__alt_')[0];

const actualExerciseId = (exercise: Pick<ExercisePrescription, 'id' | 'actualExerciseId' | 'replacementExerciseId' | 'canonicalExerciseId'>) =>
  exercise.actualExerciseId || exercise.replacementExerciseId || exercise.canonicalExerciseId || exercise.id;

const canonicalIdForAliasFilter = (id: string) => getExerciseNameEntry(id).zh || id;

const normalizeName = (value: string) => value.replace(/[（）()\\s-]/g, '').toLowerCase();

const buildCurrentIdentitySet = (exercise: ExercisePrescription) => {
  const ids = [exercise.id, exercise.baseId, exercise.canonicalExerciseId, exercise.originalExerciseId, exercise.actualExerciseId, exercise.replacementExerciseId, exercise.replacedFromId]
    .filter(Boolean)
    .map(String);
  const names = ids.flatMap((id) => [canonicalIdForAliasFilter(id), ...(EXERCISE_ALIASES[id] || [])]).map(normalizeName);
  return {
    ids: new Set(ids),
    names: new Set(names),
  };
};

const isSelfOrAlias = (id: string, identity: ReturnType<typeof buildCurrentIdentitySet>) =>
  identity.ids.has(id) || identity.names.has(normalizeName(canonicalIdForAliasFilter(id))) || (EXERCISE_ALIASES[id] || []).some((alias) => identity.names.has(normalizeName(alias)));

const optionFromId = (id: string, rank: ReplacementRank, reason: string): ReplacementOption | null => {
  const metadata = EXERCISE_KNOWLEDGE_OVERRIDES[id];
  if (!validateReplacementExerciseId(id)) return null;
  const fatigueCost = String(metadata?.fatigueCost || 'medium');
  return {
    id,
    name: displayName(id, true),
    rank,
    rankLabel: rankLabels[rank] || formatReplacementCategory(rank),
    reason,
    fatigueCost,
    fatigueCostLabel: formatFatigueCost(fatigueCost),
    prIndependent: true,
  };
};

const rankFromPriority = (value: ReplacementPriorityValue | undefined, fallback: ReplacementRank): ReplacementRank | null => {
  if (value === 'not_recommended' || value === 'avoid') return null;
  if (
    value === 'priority' ||
    value === 'acceptable' ||
    value === 'optional' ||
    value === 'angle' ||
    value === 'equipment_fallback' ||
    value === 'fatigue_reduction' ||
    value === 'compound_fallback'
  )
    return value;
  return fallback;
};

const reasonForReplacement = (sourceId: string, id: string, rank: ReplacementRank) => {
  if (sourceId === 'lat-pulldown') {
    if (id === 'assisted-pull-up') return '同属垂直拉，动作目标接近；会按辅助引体向上独立记录 PR / e1RM。';
    if (id === 'pull-up') return '同属垂直拉，强度和技能要求更高；适合状态好时替代。';
    if (id === 'single-arm-lat-pulldown') return '同属垂直拉，但改为单侧角度，适合需要更细致控制背阔发力时使用。';
    if (id === 'machine-row' || id === 'seated-row') return '这是背部补量选择，不是一线垂直拉等价替代；仅在下拉器械不可用时使用。';
  }
  if (sourceId === 'seated-row') {
    if (id === 'chest-supported-row') return '同属水平拉，胸托能降低躯干代偿，适合作为坐姿划船的一线替代。';
    if (id === 'machine-row') return '同属水平拉，轨迹稳定，适合作为坐姿划船的一线替代。';
    if (id === 'one-arm-db-row') return '同属水平拉，但改为单侧自由重量，需要更多稳定控制。';
    if (id === 'barbell-row') return '同属水平拉但疲劳和技术要求更高，适合作为可选替代，不是默认降阶。';
  }
  if (sourceId === 'barbell-row') {
    if (id === 'chest-supported-row') return '同属水平拉，胸托能降低腰背疲劳，同时保留背部主训练刺激。';
    if (id === 't-bar-row') return '同属水平拉，负荷路径接近，适合作为杠铃划船的一线替代。';
    if (id === 'one-arm-db-row' || id === 'seated-row') return '同属水平拉，但器械或单侧形式不同；会按实际动作独立记录。';
    if (id === 'machine-row') return '同属背部水平拉补量，稳定性更高，但不是完全等价的杠铃划船替代。';
  }
  if (sourceId === 'face-pull') {
    if (id === 'reverse-pec-deck') return '同样偏向肩后束和肩胛控制，适合替代面拉，不作为背部主训练替代。';
    if (id === 'cable-rear-delt-fly') return '同样偏向肩后束控制，适合替代面拉，不提高背部主训练量权重。';
    if (id === 'lateral-raise') return '这是肩部补量选择，方向不同，只作为可选替代。';
  }
  if (sourceId === 'squat') {
    if (id === 'hack-squat') return '同属深蹲链，轨迹更稳定，适合作为深蹲的一线替代。';
    if (id === 'smith-squat') return '同属深蹲链，轨迹固定，适合器械可用时替代深蹲，并按史密斯深蹲独立记录。';
    if (id === 'leg-press') return '同属深蹲模式的腿部主训练，但躯干和稳定要求不同，是可接受替代，不是完全等价。';
    if (id === 'belt-squat') return '同属深蹲模式，能减少脊柱负担，是可接受替代，不是完全等价。';
    if (id === 'goblet-squat') return '同属深蹲模式，但负荷上限较低，适合作为可选替代或技术保守方案。';
  }
  if (sourceId === 'romanian-deadlift') {
    if (id === 'db-rdl') return '同属髋铰链，负荷形式更灵活，适合作为 RDL 的一线替代。';
    if (id === 'hip-thrust') return '臀推更偏髋伸和臀腿后链，降低下背压力，但不是髋铰链完全等价。';
    if (id === 'leg-curl' || id === 'seated-leg-curl' || id === 'lying-leg-curl') return '这是腿后侧补量选择，不是髋铰链等价替代，会按实际动作独立记录。';
  }
  if (sourceId === 'leg-curl') {
    if (id === 'seated-leg-curl') return '同属膝屈链，适合作为腿弯举的一线替代。';
    if (id === 'lying-leg-curl') return '同属膝屈链，适合作为腿弯举的一线替代。';
    if (id === 'nordic-curl') return '同属膝屈链，但疲劳和技术要求更高，适合作为可接受替代。';
    if (id === 'romanian-deadlift') return '这是后链补量选择，不是腿弯举同模式优先替代。';
  }
  if (sourceId === 'calf-raise') {
    if (id === 'seated-calf-raise') return '同属跖屈链，适合作为提踵的一线替代。';
    if (id === 'standing-calf-raise') return '同属跖屈链，适合作为提踵的一线替代。';
    if (id === 'leg-press-calf-raise') return '同属跖屈链，器械角度不同，是可接受替代。';
  }
  if (sourceId === 'shoulder-press') {
    if (id === 'machine-shoulder-press') return '同属垂直推链，轨迹更稳定，适合作为哑铃肩推的一线替代。';
    if (id === 'smith-shoulder-press') return '同属垂直推链，轨迹固定，适合需要更稳定推举路径时替代。';
    if (id === 'landmine-press') return '地雷管推举是斜向推，肩部目标接近但不是垂直推完全等价替代。';
    if (id === 'db-bench-press') return '这是推类补量选择，角度偏水平推，不是肩推等价替代。';
  }
  if (sourceId === 'lateral-raise') {
    if (id === 'cable-lateral-raise') return '同属侧平举链，阻力曲线更连续，适合作为哑铃侧平举的一线替代。';
    if (id === 'machine-lateral-raise') return '同属侧平举链，轨迹更稳定，适合作为哑铃侧平举的一线替代。';
    if (id === 'rear-delt-raise') return '这是肩后束补量选择，动作方向不同，不作为侧平举主替代。';
  }
  if (sourceId === 'db-curl') {
    if (id === 'ez-bar-curl') return '同属二头弯举链，握距和器械不同，会按 EZ 杠弯举独立记录。';
    if (id === 'preacher-curl') return '同属二头弯举链，支撑更稳定，适合作为哑铃弯举的一线替代。';
    if (id === 'cable-curl') return '同属二头弯举链，张力更连续，适合作为哑铃弯举的一线替代。';
    if (id === 'incline-db-curl') return '同属二头训练，但肩位和拉伸重点不同，是可接受替代。';
    if (id === 'hammer-curl') return '锤式握法侧重点不同，只作为可选替代，不是完全等价二头弯举。';
  }
  if (sourceId === 'hammer-curl') {
    if (id === 'rope-hammer-curl') return '同属锤式弯举链，握法和侧重点接近，适合作为一线替代。';
    if (id === 'db-curl') return '哑铃弯举可接受，但握法和侧重点不同，不是锤式弯举完全等价替代。';
    if (id === 'ez-bar-curl') return '这是二头弯举补量选择，握法不同，只作为可选替代。';
  }
  if (sourceId === 'triceps-pushdown') {
    if (id === 'straight-bar-pushdown') return '同属三头下压模式，手柄不同，适合作为绳索下压的一线替代。';
    if (id === 'overhead-cable-triceps-extension') return '同属三头伸展训练，但手臂位置不同，是可接受替代。';
    if (id === 'skull-crusher') return '同属三头伸展训练，器械和关节压力不同，只作为可选替代。';
    if (id === 'close-grip-bench' || id === 'assisted-dip') return '复合推类替代，疲劳成本更高，不是孤立下压等价替代。';
  }
  if (sourceId === 'bench-press') {
    if (id === 'db-bench-press') return '同为水平推，胸部刺激接近，器械占用时适合直接替代卧推。';
    if (id === 'machine-chest-press') return '同为水平推，轨迹更稳定，适合在卧推架不可用或需要降低技术压力时替代。';
    if (id === 'push-up') return '同为水平推，适合器械受限或短时训练，但负荷精度低于卧推。';
    if (id === 'incline-db-press') return '同属胸部推举，但角度偏上胸，适合作为较低优先级替代。';
  }
  if (rank === 'angle') return '同属相近动作链，但角度或刺激重点不同，适合作为较低优先级替代。';
  if (rank === 'acceptable') return '动作模式接近但不完全等价，会按实际动作独立记录。';
  if (rank === 'equipment_fallback') return '这是器械不可用时的备用方案，不代表与原动作完全等价。';
  if (rank === 'fatigue_reduction') return '这是降低疲劳的替代方案，会按实际动作独立记录。';
  if (rank === 'compound_fallback') return '复合动作替代，疲劳成本更高，不是孤立动作完全等价替代。';
  if (rank === 'optional') return '这是可选替代，适合特殊器械或疲劳限制场景，不代表完全等价。';
  return '同一动作链内的替代动作，会保留本次模板位置，并按实际动作独立统计 PR / e1RM。';
};

export const buildReplacementOptions = (exercise: ExercisePrescription): ReplacementOption[] => {
  const sourceId = baseExerciseId(exercise);
  const identity = buildCurrentIdentitySet(exercise);
  const metadata = EXERCISE_KNOWLEDGE_OVERRIDES[sourceId] || {};
  const chain = Object.values(EXERCISE_EQUIVALENCE_CHAINS).find((item) => item.id === metadata.equivalenceChainId || item.members.includes(sourceId));
  const explicitAlternativeIds = ((metadata.alternativeIds as string[] | undefined) || exercise.alternativeIds || []).filter(Boolean);
  const priorityMap = ((metadata.alternativePriorities as Record<string, ReplacementPriorityValue> | undefined) || exercise.alternativePriorities || {}) as Record<string, ReplacementPriorityValue>;
  const candidateIds = explicitAlternativeIds.length
    ? explicitAlternativeIds
    : [
        ...((metadata.regressionIds as string[] | undefined) || []),
        ...((chain?.members || []).filter((id) => id !== sourceId)),
        ...((metadata.progressionIds as string[] | undefined) || []),
      ];
  const seenNames = new Set<string>();
  const uniqueIds = Array.from(new Set(candidateIds)).filter((id) => {
    if (id === sourceId || (sourceId === 'bench-press' && forbiddenBenchReplacementIds.has(id)) || isSelfOrAlias(id, identity)) return false;
    if (priorityMap[id] === 'not_recommended' || priorityMap[id] === 'avoid') return false;
    const nameKey = normalizeName(canonicalIdForAliasFilter(id));
    if (seenNames.has(nameKey)) return false;
    seenNames.add(nameKey);
    return true;
  });

  return uniqueIds
    .map((id, index) => {
      const rank = rankFromPriority(priorityMap[id], index <= 1 ? 'priority' : 'optional');
      return rank ? optionFromId(id, rank, reasonForReplacement(sourceId, id, rank)) : null;
    })
    .filter(Boolean)
    .sort((left, right) => rankOrder[left!.rank] - rankOrder[right!.rank]) as ReplacementOption[];
};

export const applyExerciseReplacement = (session: TrainingSession, exerciseIndex: number, replacementId: string): TrainingSession => {
  if (!validateReplacementExerciseId(replacementId)) return session;
  const next = clone(session) as TrainingSession;
  const exercise = next.exercises[exerciseIndex] as ExercisePrescription & {
    replacementReason?: string;
    sameTemplateSlot?: boolean;
    prIndependent?: boolean;
  };
  if (!exercise) return session;
  const originalId = baseExerciseId(exercise);
  const replacementName = displayName(replacementId);
  const originalName = exercise.replacedFromName || exercise.originalName || displayName(originalId);
  const previousActualId = actualExerciseId(exercise);
  const replacementMetadata = EXERCISE_KNOWLEDGE_OVERRIDES[replacementId] || {};
  const replacementNotice = `已替换为 ${replacementName}：计入本次训练量，PR / e1RM 独立统计。`;
  const warningParts = String(exercise.warning || '')
    .split(' / ')
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('已替换为 '));

  exercise.id = replacementId;
  exercise.name = replacementName;
  exercise.alias = replacementName;
  Object.assign(exercise, replacementMetadata);
  exercise.canonicalExerciseId = replacementId;
  exercise.originalExerciseId = originalId;
  exercise.actualExerciseId = replacementId;
  exercise.replacementExerciseId = replacementId;
  exercise.replacedFromId = originalId;
  exercise.replacedFromName = originalName;
  exercise.originalName = originalName;
  exercise.sameTemplateSlot = true;
  exercise.prIndependent = true;
  exercise.autoReplaced = true;
  exercise.replacementReason = `用户在训练中手动选择替代动作；原实际动作为 ${displayName(previousActualId)}。`;
  exercise.warning = [...warningParts, replacementNotice].join(' / ');

  const oldStepPrefix = `main:${previousActualId}:`;
  const newStepPrefix = `main:${replacementId}:`;
  const migrateStepId = (id?: string) => (id && id.startsWith(oldStepPrefix) ? id.replace(oldStepPrefix, newStepPrefix) : id);

  next.currentFocusStepId = migrateStepId(next.currentFocusStepId);
  next.focusCompletedStepIds = (next.focusCompletedStepIds || []).map((id) => migrateStepId(id) || id);
  next.focusSkippedStepIds = (next.focusSkippedStepIds || []).map((id) => migrateStepId(id) || id);
  next.focusWarmupSetLogs = (next.focusWarmupSetLogs || []).map((set) => ({ ...set, id: migrateStepId(set.id) || set.id }));
  next.focusActualSetDrafts = (next.focusActualSetDrafts || []).map((draft) =>
    draft.exerciseId === previousActualId || draft.stepId.startsWith(oldStepPrefix)
      ? { ...draft, exerciseId: replacementId, stepId: migrateStepId(draft.stepId) || draft.stepId }
      : draft
  );
  if (next.restTimerState?.exerciseId === previousActualId) {
    next.restTimerState = { ...next.restTimerState, exerciseId: replacementId };
  }

  next.currentExerciseId = replacementId;
  return next;
};

export const restoreOriginalExercise = (session: TrainingSession, exerciseIndex: number): TrainingSession => {
  const next = clone(session) as TrainingSession;
  const exercise = next.exercises[exerciseIndex] as ExercisePrescription & {
    replacementReason?: string;
    sameTemplateSlot?: boolean;
    prIndependent?: boolean;
  };
  if (!exercise) return session;
  const originalId = baseExerciseId(exercise);
  const previousActualId = actualExerciseId(exercise);
  if (!originalId || previousActualId === originalId) return session;
  const originalName = exercise.replacedFromName || exercise.originalName || displayName(originalId);
  const originalMetadata = EXERCISE_KNOWLEDGE_OVERRIDES[originalId] || {};

  exercise.id = originalId;
  exercise.name = originalName;
  exercise.alias = originalName;
  Object.assign(exercise, originalMetadata);
  exercise.canonicalExerciseId = originalId;
  exercise.originalExerciseId = originalId;
  exercise.actualExerciseId = originalId;
  exercise.replacementExerciseId = undefined;
  exercise.replacedFromId = undefined;
  exercise.replacedFromName = undefined;
  exercise.sameTemplateSlot = false;
  exercise.prIndependent = false;
  exercise.autoReplaced = false;
  exercise.replacementReason = '用户手动恢复原计划动作。';
  exercise.warning = String(exercise.warning || '')
    .split(' / ')
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('已替换为 '))
    .join(' / ');

  const oldStepPrefix = `main:${previousActualId}:`;
  const newStepPrefix = `main:${originalId}:`;
  const migrateStepId = (id?: string) => (id && id.startsWith(oldStepPrefix) ? id.replace(oldStepPrefix, newStepPrefix) : id);
  next.currentFocusStepId = migrateStepId(next.currentFocusStepId);
  next.focusCompletedStepIds = (next.focusCompletedStepIds || []).map((id) => migrateStepId(id) || id);
  next.focusSkippedStepIds = (next.focusSkippedStepIds || []).map((id) => migrateStepId(id) || id);
  next.focusWarmupSetLogs = (next.focusWarmupSetLogs || []).map((set) => ({ ...set, id: migrateStepId(set.id) || set.id }));
  next.focusActualSetDrafts = (next.focusActualSetDrafts || []).map((draft) =>
    draft.exerciseId === previousActualId || draft.stepId.startsWith(oldStepPrefix)
      ? { ...draft, exerciseId: originalId, stepId: migrateStepId(draft.stepId) || draft.stepId }
      : draft
  );
  if (next.restTimerState?.exerciseId === previousActualId) {
    next.restTimerState = { ...next.restTimerState, exerciseId: originalId };
  }
  next.currentExerciseId = originalId;
  return next;
};
