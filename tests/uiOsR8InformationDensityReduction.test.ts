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

  it('keeps Settings grouped summaries first and low-frequency maintenance collapsed', () => {
    const profileSource = read('src/features/ProfileView.tsx');
    const renderSource = profileSource.slice(profileSource.indexOf('<SettingsControlCenter'));

    expect(renderSource.indexOf('<SettingsControlCenter')).toBeLessThan(renderSource.indexOf('ThemeSettingsPanel'));
    expect(renderSource.indexOf('ThemeSettingsPanel')).toBeLessThan(renderSource.indexOf('BackupRecoverySettingsPanel'));
    expect(profileSource).toContain('data-settings-secondary-details="collapsed"');
    expect(renderSource.indexOf('data-settings-secondary-details="collapsed"')).toBeLessThan(renderSource.indexOf('HealthDataPanel'));
  });

  it('keeps cloud candidate manual and avoids casual sync buttons', () => {
    const cloudSource = read('src/uiOs/settings/CloudCandidateSettingsPanel.tsx');

    expect(cloudSource).toContain('需要手动确认');
    expect(cloudSource).toContain('不会自动覆盖本地数据');
    expect(cloudSource).not.toContain('一键同步');
    expect(cloudSource).not.toContain('同步全部');
  });
});
