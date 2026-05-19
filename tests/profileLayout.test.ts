import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Profile layout', () => {
  const source = readFileSync('src/features/ProfileView.tsx', 'utf8');

  it('uses the responsive product page layout', () => {
    expect(source).toContain("from '../ui/layouts/ResponsivePageLayout'");
    expect(source).toContain('SettingsControlCenter');
  });

  it('acts as the settings center', () => {
    expect(source).toContain('SettingsControlCenter');
    expect(source).toContain('身体 / 动作筛查');
    expect(source).toContain('ThemeSettingsPanel');
    expect(source).toContain('BackupRecoverySettingsPanel');
    expect(source).toContain('EmergencyLocalSettingsPanel');
    expect(source).toContain('EquipmentProfileSettingsPanel');
    expect(source).toContain('CloudCandidateSettingsPanel');
    expect(source).toContain('DiagnosticsDataSafetyPanel');
    expect(source).toContain('HealthDataPanel');
    expect(source).toContain('AboutDataSafetyPanel');
  });

  it('separates global backup restore from training record data management', () => {
    const backupPanelSource = readFileSync('src/uiOs/settings/BackupRecoverySettingsPanel.tsx', 'utf8');
    expect(backupPanelSource).toContain('管理单次训练记录');
    expect(backupPanelSource).toContain('导入恢复');
    expect(source).toContain('BackupRecoverySettingsPanel');
    expect(source).toContain('<ConfirmDialog');
    expect(source).toContain('导入备份？');
    expect(source).toContain('confirmText={restoreConfirmText(pendingRestore.report)}');
    expect(source).toContain('下载修复后的 JSON');
  });

  it('does not become another training or record page', () => {
    expect(source).not.toContain('今日建议');
    expect(source).not.toContain('完成一组');
    expect(source).not.toContain('训练日历');
    expect(source).not.toContain('PR 趋势');
  });
});
