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
import {
  runProductionFullAcceptanceSync,
  type Phase21iProductionFullAcceptanceGateway,
  type Phase21iProductionFullAcceptanceResult,
} from '../../cloudProduction/productionFullAcceptanceRuntime';
import { exportAppData, getBackupFileName } from '../../storage/backup';
import { validateAppDataSchema } from '../../storage/appDataValidation';
import {
  clearCloudSyncFlowState,
  loadCloudSyncFlowState,
  saveCloudSyncFlowState,
} from '../../storage/localStorageAdapter';
import { buildAppDataSnapshotHash } from '../../cloudProduction/accountBoundaryLocalInventory';
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
  productionSyncGateway?: Phase21iProductionFullAcceptanceGateway<AppData> | null;
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

type ProductionSyncApplyState = {
  pending: boolean;
  result: Phase21iProductionFullAcceptanceResult<AppData> | null;
  message: string | null;
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
  productionSyncGateway,
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
  // Backup / dry-run flow state survives PWA close+reopen via localStorage.
  // We snapshot the appData hash at save time so a stale persisted state is
  // discarded if the user's data has drifted since the last "create backup"
  // press — that prevents silently shipping an outdated backup.
  const appDataSnapshotHashAtMount = React.useMemo(
    () => (appData ? buildAppDataSnapshotHash(appData) : null),
    // Compute once on mount; downstream saves carry the live hash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [localBackupDryRunUiState, setLocalBackupDryRunUiState] = React.useState<LocalBackupDryRunUiState>(() => {
    const persisted = loadCloudSyncFlowState({ expectedAppDataSnapshotHash: appDataSnapshotHashAtMount });
    return {
      backupJson: persisted.backupJson,
      backupExportConfirmed: persisted.backupExportConfirmed,
      dryRunRequested: persisted.dryRunRequested,
    };
  });
  const [productionSyncApplyState, setProductionSyncApplyState] = React.useState<ProductionSyncApplyState>({
    pending: false,
    result: null,
    message: null,
  });
  const [authEmail, setAuthEmail] = React.useState('');
  const [authPassword, setAuthPassword] = React.useState('');
  const [authMode, setAuthMode] = React.useState<CloudAuthMode>('sign_in');
  const publicBrowserEnv = React.useMemo(() => browserEnv ?? readPublicBrowserEnv(), [browserEnv]);
  const publicConfig = React.useMemo(
    () => ({
      supabaseUrl: publicBrowserEnv.VITE_SUPABASE_URL,
      anonKey: publicBrowserEnv.VITE_SUPABASE_ANON_KEY,
      authCallbackUrl: publicBrowserEnv.VITE_IRONPATH_AUTH_CALLBACK_URL,
      cloudEnvironment: publicBrowserEnv.VITE_IRONPATH_CLOUD_ENVIRONMENT,
    }),
    [publicBrowserEnv],
  );
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
            publicConfig,
            signInEmail: authEmail,
            password: authPassword,
            userInitiated: true,
            nowIso,
          });

      if ((action === 'sign_in' || action === 'sign_up') && result.authRuntime.authenticated) {
        setAuthPassword('');
      }

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
  }, [authAdapter, authEmail, authPassword, nowIso, publicConfig, readiness]);

  React.useEffect(() => {
    if (authAdapter || runtimeInput.authRuntime || authActionState.authRuntime || readiness.readyFor20C !== true) return;
    let cancelled = false;

    void runCloudSyncRealSupabaseAuthActionRuntime({
      action: 'check_session',
      readiness,
      publicConfig: {
        supabaseUrl: publicConfig.supabaseUrl,
        anonKey: publicConfig.anonKey,
        authCallbackUrl: publicConfig.authCallbackUrl,
        cloudEnvironment: publicConfig.cloudEnvironment,
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
  }, [authActionState.authRuntime, authAdapter, nowIso, publicConfig, readiness, runtimeInput.authRuntime]);

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
    setProductionSyncApplyState({
      pending: false,
      result: null,
      message: null,
    });
    // Sign-out is the explicit "forget the backup flow" signal — wipe the
    // persisted copy so the next sign-in starts from a clean slate rather
    // than rehydrating someone else's confirmation.
    clearCloudSyncFlowState();
  }, [authRuntime?.authenticated]);

  // Persist backup / dry-run flow state every time it changes. The hash we
  // store comes from the *current* AppData so subsequent mounts can detect
  // drift and reset the confirmation if the user has trained / edited data
  // since pressing "创建备份".
  React.useEffect(() => {
    if (!appData) return;
    const hash = buildAppDataSnapshotHash(appData);
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: localBackupDryRunUiState.backupExportConfirmed,
        dryRunRequested: localBackupDryRunUiState.dryRunRequested,
        backupJson: localBackupDryRunUiState.backupJson,
      },
      { appDataSnapshotHash: hash, nowIso },
    );
  }, [
    appData,
    localBackupDryRunUiState.backupExportConfirmed,
    localBackupDryRunUiState.dryRunRequested,
    localBackupDryRunUiState.backupJson,
    nowIso,
  ]);

  // Clear any stale "发现冲突 / 恢复本地模式" process notice when the user
  // re-enters the cloud-sync panel with a freshly ready backup. Without this,
  // a single failed enable-sync attempt would leave the warning pill on the
  // screen forever and the toggle would *look* dead even after the user re-
  // backed up and the underlying hash-parity bug had been fixed.
  React.useEffect(() => {
    if (productionSyncApplyState.pending) return;
    if (productionSyncApplyState.message == null) return;
    if (localBackupDryRunUi?.backupReady !== true) return;
    if (productionSyncApplyState.result?.ok === true) return;
    setProductionSyncApplyState((current) =>
      current.pending ? current : { pending: false, result: null, message: null },
    );
  }, [
    localBackupDryRunUi?.backupReady,
    productionSyncApplyState.message,
    productionSyncApplyState.pending,
    productionSyncApplyState.result?.ok,
  ]);

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

  const handleEnableProductionSync = React.useCallback(() => {
    if (!appData || !authRuntime || !localBackupDryRunUi || productionSyncApplyState.pending) return;

    setProductionSyncApplyState({
      pending: true,
      result: null,
      message: '正在开启同步',
    });

    void runProductionFullAcceptanceSync<AppData>({
      enabled: true,
      readiness,
      authRuntime,
      publicConfig,
      appData,
      localBackupDryRunUi,
      gateway: productionSyncGateway ?? null,
      schemaValidator: (candidate) => Boolean(validateAppDataSchema(candidate)),
      nowIso,
    }).then((result) => {
      setProductionSyncApplyState({
        pending: false,
        result,
        message: result.ok ? null : result.userMessage,
      });
    }).catch(() => {
      setProductionSyncApplyState({
        pending: false,
        result: null,
        message: '恢复本地模式',
      });
    });
  }, [
    appData,
    authRuntime,
    localBackupDryRunUi,
    nowIso,
    productionSyncApplyState.pending,
    productionSyncGateway,
    publicConfig,
    readiness,
  ]);

  const handleUseLocalMode = React.useCallback(() => {
    setProductionSyncApplyState((current) => ({
      ...current,
      pending: false,
      message: '恢复本地模式',
    }));
  }, []);

  const handleRetryCloud = React.useCallback(() => {
    setProductionSyncApplyState((current) => ({
      ...current,
      message: null,
    }));
  }, []);

  const onCreateBackup = runtimeInput.onCreateBackup ?? (appData ? handleCreateLocalBackup : undefined);
  const onStartDryRun = runtimeInput.onStartDryRun ?? (appData ? handleStartLocalDryRun : undefined);
  const onEnableSync = runtimeInput.onEnableSync ??
    (appData && !productionSyncApplyState.pending ? handleEnableProductionSync : undefined);
  const syncRuntime = productionSyncApplyState.result?.syncRuntime ?? runtimeInput.syncRuntime;
  const productionNotice = productionSyncApplyState.pending
    ? productionSyncApplyState.message
    : productionSyncApplyState.result?.ok === false
      ? productionSyncApplyState.result.userMessage
      : productionSyncApplyState.message;

  const sectionProps = React.useMemo(
    () => {
      const props = buildCloudSyncSettingsSectionPropsFromRuntime({
        ...runtimeInput,
        syncRuntime,
        readiness,
        authRuntime,
        authActionPending,
        authErrorMessage,
        syncPreflight,
        localBackupDryRunUi,
        onEnableSync,
        onCreateBackup,
        onStartDryRun,
        onSignIn: handleSignIn,
        onSignUp: handleSignUp,
        onSignOut: handleSignOut,
        onUseLocal: runtimeInput.onUseLocal ?? handleUseLocalMode,
        onRetryCloud: runtimeInput.onRetryCloud ?? handleRetryCloud,
      });

      if (!productionNotice || !props.syncStatus) return props;
      return {
        ...props,
        syncStatus: {
          ...props.syncStatus,
          warnings: [productionNotice, ...(props.syncStatus.warnings ?? [])],
        },
      };
    },
    [
      authActionPending,
      authErrorMessage,
      authRuntime,
      handleRetryCloud,
      handleSignIn,
      handleSignOut,
      handleSignUp,
      handleUseLocalMode,
      localBackupDryRunUi,
      onEnableSync,
      onCreateBackup,
      onStartDryRun,
      productionNotice,
      readiness,
      runtimeInput,
      syncRuntime,
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
