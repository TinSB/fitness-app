import { EXERCISE_DISPLAY_NAMES, EXERCISE_EQUIVALENCE_CHAINS, EXERCISE_KNOWLEDGE_OVERRIDES } from '../data/exerciseLibrary';
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
  prIndependent: boolean;
}

const rankLabels: Record<ReplacementRank, string> = {
  priority: '优先',
  optional: '可选',
  angle: '角度变化',
};

const forbiddenBenchReplacementIds = new Set(['triceps-pushdown', 'shoulder-press', 'machine-shoulder-press', 'cable-fly']);

const displayName = (id: string) => EXERCISE_DISPLAY_NAMES[id] || id;

const baseExerciseId = (exercise: Pick<ExercisePrescription, 'baseId' | 'replacedFromId' | 'canonicalExerciseId' | 'id'>) =>
  exercise.replacedFromId || exercise.baseId || String(exercise.canonicalExerciseId || exercise.id).split('__alt_')[0];

const optionFromId = (id: string, rank: ReplacementRank, reason: string): ReplacementOption | null => {
  const metadata = EXERCISE_KNOWLEDGE_OVERRIDES[id];
  if (!metadata && !EXERCISE_DISPLAY_NAMES[id]) return null;
  return {
    id,
    name: displayName(id),
    rank,
    rankLabel: rankLabels[rank],
    reason,
    fatigueCost: String(metadata?.fatigueCost || 'medium'),
    prIndependent: true,
  };
};

export const buildReplacementOptions = (exercise: ExercisePrescription): ReplacementOption[] => {
  const sourceId = baseExerciseId(exercise);

  if (sourceId === 'bench-press') {
    return [
      optionFromId('db-bench-press', 'priority', '同为水平推，胸部刺激接近，器械占用时适合直接替代卧推。'),
      optionFromId('machine-chest-press', 'priority', '同为水平推，轨迹更稳定，适合在卧推架不可用或需要降低技术压力时替代。'),
      optionFromId('push-up', 'optional', '同为水平推，适合器械受限或短时训练，但负荷精度低于卧推。'),
      optionFromId('incline-db-press', 'angle', '同属胸部推举，但角度偏上胸，适合作为较低优先级替代。'),
    ].filter(Boolean) as ReplacementOption[];
  }

  const metadata = EXERCISE_KNOWLEDGE_OVERRIDES[sourceId] || {};
  const chain = Object.values(EXERCISE_EQUIVALENCE_CHAINS).find((item) => item.id === metadata.equivalenceChainId || item.members.includes(sourceId));
  const candidateIds = [
    ...((metadata.regressionIds as string[] | undefined) || []),
    ...((chain?.members || []).filter((id) => id !== sourceId)),
    ...((metadata.progressionIds as string[] | undefined) || []),
  ];
  const uniqueIds = Array.from(new Set(candidateIds)).filter((id) => id !== sourceId && !forbiddenBenchReplacementIds.has(id));

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
  const next = clone(session) as TrainingSession;
  const exercise = next.exercises[exerciseIndex] as ExercisePrescription & {
    replacementReason?: string;
    sameTemplateSlot?: boolean;
    prIndependent?: boolean;
  };
  if (!exercise) return session;
  const originalId = baseExerciseId(exercise);
  const replacementName = displayName(replacementId);
  const originalName = exercise.replacedFromName || exercise.originalName || exercise.name;
  const replacementMetadata = EXERCISE_KNOWLEDGE_OVERRIDES[replacementId] || {};
  const replacementNotice = `已替换为 ${replacementName}：计入本次训练量，PR / e1RM 独立统计。`;
  const warningParts = String(exercise.warning || '')
    .split(' / ')
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('已替换为 '));

  exercise.id = replacementId;
  exercise.name = replacementName;
  Object.assign(exercise, replacementMetadata);
  exercise.canonicalExerciseId = replacementId;
  exercise.replacedFromId = originalId;
  exercise.replacedFromName = originalName;
  exercise.originalName = originalName;
  exercise.sameTemplateSlot = true;
  exercise.prIndependent = true;
  exercise.autoReplaced = true;
  exercise.replacementReason = '用户在训练中手动选择替代动作';
  exercise.warning = [...warningParts, replacementNotice].join(' / ');

  next.currentExerciseId = replacementId;
  return next;
};
