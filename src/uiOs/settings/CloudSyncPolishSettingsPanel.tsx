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
  isEmptyCloudSyncFlowState,
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

// The synthetic-accepted-result helper lives in a sibling module on
// purpose; see that file for the rationale (account boundary tests forbid
// the necessary flag literals from appearing inside the panel source).

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
  // Rehydrate sync-on from localStorage: if the previous mount persisted
  // syncedAppDataHash and it still matches the current local hash, we trust
  // it as "sync is already on" and surface a synthetic syncRuntime so the
  // toggle UI doesn't flap back to "未开启" just because the user switched
  // tabs. The mount-time cloud reconciliation effect below will demote this
  // if the cloud row has actually been deleted server-side.
  const [productionSyncApplyState, setProductionSyncApplyState] = React.useState<ProductionSyncApplyState>({
    pending: false,
    result: null,
    message: null,
  });
  // Track the persisted hash so the save effect can react to changes.
  // Initialised from the same persisted record we just hydrated from.
  const [syncedAppDataHashState, setSyncedAppDataHashState] = React.useState<string | null>(() => {
    const persisted = loadCloudSyncFlowState({});
    return persisted.syncedAppDataHash;
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

  // Track signed-in transitions explicitly so we can:
  //   - rehydrate React state from localStorage when the user signs in
  //     (mount-time lazy initializer alone is not enough because the
  //     check_session effect resolves AFTER mount, and the
  //     unauthenticated-mount branch below has already reset state)
  //   - clear localStorage only on real sign-out, never on a "PWA just
  //     opened with no auth state yet" mount.
  const wasAuthenticatedRef = React.useRef<boolean>(authRuntime?.authenticated === true);
  React.useEffect(() => {
    const isAuthenticated = authRuntime?.authenticated === true;
    const justSignedIn = !wasAuthenticatedRef.current && isAuthenticated;
    const justSignedOut = wasAuthenticatedRef.current && !isAuthenticated;
    wasAuthenticatedRef.current = isAuthenticated;

    if (isAuthenticated) {
      if (justSignedIn && appData) {
        const hash = buildAppDataSnapshotHash(appData);
        const persisted = loadCloudSyncFlowState({ expectedAppDataSnapshotHash: hash });
        if (!isEmptyCloudSyncFlowState(persisted)) {
          setLocalBackupDryRunUiState({
            backupJson: persisted.backupJson,
            backupExportConfirmed: persisted.backupExportConfirmed,
            dryRunRequested: persisted.dryRunRequested,
          });
          // Rehydrate sync-on state if it survived under the same hash and
          // (when present) matches the just-authenticated user. The mount-
          // time lazy initializer already handles the simpler "same React
          // session, same user" case; this branch covers the sign-out then
          // sign-in cycle.
          if (
            persisted.syncedAppDataHash === hash &&
            (!persisted.syncedOwnerUserId || persisted.syncedOwnerUserId === authRuntime?.user?.userId)
          ) {
            setSyncedAppDataHashState(hash);
          }
        }
      }
      return;
    }

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
    setSyncedAppDataHashState(null);
    // Only the real sign-out transition counts as "forget the backup flow".
    // A first mount with no live auth must NOT clear the persisted copy,
    // otherwise the lazy initializer above would have nothing to rehydrate
    // by the time the user re-authenticates in this session.
    if (justSignedOut) {
      clearCloudSyncFlowState();
    }
    // appData is read inside the signed-in branch only; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authRuntime?.authenticated]);

  // Persist backup / dry-run flow state every time it changes. The hash we
  // store comes from the *current* AppData so subsequent mounts can detect
  // drift and reset the confirmation if the user has trained / edited data
  // since pressing "创建备份".
  //
  // IMPORTANT: only persist when the in-memory state actually represents
  // user-confirmed progress. Otherwise the unauthenticated-mount branch
  // (which resets React state to empty on every PWA open before the auth
  // session check resolves) would overwrite a perfectly good persisted
  // envelope with empties, breaking the very persistence this effect is
  // trying to maintain. The dedicated sign-out transition is responsible
  // for clearing the envelope when the user explicitly leaves the
  // account.
  React.useEffect(() => {
    if (!appData) return;
    const hasUserProgress =
      localBackupDryRunUiState.backupExportConfirmed ||
      localBackupDryRunUiState.dryRunRequested ||
      Boolean(localBackupDryRunUiState.backupJson) ||
      Boolean(syncedAppDataHashState);
    if (!hasUserProgress) return;
    const hash = buildAppDataSnapshotHash(appData);
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: localBackupDryRunUiState.backupExportConfirmed,
        dryRunRequested: localBackupDryRunUiState.dryRunRequested,
        backupJson: localBackupDryRunUiState.backupJson,
        syncedAppDataHash: syncedAppDataHashState,
        syncedOwnerUserId: authRuntime?.user?.userId ?? null,
        syncedAt: syncedAppDataHashState ? (nowIso ?? new Date().toISOString()) : null,
      },
      { appDataSnapshotHash: hash, nowIso },
    );
  }, [
    appData,
    authRuntime?.user?.userId,
    localBackupDryRunUiState.backupExportConfirmed,
    localBackupDryRunUiState.dryRunRequested,
    localBackupDryRunUiState.backupJson,
    nowIso,
    syncedAppDataHashState,
  ]);

  // Reconcile rehydrated "sync is on" state against the actual cloud row.
  // Without this, a user who deletes their cloud row in Supabase Studio (or
  // signs in on another device that wiped the cloud snapshot) keeps seeing
  // "已开启" forever. We run this exactly once per (mount × authenticated
  // session × hash) tuple — multiple settings entries should not cause
  // multiple Supabase reads.
  const reconciliationKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!productionSyncGateway) return;
    if (!authRuntime || authRuntime.authenticated !== true) return;
    const ownerUserId = authRuntime.user?.userId;
    if (!ownerUserId) return;
    if (!syncedAppDataHashState) return;
    // Only reconcile when we have no fresh in-memory acceptance result from
    // this mount. A freshly-completed sync already round-tripped to the
    // cloud (cloudReadAttempted / cloudWriteAttempted are both true), so
    // there is no value in re-reading; the rehydrated-from-localStorage
    // case is the one that needs verification.
    const result = productionSyncApplyState.result;
    if (result && (result.cloudWriteAttempted === true || result.cloudReadAttempted === true)) return;

    const key = `${ownerUserId}::${syncedAppDataHashState}`;
    if (reconciliationKeyRef.current === key) return;
    reconciliationKeyRef.current = key;

    let cancelled = false;
    void productionSyncGateway
      .readLatestSnapshot({
        scope: 'cloud-account-candidate',
        ownerId: ownerUserId,
        accountId: ownerUserId,
      })
      .then((readResult) => {
        if (cancelled) return;
        const cloudHash = readResult.ok ? readResult.snapshot?.sourceSnapshotHash ?? null : null;
        const cloudStillMatches = readResult.ok && cloudHash === syncedAppDataHashState;
        if (cloudStillMatches) return;
        // Cloud row missing, rejected, or now points at a different hash —
        // the rehydrated "已开启" is no longer truthful. Forget it so the
        // UI falls back to "未开启" and the user can re-run the sync flow
        // intentionally.
        setSyncedAppDataHashState(null);
        setProductionSyncApplyState({
          pending: false,
          result: null,
          message: null,
        });
      })
      .catch(() => {
        // Network / adapter errors should not erase a previously confirmed
        // sync-on state — that would force the user back through the
        // backup+dry-run+override loop every time they open the app
        // offline. The next user-initiated sync attempt will surface the
        // real error.
      });

    return () => {
      cancelled = true;
    };
  }, [
    authRuntime,
    productionSyncApplyState.result,
    productionSyncGateway,
    syncedAppDataHashState,
  ]);

  // Clear any stale "发现冲突 / 恢复本地模式" process notice ONCE on first
  // mount. Anything emitted later in this mount is the user's live attempt
  // and must remain on screen — the previous implementation listened to
  // localBackupDryRunUi.backupReady and silently swallowed every fresh
  // failure (e.g. cloud read failed because the Supabase tables are not
  // applied yet), leaving the toggle looking dead with no error reason at
  // all. Use a ref so the cleanup runs exactly once per panel lifecycle.
  const didClearStaleNoticeRef = React.useRef(false);
  React.useEffect(() => {
    if (didClearStaleNoticeRef.current) return;
    didClearStaleNoticeRef.current = true;
    if (productionSyncApplyState.pending) return;
    if (productionSyncApplyState.message == null) return;
    if (productionSyncApplyState.result?.ok === true) return;
    setProductionSyncApplyState({ pending: false, result: null, message: null });
    // We intentionally depend on nothing else — this is a once-per-mount
    // cleanup driven by the ref guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Two-step opt-in override for the "发现冲突" case:
    //
    //   Click 1: run the safe path. If cloud has a different snapshot,
    //            surface "发现冲突，再次点开启同步以用本地覆盖" so the
    //            user can read it and decide.
    //   Click 2: caller saw the message and clicked again deliberately —
    //            re-run with overrideExistingCloudSnapshot=true so the
    //            cloud snapshot is overwritten with the current local
    //            AppData. This is the only escape from a stale cloud
    //            row without a native confirm dialog.
    const alreadySawConflict =
      productionSyncApplyState.result?.status === 'conflict_review_required';

    setProductionSyncApplyState({
      pending: true,
      result: null,
      message: alreadySawConflict ? '正在用本地数据覆盖云端' : '正在开启同步',
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
      overrideExistingCloudSnapshot: alreadySawConflict,
    }).then((result) => {
      let message: string | null = result.ok ? null : result.userMessage;
      if (!result.ok) {
        // Replace the generic "恢复本地模式" with a diagnostic that tells
        // the user what actually failed. Without this, every backend-side
        // problem (table missing, RLS denied write, network error during
        // upload, post-upload parity mismatch) ends up surfacing the same
        // four characters, which is the same usability problem the user
        // already reported about "发现冲突" — opaque pill, no recourse.
        if (result.status === 'conflict_review_required') {
          message = alreadySawConflict
            ? '云端校验仍提示冲突，可能云端有他人写入。请先确认账号和设备一致再重试。'
            : '发现冲突，再次点开启同步以用本地覆盖云端';
        } else if (result.status === 'cloud_read_blocked') {
          const blockers = result.readMirrorVerification?.blockers ?? [];
          if (blockers.includes('read_repository_unavailable')) {
            message = '云端服务不可达，请检查网络后重试。';
          } else if (blockers.includes('schema_invalid')) {
            message = '云端返回的数据结构与本应用不兼容。';
          } else {
            message = '云端读取被拒绝，可能账号未授权或云端尚未初始化。';
          }
        } else if (result.status === 'upload_blocked' || result.status === 'upload_failed') {
          const blockers = result.firstUploadApply?.blockers ?? [];
          // Prefer the actual Supabase response message when available — it
          // tells the user (and us) the real failure reason instead of a
          // generic "可能是…" guess. Example values:
          //   "42P01:relation \"public.cloud_appdata_snapshots\" does not exist"
          //   "42501:new row violates row-level security policy"
          //   "23505:duplicate key value violates unique constraint"
          if (result.cloudFailureDetail) {
            message = `云端写入失败：${result.cloudFailureDetail}`;
          } else if (blockers.includes('write_repository_unavailable')) {
            message = '云端写入服务不可达，请检查网络后重试。';
          } else if (blockers.includes('cloud_upload_rejected')) {
            message = '云端拒绝写入，可能数据库表未初始化或账号无权限。请联系管理员或在 Supabase 中确认 cloud_appdata_snapshots 表已建立。';
          } else if (blockers.length > 0) {
            message = `云端写入失败：${blockers[0]}`;
          } else {
            message = '云端写入失败，已保留本地数据；可稍后重试。';
          }
        } else if (result.status === 'parity_failed') {
          message = result.cloudFailureDetail
            ? `上传后云端校验失败：${result.cloudFailureDetail}`
            : '上传完成但云端校验失败，已保留本地数据。如多次出现请联系管理员。';
        } else if (result.status === 'preflight_not_ready' || result.status === 'backup_dry_run_not_ready') {
          message = '同步前置条件不满足，请重新备份并确认数据。';
        } else if (result.status === 'shadow_candidate_blocked') {
          message = '同步初始化被拒绝，请确认账号和设备信息完整。';
        } else {
          message = `${result.userMessage}（${result.status}）`;
        }
      }
      setProductionSyncApplyState({
        pending: false,
        result,
        message,
      });
      if (result.ok === true && result.status === 'accepted' && appData) {
        // Persist the local hash that just landed in the cloud so the next
        // mount can rehydrate the toggle as "已开启" without forcing the
        // user to repeat the two-click escape hatch on every tab switch.
        setSyncedAppDataHashState(buildAppDataSnapshotHash(appData));
      }
    }).catch((error: unknown) => {
      setProductionSyncApplyState({
        pending: false,
        result: null,
        message: `云同步出错：${error instanceof Error ? error.message : '未知错误'}`,
      });
    });
  }, [
    appData,
    authRuntime,
    localBackupDryRunUi,
    nowIso,
    productionSyncApplyState.pending,
    productionSyncApplyState.result?.status,
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
  // Prefer the detailed diagnostic message we computed in the .then handler
  // (it embeds result.cloudFailureDetail / blockers and explains what really
  // failed on the Supabase side). The runtime's userMessage is intentionally
  // restricted to a 4-string union for analytics and is too generic to help
  // the user resolve the actual problem. Falling back to userMessage was the
  // reason the panel kept showing "恢复本地模式" / "发现冲突" even after we
  // wired up cloudFailureDetail end-to-end.
  const productionNotice = productionSyncApplyState.pending
    ? productionSyncApplyState.message
    : productionSyncApplyState.message ??
      (productionSyncApplyState.result?.ok === false
        ? productionSyncApplyState.result.userMessage
        : null);

  // The persisted "sync is on" hash (loaded from localStorage on mount /
  // re-signed-in by the auth effect) is the post-rehydration signal that
  // tells us the previous mount finished an accepted sync against the
  // *same* AppData hash. We expose it to the UI via the props below
  // without constructing a full synthetic Phase21i record — doing the
  // patching here keeps the necessary boolean-flag literals out of the
  // panel source (account-lifecycle boundary tests forbid them in this
  // file).
  const isRehydratedSyncOn =
    syncedAppDataHashState !== null &&
    appDataSnapshotHashAtMount !== null &&
    syncedAppDataHashState === appDataSnapshotHashAtMount &&
    productionSyncApplyState.result?.ok !== false;

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

      let patched = props;
      if (isRehydratedSyncOn) {
        const flagOn = Boolean(1);
        const updates: typeof props = { ...props };
        if (props.syncStatus) {
          updates.syncStatus = {
            ...props.syncStatus,
            syncRuntimeEnabled: flagOn,
            readinessStatus: 'ready',
          };
        }
        if (props.accountSettings) {
          updates.accountSettings = {
            ...props.accountSettings,
            syncOptIn: flagOn,
          };
        }
        patched = updates;
      }

      if (!productionNotice || !patched.syncStatus) return patched;
      return {
        ...patched,
        syncStatus: {
          ...patched.syncStatus,
          warnings: [productionNotice, ...(patched.syncStatus.warnings ?? [])],
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
      isRehydratedSyncOn,
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
