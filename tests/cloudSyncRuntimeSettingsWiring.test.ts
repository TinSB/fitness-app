import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildAuthRuntimeWiring, createSyntheticAuthRuntimeAdapter } from '../src/cloudProduction/authRuntimeWiring';
import type { Phase20dAuthRuntimeLike } from '../src/cloudProduction/explicitOptInSyncRuntimeWiring';
import { buildExplicitOptInSyncRuntimeWiring } from '../src/cloudProduction/explicitOptInSyncRuntimeWiring';
import { buildSupabaseProjectRuntimeReadinessCheck } from '../src/cloudProduction/supabaseProjectRuntimeReadinessCheck';
import type { Phase20eLocalBackupDryRunResult } from '../src/cloudProduction/localBackupDryRunMigrationRuntimeFlow';
import type { Phase20fCloudReadWriteVerificationResult } from '../src/cloudProduction/cloudReadWriteVerificationFlow';
import { CloudSyncPolishSettingsPanel } from '../src/uiOs/settings/CloudSyncPolishSettingsPanel';
import { buildCloudSyncSettingsSectionPropsFromRuntime } from '../src/uiOs/settings/cloudSyncRuntimeSettingsAdapter';
import { CloudSyncSettingsSection } from '../src/cloudSync';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';

const nowIso = '2026-05-24T22:30:00.000Z';

const render = (element: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      UiThemeProvider,
      { value: { selectedThemeMode: 'dark', resolvedTheme: 'dark', focusModeImmersiveDark: true } },
      element,
    ),
  );

const textOnly = (markup: string) => markup.replace(/<[^>]+>/g, '');

const ready20b = () =>
  buildSupabaseProjectRuntimeReadinessCheck({
    enabled: true,
    phase20aAuthorization: {
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
    },
    browserEnv: {
      VITE_SUPABASE_URL: 'https://ironpath-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'synthetic-public-anon-key',
      VITE_IRONPATH_AUTH_CALLBACK_URL: 'http://127.0.0.1:3000/auth/callback',
      VITE_IRONPATH_CLOUD_ENVIRONMENT: 'production',
    },
    runtimeBoundary: {
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    serviceRoleKeyPresent: false,
    browserConfig: { publicBrowserConfigOnly: true },
    nowIso,
  });

const signedInAuth = () =>
  buildAuthRuntimeWiring({
    enabled: true,
    readiness: ready20b(),
    adapter: createSyntheticAuthRuntimeAdapter({
      userId: 'user-1',
      accountId: 'account-1',
      displayName: 'IronPath 账号',
    }),
    action: 'check_session',
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
  });

const signedOutAuth = () =>
  buildAuthRuntimeWiring({
    enabled: true,
    readiness: ready20b(),
    adapter: createSyntheticAuthRuntimeAdapter(null),
    action: 'check_session',
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
  });

const authLike = (): Phase20dAuthRuntimeLike => ({
  readyFor20D: true,
  authRuntimeEnabled: true,
  authenticated: true,
  user: {
    userId: 'user-1',
    accountId: 'account-1',
    displayName: 'IronPath 账号',
  },
  tokenStored: false,
  localStorageChanged: false,
  secretsExposed: false,
  serviceRoleExposed: false,
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
});

const syncOff = () =>
  buildExplicitOptInSyncRuntimeWiring({
    enabled: true,
    authRuntime: authLike(),
    explicitOptIn: false,
    manualConfirmation: false,
    localStorageFallbackConfirmed: true,
    noSilentOverwriteConfirmed: true,
    backupBeforeSyncConfirmed: false,
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
  });

const syncEnabled = () =>
  buildExplicitOptInSyncRuntimeWiring({
    enabled: true,
    authRuntime: authLike(),
    explicitOptIn: true,
    manualConfirmation: true,
    localStorageFallbackConfirmed: true,
    noSilentOverwriteConfirmed: true,
    backupBeforeSyncConfirmed: true,
    runtimeBoundary: {
      syncRuntimeEnabled: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
    },
    nowIso,
  });

const backupReady = (): Phase20eLocalBackupDryRunResult => ({
  backup: {
    status: 'valid',
    checked: true,
    backupSnapshotHash: 'backup-hash',
    matchesCurrentLocal: true,
    generatedInMemory: false,
    exportRequiredBeforeFirstSync: true,
  },
  readyFor20F: true,
  status: 'ready_for_cloud_verification',
  createdAt: nowIso,
} as Phase20eLocalBackupDryRunResult);

const conflictVerification = (): Phase20fCloudReadWriteVerificationResult => ({
  status: 'manual_review_required',
  blockers: ['cloud_read_manual_review'],
  readyFor20G: false,
  createdAt: nowIso,
} as Phase20fCloudReadWriteVerificationResult);

describe('Cloud Sync runtime wiring to Settings UI', () => {
  it('renders signed-out runtime state with all required markers and local-first copy', () => {
    const markup = render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authRuntime: signedOutAuth(),
    }));
    const text = textOnly(markup);

    for (const marker of [
      'ironpath-auth-card',
      'ironpath-sync-status-center',
      'ironpath-first-sync-flow',
      'ironpath-conflict-review',
      'ironpath-offline-recovery',
      'ironpath-account-settings',
    ]) {
      expect(markup).toContain(`data-testid="${marker}"`);
    }
    expect(text).toContain('登录账号');
    expect(text).toContain('创建账号');
    expect(text).toContain('密码');
    expect(text).toContain('未登录');
    expect(markup).toContain('data-testid="ironpath-auth-sign-in"');
    expect(markup).toContain('data-testid="ironpath-auth-password-input"');
    expect(text).toContain('本地数据仍会保留');
    expect(text).toContain('登录后再开启同步');
  });

  it('renders signed-in sync-off state and exposes enable sync only through a provided callback', () => {
    const withoutCallback = textOnly(render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authRuntime: signedInAuth(),
      syncRuntime: syncOff(),
      backupDryRun: backupReady(),
    })));
    const withCallback = textOnly(render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authRuntime: signedInAuth(),
      syncRuntime: syncOff(),
      backupDryRun: backupReady(),
      onEnableSync: () => undefined,
    })));

    expect(withoutCallback).toContain('IronPath 账号');
    expect(withoutCallback).toContain('退出登录');
    expect(withoutCallback).toContain('本地数据仍会保留');
    expect(withoutCallback).not.toContain('开启同步');
    expect(withCallback).toContain('开启同步');
  });

  it('shows backup-required and sync opt-in ready states without running sync automatically', () => {
    const needsBackup = textOnly(render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authRuntime: signedInAuth(),
      syncRuntime: syncOff(),
    })));
    const ready = textOnly(render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authRuntime: signedInAuth(),
      syncRuntime: syncEnabled(),
      backupDryRun: backupReady(),
    })));

    expect(needsBackup).toContain('开启前先备份');
    expect(needsBackup).toContain('备份本地数据');
    expect(ready).toContain('已选择开启');
    expect(ready).toContain('本地数据仍会保留');
    expect(ready).not.toContain('云端优先');
  });

  it('shows conflict review only when safe conflict callback props are supplied', () => {
    const hiddenConflictProps = buildCloudSyncSettingsSectionPropsFromRuntime({
      readiness: ready20b(),
      authRuntime: signedInAuth(),
      syncRuntime: syncEnabled(),
      backupDryRun: backupReady(),
      verificationFlow: conflictVerification(),
    });
    const visibleConflictProps = buildCloudSyncSettingsSectionPropsFromRuntime({
      readiness: ready20b(),
      authRuntime: signedInAuth(),
      syncRuntime: syncEnabled(),
      backupDryRun: backupReady(),
      verificationFlow: conflictVerification(),
      onKeepLocal: () => undefined,
      onUseCloud: () => undefined,
    });

    const hiddenMarkup = render(createElement(CloudSyncSettingsSection, hiddenConflictProps));
    const hiddenText = textOnly(hiddenMarkup);
    const visibleText = textOnly(render(createElement(CloudSyncSettingsSection, visibleConflictProps)));

    expect(hiddenText).toContain('无冲突');
    expect(hiddenMarkup).not.toContain('runtime-conflict-review');
    expect(visibleText).toContain('查看冲突');
    expect(visibleText).toContain('训练记录');
    expect(visibleText).toContain('保留本地');
    expect(visibleText).toContain('使用云端');
  });

  it('shows offline availability when cloud readiness is unavailable', () => {
    const readiness = buildSupabaseProjectRuntimeReadinessCheck({
      enabled: true,
      phase20aAuthorization: {
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
      },
      browserEnv: {},
      runtimeBoundary: {
        authRuntimeEnabled: false,
        syncRuntimeEnabled: false,
        cloudPrimaryEnabled: false,
        defaultSyncEnabled: false,
        backgroundWorkEnabled: false,
        sourceOfTruthChanged: false,
        localStorageDeleted: false,
      },
      serviceRoleKeyPresent: false,
      browserConfig: { publicBrowserConfigOnly: true },
      nowIso,
    });
    const text = textOnly(render(createElement(CloudSyncPolishSettingsPanel, { readiness })));

    expect(text).toContain('暂不可用');
    expect(text).toContain('本地数据仍会保留');
    expect(text).toContain('可以继续正常训练');
  });

  it('does not render forbidden technical destructive or secret copy', () => {
    const text = textOnly(render(createElement(CloudSyncPolishSettingsPanel, {
      readiness: ready20b(),
      authRuntime: signedInAuth(),
      syncRuntime: syncEnabled(),
      backupDryRun: backupReady(),
      verificationFlow: conflictVerification(),
      onKeepLocal: () => undefined,
      onUseCloud: () => undefined,
    })));

    for (const forbidden of [
      '引擎',
      '算法',
      '自动化',
      '模型',
      'AI 教练',
      '系统判断',
      '智能推荐',
      '决策系统',
      '自动同步已开启',
      '云端优先',
      '默认开启',
      '自动覆盖',
      '删除本地数据',
      'service role',
      'API key',
      'token',
      '订阅',
      '付费',
      'billing',
      'admin',
      'coach',
      'team',
      'social',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
