import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildSettingsSafetySummary } from '../src/engines/settingsSafetySummary';
import { SettingsControlCenter } from '../src/uiOs/settings/SettingsControlCenter';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('SettingsControlCenter', () => {
  it('renders safety summary local-first copy and children', () => {
    const summary = buildSettingsSafetySummary({
      backupStatus: 'ready',
      emergencyLocalAvailable: true,
      sourceOfTruthClear: true,
      dataHealthOverallState: 'healthy',
      equipmentProfileCoverage: 'complete',
      acceptedMutationRouteCount: 7,
      hasBlockedRoutes: true,
      personalOnlyMode: true,
      cloudSyncEnabled: false,
      automaticWorkerEnabled: false,
    });
    const markup = renderToStaticMarkup(
      <SettingsControlCenter summary={summary}>
        <section>child settings panel</section>
      </SettingsControlCenter>,
    );
    const visible = text(markup);

    expect(visible).toContain('个人控制中心');
    expect(visible).toContain('本地优先正常');
    expect(visible).toContain('本地数据是默认来源');
    expect(visible).toContain('继续使用本地数据');
    expect(visible).toContain('child settings panel');
  });

  it('renders iOS-style grouped navigation when groups are supplied', () => {
    const summary = buildSettingsSafetySummary({
      backupStatus: 'ready',
      emergencyLocalAvailable: true,
      sourceOfTruthClear: true,
      dataHealthOverallState: 'healthy',
      equipmentProfileCoverage: 'complete',
      acceptedMutationRouteCount: 7,
      hasBlockedRoutes: true,
      personalOnlyMode: true,
      cloudSyncEnabled: false,
      automaticWorkerEnabled: false,
    });
    const markup = renderToStaticMarkup(
      <SettingsControlCenter
        summary={summary}
        groups={[
          {
            id: 'account',
            title: '账号',
            items: [
              {
                id: 'cloud_sync',
                title: '账号与同步',
                subtitle: '本地数据仍会保留',
                value: '未开启',
                icon: <span />,
                content: <section>sync detail</section>,
              },
              {
                id: 'backup_recovery',
                title: '备份与恢复',
                subtitle: '开启前先备份',
                icon: <span />,
                content: <section>backup detail</section>,
              },
            ],
          },
        ]}
        initialSectionId="backup_recovery"
      />,
    );
    const visible = text(markup);

    expect(markup).toContain('data-settings-navigation-stack');
    expect(markup).toContain('data-settings-row="cloud_sync"');
    expect(markup).toContain('data-settings-detail-content="backup_recovery"');
    expect(visible).toContain('账号与同步');
    expect(visible).toContain('备份与恢复');
    expect(visible).toContain('backup detail');
  });
});
