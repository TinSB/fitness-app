import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AccountSettings,
  CloudAuthCard,
  CloudSyncSettingsSection,
  ConflictReview,
  FirstSyncFlow,
  OfflineRecovery,
  SyncStatusCenter,
} from '../src/cloudSync';
import { UiThemeProvider } from '../src/uiOs/theme/UiThemeProvider';

const render = (element: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      UiThemeProvider,
      { value: { selectedThemeMode: 'dark', resolvedTheme: 'dark', focusModeImmersiveDark: true } },
      element,
    ),
  );

const stripTags = (markup: string) => markup.replace(/<[^>]+>/g, '');

describe('Cloud Sync UI Polish V1 components', () => {
  it('renders all six presentational components with required data-testid markers', () => {
    const markup = [
      render(createElement(CloudAuthCard, { authStatus: 'signed_out' })),
      render(createElement(SyncStatusCenter, { syncRuntimeEnabled: false, readinessStatus: 'not_enabled' })),
      render(createElement(FirstSyncFlow, {
        backupReady: false,
        dryRunReady: false,
        explicitOptIn: false,
        canVerify: false,
      })),
      render(createElement(ConflictReview, {
        conflictCount: 1,
        conflictItems: [{ id: 'conflict-1', field: '训练记录', localValue: '本地', cloudValue: '云端' }],
        selectedResolution: 'review_required',
      })),
      render(createElement(OfflineRecovery, {
        offlineAvailable: true,
        cloudUnavailable: true,
        rollbackAvailable: false,
        emergencyLocalAvailable: true,
      })),
      render(createElement(AccountSettings, {
        accountEmail: null,
        syncOptIn: false,
        localBackupAvailable: false,
      })),
    ].join('\n');

    for (const testId of [
      'ironpath-auth-card',
      'ironpath-sync-status-center',
      'ironpath-first-sync-flow',
      'ironpath-conflict-review',
      'ironpath-offline-recovery',
      'ironpath-account-settings',
    ]) {
      expect(markup).toContain(`data-testid="${testId}"`);
    }
  });

  it('renders Chinese-first safe copy without forbidden technical or destructive wording', () => {
    const text = stripTags(render(createElement(CloudSyncSettingsSection)));

    for (const expected of [
      '登录账号',
      '同步状态',
      '本地数据仍会保留',
      '开启前先备份',
      '不会自动覆盖本地训练记录',
      '查看冲突',
      '保留本地',
      '云端暂不可用',
      '账号设置',
    ]) {
      expect(text).toContain(expected);
    }

    for (const forbidden of [
      '引擎',
      '算法',
      '自动化',
      '模型',
      'AI 教练',
      '系统判断',
      '智能推荐',
      '决策系统',
      'engine',
      'algorithm',
      'automation',
      'model',
      'AI coach',
      'intelligent recommendation',
      'decision system',
      '应用到计划',
      '生成草案',
      '保存建议',
      '同步已开启',
      '默认开启',
      '后台同步',
      '自动上传',
      '自动应用',
      '云端已成为默认',
      '订阅',
      '付费',
      '管理后台',
      '团队',
      '教练',
      '社交',
      'billing',
      'subscription',
      'admin',
      'team',
      'coach',
      'social',
      'service role',
      'token',
      'api key',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('does not render account settings when service-role exposure is reported', () => {
    const markup = render(createElement(AccountSettings, {
      accountEmail: 'person@example.com',
      syncOptIn: false,
      localBackupAvailable: true,
      serviceRoleExposed: true,
    }));

    expect(markup).not.toContain('ironpath-account-settings');
    expect(markup).not.toContain('person@example.com');
  });

  it('renders the Settings preview surface with reachable first sync conflict and offline states', () => {
    const markup = render(createElement(CloudSyncSettingsSection));

    expect(markup).toContain('ironpath-cloud-sync-settings-section');
    expect(markup).toContain('ironpath-auth-card');
    expect(markup).toContain('ironpath-sync-status-center');
    expect(markup).toContain('ironpath-first-sync-flow');
    expect(markup).toContain('ironpath-conflict-review');
    expect(markup).toContain('ironpath-offline-recovery');
    expect(markup).toContain('ironpath-account-settings');
    expect(markup).toContain('查看同步流程预览');
  });
});
