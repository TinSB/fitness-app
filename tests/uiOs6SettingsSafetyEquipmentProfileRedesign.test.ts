import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS 6 Settings Safety Equipment Profile redesign', () => {
  const profileSource = read('src/features/ProfileView.tsx');
  const cardsSource = read('src/uiOs/settings/SettingsOsCards.tsx');

  it('adds UI-OS settings surfaces without replacing existing settings behavior', () => {
    for (const marker of ['SettingsOsHero', 'SettingsOsGroup', 'SettingsOsMiniCard']) {
      expect(cardsSource).toContain(marker);
      expect(profileSource).toContain(marker);
    }
    expect(cardsSource).toContain('bg-[#0a0a0b]');
    expect(cardsSource).toContain('rounded-[28px]');
    expect(profileSource).toContain('onUpdateUnitSettings');
    expect(profileSource).toContain('downloadBackup');
    expect(profileSource).toContain('handleImportFile');
    expect(profileSource).toContain('HealthDataPanel');
  });

  it('renders the required owner-only settings groups', () => {
    for (const expected of [
      'Units',
      'Backup / Recovery',
      'Emergency Local Mode',
      'Equipment Profiles',
      'Cloud Candidate',
      'Diagnostics',
      'About / Data Safety',
    ]) {
      expect(profileSource).toContain(expected);
    }
  });

  it('shows safe equipment profile examples without persisting new settings', () => {
    for (const expected of [
      'Olympic bar 45 lb',
      'Smith machine 25 lb',
      '哑铃每只手 / per-hand',
      '5 lb increment',
      'selectorized machine stack / 插片',
      'plate-loaded base/sled warning',
      '器械自重可能未计入',
    ]) {
      expect(profileSource).toContain(expected);
    }
    expect(profileSource).not.toContain('persistEquipmentProfile');
    expect(profileSource).not.toContain('saveEquipmentProfile');
  });

  it('keeps cloud candidate and emergency local copy manual and reversible', () => {
    expect(profileSource).toContain('云端候选：需要手动确认');
    expect(profileSource).toContain('紧急本地模式可用');
    expect(profileSource).toContain('rollback / kill switch 可用');
    expect(profileSource).toContain('cloud pull does not auto-apply');
    expect(profileSource).toContain('cloud push requires manual confirmation');
    expect(profileSource).toContain('explicit opt-in and reversible');
    for (const forbidden of ['自动同步已启用', '后台同步', '云端已成为默认数据源', '已上传成功', 'SaaS 已上线']) {
      expect(profileSource).not.toContain(forbidden);
      expect(cardsSource).not.toContain(forbidden);
    }
  });
});
