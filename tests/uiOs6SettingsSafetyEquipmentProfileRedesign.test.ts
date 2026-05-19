import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS 6 Settings Safety Equipment Profile redesign', () => {
  const profileSource = read('src/features/ProfileView.tsx');
  const controlCenterSource = read('src/uiOs/settings/SettingsControlCenter.tsx');
  const equipmentPanelSource = read('src/uiOs/settings/EquipmentProfileSettingsPanel.tsx');

  it('adds UI-OS settings surfaces without replacing existing settings behavior', () => {
    for (const marker of ['SettingsControlCenter', 'ThemeSettingsPanel', 'BackupRecoverySettingsPanel', 'EquipmentProfileSettingsPanel']) {
      expect(profileSource).toContain(marker);
    }
    expect(controlCenterSource).toContain('个人控制中心');
    expect(controlCenterSource).toContain('SafetyStrip');
    expect(profileSource).toContain('onUpdateUnitSettings');
    expect(profileSource).toContain('downloadBackup');
    expect(profileSource).toContain('handleImportFile');
    expect(profileSource).toContain('HealthDataPanel');
  });

  it('renders the required owner-only settings groups', () => {
    const combined = `${profileSource}\n${controlCenterSource}\n${read('src/uiOs/settings/ThemeSettingsPanel.tsx')}\n${read('src/uiOs/settings/BackupRecoverySettingsPanel.tsx')}\n${read('src/uiOs/settings/EmergencyLocalSettingsPanel.tsx')}\n${read('src/uiOs/settings/EquipmentProfileSettingsPanel.tsx')}\n${read('src/uiOs/settings/CloudCandidateSettingsPanel.tsx')}\n${read('src/uiOs/settings/DiagnosticsDataSafetyPanel.tsx')}\n${read('src/uiOs/settings/AboutDataSafetyPanel.tsx')}`;
    for (const expected of [
      '应用偏好',
      '备份与恢复',
      '紧急本地模式',
      '器械档案',
      '云端候选',
      '诊断',
      '关于与数据安全',
    ]) {
      expect(combined).toContain(expected);
    }
  });

  it('shows safe equipment profile examples without persisting new settings', () => {
    const source = `${profileSource}\n${equipmentPanelSource}`;
    for (const expected of [
      '奥林匹克杠铃',
      '史密斯机',
      '25 lb',
      '哑铃',
      '每只手',
      '5 lb 一跳',
      '插片器械',
      '按机器插片',
      '挂片器械',
      '注意器械自重',
    ]) {
      expect(source).toContain(expected);
    }
    expect(profileSource).not.toContain('persistEquipmentProfile');
    expect(profileSource).not.toContain('saveEquipmentProfile');
  });

  it('keeps cloud candidate and emergency local copy manual and reversible', () => {
    const combined = `${profileSource}\n${read('src/engines/settingsSafetySummary.ts')}\n${read('src/uiOs/settings/CloudCandidateSettingsPanel.tsx')}`;
    expect(combined).toContain('云端候选需要手动确认');
    expect(combined).toContain('紧急本地模式可用');
    expect(combined).toContain('不会自动覆盖本地数据');
    expect(combined).toContain('上传候选也需要再次确认');
    for (const forbidden of ['自动同步已启用', '后台同步', '云端已成为默认数据源', '已上传成功', 'SaaS 已上线']) {
      expect(combined).not.toContain(forbidden);
    }
  });
});
