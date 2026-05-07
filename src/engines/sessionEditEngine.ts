import type {
  SessionDataFlag,
  SessionEditAffectedStat,
  SessionEditSummarySnapshot,
  SessionEditType,
  TechniqueQuality,
  TrainingSession,
  TrainingSetLog,
  UnitSettings,
  WeightUnit,
} from '../models/training-model';
import { formatDataFlag } from '../i18n/formatters';
import { clone, number } from './engineUtils';
import { buildSessionDetailSummary } from './sessionDetailSummaryEngine';
import { formatWeight } from './unitConversionEngine';

export type SessionSetEditPatch = {
  weightKg?: number;
  displayWeight?: number;
  displayUnit?: WeightUnit;
  reps?: number;
  rir?: number | string;
  techniqueQuality?: TechniqueQuality;
  painFlag?: boolean;
  note?: string;
};

export type SessionEditValidationResult = {
  valid: boolean;
  errors: string[];
};

export type SessionEditResult = {
  ok: boolean;
  changed: boolean;
  session?: TrainingSession;
  message: string;
};

type AuditSetKind = 'working' | 'warmup';

type ComparableSet = {
  exerciseId: string;
  set: TrainingSetLog;
  index: number;
  kind: AuditSetKind;
};

type SetDiff = {
  kind: AuditSetKind;
  changedFields: string[];
  beforeText: string;
  afterText: string;
};

type AuditDetails = {
  editType: SessionEditType;
  changedFields: string[];
  beforeSummaryText: string;
  afterSummaryText: string;
  affectedStats: SessionEditAffectedStat[];
};

const CHANGED_FIELD_ORDER = ['weight', 'reps', 'rir', 'techniqueQuality', 'painFlag', 'note', 'dataFlag'];

export const sessionEditFeedbackMessage = (fields: string[]) => {
  const fieldSet = new Set(fields);
  if (fieldSet.has('dataFlag')) return '数据状态已更新。';
  if (fieldSet.has('sets')) return '已保存修正，相关统计会重新计算。';
  if (fieldSet.has('warmupSets')) return '已更新热身组，不影响 PR、e1RM 和有效组。';
  return '已保存修正，相关统计会重新计算。';
};

export const buildSessionEditSummarySnapshot = (session: TrainingSession): SessionEditSummarySnapshot => {
  const summary = buildSessionDetailSummary(session);
  return {
    plannedWorkingSets: summary.plannedWorkingSets,
    completedWorkingSets: summary.completedWorkingSets,
    effectiveSets: summary.effectiveSets,
    warmupSets: summary.warmupSets,
    incompleteSets: summary.incompleteSets,
    workingVolume: summary.workingVolume,
    warmupVolume: summary.warmupVolume,
    dataFlag: session.dataFlag || 'normal',
    excludedFromStatsReason: summary.excludedFromStatsReason || undefined,
  };
};

const uniqueByOrder = (items: string[]) =>
  [...new Set(items.filter(Boolean))].sort((left, right) => {
    const leftIndex = CHANGED_FIELD_ORDER.indexOf(left);
    const rightIndex = CHANGED_FIELD_ORDER.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

const uniqueAffectedStats = (stats: SessionEditAffectedStat[]): SessionEditAffectedStat[] => {
  const unique = [...new Set(stats)];
  if (unique.length > 1 && unique.includes('none')) return unique.filter((stat) => stat !== 'none');
  return unique.length ? unique : ['none'];
};

export const inferSessionEditAffectedStats = (fields: string[], editType?: SessionEditType): SessionEditAffectedStat[] => {
  const fieldSet = new Set(fields);

  if (fieldSet.has('dataFlag') || editType === 'data_flag') {
    return ['calendar', 'effectiveSet', 'PR', 'e1RM'];
  }
  if (editType === 'warmup_set' || (fieldSet.has('warmupSets') && !fieldSet.has('sets'))) {
    return ['none'];
  }
  if (fieldSet.has('sets') && !fields.some((field) => CHANGED_FIELD_ORDER.includes(field))) {
    return ['volume', 'effectiveSet', 'PR', 'e1RM'];
  }

  const stats: SessionEditAffectedStat[] = [];
  if (fieldSet.has('weight') || fieldSet.has('reps')) stats.push('volume', 'effectiveSet', 'PR', 'e1RM');
  if (fieldSet.has('rir')) stats.push('effectiveSet');
  if (fieldSet.has('techniqueQuality') || fieldSet.has('painFlag')) stats.push('effectiveSet', 'sessionQuality');
  if (fieldSet.has('note') && !stats.length) stats.push('none');
  return uniqueAffectedStats(stats);
};

const setWeightKg = (set: TrainingSetLog) => number(set.actualWeightKg ?? set.weight);

const comparableValue = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value.trim() : value;
};

const sameNumber = (left: unknown, right: unknown) => number(left) === number(right);

const dataFlagLabel = (flag: SessionDataFlag | undefined) => {
  const label = formatDataFlag(flag || 'normal');
  return flag === 'test' || flag === 'excluded' ? `${label}，不参与默认统计` : label;
};

const setLabel = (kind: AuditSetKind, set: TrainingSetLog, fallbackIndex: number) => {
  const displayIndex = Math.max(1, number(set.setIndex) || fallbackIndex + 1);
  return `${kind === 'warmup' ? '热身组' : '正式组'} ${displayIndex}`;
};

const setSummaryText = (kind: AuditSetKind, set: TrainingSetLog, fallbackIndex: number, unitSettings?: Partial<UnitSettings>) => {
  const base = `${setLabel(kind, set, fallbackIndex)}：${formatWeight(setWeightKg(set), unitSettings)} × ${Math.max(0, number(set.reps))}`;
  const rir = comparableValue(set.rir);
  return kind === 'working' && rir !== '' ? `${base} / RIR ${rir}` : base;
};

const noteSummaryText = (kind: AuditSetKind, set: TrainingSetLog, fallbackIndex: number) => {
  const note = String(set.note || '').trim() || '无';
  return `${setLabel(kind, set, fallbackIndex)}备注：${note}`;
};

const setKind = (set: TrainingSetLog): AuditSetKind =>
  String(set.type || '').toLowerCase() === 'warmup' || String(set.id || '').includes(':warmup:')
    ? 'warmup'
    : 'working';

const exerciseIdsFor = (exercise: TrainingSession['exercises'][number]) =>
  [
    exercise.id,
    exercise.actualExerciseId,
    exercise.replacementExerciseId,
    exercise.originalExerciseId,
    exercise.baseId,
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

const buildComparableSets = (session: TrainingSession): ComparableSet[] => {
  const exerciseSets = (session.exercises || []).flatMap((exercise) => {
    const exerciseId = exerciseIdsFor(exercise)[0] || exercise.id || '';
    return (Array.isArray(exercise.sets) ? exercise.sets : []).map((set, index) => ({
      exerciseId,
      set,
      index,
      kind: setKind(set),
    }));
  });
  const warmupSets = (session.focusWarmupSetLogs || []).map((set, index) => ({
    exerciseId: focusWarmupExerciseId(set),
    set,
    index,
    kind: 'warmup' as const,
  }));
  return [...exerciseSets, ...warmupSets];
};

const setKey = (entry: ComparableSet) =>
  [
    entry.exerciseId,
    entry.set.id || '',
    entry.kind,
    entry.index,
  ].join('::');

const compareSetFields = (before: TrainingSetLog, after: TrainingSetLog) => {
  const changedFields: string[] = [];
  if (!sameNumber(setWeightKg(before), setWeightKg(after))) changedFields.push('weight');
  if (!sameNumber(before.reps, after.reps)) changedFields.push('reps');
  if (comparableValue(before.rir) !== comparableValue(after.rir)) changedFields.push('rir');
  if (comparableValue(before.techniqueQuality) !== comparableValue(after.techniqueQuality)) changedFields.push('techniqueQuality');
  if (Boolean(before.painFlag) !== Boolean(after.painFlag)) changedFields.push('painFlag');
  if (comparableValue(before.note) !== comparableValue(after.note)) changedFields.push('note');
  return changedFields;
};

const buildSetDiffs = (beforeSession: TrainingSession, afterSession: TrainingSession, unitSettings?: Partial<UnitSettings>) => {
  const beforeMap = new Map(buildComparableSets(beforeSession).map((entry) => [setKey(entry), entry]));
  return buildComparableSets(afterSession)
    .map((afterEntry) => {
      const beforeEntry = beforeMap.get(setKey(afterEntry));
      if (!beforeEntry) return null;
      const changedFields = compareSetFields(beforeEntry.set, afterEntry.set);
      if (!changedFields.length) return null;
      const noteOnly = changedFields.length === 1 && changedFields[0] === 'note';
      return {
        kind: afterEntry.kind,
        changedFields,
        beforeText: noteOnly
          ? noteSummaryText(beforeEntry.kind, beforeEntry.set, beforeEntry.index)
          : setSummaryText(beforeEntry.kind, beforeEntry.set, beforeEntry.index, unitSettings),
        afterText: noteOnly
          ? noteSummaryText(afterEntry.kind, afterEntry.set, afterEntry.index)
          : setSummaryText(afterEntry.kind, afterEntry.set, afterEntry.index, unitSettings),
      } satisfies SetDiff;
    })
    .filter(Boolean) as SetDiff[];
};

const fallbackSummaryText = (snapshot: SessionEditSummarySnapshot) =>
  `完成正式组 ${snapshot.completedWorkingSets}，有效组 ${snapshot.effectiveSets}，总量 ${snapshot.workingVolume}kg`;

const buildAuditDetails = (
  afterSession: TrainingSession,
  beforeSession: TrainingSession,
  fields: string[],
  unitSettings?: Partial<UnitSettings>,
): AuditDetails | null => {
  const setDiffs = buildSetDiffs(beforeSession, afterSession, unitSettings);
  const beforeFlag = beforeSession.dataFlag || 'normal';
  const afterFlag = afterSession.dataFlag || 'normal';
  const dataFlagChanged = beforeFlag !== afterFlag;
  const changedFields = uniqueByOrder([
    ...setDiffs.flatMap((diff) => diff.changedFields),
    ...(dataFlagChanged ? ['dataFlag'] : []),
  ]);

  if (!changedFields.length) return null;

  const hasWorking = setDiffs.some((diff) => diff.kind === 'working');
  const hasWarmup = setDiffs.some((diff) => diff.kind === 'warmup');
  const hasDataFlag = changedFields.includes('dataFlag');
  const onlyNote = changedFields.length === 1 && changedFields[0] === 'note';
  const editType: SessionEditType =
    [hasWorking, hasWarmup, hasDataFlag].filter(Boolean).length > 1
      ? 'mixed'
      : hasDataFlag
        ? 'data_flag'
        : onlyNote
          ? 'note'
          : hasWarmup
            ? 'warmup_set'
            : 'working_set';

  const beforeParts = setDiffs.map((diff) => diff.beforeText);
  const afterParts = setDiffs.map((diff) => diff.afterText);
  if (hasDataFlag) {
    beforeParts.push(dataFlagLabel(beforeFlag));
    afterParts.push(dataFlagLabel(afterFlag));
  }
  const beforeSummary = buildSessionEditSummarySnapshot(beforeSession);
  const afterSummary = buildSessionEditSummarySnapshot(afterSession);

  return {
    editType,
    changedFields,
    beforeSummaryText: beforeParts.join('；') || fallbackSummaryText(beforeSummary),
    afterSummaryText: afterParts.join('；') || fallbackSummaryText(afterSummary),
    affectedStats: inferSessionEditAffectedStats(changedFields, editType),
  };
};

const buildLegacyAuditDetails = (session: TrainingSession, fields: string[]): AuditDetails | null => {
  const uniqueFields = [...new Set(fields.filter(Boolean))];
  if (!uniqueFields.length) return null;
  const editType = inferEditTypeFromLegacyFields(uniqueFields);
  const changedFields = uniqueByOrder(
    uniqueFields.flatMap((field) => {
      if (field === 'sets') return ['weight', 'reps', 'rir'];
      if (field === 'warmupSets') return ['weight', 'reps'];
      return [field];
    }),
  );
  const snapshot = buildSessionEditSummarySnapshot(session);
  const summaryText = fallbackSummaryText(snapshot);
  return {
    editType,
    changedFields,
    beforeSummaryText: summaryText,
    afterSummaryText: summaryText,
    affectedStats: inferSessionEditAffectedStats(uniqueFields, editType),
  };
};

const inferEditTypeFromLegacyFields = (fields: string[]): SessionEditType => {
  const fieldSet = new Set(fields);
  if (fieldSet.has('dataFlag')) return fieldSet.size > 1 ? 'mixed' : 'data_flag';
  if (fieldSet.has('sets')) return fieldSet.has('warmupSets') ? 'mixed' : 'working_set';
  if (fieldSet.has('warmupSets')) return 'warmup_set';
  if (fieldSet.has('note')) return 'note';
  return 'mixed';
};

const makeAuditId = (
  session: TrainingSession,
  editedAt: string,
  editType: SessionEditType,
  changedFields: string[],
  index: number,
) =>
  [
    session.id || 'session',
    'edit',
    String(index + 1),
    editedAt.replace(/[^0-9T]/g, ''),
    editType,
    changedFields.join('-') || 'change',
  ].join(':');

const matchesExercise = (exercise: TrainingSession['exercises'][number], exerciseId: string) =>
  exercise.id === exerciseId ||
  exercise.actualExerciseId === exerciseId ||
  exercise.replacementExerciseId === exerciseId ||
  exercise.originalExerciseId === exerciseId ||
  exercise.baseId === exerciseId;

const matchesSet = (set: TrainingSetLog, setId: string, index: number) =>
  set.id === setId || String(index) === setId || String(index + 1) === setId;

const focusWarmupExerciseId = (set: TrainingSetLog) => {
  const explicit = String((set as TrainingSetLog & { exerciseId?: unknown }).exerciseId || '').trim();
  if (explicit) return explicit;
  const match = String(set.id || '').match(/^main:([^:]+):warmup:/);
  return match?.[1] || '';
};

const applySetPatch = (set: TrainingSetLog, patch: SessionSetEditPatch): TrainingSetLog => {
  const nextSet: TrainingSetLog = { ...set };
  if (patch.weightKg !== undefined) {
    const safeWeightKg = Math.max(0, number(patch.weightKg));
    nextSet.weight = safeWeightKg;
    nextSet.actualWeightKg = safeWeightKg;
  }
  if (patch.displayWeight !== undefined) nextSet.displayWeight = Math.max(0, number(patch.displayWeight));
  if (patch.displayUnit) nextSet.displayUnit = patch.displayUnit;
  if (patch.reps !== undefined) nextSet.reps = Math.max(0, Math.round(number(patch.reps)));
  if (patch.rir !== undefined) nextSet.rir = patch.rir;
  if (patch.techniqueQuality) nextSet.techniqueQuality = patch.techniqueQuality;
  if (patch.painFlag !== undefined) nextSet.painFlag = patch.painFlag;
  if (patch.note !== undefined) nextSet.note = patch.note;
  nextSet.done = true;
  return nextSet;
};

export const updateSessionSet = (
  session: TrainingSession,
  exerciseId: string,
  setId: string,
  patch: SessionSetEditPatch,
): TrainingSession => {
  const next = clone(session);
  next.exercises = (next.exercises || []).map((exercise) => {
    if (!matchesExercise(exercise, exerciseId) || !Array.isArray(exercise.sets)) return exercise;
    return {
      ...exercise,
      sets: exercise.sets.map((set, index) => {
        if (!matchesSet(set, setId, index)) return set;
        return applySetPatch(set, patch);
      }),
    };
  });
  next.focusWarmupSetLogs = (next.focusWarmupSetLogs || []).map((set, index) => {
    const warmupExerciseId = focusWarmupExerciseId(set);
    if (warmupExerciseId !== exerciseId || !matchesSet(set, setId, index)) return set;
    return { ...applySetPatch(set, patch), type: 'warmup' };
  });
  return next;
};

export const markSessionEdited = (
  session: TrainingSession,
  fields: string[],
  note?: string,
  beforeSession?: TrainingSession,
  unitSettings?: Partial<UnitSettings>,
): TrainingSession => {
  const uniqueFields = [...new Set(fields.filter(Boolean))];
  const sourceBefore = beforeSession || session;
  const auditDetails = beforeSession
    ? buildAuditDetails(session, sourceBefore, uniqueFields, unitSettings)
    : buildLegacyAuditDetails(session, uniqueFields);
  if (!auditDetails) return session;

  const editedAt = new Date().toISOString();
  const previousHistory = session.editHistory || [];
  return {
    ...session,
    editedAt,
    editHistory: [
      ...previousHistory,
      {
        id: makeAuditId(session, editedAt, auditDetails.editType, auditDetails.changedFields, previousHistory.length),
        editedAt,
        editType: auditDetails.editType,
        fields: uniqueFields,
        editedFields: uniqueFields,
        changedFields: auditDetails.changedFields,
        note,
        reason: note,
        beforeSummaryText: auditDetails.beforeSummaryText,
        afterSummaryText: auditDetails.afterSummaryText,
        beforeSummary: buildSessionEditSummarySnapshot(sourceBefore),
        afterSummary: buildSessionEditSummarySnapshot(session),
        affectedStats: auditDetails.affectedStats,
      },
    ],
  };
};

export const validateSessionEdit = (session: TrainingSession): SessionEditValidationResult => {
  const errors: string[] = [];
  (session.exercises || []).forEach((exercise) => {
    (Array.isArray(exercise.sets) ? exercise.sets : []).forEach((set) => {
      if (number(set.actualWeightKg ?? set.weight) < 0) errors.push('weight_negative');
      if (number(set.reps) < 0) errors.push('reps_negative');
      if (set.rir !== undefined && set.rir !== '' && number(set.rir) < 0) errors.push('rir_negative');
    });
  });
  return { valid: errors.length === 0, errors };
};
