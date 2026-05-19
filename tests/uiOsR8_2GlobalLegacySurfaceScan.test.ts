import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const todaySource = () => read('src/features/TodayView.tsx');
const settingsSources = () =>
  [
    'src/uiOs/settings/SettingsControlCenter.tsx',
    'src/uiOs/settings/ThemeSettingsPanel.tsx',
    'src/uiOs/settings/BackupRecoverySettingsPanel.tsx',
    'src/uiOs/settings/EmergencyLocalSettingsPanel.tsx',
    'src/uiOs/settings/EquipmentProfileSettingsPanel.tsx',
    'src/uiOs/settings/CloudCandidateSettingsPanel.tsx',
    'src/uiOs/settings/DiagnosticsDataSafetyPanel.tsx',
    'src/uiOs/settings/AboutDataSafetyPanel.tsx',
  ]
    .map(read)
    .join('\n');

describe('UI-OS R8.2 global legacy surface scan', () => {
  it('keeps Today free of legacy card modules in the decision/detail path', () => {
    const source = todaySource();
    const primaryFlow = source.slice(source.indexOf('<TodayDecisionHero'), source.indexOf('data-today-secondary-details="collapsed"'));

    for (const forbidden of [
      '<Card',
      '<MetricCard',
      '<PageSection',
      'bg-stone-50',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    for (const forbidden of ['<CoachActionList', '推荐置信度', '今日自动调整', '完整动作指导', '今日提示']) {
      expect(primaryFlow).not.toContain(forbidden);
    }
    expect(source).toContain('data-theme-surface="compact_row"');
    expect(source).toContain('data-today-secondary-details="collapsed"');
  });

  it('puts full Training and Record legacy islands under semantic sweep wrappers', () => {
    expect(read('src/features/TrainingView.tsx')).toContain('data-global-surface-sweep="train"');
    expect(read('src/features/RecordView.tsx')).toContain('data-global-surface-sweep="record"');
    expect(read('src/ui/Card.tsx')).toContain('data-theme-surface');
    expect(read('src/ui/MetricCard.tsx')).toContain('data-theme-surface="compact_row"');
  });

  it('keeps Settings top-level copy owner-facing instead of developer-facing', () => {
    const combined = settingsSources();

    for (const forbidden of [
      'HTTP route',
      'localStorage remains',
      'cloud operation implied',
      'service role',
      'POST /data-health/repair/apply',
      'manual candidate only',
      'full AppData',
      'secrets / tokens',
    ]) {
      expect(combined).not.toContain(forbidden);
    }

    expect(combined).toContain('先导出备份，再进行恢复');
    expect(combined).toContain('诊断摘要不会上传完整训练数据');
    expect(combined).toContain('写入边界已锁定');
  });
});
