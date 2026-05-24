import React from 'react';
import { CloudSyncSettingsSection } from '../../cloudSync';
import {
  buildSupabaseProjectRuntimeReadinessCheck,
  type Phase20bEnvRecord,
  type Phase20bSupabaseProjectRuntimeReadinessResult,
} from '../../cloudProduction/supabaseProjectRuntimeReadinessCheck';
import {
  buildCloudSyncSettingsSectionPropsFromRuntime,
  type CloudSyncSettingsRuntimeInput,
} from './cloudSyncRuntimeSettingsAdapter';
import {
  buildCloudSyncAuthActionRuntime,
  type CloudSyncAuthAction,
} from './cloudSyncAuthActionController';
import type {
  Phase20cAuthRuntimeAdapter,
  Phase20cAuthRuntimeWiringResult,
} from '../../cloudProduction/authRuntimeWiring';

export type CloudSyncPolishSettingsPanelProps = CloudSyncSettingsRuntimeInput & {
  authAdapter?: Phase20cAuthRuntimeAdapter | null;
  browserEnv?: Phase20bEnvRecord | null;
  readiness?: Phase20bSupabaseProjectRuntimeReadinessResult | null;
  nowIso?: string;
};

type LocalAuthActionState = {
  pendingAction: CloudSyncAuthAction | null;
  authRuntime: Phase20cAuthRuntimeWiringResult | null;
  errorMessage: string | null;
};

const phase20aAuthorization = {
  runtimeImplementationAuthorized: true,
  canStart20B: true,
  liveCloudSyncActivated: false,
  authRuntimeEnabled: false,
  syncRuntimeEnabled: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
};

const runtimeBoundary = {
  authRuntimeEnabled: false,
  syncRuntimeEnabled: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
};

const readPublicBrowserEnv = (): Phase20bEnvRecord => ({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_IRONPATH_AUTH_CALLBACK_URL: import.meta.env.VITE_IRONPATH_AUTH_CALLBACK_URL,
  VITE_IRONPATH_CLOUD_ENVIRONMENT: import.meta.env.VITE_IRONPATH_CLOUD_ENVIRONMENT,
});

export function CloudSyncPolishSettingsPanel({
  authAdapter,
  browserEnv,
  readiness: providedReadiness,
  nowIso,
  ...runtimeInput
}: CloudSyncPolishSettingsPanelProps) {
  const [authActionState, setAuthActionState] = React.useState<LocalAuthActionState>({
    pendingAction: null,
    authRuntime: null,
    errorMessage: null,
  });
  const readiness = React.useMemo(
    () =>
      providedReadiness ??
      buildSupabaseProjectRuntimeReadinessCheck({
        enabled: true,
        phase20aAuthorization,
        browserEnv: browserEnv ?? readPublicBrowserEnv(),
        runtimeBoundary,
        serviceRoleKeyPresent: false,
        browserConfig: { publicBrowserConfigOnly: true },
      }),
    [browserEnv, providedReadiness],
  );
  const runAuthAction = React.useCallback((action: CloudSyncAuthAction) => {
    setAuthActionState((current) => ({
      ...current,
      pendingAction: action,
      errorMessage: null,
    }));

    void Promise.resolve().then(() => {
      const result = buildCloudSyncAuthActionRuntime({
        action,
        readiness,
        adapter: authAdapter ?? null,
        userInitiated: true,
        nowIso,
      });

      setAuthActionState({
        pendingAction: null,
        authRuntime: result.authRuntime,
        errorMessage: result.errorMessage,
      });
    });
  }, [authAdapter, nowIso, readiness]);

  const handleSignIn = React.useCallback(() => {
    if (runtimeInput.onSignIn) {
      runtimeInput.onSignIn();
      return;
    }
    runAuthAction('sign_in');
  }, [runAuthAction, runtimeInput]);

  const handleSignOut = React.useCallback(() => {
    if (runtimeInput.onSignOut) {
      runtimeInput.onSignOut();
      return;
    }
    runAuthAction('sign_out');
  }, [runAuthAction, runtimeInput]);

  const authRuntime = authActionState.authRuntime ?? runtimeInput.authRuntime ?? null;
  const authActionPending = authActionState.pendingAction !== null || runtimeInput.authActionPending === true;
  const authErrorMessage = authActionState.errorMessage ?? runtimeInput.authErrorMessage ?? null;

  const sectionProps = React.useMemo(
    () =>
      buildCloudSyncSettingsSectionPropsFromRuntime({
        ...runtimeInput,
        readiness,
        authRuntime,
        authActionPending,
        authErrorMessage,
        onSignIn: handleSignIn,
        onSignOut: handleSignOut,
      }),
    [authActionPending, authErrorMessage, authRuntime, handleSignIn, handleSignOut, readiness, runtimeInput],
  );

  return <CloudSyncSettingsSection {...sectionProps} />;
}
