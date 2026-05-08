import type {
  AppData,
  SessionMutationRequest,
  SessionMutationResponse,
  SessionMutationResult,
  SessionMutationReasonCode,
  SessionPatch,
} from '../../../packages/contracts/src';
import { createSession } from '../../../src/engines/sessionBuilder';
import { buildWeeklyPrescription } from '../../../src/engines/supportPlanEngine';
import { buildTrainingDecisionContext } from '../../../src/engines/trainingDecisionContext';
import { reconcileScreeningProfile } from '../../../src/engines/adaptiveFeedbackEngine';
import { clone } from '../../../src/engines/engineUtils';
import {
  applySessionPatches,
  findActivePendingSessionPatch,
  markPendingSessionPatchConsumed,
} from '../../../src/engines/sessionPatchEngine';
import {
  buildIncompleteMainWorkGuard,
  completeTrainingSessionIntoHistory,
} from '../../../src/engines/trainingCompletionEngine';

type SessionMutationRoute =
  | '/sessions/start'
  | '/sessions/active/patches'
  | '/sessions/active/complete'
  | '/sessions/active/discard';

export const SESSION_MUTATION_ROUTES: Array<{
  method: 'POST';
  path: SessionMutationRoute;
  description: string;
}> = [
  { method: 'POST', path: '/sessions/start', description: 'Create the active session from the selected template.' },
  { method: 'POST', path: '/sessions/active/patches', description: 'Apply session-level patches to the active session.' },
  { method: 'POST', path: '/sessions/active/complete', description: 'Finalize the active session into history.' },
  { method: 'POST', path: '/sessions/active/discard', description: 'Discard the unsaved active session.' },
];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const bodyRecord = (request: SessionMutationRequest): Record<string, unknown> => (isRecord(request.body) ? request.body : {});

const nowIso = (request: SessionMutationRequest) =>
  typeof request.nowIso === 'string' && request.nowIso.trim() ? request.nowIso : new Date().toISOString();

const dateKey = (value: string) => String(value || '').slice(0, 10);

const stringField = (body: Record<string, unknown>, key: string): string | undefined => {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const booleanField = (body: Record<string, unknown>, key: string) => body[key] === true;

const sessionPatchesFromBody = (body: Record<string, unknown>): SessionPatch[] => {
  if (!Array.isArray(body.patches)) return [];
  return body.patches.filter(isRecord) as unknown as SessionPatch[];
};

const result = (
  status: SessionMutationResult['status'],
  reasonCode: SessionMutationReasonCode,
  message: string,
  options: Partial<Pick<SessionMutationResult, 'ok' | 'changed' | 'warnings' | 'requiresConfirmation'>> = {},
): SessionMutationResult => ({
  ok: options.ok ?? false,
  changed: options.changed ?? false,
  status,
  reasonCode,
  message,
  warnings: options.warnings?.length ? options.warnings : undefined,
  requiresConfirmation: options.requiresConfirmation,
});

const changedResult = (
  reasonCode: SessionMutationReasonCode,
  message: string,
  warnings: string[] = [],
): SessionMutationResult =>
  result('success', reasonCode, message, {
    ok: true,
    changed: true,
    warnings,
  });

const response = (status: number, mutationResult: SessionMutationResult, nextData?: AppData): SessionMutationResponse => {
  if (mutationResult.ok === true && mutationResult.changed === true && nextData) {
    return { status, result: mutationResult, nextData };
  }
  return { status, result: mutationResult };
};

const pendingPatchesOf = (data: AppData) => data.pendingSessionPatches || data.settings?.pendingSessionPatches || [];

const findTemplateById = (data: AppData, templateId: string) => (data.templates || []).find((template) => template.id === templateId);

const startSessionMutation = (source: AppData, request: SessionMutationRequest): SessionMutationResponse => {
  if (source.activeSession) {
    return response(409, result('conflict', 'active_session_exists', '当前已有进行中的训练。'));
  }

  const body = bodyRecord(request);
  const startedAt = nowIso(request);
  const currentDate = dateKey(startedAt);
  const templateId = stringField(body, 'templateId') || source.activeProgramTemplateId || source.selectedTemplateId;
  const template = findTemplateById(source, templateId);
  if (!template) {
    return response(404, result('not_found', 'template_not_found', '找不到要开始的训练模板。'));
  }

  const screeningProfile = reconcileScreeningProfile(source.screeningProfile, source.history);
  const currentActiveTemplateId = source.activeProgramTemplateId || source.selectedTemplateId || templateId;
  const workingData: AppData = {
    ...source,
    screeningProfile,
    selectedTemplateId: templateId,
    activeProgramTemplateId: currentActiveTemplateId,
  };
  const decisionContext = buildTrainingDecisionContext(workingData, currentDate, {
    screeningProfile,
    selectedTemplateId: templateId,
    activeProgramTemplateId: currentActiveTemplateId,
    currentTrainingTemplate: template,
    activeTemplate: template,
  });
  const baseSession = createSession(
    template,
    source.todayStatus,
    source.history,
    source.trainingMode,
    buildWeeklyPrescription(source),
    undefined,
    screeningProfile,
    source.mesocyclePlan,
    decisionContext,
  );
  const pendingPatch = findActivePendingSessionPatch(pendingPatchesOf(source), currentDate, templateId);
  const patchResult = pendingPatch?.patches?.length ? applySessionPatches(baseSession, pendingPatch.patches) : null;
  const activeSession = {
    ...(patchResult?.session || baseSession),
    startedAt,
    date: currentDate,
  };
  const nextPendingPatches = pendingPatch
    ? markPendingSessionPatchConsumed(pendingPatchesOf(source), pendingPatch.id, startedAt)
    : pendingPatchesOf(source);
  const nextData: AppData = {
    ...source,
    screeningProfile,
    selectedTemplateId: templateId,
    activeProgramTemplateId: source.activeProgramTemplateId || currentActiveTemplateId || templateId,
    activeSession,
    pendingSessionPatches: nextPendingPatches,
    settings: {
      ...source.settings,
      pendingSessionPatches: nextPendingPatches,
    },
  };

  return response(200, changedResult('session_started', '已创建当前训练。', patchResult?.warnings || []), nextData);
};

const applyActiveSessionPatchesMutation = (source: AppData, request: SessionMutationRequest): SessionMutationResponse => {
  if (!source.activeSession) {
    return response(409, result('conflict', 'no_active_session', '当前没有进行中的训练。'));
  }

  const body = bodyRecord(request);
  const consumedAt = nowIso(request);
  const pendingPatchId = stringField(body, 'pendingPatchId');
  const pendingPatch = pendingPatchId ? pendingPatchesOf(source).find((patch) => patch.id === pendingPatchId) : undefined;
  if (pendingPatchId && !pendingPatch) {
    return response(404, result('not_found', 'pending_patch_not_found', '找不到要应用的本次训练调整。'));
  }

  const patches = pendingPatch ? pendingPatch.patches || [] : sessionPatchesFromBody(body);
  if (!patches.length) {
    return response(200, result('no_change', 'no_change', '没有需要应用的本次训练调整。', { ok: true }));
  }

  const patchResult = applySessionPatches(source.activeSession, patches);
  if (!patchResult.appliedPatches.length) {
    return response(200, result('no_change', 'no_change', '本次训练调整没有产生变化。', { ok: true, warnings: patchResult.warnings }));
  }

  const nextPendingPatches = pendingPatch
    ? markPendingSessionPatchConsumed(pendingPatchesOf(source), pendingPatch.id, consumedAt)
    : pendingPatchesOf(source);
  const nextData: AppData = {
    ...source,
    activeSession: patchResult.session,
    pendingSessionPatches: nextPendingPatches,
    settings: {
      ...source.settings,
      pendingSessionPatches: nextPendingPatches,
    },
  };

  return response(200, changedResult('session_patches_applied', '已应用本次训练调整。', patchResult.warnings), nextData);
};

const completeActiveSessionMutation = (source: AppData, request: SessionMutationRequest): SessionMutationResponse => {
  if (!source.activeSession) {
    return response(409, result('conflict', 'no_active_session', '当前没有进行中的训练。'));
  }

  const body = bodyRecord(request);
  const finishedAt = nowIso(request);
  const incompleteGuard = buildIncompleteMainWorkGuard(source.activeSession);
  if (incompleteGuard.hasIncompleteMainWork && !booleanField(body, 'confirmIncompleteMainWork')) {
    return response(
      409,
      result('requires_confirmation', 'incomplete_main_work_requires_confirmation', '仍有未完成主训练，需要确认后结束。', {
        requiresConfirmation: true,
      }),
    );
  }

  const completion = completeTrainingSessionIntoHistory(source, finishedAt, {
    endedEarly: incompleteGuard.hasIncompleteMainWork,
  });
  if (!completion.session) {
    return response(200, result('no_change', 'no_change', '没有需要完成的训练。', { ok: true }));
  }

  return response(200, changedResult('session_completed', '已完成并保存本次训练。'), completion.data);
};

const discardActiveSessionMutation = (source: AppData, request: SessionMutationRequest): SessionMutationResponse => {
  if (!source.activeSession) {
    return response(409, result('conflict', 'no_active_session', '当前没有进行中的训练。'));
  }

  if (!booleanField(bodyRecord(request), 'confirmDiscard')) {
    return response(
      409,
      result('requires_confirmation', 'discard_requires_confirmation', '放弃当前训练需要确认。', {
        requiresConfirmation: true,
      }),
    );
  }

  return response(
    200,
    changedResult('session_discarded', '已放弃当前训练。'),
    {
      ...source,
      activeSession: null,
    },
  );
};

export const handleSessionMutationRequest = (data: AppData, request: SessionMutationRequest): SessionMutationResponse => {
  const source = clone(data);

  if (request.method !== 'POST') {
    return response(405, result('unsupported', 'unsupported_route', 'Session mutation API only supports POST requests.'));
  }

  if (request.path === '/sessions/start') return startSessionMutation(source, request);
  if (request.path === '/sessions/active/patches') return applyActiveSessionPatchesMutation(source, request);
  if (request.path === '/sessions/active/complete') return completeActiveSessionMutation(source, request);
  if (request.path === '/sessions/active/discard') return discardActiveSessionMutation(source, request);

  return response(404, result('unsupported', 'unsupported_route', 'Session mutation route not found.'));
};
