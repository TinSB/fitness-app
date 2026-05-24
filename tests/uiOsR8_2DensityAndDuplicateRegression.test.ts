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
    const settings = read('src/uiOs/settings/EquipmentProfileSettingsPanel.tsx') + read('src/uiOs/settings/DiagnosticsDataSafetyPanel.tsx');

    expect(profile).toContain('data-settings-secondary-details="collapsed"');
    expect(profile.indexOf('data-settings-secondary-details="collapsed"')).toBeLessThan(profile.lastIndexOf('HealthDataPanel'));
    expect(settings).toContain('data-settings-equipment-compact-rows="true"');
    expect(settings).toContain('data-settings-diagnostics-details="collapsed"');
  });

  it('does not duplicate primary ownership copy across Today Focus and Settings', () => {
    const today = read('src/features/TodayView.tsx');
    const focus = read('src/features/TrainingFocusView.tsx');
    const settings = read('src/uiOs/settings/CloudCandidateSettingsPanel.tsx') + read('src/features/ProfileView.tsx');

    expect((today.match(/<SafetyStrip/g) || []).length).toBe(1);
    expect((today.match(/<TodayDecisionHero/g) || []).length).toBe(1);
    expect((focus.match(/完成一组/g) || []).length).toBeLessThanOrEqual(1);
    expect((settings.match(/只做查看，不改变本地数据/g) || []).length).toBeLessThanOrEqual(1);
    expect(settings).not.toContain('自动覆盖');
  });
});
