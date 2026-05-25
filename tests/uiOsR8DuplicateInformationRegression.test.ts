import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R8 duplicate information deletion', () => {
  it('does not repeat local-first safety strips on Today normal flow', () => {
    const todaySource = read('src/features/TodayView.tsx');
    const safetyOccurrences = todaySource.match(/<SafetyStrip/g) || [];

    expect(safetyOccurrences).toHaveLength(1);
    expect(todaySource).toContain('shouldShowTodaySafetyStrip');
    expect(todaySource).not.toContain('<SafetyStrip includeSecondaryCopy />');
  });

  it('does not duplicate Today recommendation cards in the primary flow', () => {
    const todaySource = read('src/features/TodayView.tsx');
    const primaryFlow = todaySource.slice(todaySource.indexOf('<TodayDecisionHero'), todaySource.indexOf('data-today-secondary-details="collapsed"'));

    expect((primaryFlow.match(/TodayDecisionHero/g) || []).length).toBe(1);
    expect((primaryFlow.match(/训练预览/g) || []).length).toBeLessThanOrEqual(2);
    expect(primaryFlow).not.toContain('推荐置信度');
    expect(primaryFlow).not.toContain('教练提醒');
  });

  it('does not duplicate Focus primary completion actions', () => {
    const focusSource = read('src/features/TrainingFocusView.tsx');
    const actionBarSource = read('src/uiOs/training/FocusModeActionBar.tsx');

    expect(actionBarSource).toContain('data-focus-mode-action-bar="one-dominant-primary"');
    expect((focusSource.match(/完成一组/g) || []).length).toBeLessThanOrEqual(1);
    expect(focusSource).not.toContain('ActualSetInputCard');
  });

  it('does not repeat cloud safety paragraph at Settings top level', () => {
    const settingsSource = read('src/uiOs/settings/SettingsControlCenter.tsx') + read('src/features/ProfileView.tsx');
    const cloudPanelSource = read('src/uiOs/settings/CloudCandidateSettingsPanel.tsx');

    expect((settingsSource.match(/云端候选不会自动同步/g) || []).length).toBeLessThanOrEqual(1);
    expect(cloudPanelSource).toContain('读取候选');
    expect(cloudPanelSource).toContain('查看');
    expect(cloudPanelSource).not.toContain('只做查看，不改变本地数据');
    expect(cloudPanelSource).not.toContain('自动覆盖');
  });
});
