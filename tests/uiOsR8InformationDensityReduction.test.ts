import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R8 information density reduction', () => {
  it('keeps History calendar and frequency before recent sessions', () => {
    const recordSource = read('src/features/RecordView.tsx');
    const historySurface = recordSource.slice(recordSource.indexOf('aria-label="History calendar-first surface"'));

    expect(historySurface.indexOf('HistoryFrequencySummary')).toBeLessThan(historySurface.indexOf('TrainingFrequencyCalendar'));
    expect(historySurface.indexOf('TrainingFrequencyCalendar')).toBeLessThan(historySurface.indexOf('RecentTrainingTimeline'));
    expect(historySurface.indexOf('PrErmQuickAccessCards')).toBeLessThan(historySurface.indexOf('RecentTrainingTimeline'));
  });

  it('keeps Progress strength trend and PR e1RM before recovery pressure and raw supporting analytics', () => {
    const recordSource = read('src/features/RecordView.tsx');
    const statsSurface = recordSource.slice(recordSource.indexOf('const renderStats'));

    expect(statsSurface.indexOf('ProgressInsightHero')).toBeLessThan(statsSurface.indexOf('StrengthTrendCards'));
    expect(statsSurface.indexOf('StrengthTrendCards')).toBeLessThan(statsSurface.indexOf('ReadinessPressureCard'));
    expect(statsSurface.indexOf('ReadinessPressureCard')).toBeLessThan(statsSurface.indexOf('<MetricCard label="本月训练"'));
  });

  it('keeps Settings grouped summaries first and low-frequency maintenance behind navigation detail', () => {
    const profileSource = read('src/features/ProfileView.tsx');
    const navigationSource = read('src/uiOs/settings/SettingsNavigationStack.tsx');

    expect(profileSource).toContain('groups={settingsGroups}');
    expect(navigationSource).toContain('data-settings-navigation-stack');
    expect(navigationSource).toContain('data-settings-navigation-list');
    expect(navigationSource).toContain('data-settings-navigation-detail');
    expect(profileSource.indexOf("id: 'cloud_sync'")).toBeLessThan(profileSource.indexOf("id: 'backup_recovery'"));
    expect(profileSource.indexOf("id: 'backup_recovery'")).toBeLessThan(profileSource.indexOf("id: 'health_data'"));
    expect(profileSource.indexOf("id: 'health_data'")).toBeLessThan(profileSource.indexOf('<HealthDataPanel'));
  });

  it('keeps cloud candidate manual and avoids casual sync buttons', () => {
    const cloudSource = read('src/uiOs/settings/CloudCandidateSettingsPanel.tsx');

    expect(cloudSource).toContain('需要手动确认');
    expect(cloudSource).toContain('读取候选');
    expect(cloudSource).toContain('查看');
    expect(cloudSource).not.toContain('只做查看，不改变本地数据');
    expect(cloudSource).not.toContain('自动覆盖');
    expect(cloudSource).not.toContain('一键同步');
    expect(cloudSource).not.toContain('同步全部');
  });
});
