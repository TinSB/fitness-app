import type {
  AppData,
  RecordDataHealthMutationReasonCode,
  RecordDataHealthMutationRequest,
  RecordDataHealthMutationResponse,
  RecordDataHealthMutationResult,
} from '../../../packages/contracts/src';
import type { SessionDataFlag } from '../../../src/models/training-model';
import { dismissDataHealthIssueToday, buildDataHealthReport, filterDismissedDataHealthIssues } from '../../../src/engines/dataHealthEngine';
import {
  analyzeLegacyDisplayWeightRepairScope,
  repairLegacyDisplayWeights,
} from '../../../src/engines/dataHealthRepairEngine';
import { analyzeImportedAppData } from '../../../src/engines/dataRepairEngine';
import { clone } from '../../../src/engines/engineUtils';
import { reconcileScreeningProfile } from '../../../src/engines/adaptiveFeedbackEngine';
import {
  markSessionEdited,
  updateSessionSet,
  validateSessionEdit,
  type SessionSetEditPatch,
} from '../../../src/engines/sessionEditEngine';
import { markSessionDataFlag } from '../../../src/engines/sessionHistoryEngine';

type RecordDataHealthMutationRoute =
  | '/history/:id/edit'
  | '/history/:id/data-flag'
  | '/data-health/issues/:issueId/dismiss'
  | '/data-health/repair/apply';

export const RECORD_DATA_HEALTH_MUTATION_ROUTES: Array<{
  method: 'POST';
  path: RecordDataHealthMutationRoute;
  description: string;
}> = [
  { method: 'POST', path: '/history/:id/edit', description: 'Apply an existing record edit helper to a history session.' },
  { method: 'POST', path: '/history/:id/data-flag', description: 'Update a history session dataFlag through existing audit behavior.' },
  { method: 'POST', path: '/data-health/issues/:issueId/dismiss', description: 'Dismiss a DataHealth issue for today.' },
  { method: 'POST', path: '/data-health/repair/apply', description: 'Apply a whitelisted safe DataHealth repair.' },
];

const DATA_FLAGS = new Set<SessionDataFlag>(['normal', 'test', 'excluded']);
const EDIT_PATCH_KEYS = ['weightKg', 'displayWeight', 'displayUnit', 'reps', 'rir', 'techniqueQuality', 'painFlag', 'note'] as const;
const IMPORT_LIKE_KEYS = ['importData', 'importJson', 'importJsonText', 'jsonText', 'backup', 'rawData'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bodyRecord = (request: RecordDataHealthMutationRequest): Record<string, unknown> | null =>
  isRecord(request.body) ? request.body : null;

const nowIso = (request: RecordDataHealthMutationRequest) =>
  typeof request.nowIso === 'string' && request.nowIso.trim() ? request.nowIso : new Date().toISOString();

const stringField = (body: Record<string, unknown>, key: string): string | undefined => {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const booleanField = (body: Record<string, unknown>, key: string) => body[key] === true;

const result = (
  status: RecordDataHealthMutationResult['status'],
  reasonCode: RecordDataHealthMutationReasonCode,
  message: string,
  options: Partial<Pick<RecordDataHealthMutationResult, 'ok' | 'changed' | 'warnings' | 'requiresConfirmation'>> = {},
): RecordDataHealthMutationResult => ({
  ok: options.ok ?? false,
  changed: options.changed ?? false,
  status,
  reasonCode,
  message,
  warnings: options.warnings?.length ? options.warnings : undefined,
  requiresConfirmation: options.requiresConfirmation,
});

const changedResult = (
  reasonCode: RecordDataHealthMutationReasonCode,
  message: string,
  warnings: string[] = [],
): RecordDataHealthMutationResult =>
  result('success', reasonCode, message, {
    ok: true,
    changed: true,
    warnings,
  });

const response = (
  status: number,
  mutationResult: RecordDataHealthMutationResult,
  nextData?: AppData,
): RecordDataHealthMutationResponse => {
  if (mutationResult.ok === true && mutationResult.changed === true && nextData) {
    return { status, result: mutationResult, nextData };
  }
  return { status, result: mutationResult };
};

const decodePathPart = (value: string) => decodeURIComponent(value);

const historyEditPath = (path: string) => path.match(/^\/history\/([^/]+)\/edit$/);
const historyDataFlagPath = (path: string) => path.match(/^\/history\/([^/]+)\/data-flag$/);
const dataHealthDismissPath = (path: string) => path.match(/^\/data-health\/issues\/([^/]+)\/dismiss$/);

const numericPatchField = (body: Record<string, unknown>, patch: SessionSetEditPatch, key: 'weightKg' | 'displayWeight' | 'reps') => {
  if (!(key in body)) return true;
  const value = body[key];
  if (value === undefined || value === null || value === '') return false;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return false;
  patch[key] = numberValue;
  return true;
};

const buildSetEditPatch = (body: Record<string, unknown>): SessionSetEditPatch | null => {
  const patchBody = isRecord(body.patch) ? body.patch : {};
  const hasPatch = EDIT_PATCH_KEYS.some((key) => Object.prototype.hasOwnProperty.call(patchBody, key));
  if (!hasPatch) return null;

  const patch: SessionSetEditPatch = {};
  if (!numericPatchField(patchBody, patch, 'weightKg')) return null;
  if (!numericPatchField(patchBody, patch, 'displayWeight')) return null;
  if (!numericPatchField(patchBody, patch, 'reps')) return null;

  if ('displayUnit' in patchBody) {
    if (patchBody.displayUnit !== 'kg' && patchBody.displayUnit !== 'lb') return null;
    patch.displayUnit = patchBody.displayUnit;
  }
  if ('rir' in patchBody) {
    const value = patchBody.rir;
    if (value !== '' && typeof value !== 'number' && typeof value !== 'string') return null;
    patch.rir = value as SessionSetEditPatch['rir'];
  }
  if ('techniqueQuality' in patchBody) {
    if (patchBody.techniqueQuality !== 'good' && patchBody.techniqueQuality !== 'acceptable' && patchBody.techniqueQuality !== 'poor') return null;
    patch.techniqueQuality = patchBody.techniqueQuality;
  }
  if ('painFlag' in patchBody) {
    if (typeof patchBody.painFlag !== 'boolean') return null;
    patch.painFlag = patchBody.painFlag;
  }
  if ('note' in patchBody) {
    if (typeof patchBody.note !== 'string') return null;
    patch.note = patchBody.note;
  }

  return patch;
};

const editedFieldsFor = (before: AppData['history'][number], after: AppData['history'][number]) => {
  const fields: string[] = [];
  if (JSON.stringify(before.exercises || []) !== JSON.stringify(after.exercises || [])) fields.push('sets');
  if (JSON.stringify(before.focusWarmupSetLogs || []) !== JSON.stringify(after.focusWarmupSetLogs || [])) fields.push('warmupSets');
  if ((before.dataFlag || 'normal') !== (after.dataFlag || 'normal')) fields.push('dataFlag');
  return fields;
};

const replaceHistorySession = (data: AppData, session: AppData['history'][number]) =>
  (data.history || []).map((item) => (item.id === session.id ? session : item));

const editHistoryRecordMutation = (
  source: AppData,
  sessionId: string,
  request: RecordDataHealthMutationRequest,
): RecordDataHealthMutationResponse => {
  const body = bodyRecord(request);
  if (!body) return response(400, result('invalid', 'record_edit_invalid', '编辑请求格式不正确。'));

  const target = (source.history || []).find((session) => session.id === sessionId);
  if (!target) return response(404, result('not_found', 'record_not_found', '找不到要修改的训练记录。'));

  const exerciseId = stringField(body, 'exerciseId');
  const setId = stringField(body, 'setId');
  const patch = buildSetEditPatch(body);
  if (!exerciseId || !setId || !patch) {
    return response(400, result('invalid', 'record_edit_invalid', '编辑请求缺少动作、组或修正内容。'));
  }

  const patched = updateSessionSet(target, exerciseId, setId, patch);
  const fields = editedFieldsFor(target, patched);
  if (!fields.length) return response(200, result('no_change', 'record_no_change', '没有需要保存的修改。', { ok: true }));

  const validation = validateSessionEdit(patched);
  if (!validation.valid) {
    return response(400, result('invalid', 'record_edit_invalid', '训练记录修正内容需要检查。', { warnings: validation.errors }));
  }

  const beforeEditCount = target.editHistory?.length || 0;
  const edited = markSessionEdited(
    patched,
    fields,
    stringField(body, 'reason') || '历史训练详情修正',
    target,
    source.unitSettings,
  );
  if ((edited.editHistory?.length || 0) <= beforeEditCount) {
    return response(200, result('no_change', 'record_no_change', '没有需要保存的修改。', { ok: true }));
  }

  const history = replaceHistorySession(source, edited);
  return response(
    200,
    changedResult('record_updated', '历史训练已更新。'),
    {
      ...source,
      history,
      screeningProfile: reconcileScreeningProfile(source.screeningProfile, history),
    },
  );
};

const dataFlagMutation = (
  source: AppData,
  sessionId: string,
  request: RecordDataHealthMutationRequest,
): RecordDataHealthMutationResponse => {
  const body = bodyRecord(request);
  if (!body || !DATA_FLAGS.has(body.dataFlag as SessionDataFlag)) {
    return response(400, result('invalid', 'record_edit_invalid', '数据状态必须是 normal、test 或 excluded。'));
  }

  const mutation = markSessionDataFlag(source, sessionId, body.dataFlag as SessionDataFlag, true);
  if (!mutation.ok) {
    return response(404, result('not_found', 'record_not_found', mutation.message || '找不到要修改的训练记录。'));
  }
  if (!mutation.changed) {
    return response(200, result('no_change', 'record_no_change', mutation.message || '数据状态没有变化。', { ok: true }));
  }

  return response(200, changedResult('record_updated', mutation.message || '数据状态已更新。'), mutation.data);
};

const dismissedIssuesOf = (source: AppData) => {
  const entries = [...(source.settings?.dismissedDataHealthIssues || []), ...(source.dismissedDataHealthIssues || [])];
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = [entry.issueId, entry.dismissedAt, entry.scope].join('::');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dismissDataHealthIssueMutation = (
  source: AppData,
  issueId: string,
  request: RecordDataHealthMutationRequest,
): RecordDataHealthMutationResponse => {
  const report = buildDataHealthReport(source);
  const issue = report.issues.find((item) => item.id === issueId);
  if (!issue) {
    return response(404, result('not_found', 'data_health_issue_not_found', '找不到这条数据健康提示。'));
  }

  const dismissedAt = nowIso(request);
  const existing = dismissedIssuesOf(source);
  if (!filterDismissedDataHealthIssues([issue], existing, dismissedAt).length) {
    return response(200, result('no_change', 'data_health_no_change', '这条提示今天已经隐藏。', { ok: true }));
  }

  const dismissedDate = dismissedAt.slice(0, 10);
  const nextDismissed = [
    ...existing.filter((item) => !(item.scope === 'today' && item.issueId === issueId && item.dismissedAt.slice(0, 10) === dismissedDate)),
    dismissDataHealthIssueToday(issueId, dismissedAt),
  ];

  return response(
    200,
    changedResult('data_health_issue_dismissed', '已暂不处理，今天不再提醒。'),
    {
      ...source,
      dismissedDataHealthIssues: nextDismissed,
      settings: {
        ...source.settings,
        dismissedDataHealthIssues: nextDismissed,
      },
    },
  );
};

const parseImportLikePayload = (body: Record<string, unknown>): unknown | undefined => {
  for (const key of IMPORT_LIKE_KEYS) {
    if (!(key in body)) continue;
    const value = body[key];
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }
  return undefined;
};

const hasImportLikePayload = (body: Record<string, unknown>) => IMPORT_LIKE_KEYS.some((key) => key in body);

const actualWeightSnapshots = (data: AppData) =>
  (data.history || []).flatMap((session) => [
    ...(session.exercises || []).flatMap((exercise) =>
      (Array.isArray(exercise.sets) ? exercise.sets : []).map((set, setIndex) => ({
        path: `${session.id}/${exercise.id}/${set.id || setIndex}`,
        actualWeightKg: set.actualWeightKg,
      })),
    ),
    ...((session.focusWarmupSetLogs || []).map((set, setIndex) => ({
      path: `${session.id}/warmup/${set.id || setIndex}`,
      actualWeightKg: set.actualWeightKg,
    })) || []),
  ]);

const repairDataHealthMutation = (source: AppData, request: RecordDataHealthMutationRequest): RecordDataHealthMutationResponse => {
  const body = bodyRecord(request);
  if (!body || body.repairType !== 'legacy_display_weight') {
    return response(400, result('unsupported', 'data_health_repair_not_supported', '暂不支持该数据健康修复。'));
  }

  if (hasImportLikePayload(body)) {
    const importLike = parseImportLikePayload(body);
    const importReport = importLike === null ? { status: 'unsafe' as const, issues: [] } : analyzeImportedAppData(importLike);
    if (importReport.status === 'unsafe') {
      return response(400, result('unsafe', 'unsafe_import_rejected', '导入类数据不属于本修复接口，已拒绝处理。'));
    }
    if (importReport.status === 'needs_review') {
      return response(
        409,
        result('needs_review', 'backup_import_requires_review', '导入类数据需要复核，已拒绝在修复接口中处理。', {
          requiresConfirmation: true,
        }),
      );
    }
    return response(400, result('unsupported', 'data_health_repair_not_supported', '本接口不处理备份导入。'));
  }

  if (!booleanField(body, 'confirmRepair')) {
    return response(
      409,
      result('requires_confirmation', 'data_health_repair_requires_confirmation', '修复历史显示重量需要确认。', {
        requiresConfirmation: true,
      }),
    );
  }

  const scope = analyzeLegacyDisplayWeightRepairScope(source);
  if (scope.repairableCount <= 0) {
    return response(
      200,
      result('no_change', 'data_health_no_change', '没有可自动修复的历史显示重量。', {
        ok: true,
        warnings: scope.needsReviewCount > 0 ? ['部分记录缺少真实重量来源，需要人工复核。'] : undefined,
      }),
    );
  }

  const beforeActualWeights = actualWeightSnapshots(source);
  const repair = repairLegacyDisplayWeights(source, { repairedAt: nowIso(request) });
  const afterActualWeights = actualWeightSnapshots(repair.repairedData);
  if (JSON.stringify(beforeActualWeights) !== JSON.stringify(afterActualWeights)) {
    return response(409, result('unsafe', 'unsafe_import_rejected', '修复已停止：真实训练重量校验未通过。'));
  }
  if (repair.repairedCount <= 0) {
    return response(200, result('no_change', 'data_health_no_change', '没有可自动修复的历史显示重量。', { ok: true, warnings: repair.warnings }));
  }

  return response(
    200,
    changedResult('data_health_repair_applied', '已修复历史显示重量，真实训练重量未改变。', repair.warnings),
    repair.repairedData,
  );
};

export const handleRecordDataHealthMutationRequest = (
  data: AppData,
  request: RecordDataHealthMutationRequest,
): RecordDataHealthMutationResponse => {
  const source = clone(data);

  if (request.method !== 'POST') {
    return response(405, result('unsupported', 'unsupported_route', 'Record/DataHealth mutation API only supports POST requests.'));
  }

  const editMatch = historyEditPath(request.path);
  if (editMatch) return editHistoryRecordMutation(source, decodePathPart(editMatch[1]), request);

  const dataFlagMatch = historyDataFlagPath(request.path);
  if (dataFlagMatch) return dataFlagMutation(source, decodePathPart(dataFlagMatch[1]), request);

  const dismissMatch = dataHealthDismissPath(request.path);
  if (dismissMatch) return dismissDataHealthIssueMutation(source, decodePathPart(dismissMatch[1]), request);

  if (request.path === '/data-health/repair/apply') return repairDataHealthMutation(source, request);

  return response(404, result('unsupported', 'unsupported_route', 'Record/DataHealth mutation route not found.'));
};
