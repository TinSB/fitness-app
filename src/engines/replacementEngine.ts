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

export type ReplacementRank = 'priority' | 'optional' | 'angle';

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
  optional: '可选',
  angle: '角度变化',
};

const forbiddenBenchReplacementIds = new Set(['triceps-pushdown', 'shoulder-press', 'machine-shoulder-press', 'cable-fly']);

const displayName = (id: string, bilingual = false) => formatExerciseDisplayName(id, { bilingual, fallback: '未命名动作' });

export const isSyntheticReplacementExerciseId = (id: unknown) => /__(?:auto_)?alt(?:_|$)/.test(String(id || ''));

export const validateReplacementExerciseId = (id: unknown) => {
  const value = String(id || '').trim();
  if (!value || isSyntheticReplacementExerciseId(value)) return false;
  return Boolean(EXERCISE_DISPLAY_NAMES[value] || EXERCISE_KNOWLEDGE_OVERRIDES[value]);
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

export const buildReplacementOptions = (exercise: ExercisePrescription): ReplacementOption[] => {
  const sourceId = baseExerciseId(exercise);
  const identity = buildCurrentIdentitySet(exercise);

  if (sourceId === 'bench-press') {
    return [
      optionFromId('db-bench-press', 'priority', '同为水平推，胸部刺激接近，器械占用时适合直接替代卧推。'),
      optionFromId('machine-chest-press', 'priority', '同为水平推，轨迹更稳定，适合在卧推架不可用或需要降低技术压力时替代。'),
      optionFromId('push-up', 'optional', '同为水平推，适合器械受限或短时训练，但负荷精度低于卧推。'),
      optionFromId('incline-db-press', 'angle', '同属胸部推举，但角度偏上胸，适合作为较低优先级替代。'),
    ].filter((option): option is ReplacementOption => option !== null && !isSelfOrAlias(option.id, identity));
  }

  const metadata = EXERCISE_KNOWLEDGE_OVERRIDES[sourceId] || {};
  const chain = Object.values(EXERCISE_EQUIVALENCE_CHAINS).find((item) => item.id === metadata.equivalenceChainId || item.members.includes(sourceId));
  const candidateIds = [
    ...((metadata.regressionIds as string[] | undefined) || []),
    ...((chain?.members || []).filter((id) => id !== sourceId)),
    ...((metadata.progressionIds as string[] | undefined) || []),
  ];
  const seenNames = new Set<string>();
  const uniqueIds = Array.from(new Set(candidateIds)).filter((id) => {
    if (id === sourceId || forbiddenBenchReplacementIds.has(id) || isSelfOrAlias(id, identity)) return false;
    const nameKey = normalizeName(canonicalIdForAliasFilter(id));
    if (seenNames.has(nameKey)) return false;
    seenNames.add(nameKey);
    return true;
  });

  return uniqueIds
    .map((id, index) =>
      optionFromId(
        id,
        index <= 1 ? 'priority' : 'optional',
        '同一动作链内的替代动作，会保留本次模板位置，并按实际动作独立统计 PR / e1RM。'
      )
    )
    .filter(Boolean) as ReplacementOption[];
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
