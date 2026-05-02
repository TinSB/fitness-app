import {
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  SUPPORT_EXERCISE_MAP,
} from '../data/trainingData';
import type { AppData, DataRepairLogEntry, ProgramAdjustmentDraft, WeightUnit } from '../models/training-model';
import { formatExerciseName } from '../i18n/formatters';
import { buildPlanAdjustmentFingerprintFromDraft } from './planAdjustmentIdentityEngine';
import { isSyntheticReplacementExerciseId, validateReplacementExerciseId } from './replacementEngine';
import { sanitizeData } from '../storage/persistence';
import { convertKgToDisplayWeight } from './unitConversionEngine';
import { clone, isNoSoreness, normalizeSoreness, number } from './engineUtils';

export type DataRepairStatus = 'clean' | 'repairable' | 'needs_review' | 'unsafe';
export type DataRepairIssueSeverity = 'info' | 'warning' | 'error';
export type DataRepairIssueCategory =
  | 'replacement'
  | 'template'
  | 'warmup'
  | 'unit'
  | 'todayStatus'
  | 'adjustmentDraft'
  | 'exerciseReference'
  | 'history';

export type DataRepairReport = {
  status: DataRepairStatus;
  issues: Array<{
    id: string;
    severity: DataRepairIssueSeverity;
    category: DataRepairIssueCategory;
    title: string;
    message: string;
    canAutoRepair: boolean;
    affectedCount?: number;
  }>;
};

export type DataRepairOptions = {
  repairDate: string;
  sourceFileName?: string;
  maxRepairLogEntries?: number;
};

export type DataRepairResult = {
  repairedData: AppData;
  report: DataRepairReport;
  repairLog: DataRepairLogEntry[];
};

type MutableRecord = Record<string, unknown>;
type RepairIssue = DataRepairReport['issues'][number];
type RepairLogInput = Omit<DataRepairLogEntry, 'createdAt' | 'sourceFileName'>;

const DEFAULT_REPAIR_LOG_LIMIT = 200;

const isPlainObject = (value: unknown): value is MutableRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pickArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const pickRecord = (value: unknown): MutableRecord => (isPlainObject(value) ? value : {});
const pickString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const finiteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const exerciseLibraryIds = new Set([
  ...Object.keys(EXERCISE_DISPLAY_NAMES),
  ...Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES),
  ...Object.keys(SUPPORT_EXERCISE_MAP),
]);

const currentExerciseIdsFromData = (data: MutableRecord) => {
  const ids = new Set(exerciseLibraryIds);
  pickArray(data.templates).forEach((template) => {
    pickArray(pickRecord(template).exercises).forEach((exercise) => {
      const id = pickString(pickRecord(exercise).id);
      if (id) ids.add(id);
    });
  });
  return ids;
};

const isKnownExerciseId = (id: unknown, ids: Set<string>) => {
  const text = pickString(id);
  return Boolean(text && ids.has(text));
};

const safeSnippet = (value: unknown): unknown => {
  if (!isPlainObject(value)) return value;
  const allowed = [
    'id',
    'name',
    'exerciseName',
    'actualExerciseId',
    'originalExerciseId',
    'replacementExerciseId',
    'legacyActualExerciseId',
    'legacyReplacementExerciseId',
    'legacyOriginalExerciseId',
    'identityInvalid',
    'identityReviewReason',
    'displayWeight',
    'displayUnit',
    'actualWeightKg',
    'soreness',
    'date',
    'sourceFingerprint',
    'status',
  ];
  return Object.fromEntries(allowed.filter((key) => key in value).map((key) => [key, value[key]]));
};

const issue = (
  issues: RepairIssue[],
  id: string,
  category: DataRepairIssueCategory,
  severity: DataRepairIssueSeverity,
  title: string,
  message: string,
  canAutoRepair: boolean,
  affectedCount?: number,
) => {
  if (affectedCount !== undefined && affectedCount <= 0) return;
  issues.push({ id, category, severity, title, message, canAutoRepair, affectedCount });
};

const finalizeReport = (issues: RepairIssue[]): DataRepairReport => {
  if (!issues.length) return { status: 'clean', issues: [] };
  if (issues.some((item) => item.severity === 'error' && !item.canAutoRepair)) {
    return { status: 'needs_review', issues };
  }
  if (issues.some((item) => !item.canAutoRepair)) {
    return { status: 'needs_review', issues };
  }
  return { status: 'repairable', issues };
};

const looksLikeAppData = (raw: MutableRecord) =>
  Array.isArray(raw.history) ||
  Array.isArray(raw.templates) ||
  isPlainObject(raw.programTemplate) ||
  isPlainObject(raw.todayStatus) ||
  Number.isFinite(Number(raw.schemaVersion));

const sessionList = (data: MutableRecord) => [
  ...pickArray(data.history),
  ...(isPlainObject(data.activeSession) ? [data.activeSession] : []),
];

const exerciseList = (data: MutableRecord) =>
  sessionList(data).flatMap((session) => pickArray(pickRecord(session).exercises));

const countSyntheticReplacementIds = (data: MutableRecord) =>
  exerciseList(data).filter((exercise) => {
    const raw = pickRecord(exercise);
    return [raw.id, raw.actualExerciseId, raw.replacementExerciseId].some((value) => isSyntheticReplacementExerciseId(pickString(value)));
  }).length;

const countExerciseNameConflicts = (data: MutableRecord, ids: Set<string>) =>
  exerciseList(data).filter((exercise) => {
    const raw = pickRecord(exercise);
    const actualExerciseId = pickString(raw.actualExerciseId || raw.id);
    if (!isKnownExerciseId(actualExerciseId, ids)) return false;
    const expected = formatExerciseName(actualExerciseId);
    const currentName = pickString(raw.exerciseName || raw.name);
    return Boolean(currentName && expected && currentName !== expected);
  }).length;

const countInvalidHistoryExerciseRefs = (data: MutableRecord, ids: Set<string>) =>
  exerciseList(data).reduce<number>((count, exercise) => {
    const raw = pickRecord(exercise);
    return (
      count +
      ['actualExerciseId', 'originalExerciseId', 'replacementExerciseId'].filter((field) => {
        const value = pickString(raw[field]);
        return Boolean(value && !isKnownExerciseId(value, ids));
      }).length
      );
    }, 0);

const countIdentityReviewExerciseRefs = (data: MutableRecord) =>
  exerciseList(data).filter((exercise) => {
    const raw = pickRecord(exercise);
    return Boolean(raw.identityInvalid || raw.legacyActualExerciseId || raw.legacyReplacementExerciseId || raw.legacyOriginalExerciseId);
  }).length;

const warmupNeedsRepair = (entry: unknown) => {
  if (typeof entry === 'string') return true;
  const raw = pickRecord(entry);
  return !raw.exerciseId || !raw.originalExerciseId || !raw.actualExerciseId || !raw.type || !raw.warmupType || raw.setIndex === undefined;
};

const countWarmupIssues = (data: MutableRecord) =>
  sessionList(data).reduce<number>((count, session) => count + pickArray(pickRecord(session).focusWarmupSetLogs).filter(warmupNeedsRepair).length, 0);

const countUnitIssues = (data: MutableRecord) => {
  let displayMismatch = 0;
  let missingActual = 0;
  const visitSet = (set: unknown) => {
    const raw = pickRecord(set);
    const actualWeightKg = finiteNumber(raw.actualWeightKg);
    const displayWeight = finiteNumber(raw.displayWeight);
    const displayUnit = pickString(raw.displayUnit) as WeightUnit;
    if (actualWeightKg !== undefined && displayWeight !== undefined && (displayUnit === 'kg' || displayUnit === 'lb')) {
      const expected = convertKgToDisplayWeight(actualWeightKg, displayUnit);
      if (Math.abs(expected - displayWeight) > 1.1) displayMismatch += 1;
    } else if (actualWeightKg === undefined && displayWeight !== undefined) {
      missingActual += 1;
    }
  };
  exerciseList(data).forEach((exercise) => pickArray(pickRecord(exercise).sets).forEach(visitSet));
  sessionList(data).forEach((session) => pickArray(pickRecord(session).focusWarmupSetLogs).forEach(visitSet));
  return { displayMismatch, missingActual };
};

const countMissingTemplateReferences = (data: MutableRecord, ids: Set<string>) => {
  let count = 0;
  pickArray(data.templates).forEach((template) => {
    pickArray(pickRecord(template).exercises).forEach((exercise) => {
      const raw = pickRecord(exercise);
      ['alternativeIds', 'regressionIds', 'progressionIds'].forEach((field) => {
        pickArray(raw[field]).forEach((id) => {
          if (!isKnownExerciseId(id, ids)) count += 1;
        });
      });
    });
  });
  return count;
};

const draftFingerprint = (draft: ProgramAdjustmentDraft) => draft.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(draft);

const countDraftIssues = (data: MutableRecord) => {
  const drafts = pickArray(data.programAdjustmentDrafts);
  const missingFingerprint = drafts.filter((draft) => !pickString(pickRecord(draft).sourceFingerprint)).length;
  const counts = new Map<string, number>();
  drafts.forEach((draft) => {
    const raw = pickRecord(draft) as unknown as ProgramAdjustmentDraft;
    const fingerprint = pickString(pickRecord(draft).sourceFingerprint) || buildPlanAdjustmentFingerprintFromDraft(raw);
    counts.set(fingerprint, (counts.get(fingerprint) || 0) + 1);
  });
  const duplicates = [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  return { missingFingerprint, duplicates };
};

const activeProgramPointsToDayTemplate = (data: MutableRecord) => {
  const activeProgramTemplateId = pickString(data.activeProgramTemplateId || pickRecord(data.settings).activeProgramTemplateId);
  const programTemplate = pickRecord(data.programTemplate);
  const programId = pickString(programTemplate.id);
  if (!activeProgramTemplateId || activeProgramTemplateId === programId) return false;
  return pickArray(programTemplate.dayTemplates).some((day) => pickString(pickRecord(day).id) === activeProgramTemplateId);
};

export const analyzeImportedAppData = (rawData: unknown): DataRepairReport => {
  if (!isPlainObject(rawData)) {
    return {
      status: 'unsafe',
      issues: [
        {
          id: 'import.not_app_data',
          severity: 'error',
          category: 'history',
          title: '无法识别备份文件',
          message: '该文件不是 IronPath 应用备份结构，禁止作为应用数据导入。',
          canAutoRepair: false,
        },
      ],
    };
  }
  if (!looksLikeAppData(rawData)) {
    return {
      status: 'unsafe',
      issues: [
        {
          id: 'import.not_app_data',
          severity: 'error',
          category: 'history',
          title: '无法识别备份文件',
          message: '该 JSON 不包含训练历史、模板或应用备份字段，禁止导入。',
          canAutoRepair: false,
        },
      ],
    };
  }

  const issues: RepairIssue[] = [];
  const knownIds = currentExerciseIdsFromData(rawData);
  issue(
    issues,
    'replacement.synthetic_id',
    'replacement',
    'warning',
    '发现旧替代动作 ID',
    '部分记录包含旧版合成替代动作 ID，需要生成修复预览后再导入。',
    true,
    countSyntheticReplacementIds(rawData),
  );
  issue(
    issues,
    'replacement.name_mismatch',
    'replacement',
    'info',
    '动作显示名与实际动作不一致',
    '可按 actualExerciseId 重新生成显示名，不改变记录池。',
    true,
    countExerciseNameConflicts(rawData, knownIds),
  );
  issue(
    issues,
    'exerciseReference.history_missing',
    'exerciseReference',
    'error',
    '历史记录引用了不存在的动作',
    '历史动作身份需要人工检查；修复不会把它静默改回原计划动作。',
    false,
    countInvalidHistoryExerciseRefs(rawData, knownIds),
  );
  issue(
    issues,
    'exerciseReference.identity_review',
    'exerciseReference',
    'error',
    '动作记录身份需要检查',
    '部分历史记录来自旧版替代动作逻辑，系统已保留原始记录，但不会把它用于 PR、e1RM 或有效组。',
    false,
    countIdentityReviewExerciseRefs(rawData),
  );
  issue(
    issues,
    'warmup.incomplete',
    'warmup',
    'warning',
    '热身记录结构不完整',
    '可尽量补齐热身组的动作 ID、类型和组序号；不会写入正式组。',
    true,
    countWarmupIssues(rawData),
  );

  const unitIssues = countUnitIssues(rawData);
  issue(
    issues,
    'unit.display_mismatch',
    'unit',
    'info',
    '旧显示重量与标准重量不一致',
    'actualWeightKg 会继续作为唯一计算来源，旧 display 字段只作为显示兼容处理。',
    true,
    unitIssues.displayMismatch,
  );
  issue(
    issues,
    'unit.missing_actual_weight',
    'unit',
    'warning',
    '缺少标准重量',
    '部分记录只有 displayWeight/displayUnit，无法自动确认真实 kg 重量，需要人工检查。',
    false,
    unitIssues.missingActual,
  );

  const todayStatus = pickRecord(rawData.todayStatus);
  issue(
    issues,
    'todayStatus.missing_date',
    'todayStatus',
    'warning',
    '今日状态缺少日期',
    '旧酸痛状态不会沿用到今天；修复副本会把酸痛设为无并保留睡眠、精力和时长。',
    true,
    todayStatus && !pickString(todayStatus.date) ? 1 : 0,
  );
  issue(
    issues,
    'template.active_day_id',
    'template',
    'warning',
    '当前计划 ID 可能指向训练日',
    'activeProgramTemplateId 看起来是训练日模板 ID。本轮只报告，不强行迁移。',
    false,
    activeProgramPointsToDayTemplate(rawData) ? 1 : 0,
  );
  issue(
    issues,
    'exerciseReference.template_missing',
    'exerciseReference',
    'warning',
    '模板中存在失效动作引用',
    '模板 alternative / regression / progression 中的失效引用可自动移除并记录。',
    true,
    countMissingTemplateReferences(rawData, knownIds),
  );

  const draftIssues = countDraftIssues(rawData);
  issue(
    issues,
    'adjustmentDraft.missing_fingerprint',
    'adjustmentDraft',
    'info',
    '调整草案缺少来源指纹',
    '可补齐 legacy sourceFingerprint，用于后续去重显示。',
    true,
    draftIssues.missingFingerprint,
  );
  issue(
    issues,
    'adjustmentDraft.duplicate_fingerprint',
    'adjustmentDraft',
    'warning',
    '发现重复调整草案',
    '修复预览会记录重复关系，但不会删除旧草案。',
    true,
    draftIssues.duplicates,
  );

  return finalizeReport(issues);
};

const createRepairLogger = (options: Required<Pick<DataRepairOptions, 'repairDate' | 'maxRepairLogEntries'>> & Pick<DataRepairOptions, 'sourceFileName'>) => {
  const entries: DataRepairLogEntry[] = [];
  const overflow: RepairLogInput[] = [];

  const add = (entry: RepairLogInput) => {
    const normalized: DataRepairLogEntry = {
      ...entry,
      createdAt: options.repairDate,
      sourceFileName: options.sourceFileName,
      affectedIds: [...new Set((entry.affectedIds || []).map(String))].slice(0, 100),
      before: safeSnippet(entry.before),
      after: safeSnippet(entry.after),
    };
    if (entries.length < options.maxRepairLogEntries - 1) entries.push(normalized);
    else overflow.push(normalized);
  };

  const list = () => {
    if (!overflow.length) return entries;
    const grouped = new Map<string, Set<string>>();
    overflow.forEach((entry) => {
      const key = `${entry.category}:${entry.action}`;
      if (!grouped.has(key)) grouped.set(key, new Set());
      entry.affectedIds.forEach((id) => grouped.get(key)?.add(id));
    });
    const summary: DataRepairLogEntry = {
      id: `repair-summary-${options.repairDate}`,
      createdAt: options.repairDate,
      sourceFileName: options.sourceFileName,
      category: 'summary',
      action: '合并记录大量同类修复',
      affectedIds: [...grouped.entries()].flatMap(([key, ids]) => [`${key}:${ids.size}`]).slice(0, 100),
    };
    return [...entries, summary].slice(0, options.maxRepairLogEntries);
  };

  return { add, list };
};

const repairTodayStatus = (data: MutableRecord, log: ReturnType<typeof createRepairLogger>, repairDate: string) => {
  const raw = pickRecord(data.todayStatus);
  if (!Object.keys(raw).length) return;
  if (pickString(raw.date)) {
    raw.soreness = normalizeSoreness(raw.soreness);
    data.todayStatus = raw;
    return;
  }
  const before = { date: raw.date, soreness: raw.soreness };
  raw.date = repairDate;
  raw.soreness = ['无'];
  data.todayStatus = raw;
  log.add({
    id: 'repair-todayStatus-date',
    category: 'todayStatus',
    action: '为旧 todayStatus 设置导入日期并清空旧酸痛',
    affectedIds: ['todayStatus'],
    before,
    after: { date: raw.date, soreness: raw.soreness },
  });
};

const displayNameForActual = (actualExerciseId: string) => EXERCISE_DISPLAY_NAMES[actualExerciseId] || formatExerciseName(actualExerciseId);

const repairExerciseIdentity = (exercise: MutableRecord, knownIds: Set<string>, log: ReturnType<typeof createRepairLogger>, affectedIdPrefix: string) => {
  const rawId = pickString(exercise.id);
  const explicitActualExerciseId = pickString(exercise.actualExerciseId);
  const actualExerciseId = explicitActualExerciseId || rawId;
  const replacementExerciseId = pickString(exercise.replacementExerciseId);
  const originalExerciseId = pickString(exercise.originalExerciseId);
  const name = pickString(exercise.exerciseName || exercise.name);
  const invalidActual = Boolean(actualExerciseId && !isKnownExerciseId(actualExerciseId, knownIds)) || isSyntheticReplacementExerciseId(actualExerciseId);
  const invalidReplacement = Boolean(replacementExerciseId && !isKnownExerciseId(replacementExerciseId, knownIds));
  const invalidOriginal = Boolean(originalExerciseId && !isKnownExerciseId(originalExerciseId, knownIds));

  if (actualExerciseId && !invalidActual && isKnownExerciseId(actualExerciseId, knownIds)) {
    const expected = displayNameForActual(actualExerciseId);
    if (name && expected && name !== expected) {
      const before = { id: exercise.id, name: exercise.name, exerciseName: exercise.exerciseName, actualExerciseId };
      exercise.exerciseName = expected;
      exercise.name = expected;
      log.add({
        id: `repair-exercise-name-${affectedIdPrefix}-${actualExerciseId}`,
        category: 'replacement',
        action: '按 actualExerciseId 修正动作显示名',
        affectedIds: [`${affectedIdPrefix}:${pickString(exercise.id) || actualExerciseId}`],
        before,
        after: { id: exercise.id, name: exercise.name, exerciseName: exercise.exerciseName, actualExerciseId },
      });
    }
  }

  if (invalidActual || invalidReplacement || invalidOriginal) {
    const before = safeSnippet(exercise);
    if (invalidActual && actualExerciseId) {
      exercise.legacyActualExerciseId = pickString(exercise.legacyActualExerciseId) || actualExerciseId;
      delete exercise.actualExerciseId;
    }
    if (invalidReplacement && replacementExerciseId) {
      exercise.legacyReplacementExerciseId = pickString(exercise.legacyReplacementExerciseId) || replacementExerciseId;
      delete exercise.replacementExerciseId;
    }
    if (invalidOriginal && originalExerciseId) {
      exercise.legacyOriginalExerciseId = pickString(exercise.legacyOriginalExerciseId) || originalExerciseId;
      delete exercise.originalExerciseId;
    }
    exercise.identityInvalid = true;
    exercise.identityReviewReason =
      pickString(exercise.identityReviewReason) ||
      (invalidActual
        ? 'invalid_actual_exercise_id'
        : invalidReplacement
          ? 'invalid_replacement_exercise_id'
          : 'invalid_original_exercise_id');
    log.add({
      id: `repair-exercise-identity-${affectedIdPrefix}`,
      category: 'replacement',
      action: '保留无效动作身份为 legacy，并标记需要人工检查',
      affectedIds: [`${affectedIdPrefix}:${rawId || actualExerciseId || replacementExerciseId || originalExerciseId}`],
      before,
      after: safeSnippet(exercise),
    });
  }
};

const repairHistoryIdentities = (data: MutableRecord, knownIds: Set<string>, log: ReturnType<typeof createRepairLogger>) => {
  sessionList(data).forEach((session, sessionIndex) => {
    pickArray(pickRecord(session).exercises).forEach((exercise, exerciseIndex) => {
      repairExerciseIdentity(pickRecord(exercise), knownIds, log, `session-${sessionIndex + 1}-exercise-${exerciseIndex + 1}`);
    });
  });
};

const repairTemplateReferences = (data: MutableRecord, knownIds: Set<string>, log: ReturnType<typeof createRepairLogger>) => {
  pickArray(data.templates).forEach((template) => {
    const templateRecord = pickRecord(template);
    pickArray(templateRecord.exercises).forEach((exercise) => {
      const exerciseRecord = pickRecord(exercise);
      ['alternativeIds', 'regressionIds', 'progressionIds'].forEach((field) => {
        const values = pickArray(exerciseRecord[field]).map(String);
        const valid = values.filter((id) => isKnownExerciseId(id, knownIds));
        if (values.length !== valid.length) {
          exerciseRecord[field] = valid;
          log.add({
            id: `repair-template-ref-${pickString(templateRecord.id)}-${pickString(exerciseRecord.id)}-${field}`,
            category: 'exerciseReference',
            action: `移除模板中的失效 ${field} 引用`,
            affectedIds: values.filter((id) => !valid.includes(id)),
            before: { id: exerciseRecord.id, [field]: values },
            after: { id: exerciseRecord.id, [field]: valid },
          });
        }
      });
    });
  });
};

const parseWarmupId = (id: string) => {
  const match = id.match(/^([^:]+):(.+):warmup:(\d+)$/);
  if (!match) return null;
  return { section: match[1], exerciseId: match[2], setIndex: Number(match[3]) };
};

const stripSyntheticSuffix = (id: string) => id.replace(/__auto_alt(?:_alt)?$/g, '').replace(/__alt_.+$/g, '');

const findSessionExercise = (session: MutableRecord, rawExerciseId: string) => {
  const base = stripSyntheticSuffix(rawExerciseId);
  return pickArray(session.exercises).map(pickRecord).find((exercise) => {
    const candidates = [exercise.id, exercise.actualExerciseId, exercise.originalExerciseId, exercise.replacementExerciseId, exercise.baseId]
      .map((value) => pickString(value))
      .filter(Boolean);
    return candidates.includes(rawExerciseId) || candidates.includes(base);
  });
};

const repairWarmupLogs = (data: MutableRecord, log: ReturnType<typeof createRepairLogger>) => {
  sessionList(data).forEach((session) => {
    const sessionRecord = pickRecord(session);
    const logs = pickArray(sessionRecord.focusWarmupSetLogs);
    if (!logs.length) return;
    const counts = new Map<string, number>();
    logs.forEach((entry) => {
      const id = typeof entry === 'string' ? entry : pickString(pickRecord(entry).id);
      const parsed = parseWarmupId(id);
      if (parsed?.exerciseId) counts.set(parsed.exerciseId, (counts.get(parsed.exerciseId) || 0) + 1);
    });

    sessionRecord.focusWarmupSetLogs = logs.map((entry, index) => {
      const raw: MutableRecord = typeof entry === 'string' ? { id: entry } : { ...pickRecord(entry) };
      const id = pickString(raw.id, `warmup-${index + 1}`);
      const parsed = parseWarmupId(id);
      const inferredExercise = parsed ? findSessionExercise(sessionRecord, parsed.exerciseId) : undefined;
      const originalExerciseId = pickString(raw.originalExerciseId || inferredExercise?.originalExerciseId || inferredExercise?.id || parsed?.exerciseId);
      const actualExerciseId = pickString(raw.actualExerciseId || inferredExercise?.actualExerciseId || inferredExercise?.replacementExerciseId || originalExerciseId);
      const exerciseId = pickString(raw.exerciseId || actualExerciseId || originalExerciseId || parsed?.exerciseId);
      const count = parsed?.exerciseId ? counts.get(parsed.exerciseId) || 0 : 0;
      const repaired = {
        ...raw,
        id,
        exerciseId,
        originalExerciseId,
        actualExerciseId,
        type: 'warmup',
        warmupType: raw.warmupType || (count > 1 ? 'full_warmup' : count === 1 ? 'feeder_set' : 'unknown'),
        setIndex: Number.isFinite(number(raw.setIndex)) ? Math.max(0, Math.floor(number(raw.setIndex))) : parsed?.setIndex ?? index,
      };
      if (warmupNeedsRepair(entry)) {
        log.add({
          id: `repair-warmup-${pickString(sessionRecord.id) || 'session'}-${id}`,
          category: 'warmup',
          action: '补齐热身记录结构',
          affectedIds: [id],
          before: raw,
          after: repaired,
        });
      }
      return repaired;
    });
  });
};

const repairDisplayWeights = (data: MutableRecord, log: ReturnType<typeof createRepairLogger>) => {
  const repairSet = (set: unknown, idPrefix: string) => {
    const raw = pickRecord(set);
    const actualWeightKg = finiteNumber(raw.actualWeightKg);
    const displayWeight = finiteNumber(raw.displayWeight);
    const displayUnit = pickString(raw.displayUnit) as WeightUnit;
    if (actualWeightKg === undefined || displayWeight === undefined || (displayUnit !== 'kg' && displayUnit !== 'lb')) return;
    const expected = convertKgToDisplayWeight(actualWeightKg, displayUnit);
    if (Math.abs(expected - displayWeight) <= 1.1) return;
    const before = { id: raw.id, actualWeightKg, displayWeight, displayUnit };
    delete raw.displayWeight;
    delete raw.displayUnit;
    log.add({
      id: `repair-unit-display-${idPrefix}-${pickString(raw.id) || 'set'}`,
      category: 'unit',
      action: '清理不可信的旧 displayWeight/displayUnit',
      affectedIds: [pickString(raw.id) || idPrefix],
      before,
      after: { id: raw.id, actualWeightKg },
    });
  };

  exerciseList(data).forEach((exercise, exerciseIndex) => {
    pickArray(pickRecord(exercise).sets).forEach((set, setIndex) => repairSet(set, `set-${exerciseIndex + 1}-${setIndex + 1}`));
  });
  sessionList(data).forEach((session, sessionIndex) => {
    pickArray(pickRecord(session).focusWarmupSetLogs).forEach((set, setIndex) => repairSet(set, `warmup-${sessionIndex + 1}-${setIndex + 1}`));
  });
};

const repairDraftFingerprints = (data: MutableRecord, log: ReturnType<typeof createRepairLogger>) => {
  const drafts = pickArray(data.programAdjustmentDrafts).map(pickRecord);
  const groups = new Map<string, string[]>();
  drafts.forEach((draft) => {
    const before = { id: draft.id, sourceFingerprint: draft.sourceFingerprint };
    const fingerprint = pickString(draft.sourceFingerprint) || buildPlanAdjustmentFingerprintFromDraft(draft as unknown as ProgramAdjustmentDraft);
    if (!draft.sourceFingerprint) {
      draft.sourceFingerprint = fingerprint;
      log.add({
        id: `repair-draft-fingerprint-${pickString(draft.id) || fingerprint}`,
        category: 'adjustmentDraft',
        action: '补齐调整草案 sourceFingerprint',
        affectedIds: [pickString(draft.id) || fingerprint],
        before,
        after: { id: draft.id, sourceFingerprint: fingerprint },
      });
    }
    groups.set(fingerprint, [...(groups.get(fingerprint) || []), pickString(draft.id) || fingerprint]);
  });
  groups.forEach((ids, fingerprint) => {
    if (ids.length <= 1) return;
    log.add({
      id: `repair-draft-duplicate-${fingerprint}`,
      category: 'adjustmentDraft',
      action: '记录同源重复调整草案，保留原数据不删除',
      affectedIds: ids,
      before: { sourceFingerprint: fingerprint, draftCount: ids.length },
      after: { sourceFingerprint: fingerprint, displayPolicy: '优先显示已应用或最新有效草案' },
    });
  });
};

export const repairImportedAppData = (rawData: unknown, options: DataRepairOptions): DataRepairResult => {
  const maxRepairLogEntries = options.maxRepairLogEntries || DEFAULT_REPAIR_LOG_LIMIT;
  const reportBeforeRepair = analyzeImportedAppData(rawData);
  if (reportBeforeRepair.status === 'unsafe') {
    return {
      repairedData: sanitizeData({}),
      report: reportBeforeRepair,
      repairLog: [],
    };
  }

  const working = clone(rawData) as MutableRecord;
  const log = createRepairLogger({
    repairDate: options.repairDate,
    sourceFileName: options.sourceFileName,
    maxRepairLogEntries,
  });
  const knownIds = currentExerciseIdsFromData(working);

  repairTodayStatus(working, log, options.repairDate);
  repairHistoryIdentities(working, knownIds, log);
  repairTemplateReferences(working, knownIds, log);
  repairWarmupLogs(working, log);
  repairDisplayWeights(working, log);
  repairDraftFingerprints(working, log);

  const repairedData = sanitizeData(working);
  const repairLog = log.list().slice(0, maxRepairLogEntries);
  const existingLogs = Array.isArray(repairedData.settings.dataRepairLogs) ? repairedData.settings.dataRepairLogs : [];
  repairedData.settings = {
    ...repairedData.settings,
    dataRepairLogs: [...existingLogs, ...repairLog].slice(-maxRepairLogEntries),
  };

  return {
    repairedData,
    report: analyzeImportedAppData(repairedData),
    repairLog,
  };
};

export const canImportDataRepairReport = (report: DataRepairReport) => report.status !== 'unsafe';

export { isNoSoreness, normalizeSoreness };
