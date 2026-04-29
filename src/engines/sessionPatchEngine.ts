import type { AppliedCoachActionPatch, ExercisePrescription, SupportExerciseLog, TrainingSession } from '../models/training-model';
import type { DailyTrainingAdjustment } from './dailyTrainingAdjustmentEngine';
import { clone, number } from './engineUtils';
import { getCurrentFocusStep } from './focusModeStateEngine';

export type SessionPatchType =
  | 'reduce_support'
  | 'main_only'
  | 'reduce_intensity'
  | 'reduce_volume'
  | 'substitute_exercise'
  | 'extend_rest'
  | 'skip_optional';

export type SessionPatch = {
  id: string;
  type: SessionPatchType;
  targetId?: string;
  title: string;
  description: string;
  reason: string;
  reversible: boolean;
};

export type PatchedSessionResult = {
  session: TrainingSession;
  appliedPatches: SessionPatch[];
  warnings: string[];
};

type PatchSnapshot = NonNullable<AppliedCoachActionPatch['snapshot']>;

const patchTypeTitles: Record<SessionPatchType, string> = {
  reduce_support: '减少辅助训练',
  main_only: '只做主训练',
  reduce_intensity: '降低本次强度',
  reduce_volume: '减少本次训练量',
  substitute_exercise: '建议替代动作',
  extend_rest: '延长组间休息',
  skip_optional: '跳过可选内容',
};

const patchTypeDescriptions: Record<SessionPatchType, string> = {
  reduce_support: '本次训练减少纠偏、功能补丁或辅助内容，优先保证主训练质量。',
  main_only: '本次训练只保留主训练流程，未完成的纠偏和功能补丁会标记为本次跳过。',
  reduce_intensity: '本次训练采用保守强度提示，不修改 e1RM、PR 或长期处方规则。',
  reduce_volume: '本次训练不额外加组，必要时减少非关键内容。',
  substitute_exercise: '本次训练对指定动作给出替代提醒，替代仍需要用户在训练中确认。',
  extend_rest: '本次训练适当延长组间休息，优先保证动作质量。',
  skip_optional: '本次训练跳过未完成的可选功能补丁或辅助内容。',
};

const rawTokenPattern =
  /\b(undefined|null|reduce_support|main_only|reduce_intensity|reduce_volume|substitute_exercise|extend_rest|skip_optional|normal|conservative|low|medium|high)\b/gi;

const cleanText = (value: unknown, fallback: string) => {
  const text = String(value ?? '')
    .replace(rawTokenPattern, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
};

const makePatch = (type: SessionPatchType, reason: string, targetId?: string, index = 0): SessionPatch => ({
  id: `session-patch-${type}${targetId ? `-${targetId}` : ''}-${index + 1}`,
  type,
  targetId,
  title: patchTypeTitles[type],
  description: patchTypeDescriptions[type],
  reason: cleanText(reason, patchTypeDescriptions[type]),
  reversible: true,
});

const mapSuggestedChangeType = (type: DailyTrainingAdjustment['suggestedChanges'][number]['type']): SessionPatchType => {
  if (type === 'reduce_support') return 'reduce_support';
  if (type === 'keep_main_lifts') return 'main_only';
  if (type === 'substitute_exercise') return 'substitute_exercise';
  if (type === 'extend_rest') return 'extend_rest';
  if (type === 'skip_optional') return 'skip_optional';
  return 'reduce_volume';
};

const fallbackPatchType = (adjustment: DailyTrainingAdjustment): SessionPatchType | null => {
  if (adjustment.type === 'normal') return null;
  if (adjustment.type === 'reduce_support') return 'reduce_support';
  if (adjustment.type === 'main_only') return 'main_only';
  if (adjustment.type === 'substitute_risky_exercises') return 'substitute_exercise';
  if (adjustment.type === 'rest_or_recovery' || adjustment.type === 'deload_like') return 'reduce_volume';
  return 'reduce_intensity';
};

export function buildSessionPatchesFromDailyAdjustment(adjustment?: DailyTrainingAdjustment | null): SessionPatch[] {
  if (!adjustment || adjustment.type === 'normal') return [];
  const changes = adjustment.suggestedChanges || [];
  const patches = changes.map((change, index) => makePatch(mapSuggestedChangeType(change.type), change.reason, change.targetId, index));
  if (!patches.length) {
    const type = fallbackPatchType(adjustment);
    if (type) patches.push(makePatch(type, adjustment.reasons?.[0] || adjustment.summary, undefined, 0));
  }
  const seen = new Set<string>();
  return patches.filter((patch) => {
    const key = `${patch.type}:${patch.targetId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const makeSnapshot = (session: TrainingSession): PatchSnapshot => ({
  exercises: clone(session.exercises || []),
  supportExerciseLogs: clone(session.supportExerciseLogs || []),
  currentExerciseId: session.currentExerciseId,
  currentSetIndex: session.currentSetIndex,
  currentFocusStepId: session.currentFocusStepId,
  currentFocusStepType: session.currentFocusStepType,
  focusManualStepOverride: session.focusManualStepOverride,
  adjustmentNotes: clone(session.adjustmentNotes || []),
  adjustmentType: session.adjustmentType,
  adjustmentReasons: clone(session.adjustmentReasons || []),
  appliedCoachActions: clone(session.appliedCoachActions || []),
});

const restoreSnapshot = (session: TrainingSession, snapshot: PatchSnapshot): TrainingSession => ({
  ...clone(session),
  exercises: clone(snapshot.exercises || session.exercises || []),
  supportExerciseLogs: clone(snapshot.supportExerciseLogs || []),
  currentExerciseId: snapshot.currentExerciseId,
  currentSetIndex: snapshot.currentSetIndex,
  currentFocusStepId: snapshot.currentFocusStepId,
  currentFocusStepType: snapshot.currentFocusStepType,
  focusManualStepOverride: snapshot.focusManualStepOverride,
  adjustmentNotes: clone(snapshot.adjustmentNotes || []),
  adjustmentType: snapshot.adjustmentType,
  adjustmentReasons: clone(snapshot.adjustmentReasons || []),
  appliedCoachActions: clone(snapshot.appliedCoachActions || []),
});

const appendUnique = (items: string[] = [], next: string[]) => [...new Set([...items, ...next].filter(Boolean))];

const activeSupportLogs = (logs: SupportExerciseLog[] = [], includeCorrection = true) =>
  logs.filter((log) => number(log.completedSets) < number(log.plannedSets) && (includeCorrection || log.blockType !== 'correction'));

const skipSupportLogs = (session: TrainingSession, includeCorrection: boolean, reason = 'too_tired') => {
  let skipped = 0;
  session.supportExerciseLogs = (session.supportExerciseLogs || []).map((log) => {
    if (!activeSupportLogs([log], includeCorrection).length) return log;
    skipped += 1;
    return { ...log, skippedReason: reason as SupportExerciseLog['skippedReason'] };
  });
  return skipped;
};

const appendExerciseAdjustment = (exercise: ExercisePrescription, note: string) => ({
  ...exercise,
  adjustment: appendUnique([exercise.adjustment].filter(Boolean) as string[], [note]).join(' '),
});

const applyPatchMutation = (session: TrainingSession, patch: SessionPatch): string | null => {
  if (patch.type === 'reduce_support') {
    const skipped = skipSupportLogs(session, true);
    return skipped ? '已减少本次辅助训练。' : '本次没有可减少的辅助训练。';
  }
  if (patch.type === 'main_only') {
    const skipped = skipSupportLogs(session, true);
    session.adjustmentType = 'temporary_main_only';
    return skipped ? '已将本次训练调整为主训练优先。' : '本次训练已经以主训练为主。';
  }
  if (patch.type === 'skip_optional') {
    const skipped = skipSupportLogs(session, false);
    return skipped ? '已跳过本次可选功能补丁。' : '本次没有可跳过的可选内容。';
  }
  if (patch.type === 'reduce_intensity') {
    session.exercises = (session.exercises || []).map((exercise) => ({
      ...appendExerciseAdjustment(exercise, '本次保守执行：建议降低冲强度，优先保证动作质量。'),
      conservativeTopSet: true,
      adaptiveTopSetFactor: Math.min(number(exercise.adaptiveTopSetFactor) || 1, 0.95),
      adaptiveBackoffFactor: Math.min(number(exercise.adaptiveBackoffFactor) || 1, 0.95),
    }));
    return '已写入本次强度保守提示。';
  }
  if (patch.type === 'reduce_volume') {
    session.exercises = (session.exercises || []).map((exercise) =>
      appendExerciseAdjustment(exercise, '本次减少训练量：不额外加组，必要时减少非关键内容。'),
    );
    return '已写入本次训练量保守提示。';
  }
  if (patch.type === 'extend_rest') {
    session.exercises = (session.exercises || []).map((exercise) => ({
      ...appendExerciseAdjustment(exercise, '本次延长休息：组间休息可增加约 30 秒。'),
      rest: number(exercise.rest) ? number(exercise.rest) + 30 : exercise.rest,
      prescription: exercise.prescription
        ? { ...exercise.prescription, restSec: number(exercise.prescription.restSec) + 30 }
        : exercise.prescription,
    }));
    return '已写入本次延长休息提示。';
  }
  if (patch.type === 'substitute_exercise') {
    if (!patch.targetId || patch.targetId.startsWith('__')) return '替代动作目标无效，未应用。';
    const index = (session.exercises || []).findIndex((exercise) =>
      [exercise.id, exercise.actualExerciseId, exercise.originalExerciseId, exercise.replacementExerciseId].filter(Boolean).includes(patch.targetId),
    );
    if (index < 0) return '没有找到对应动作，未应用替代提醒。';
    session.exercises[index] = {
      ...appendExerciseAdjustment(session.exercises[index], '本次建议替代：请在训练中选择真实替代动作后再执行。'),
      replacementSuggested: '建议替代动作',
    };
    return '已写入本次替代动作提醒。';
  }
  return null;
};

const syncCurrentStep = (session: TrainingSession) => {
  const nextStep = getCurrentFocusStep(session);
  session.currentFocusStepId = nextStep.id;
  session.currentFocusStepType = nextStep.stepType;
  session.currentExerciseId = nextStep.exerciseIndex >= 0 ? nextStep.exerciseId : session.currentExerciseId;
};

export function applySessionPatches(session: TrainingSession, patches: SessionPatch[]): PatchedSessionResult {
  const nextSession = clone(session) as TrainingSession;
  const appliedPatches: SessionPatch[] = [];
  const warnings: string[] = [];

  nextSession.appliedCoachActions = Array.isArray(nextSession.appliedCoachActions) ? nextSession.appliedCoachActions : [];
  nextSession.adjustmentNotes = Array.isArray(nextSession.adjustmentNotes) ? nextSession.adjustmentNotes : [];
  nextSession.adjustmentReasons = Array.isArray(nextSession.adjustmentReasons) ? nextSession.adjustmentReasons : [];

  patches.forEach((patch) => {
    if (nextSession.appliedCoachActions?.some((item) => item.id === patch.id)) {
      warnings.push(`已跳过重复调整：${patch.title}`);
      return;
    }
    const snapshot = makeSnapshot(nextSession);
    const result = applyPatchMutation(nextSession, patch);
    if (result?.includes('无效') || result?.includes('没有找到')) {
      warnings.push(result);
      return;
    }
    appliedPatches.push(patch);
    nextSession.appliedCoachActions = [
      ...(nextSession.appliedCoachActions || []),
      {
        ...patch,
        appliedAt: new Date().toISOString(),
        snapshot,
      },
    ];
    nextSession.adjustmentNotes = appendUnique(nextSession.adjustmentNotes, [patch.title, patch.description]);
    nextSession.adjustmentReasons = appendUnique(nextSession.adjustmentReasons, [patch.reason]);
    nextSession.adjustmentType = nextSession.adjustmentType || 'temporary_session_patch';
    if (result) nextSession.adjustmentNotes = appendUnique(nextSession.adjustmentNotes, [result]);
  });

  if (appliedPatches.length) syncCurrentStep(nextSession);

  return {
    session: nextSession,
    appliedPatches,
    warnings,
  };
}

const toSessionPatch = (record: AppliedCoachActionPatch): SessionPatch => ({
  id: record.id,
  type: record.type as SessionPatchType,
  targetId: record.targetId,
  title: record.title,
  description: record.description,
  reason: record.reason,
  reversible: record.reversible,
});

export function revertSessionPatches(session: TrainingSession, patchIds: string[]): PatchedSessionResult {
  const records = session.appliedCoachActions || [];
  const revertIds = new Set(patchIds);
  const firstIndex = records.findIndex((record) => revertIds.has(record.id));
  if (firstIndex < 0) {
    return { session: clone(session), appliedPatches: [], warnings: ['没有找到可撤销的本次调整。'] };
  }
  const first = records[firstIndex];
  if (!first.snapshot) {
    return { session: clone(session), appliedPatches: [], warnings: ['缺少撤销快照，无法自动恢复。'] };
  }

  const base = restoreSnapshot(session, first.snapshot);
  const remaining = records.slice(firstIndex).filter((record) => !revertIds.has(record.id));
  if (!remaining.length) {
    syncCurrentStep(base);
    return { session: base, appliedPatches: [], warnings: [] };
  }

  return applySessionPatches(base, remaining.map(toSessionPatch));
}
