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
  runCloudSyncRealSupabaseAuthActionRuntime,
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
  infoMessage: string | null;
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
    infoMessage: null,
  });
  const [authEmail, setAuthEmail] = React.useState('');
  const publicBrowserEnv = React.useMemo(() => browserEnv ?? readPublicBrowserEnv(), [browserEnv]);
  const readiness = React.useMemo(
    () =>
      providedReadiness ??
      buildSupabaseProjectRuntimeReadinessCheck({
        enabled: true,
        phase20aAuthorization,
        browserEnv: publicBrowserEnv,
        runtimeBoundary,
        serviceRoleKeyPresent: false,
        browserConfig: { publicBrowserConfigOnly: true },
      }),
    [providedReadiness, publicBrowserEnv],
  );
  const runAuthAction = React.useCallback((action: CloudSyncAuthAction) => {
    setAuthActionState((current) => ({
      ...current,
      pendingAction: action,
      errorMessage: null,
      infoMessage: null,
    }));

    void Promise.resolve().then(async () => {
      if (!authAdapter && action === 'sign_in' && !authEmail.trim()) {
        setAuthActionState({
          pendingAction: null,
          authRuntime: null,
          errorMessage: '请输入邮箱。',
          infoMessage: null,
        });
        return;
      }

      const result = authAdapter
        ? buildCloudSyncAuthActionRuntime({
            action,
            readiness,
            adapter: authAdapter,
            userInitiated: true,
            nowIso,
          })
        : await runCloudSyncRealSupabaseAuthActionRuntime({
            action,
            readiness,
            publicConfig: {
              supabaseUrl: publicBrowserEnv.VITE_SUPABASE_URL,
              anonKey: publicBrowserEnv.VITE_SUPABASE_ANON_KEY,
              authCallbackUrl: publicBrowserEnv.VITE_IRONPATH_AUTH_CALLBACK_URL,
              cloudEnvironment: publicBrowserEnv.VITE_IRONPATH_CLOUD_ENVIRONMENT,
            },
            signInEmail: authEmail,
            userInitiated: true,
            nowIso,
          });

      setAuthActionState({
        pendingAction: null,
        authRuntime: result.authRuntime,
        errorMessage: result.errorMessage,
        infoMessage:
          !result.errorMessage && action === 'sign_in' && result.authRuntime.authRuntimeEnabled
            ? '登录链接已发送，请查收邮箱。'
            : !result.errorMessage && action === 'sign_out' && result.authRuntime.status === 'signed_out'
              ? '已退出登录。'
              : null,
      });
    });
  }, [authAdapter, authEmail, nowIso, publicBrowserEnv, readiness]);

  React.useEffect(() => {
    if (authAdapter || runtimeInput.authRuntime || authActionState.authRuntime || readiness.readyFor20C !== true) return;
    let cancelled = false;

    void runCloudSyncRealSupabaseAuthActionRuntime({
      action: 'check_session',
      readiness,
      publicConfig: {
        supabaseUrl: publicBrowserEnv.VITE_SUPABASE_URL,
        anonKey: publicBrowserEnv.VITE_SUPABASE_ANON_KEY,
        authCallbackUrl: publicBrowserEnv.VITE_IRONPATH_AUTH_CALLBACK_URL,
        cloudEnvironment: publicBrowserEnv.VITE_IRONPATH_CLOUD_ENVIRONMENT,
      },
      userInitiated: false,
      nowIso,
    }).then((result) => {
      if (cancelled) return;
      setAuthActionState((current) => ({
        ...current,
        authRuntime: result.authRuntime,
        errorMessage: result.errorMessage,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [authActionState.authRuntime, authAdapter, nowIso, publicBrowserEnv, readiness, runtimeInput.authRuntime]);

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

  const signedIn = sectionProps.authCard?.authStatus === 'signed_in';
  const authCard = sectionProps.authCard
    ? {
        ...sectionProps.authCard,
        infoMessage: authActionState.infoMessage,
        emailInputValue: !authAdapter && !signedIn ? authEmail : undefined,
        onEmailInputChange: !authAdapter && !signedIn ? setAuthEmail : undefined,
      }
    : sectionProps.authCard;

  return <CloudSyncSettingsSection {...sectionProps} authCard={authCard} />;
}
