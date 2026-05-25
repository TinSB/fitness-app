import React from 'react';
import { CloudSyncSettingsSection, type CloudAuthMode } from '../../cloudSync';
import { downloadText } from '../../engines/analytics';
import type { AppData } from '../../models/training-model';
import {
  buildSupabaseProjectRuntimeReadinessCheck,
  type Phase20bEnvRecord,
  type Phase20bSupabaseProjectRuntimeReadinessResult,
} from '../../cloudProduction/supabaseProjectRuntimeReadinessCheck';
import { buildExplicitOptInSyncPreflight } from '../../cloudProduction/explicitOptInSyncPreflight';
import {
  buildLocalBackupDryRunUi,
  type Phase21bLocalBackupDryRunUiResult,
} from '../../cloudProduction/localBackupDryRunUi';
import { exportAppData, getBackupFileName } from '../../storage/backup';
import { validateAppDataSchema } from '../../storage/appDataValidation';
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
  appData?: AppData | null;
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

type LocalBackupDryRunUiState = {
  backupJson: string | null;
  backupExportConfirmed: boolean;
  dryRunRequested: boolean;
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

const syncPreflightBoundary = {
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
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
  appData,
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
  const [localBackupDryRunUiState, setLocalBackupDryRunUiState] = React.useState<LocalBackupDryRunUiState>({
    backupJson: null,
    backupExportConfirmed: false,
    dryRunRequested: false,
  });
  const [authEmail, setAuthEmail] = React.useState('');
  const [authPassword, setAuthPassword] = React.useState('');
  const [authMode, setAuthMode] = React.useState<CloudAuthMode>('sign_in');
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
      if (!authAdapter && (action === 'sign_in' || action === 'sign_up') && !authEmail.trim()) {
        setAuthActionState({
          pendingAction: null,
          authRuntime: null,
          errorMessage: '请输入邮箱。',
          infoMessage: null,
        });
        return;
      }

      if (!authAdapter && (action === 'sign_in' || action === 'sign_up') && !authPassword.trim()) {
        setAuthActionState({
          pendingAction: null,
          authRuntime: null,
          errorMessage: '请输入密码。',
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
            password: authPassword,
            userInitiated: true,
            nowIso,
          });

      setAuthActionState({
        pendingAction: null,
        authRuntime: result.authRuntime,
        errorMessage: result.errorMessage,
        infoMessage:
          !result.errorMessage && (action === 'sign_in' || action === 'sign_up') && result.authRuntime.authenticated
            ? '已登录。'
            : !result.errorMessage && action === 'sign_out' && result.authRuntime.status === 'signed_out'
              ? '已退出登录。'
              : null,
      });
    });
  }, [authAdapter, authEmail, authPassword, nowIso, publicBrowserEnv, readiness]);

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

  const handleSignUp = React.useCallback(() => {
    if (runtimeInput.onSignUp) {
      runtimeInput.onSignUp();
      return;
    }
    runAuthAction('sign_up');
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
  const syncPreflight = React.useMemo(
    () =>
      runtimeInput.syncPreflight ??
      buildExplicitOptInSyncPreflight({
        enabled: true,
        readiness,
        authRuntime,
        runtimeBoundary: syncPreflightBoundary,
        nowIso,
      }),
    [authRuntime, nowIso, readiness, runtimeInput.syncPreflight],
  );
  const localBackupDryRunUi = React.useMemo<Phase21bLocalBackupDryRunUiResult | null>(() => {
    if (runtimeInput.localBackupDryRunUi) return runtimeInput.localBackupDryRunUi;
    if (!appData) return null;

    return buildLocalBackupDryRunUi({
      enabled: true,
      preflight: syncPreflight,
      appData,
      backupJson: localBackupDryRunUiState.backupJson,
      backupExportConfirmed: localBackupDryRunUiState.backupExportConfirmed,
      dryRunRequested: localBackupDryRunUiState.dryRunRequested,
      schemaValidator: (candidate) => Boolean(validateAppDataSchema(candidate)),
      runtimeBoundary: syncPreflightBoundary,
      nowIso,
    });
  }, [appData, localBackupDryRunUiState, nowIso, runtimeInput.localBackupDryRunUi, syncPreflight]);

  React.useEffect(() => {
    if (authRuntime?.authenticated === true) return;
    setLocalBackupDryRunUiState({
      backupJson: null,
      backupExportConfirmed: false,
      dryRunRequested: false,
    });
  }, [authRuntime?.authenticated]);

  const handleCreateLocalBackup = React.useCallback(() => {
    if (!appData || syncPreflight.readyFor21B !== true) return;

    const backupJson = exportAppData(appData);
    const date = nowIso ? new Date(nowIso) : new Date();
    downloadText(getBackupFileName(date), backupJson, 'application/json');
    setLocalBackupDryRunUiState({
      backupJson,
      backupExportConfirmed: true,
      dryRunRequested: false,
    });
  }, [appData, nowIso, syncPreflight.readyFor21B]);

  const handleStartLocalDryRun = React.useCallback(() => {
    setLocalBackupDryRunUiState((current) => ({
      ...current,
      dryRunRequested: true,
    }));
  }, []);
  const onCreateBackup = runtimeInput.onCreateBackup ?? (appData ? handleCreateLocalBackup : undefined);
  const onStartDryRun = runtimeInput.onStartDryRun ?? (appData ? handleStartLocalDryRun : undefined);

  const sectionProps = React.useMemo(
    () =>
      buildCloudSyncSettingsSectionPropsFromRuntime({
        ...runtimeInput,
        readiness,
        authRuntime,
        authActionPending,
        authErrorMessage,
        syncPreflight,
        localBackupDryRunUi,
        onCreateBackup,
        onStartDryRun,
        onSignIn: handleSignIn,
        onSignUp: handleSignUp,
        onSignOut: handleSignOut,
      }),
    [
      authActionPending,
      authErrorMessage,
      authRuntime,
      handleSignIn,
      handleSignOut,
      handleSignUp,
      localBackupDryRunUi,
      onCreateBackup,
      onStartDryRun,
      readiness,
      runtimeInput,
      syncPreflight,
    ],
  );

  const signedIn = sectionProps.authCard?.authStatus === 'signed_in';
  const authCard = sectionProps.authCard
    ? {
        ...sectionProps.authCard,
        authMode,
        onAuthModeChange: !authAdapter && !signedIn ? setAuthMode : undefined,
        infoMessage: authActionState.infoMessage,
        emailInputValue: !authAdapter && !signedIn ? authEmail : undefined,
        onEmailInputChange: !authAdapter && !signedIn ? setAuthEmail : undefined,
        passwordInputValue: !authAdapter && !signedIn ? authPassword : undefined,
        onPasswordInputChange: !authAdapter && !signedIn ? setAuthPassword : undefined,
      }
    : sectionProps.authCard;

  return <CloudSyncSettingsSection {...sectionProps} authCard={authCard} />;
}
