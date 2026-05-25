import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Flame } from 'lucide-react';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { buildTodayDecisionSurface } from '../src/engines/todayDecisionSurface';
import { TodayView } from '../src/features/TodayView';
import { SafetyStrip } from '../src/uiOs/surfaces/SafetyStrip';
import { TodayDecisionHero } from '../src/uiOs/today/TodayDecisionHero';
import { MobileAppShell } from '../src/uiOs/MobileAppShell';
import { UI_OS_TABS } from '../src/uiOs/uiOsNavigation';
import { getTemplate, makeAppData, makeStatus } from './fixtures';

const noop = (..._args: unknown[]) => undefined;
const items = UI_OS_TABS.map((item) => ({ ...item, icon: Flame }));

const renderText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const htmlToText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderTodayHtml = () => {
  const data = makeAppData({
    todayStatus: makeStatus({ sleep: '好', energy: '高', time: '90' }),
  });
  return renderToStaticMarkup(
    React.createElement(TodayView, {
      data,
      selectedTemplate: getTemplate(data.selectedTemplateId || 'push-a'),
      suggestedTemplate: getTemplate('pull-a'),
      weeklyPrescription: buildWeeklyPrescription(data),
      trainingMode: 'hybrid',
      onModeChange: noop,
      onStatusChange: noop,
      onSorenessToggle: noop,
      onTemplateSelect: noop,
      onUseSuggestion: noop,
      onStart: noop,
      onResume: noop,
      onReviewDataHealth: noop,
    }),
  );
};

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS R8.1 mobile Today safe-area and density fix', () => {
  it('removes the full normal local-first safety strip from Today normal state', () => {
    const text = htmlToText(renderTodayHtml());
    const todaySource = read('src/features/TodayView.tsx');
    const shellSource = read('src/uiOs/MobileAppShell.tsx');

    expect(text).not.toContain('云端候选不会自动同步');
    expect(text).not.toContain('本地训练记录仍可继续');
    expect(text).not.toContain('当前使用本地数据');
    expect(todaySource).not.toContain('<SafetyStrip includeSecondaryCopy');
    expect(shellSource).not.toContain('<SafetyStrip includeSecondaryCopy');
  });

  it('keeps source-unclear safety available without secondary local-first copy', () => {
    const result = buildTodayDecisionSurface({ recommendedFocus: '腿 A', sourceOfTruthClear: false });
    const warning = renderText(React.createElement(SafetyStrip, { state: 'source-unclear' }));

    expect(result.decisionState).toBe('source_unclear');
    expect(result.primaryActionLabel).toBe('回到本地模式');
    expect(warning).toContain('数据来源待确认');
    expect(warning).not.toContain('云端候选不会自动同步');
  });

  it('keeps normal hero copy short and collapses long recommendation details by default', () => {
    const decision = buildTodayDecisionSurface({
      recommendedFocus: '腿 A',
      sourceOfTruthClear: true,
      existingDecisionText: '建议今天执行腿 A。这是一段不应直接出现在默认 hero 的长解释。',
    });
    const heroHtml = renderToStaticMarkup(
      React.createElement(TodayDecisionHero, {
        decision,
        primaryAction: React.createElement('button', { type: 'button', 'data-today-primary-cta': 'true' }, '开始今天训练'),
      }),
    );
    const todaySource = read('src/features/TodayView.tsx');

    expect(decision.heroExplanation).toBe('');
    expect(heroHtml).toContain('data-today-hero-density="mobile-compact"');
    expect(heroHtml).toContain('data-today-primary-action-slot="hero"');
    expect(heroHtml).not.toContain('数据状态：');
    expect(heroHtml).not.toContain('训练目标：');
    expect(todaySource).toContain('data-today-secondary-details="collapsed"');
    expect(todaySource).not.toContain('<details open');
  });

  it('puts the primary CTA in the hero slot and protects it from the bottom nav structure', () => {
    const decision = buildTodayDecisionSurface({ recommendedFocus: '上肢 A', sourceOfTruthClear: true });
    const shellHtml = renderToStaticMarkup(
      React.createElement(
        MobileAppShell,
        { navItems: items, activeTab: 'today', onNavigate: noop, trainTabId: 'train' },
        React.createElement(TodayDecisionHero, {
          decision,
          primaryAction: React.createElement('button', { type: 'button', 'data-today-primary-cta': 'true' }, '开始今天训练'),
        }),
      ),
    );

    expect(shellHtml).toContain('data-shell-scroll-area="bottom-nav-aware"');
    expect(shellHtml).toContain('data-shell-safe-bottom="bottom-nav-protected"');
    expect(shellHtml).not.toMatch(/(?<!scroll-)pb-\[calc\(6\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
    expect(shellHtml).toContain('scroll-pb-[calc(6.5rem+env(safe-area-inset-bottom))]');
    expect(shellHtml.indexOf('data-today-primary-cta="true"')).toBeLessThan(shellHtml.indexOf('data-bottom-nav-hidden="false"'));
  });

  it('keeps normal recovery compact and risk recovery eligible for expanded warning', () => {
    const todayHtml = renderTodayHtml();
    const todaySource = read('src/features/TodayView.tsx');

    expect(todayHtml).toContain('data-today-recovery-density="compact"');
    expect(todaySource).toContain('meaningfulRecoveryRisk');
    expect(todaySource).toContain("todayViewModel.recommendationKind === 'modified_train'");
    expect(todaySource).toContain("adjustedPlan.readiness.level === 'red'");
    expect(todaySource).not.toContain("todayDecisionSurface.decisionState !== 'train_recommended'");
  });

  it('keeps Today first-screen density small and preview semantic', () => {
    const todaySource = read('src/features/TodayView.tsx');
    const todayHtml = renderTodayHtml();
    const primaryFlow = todayHtml.slice(todayHtml.indexOf('data-today-hero-density="mobile-compact"'), todayHtml.indexOf('data-today-training-preview="concise"'));
    const moduleMarkers = (primaryFlow.match(/data-today-hero-density|data-today-recovery-density|data-today-focus-override-density/g) || []).length;

    expect(moduleMarkers).toBeLessThanOrEqual(3);
    expect(todaySource).toContain('surface="health_card"');
    expect(todaySource).toContain('data-today-training-preview="concise"');
    expect(primaryFlow).not.toContain('CoachActionList');
    expect(primaryFlow).not.toContain('RecommendationExplanationPanel');
    expect(primaryFlow).not.toContain('HealthDataPanel');
    expect(primaryFlow).not.toContain('TodaySevereRiskNotice');
    expect(primaryFlow).not.toContain('完整 Data Health');
    expect(primaryFlow).not.toContain('bg-white text-black');
    expect(todaySource).not.toContain('<Card className="space-y-3">\n              <div className="flex items-start justify-between gap-3">');
  });
});
