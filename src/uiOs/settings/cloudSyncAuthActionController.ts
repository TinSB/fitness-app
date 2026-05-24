import {
  buildAuthRuntimeWiring,
  type Phase20cAuthAction,
  type Phase20cAuthRuntimeAdapter,
  type Phase20cAuthRuntimeWiringResult,
} from '../../cloudProduction/authRuntimeWiring';
import type { Phase20bSupabaseProjectRuntimeReadinessResult } from '../../cloudProduction/supabaseProjectRuntimeReadinessCheck';

export type CloudSyncAuthAction = Extract<Phase20cAuthAction, 'sign_in' | 'sign_out'>;

export type CloudSyncAuthActionControllerInput = {
  action: CloudSyncAuthAction;
  readiness?: Phase20bSupabaseProjectRuntimeReadinessResult | null;
  adapter?: Phase20cAuthRuntimeAdapter | null;
  userInitiated?: boolean;
  nowIso?: string;
};

export type CloudSyncAuthActionControllerResult = {
  authRuntime: Phase20cAuthRuntimeWiringResult;
  errorMessage: string | null;
  safeBoundaries: {
    tokenStored: false;
    localStorageChanged: false;
    localStorageDeleted: false;
    syncRuntimeEnabled: false;
    liveCloudSyncActivated: false;
    cloudPrimaryEnabled: false;
    defaultSyncEnabled: false;
    backgroundWorkEnabled: false;
    sourceOfTruthChanged: false;
    serviceRoleExposed: false;
    secretsExposed: false;
  };
};

const safeRuntimeBoundary = {
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
};

export const formatCloudSyncAuthActionError = (
  result: Phase20cAuthRuntimeWiringResult | null | undefined,
): string | null => {
  if (!result || result.ok) return null;
  if (result.status === 'readiness_missing') return '登录配置暂不可用。';
  if (result.status === 'user_action_required') return '请先确认操作。';
  if (result.status === 'adapter_failed') return '登录失败，请稍后再试。';
  if (result.status === 'runtime_boundary_unsafe') return '登录已暂停，请先检查设置。';
  return '登录暂不可用。';
};

export const buildCloudSyncAuthActionRuntime = (
  input: CloudSyncAuthActionControllerInput,
): CloudSyncAuthActionControllerResult => {
  const authRuntime = buildAuthRuntimeWiring({
    enabled: true,
    readiness: input.readiness ?? null,
    adapter: input.adapter ?? null,
    action: input.action,
    userInitiated: input.userInitiated === true,
    runtimeBoundary: safeRuntimeBoundary,
    nowIso: input.nowIso,
  });

  return {
    authRuntime,
    errorMessage: formatCloudSyncAuthActionError(authRuntime),
    safeBoundaries: {
      tokenStored: false,
      localStorageChanged: false,
      localStorageDeleted: false,
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      serviceRoleExposed: false,
      secretsExposed: false,
    },
  };
};
