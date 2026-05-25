import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R8.2 density and duplicate ownership regression', () => {
  it('keeps Today within the final product ownership budget', () => {
    const source = read('src/features/TodayView.tsx');
    const primaryFlow = source.slice(source.indexOf('<TodayDecisionHero'), source.indexOf('data-today-secondary-details="collapsed"'));

    expect(primaryFlow).toContain('TodayDecisionHero');
    expect(primaryFlow).toContain('data-today-training-preview="concise"');
    expect(primaryFlow).not.toContain('RecommendationExplanationPanel');
    expect(primaryFlow).not.toContain('DataHealthClarityPanel');
    expect(primaryFlow).not.toContain('CoachActionList');
    expect(primaryFlow).not.toContain('查看下次训练');
    expect(primaryFlow).not.toContain('今日自动调整');
    expect((primaryFlow.match(/TodayDecisionHero/g) || []).length).toBe(1);
  });

  it('keeps low-priority Today detail collapsed and compact', () => {
    const source = read('src/features/TodayView.tsx');
    const detailSource = source.slice(source.indexOf('data-today-secondary-details="collapsed"'), source.indexOf('data-today-status-controls="collapsed"'));

    expect(detailSource).toContain('RecommendationExplanationPanel');
    expect(detailSource).toContain('maxVisibleFactors={2}');
    expect(detailSource).toContain('data-today-confidence-density="compact"');
    expect(detailSource).toContain('data-today-coach-actions-density="collapsed-compact"');
    expect(detailSource).not.toContain('完整动作指导');
  });

  it('keeps Settings top-level sections short and details secondary', () => {
    const profile = read('src/features/ProfileView.tsx');
    const navigation = read('src/uiOs/settings/SettingsNavigationStack.tsx');
    const settings = read('src/uiOs/settings/EquipmentProfileSettingsPanel.tsx') + read('src/uiOs/settings/DiagnosticsDataSafetyPanel.tsx');

    expect(profile).toContain('groups={settingsGroups}');
    expect(profile).toContain("id: 'health_data'");
    expect(profile).toContain("id: 'training_suggestions'");
    expect(navigation).toContain('data-settings-row={item.id}');
    expect(navigation).toContain('data-settings-detail-content={detailItem.id}');
    expect(settings).toContain('data-settings-equipment-compact-rows="true"');
    expect(settings).toContain('data-settings-diagnostics-details="collapsed"');
  });

  it('keeps Settings copy minimal while preserving operation rows', () => {
    const profile = read('src/features/ProfileView.tsx');
    const navigation = read('src/uiOs/settings/SettingsNavigationStack.tsx');
    const sync = read('src/cloudSync/CloudSyncSettingsSection.tsx') + read('src/uiOs/settings/cloudSyncRuntimeSettingsAdapter.ts');
    const settingsPanels =
      read('src/uiOs/settings/BackupRecoverySettingsPanel.tsx') +
      read('src/uiOs/settings/EmergencyLocalSettingsPanel.tsx') +
      read('src/uiOs/settings/CloudCandidateSettingsPanel.tsx') +
      read('src/uiOs/settings/AboutDataSafetyPanel.tsx') +
      read('src/uiOs/settings/DiagnosticsDataSafetyPanel.tsx') +
      read('src/uiOs/settings/EquipmentProfileSettingsPanel.tsx');

    expect(profile).toContain("title: '账号与同步'");
    expect(profile).toContain("title: '检查本地数据'");
    expect(profile).toContain("title: '恢复本地模式'");
    expect(profile).toContain("title: '备份'");
    expect(profile).not.toContain('subtitle:');
    expect(profile).not.toContain('集中查看待处理');
    expect(profile).not.toContain('低频配置集中在设置页');
    expect(navigation).not.toContain('summary.summaryExplanation');
    expect(navigation).not.toContain('{detailItem.subtitle');
    expect(sync).not.toContain('本地数据仍会保留，本地训练记录不会被覆盖；冲突可保留本地。');
    expect(sync).not.toContain('账号同步');
    expect(sync).not.toContain('云端同步');
    expect(settingsPanels).not.toContain('本地数据是默认来源');
    expect(settingsPanels).not.toContain('云端候选需要手动确认');
    expect(settingsPanels).not.toContain('只做查看，不改变本地数据');
    expect(settingsPanels).not.toContain('先导出备份，再进行恢复。恢复会覆盖当前浏览器里的 IronPath 数据，请先确认备份。');
  });

  it('does not duplicate primary ownership copy across Today Focus and Settings', () => {
    const today = read('src/features/TodayView.tsx');
    const focus = read('src/features/TrainingFocusView.tsx');
    const settings = read('src/uiOs/settings/CloudCandidateSettingsPanel.tsx') + read('src/features/ProfileView.tsx');

    expect((today.match(/<SafetyStrip/g) || []).length).toBe(1);
    expect((today.match(/<TodayDecisionHero/g) || []).length).toBe(1);
    expect((focus.match(/完成一组/g) || []).length).toBeLessThanOrEqual(1);
    expect(settings).not.toContain('只做查看，不改变本地数据');
    expect(settings).not.toContain('自动覆盖');
  });
});
