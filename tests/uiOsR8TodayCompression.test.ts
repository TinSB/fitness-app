import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TodayTrainingFocusSelection } from '../src/engines/todayTrainingFocusOverrideEngine';
import { TodayFocusOverridePanel } from '../src/uiOs/today/TodayFocusOverridePanel';

const source = () => readFileSync('src/features/TodayView.tsx', 'utf8');

const selection = {
  override: 'system',
  overrideActive: false,
  selectedTemplate: { id: 'upper-a', name: '上肢 A', exercises: [] },
  selectedFocusLabel: '上肢 A',
  selectedTemplateId: 'upper-a',
  selectedTemplateName: '上肢 A',
  systemTemplate: { id: 'upper-a', name: '上肢 A', exercises: [] },
  systemTemplateId: 'upper-a',
  systemTemplateName: '上肢 A',
  warnings: [],
  generatedTemplate: false,
} as TodayTrainingFocusSelection;

describe('UI-OS R8 Today compression', () => {
  it('keeps Today first screen to decision hero compact recovery compact target and concise preview', () => {
    const todaySource = source();

    expect(todaySource).toContain('TodayDecisionHero');
    expect(todaySource).toContain('data-today-recovery-density="compact"');
    expect(todaySource).toContain('TodayFocusOverrideControl');
    expect(todaySource).toContain('adjustedExercises.slice(0, 2)');
    expect(todaySource).toContain('data-today-secondary-details="collapsed"');
    expect(todaySource).toContain('为什么这样推荐？');
    expect(todaySource).not.toContain('为什么这样推荐？ / 更多说明');
  });

  it('hides focus override options by default behind compact 切换目标', () => {
    const compact = renderToStaticMarkup(
      React.createElement(TodayFocusOverridePanel, {
        selection,
        compact: true,
        expanded: false,
        onToggleExpanded: () => undefined,
      }),
    );
    const expanded = renderToStaticMarkup(
      React.createElement(TodayFocusOverridePanel, {
        selection,
        compact: true,
        expanded: true,
        onToggleExpanded: () => undefined,
      }),
    );

    expect(compact).toContain('data-today-focus-override-density="compact"');
    expect(compact).toContain('切换目标');
    expect(compact).not.toContain('role="group"');
    expect(expanded).toContain('aria-label="今天想练补充选项"');
  });

  it('removes normal repeated safety and diagnostic stacks from Today primary flow', () => {
    const todaySource = source();
    const primaryFlow = todaySource.slice(todaySource.indexOf('<TodayDecisionHero'), todaySource.indexOf('data-today-secondary-details="collapsed"'));

    expect((todaySource.match(/<SafetyStrip/g) || []).length).toBe(1);
    expect(primaryFlow).not.toContain('CoachActionList');
    expect(primaryFlow).not.toContain('RecommendationExplanationPanel');
    expect(primaryFlow).not.toContain('HealthDataPanel');
    expect(primaryFlow).not.toContain('apply_daily_adjustment');
  });
});
