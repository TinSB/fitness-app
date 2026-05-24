import {
  resolveAuthEnvironmentCallbackGuard,
  type AuthEnvironmentCallbackGuardResult,
  type AuthEnvironmentCallbackInput,
} from './authEnvironmentCallbackGuard';
import {
  resolveSupabaseEnvironmentProjectGuard,
  type SupabaseProjectGuardInput,
  type SupabaseProjectGuardResult,
} from './supabaseEnvironmentProjectGuard';

export const PHASE19E_AUTH_CLIENT_SKELETON_ID = 'phase19e-auth-client-skeleton-env-guard';

export type Phase19eAuthClientSkeletonStatus =
  | 'disabled'
  | 'environment_rejected'
  | 'ready_candidate';

export type Phase19eAuthClientSkeletonBlockerCode =
  | 'auth_client_disabled'
  | 'supabase_project_rejected'
  | 'auth_callback_rejected'
  | 'auth_runtime_deferred'
  | 'sync_runtime_deferred';

export type Phase19eAuthClientAction =
  | 'get_session'
  | 'sign_in'
  | 'sign_out';

export type Phase19eAuthClientActionStatus =
  | 'disabled'
  | 'unsupported';

export type Phase19eAuthClientActionErrorCode =
  | 'auth_client_disabled'
  | 'auth_runtime_deferred';

export type Phase19eAuthClientSkeletonInput = {
  enabled?: boolean;
  supabaseProject?: SupabaseProjectGuardInput;
  authCallback?: AuthEnvironmentCallbackInput;
};

export type Phase19eAuthClientBrowserSafeConfig = {
  providerCandidate: 'supabase-auth-candidate' | null;
  projectUrl: string | null;
  callbackUrl: string | null;
  anonKeyClassified: 'missing' | 'public_anon_candidate';
  containsSecrets: false;
  serviceRoleExposed: false;
};

export type Phase19eAuthClientActionResult = {
  ok: false;
  action: Phase19eAuthClientAction;
  status: Phase19eAuthClientActionStatus;
  errorCode: Phase19eAuthClientActionErrorCode;
  message: string;
  networkAttempted: false;
  localStorageChanged: false;
  sourceOfTruthChanged: false;
  secretsExposed: false;
};

export type Phase19eAuthClientSkeleton = {
  id: typeof PHASE19E_AUTH_CLIENT_SKELETON_ID;
  phase: '19E';
  status: Phase19eAuthClientSkeletonStatus;
  enabled: boolean;
  clientCandidateReady: boolean;
  clientCreated: false;
  authRuntimeEnabled: false;
  syncRuntimeEnabled: false;
  loginRequired: false;
  networkAttempted: false;
  localStorageChanged: false;
  sourceOfTruthChanged: false;
  serviceRoleExposed: false;
  secretsExposed: false;
  browserSafeConfig: Phase19eAuthClientBrowserSafeConfig;
  guards: {
    supabaseProject: SupabaseProjectGuardResult;
    authCallback: AuthEnvironmentCallbackGuardResult;
  };
  blockers: Phase19eAuthClientSkeletonBlockerCode[];
  getSession: () => Phase19eAuthClientActionResult;
  signIn: () => Phase19eAuthClientActionResult;
  signOut: () => Phase19eAuthClientActionResult;
};

const disabledResult = (action: Phase19eAuthClientAction): Phase19eAuthClientActionResult => ({
  ok: false,
  action,
  status: 'disabled',
  errorCode: 'auth_client_disabled',
  message: 'Auth client skeleton is disabled by default.',
  networkAttempted: false,
  localStorageChanged: false,
  sourceOfTruthChanged: false,
  secretsExposed: false,
});

const deferredResult = (action: Phase19eAuthClientAction): Phase19eAuthClientActionResult => ({
  ok: false,
  action,
  status: 'unsupported',
  errorCode: 'auth_runtime_deferred',
  message: 'Auth runtime remains deferred in Phase 19E.',
  networkAttempted: false,
  localStorageChanged: false,
  sourceOfTruthChanged: false,
  secretsExposed: false,
});

const buildBrowserSafeConfig = (
  projectGuard: SupabaseProjectGuardResult,
  authGuard: AuthEnvironmentCallbackGuardResult,
): Phase19eAuthClientBrowserSafeConfig => ({
  providerCandidate: authGuard.providerCandidate === 'supabase-auth-candidate'
    ? authGuard.providerCandidate
    : null,
  projectUrl: projectGuard.projectUrl,
  callbackUrl: authGuard.callbackUrl,
  anonKeyClassified: projectGuard.anonKeyClassified,
  containsSecrets: false,
  serviceRoleExposed: false,
});

const buildBlockers = (
  inputEnabled: boolean,
  projectGuard: SupabaseProjectGuardResult,
  authGuard: AuthEnvironmentCallbackGuardResult,
): Phase19eAuthClientSkeletonBlockerCode[] => {
  if (!inputEnabled) return ['auth_client_disabled'];

  const blockers: Phase19eAuthClientSkeletonBlockerCode[] = [];
  if (!projectGuard.ok) blockers.push('supabase_project_rejected');
  if (!authGuard.ok) blockers.push('auth_callback_rejected');

  if (blockers.length === 0) {
    blockers.push('auth_runtime_deferred', 'sync_runtime_deferred');
  }

  return blockers;
};

export const buildPhase19eAuthClientSkeleton = (
  input: Phase19eAuthClientSkeletonInput = {},
): Phase19eAuthClientSkeleton => {
  const inputEnabled = input.enabled === true;
  const projectGuard = resolveSupabaseEnvironmentProjectGuard({
    ...input.supabaseProject,
    enabled: inputEnabled && input.supabaseProject?.enabled === true,
  });
  const authGuard = resolveAuthEnvironmentCallbackGuard({
    ...input.authCallback,
    enabled: inputEnabled && input.authCallback?.enabled === true,
  });
  const clientCandidateReady = inputEnabled && projectGuard.ok && authGuard.ok;
  const status: Phase19eAuthClientSkeletonStatus = !inputEnabled
    ? 'disabled'
    : clientCandidateReady
      ? 'ready_candidate'
      : 'environment_rejected';
  const actionResult = status === 'disabled' ? disabledResult : deferredResult;

  return {
    id: PHASE19E_AUTH_CLIENT_SKELETON_ID,
    phase: '19E',
    status,
    enabled: clientCandidateReady,
    clientCandidateReady,
    clientCreated: false,
    authRuntimeEnabled: false,
    syncRuntimeEnabled: false,
    loginRequired: false,
    networkAttempted: false,
    localStorageChanged: false,
    sourceOfTruthChanged: false,
    serviceRoleExposed: false,
    secretsExposed: false,
    browserSafeConfig: buildBrowserSafeConfig(projectGuard, authGuard),
    guards: {
      supabaseProject: projectGuard,
      authCallback: authGuard,
    },
    blockers: buildBlockers(inputEnabled, projectGuard, authGuard),
    getSession: () => actionResult('get_session'),
    signIn: () => actionResult('sign_in'),
    signOut: () => actionResult('sign_out'),
  };
};
