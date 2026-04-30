import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { PlanView } from '../src/features/PlanView';
import { makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;
const source = readFileSync('src/features/PlanView.tsx', 'utf8');

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'volume-preview-back',
  title: overrides.title || '生成训练量调整草案',
  description: overrides.description || '背部训练量偏低，可以生成下周调整草案。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'create_plan_adjustment_preview',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? true,
  reversible: overrides.reversible ?? true,
  createdAt: overrides.createdAt || '2026-04-29T12:00:00.000Z',
  targetId: overrides.targetId || 'back',
  targetType: overrides.targetType || 'muscle',
  reason: overrides.reason || '根据近期训练记录生成。',
});

const visibleText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderPlan = (coachActions: CoachAction[] = []) => {
  const data = makeAppData();
  return renderToStaticMarkup(
    React.createElement(PlanView, {
      data,
      weeklyPrescription: buildWeeklyPrescription(data),
      coachActions,
      selectedTemplateId: data.selectedTemplateId,
      onSelectTemplate: noop,
      onStartTemplate: noop,
      onUpdateExercise: noop,
      onResetTemplates: noop,
      onCoachAction: noop,
      onDismissCoachAction: noop,
    }),
  );
};

describe('Plan visual density', () => {
  it('keeps the main Plan sections present without changing information structure', () => {
    const text = visibleText(renderPlan());

    expect(text).toContain('当前计划');
    expect(text).toContain('本周安排');
    expect(text).toContain('待处理建议');
    expect(text).toContain('调整草案');
  });

  it('does not duplicate PageSection titles', () => {
    const titles = [...source.matchAll(/<PageSection[^>]*title="([^"]+)"/g)].map((match) => match[1]);
    const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);

    expect(duplicates).toEqual([]);
  });

  it('marks exactly four primary Plan blocks for density guardrails', () => {
    const primarySections = source.match(/data-plan-primary-section=/g) || [];

    expect(primarySections).toHaveLength(4);
    expect(source).toContain('data-plan-primary-section="current-plan"');
    expect(source).toContain('data-plan-primary-section="weekly-schedule"');
    expect(source).toContain('data-plan-primary-section="coach-inbox"');
    expect(source).toContain('data-plan-primary-section="adjustment-drafts"');
  });

  it('keeps the desktop and mobile rhythm compact without adding heavy styling', () => {
    expect(source).toContain('grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1.55fr)_380px]');
    expect(source).toContain('space-y-3 md:space-y-4');
    expect(source).toContain('hidden space-y-3 xl:block');
    expect(source).not.toContain('shadow-xl');
    expect(source).not.toContain('rounded-2xl');
  });

  it('does not expose raw enum text in the rendered Plan page', () => {
    const text = visibleText(renderPlan([makeAction()]));

    expect(text).not.toMatch(/\b(undefined|null|hybrid|hypertrophy|strength|fat_loss|warmup|working|support|compound|isolation|machine|review_volume|create_plan_adjustment_preview|increase|medium|low|high)\b/);
  });

  it('does not add extra primary action buttons for the density pass', () => {
    const literalPrimaryButtons = source.match(/variant="primary"/g) || [];

    expect(literalPrimaryButtons).toHaveLength(1);
    expect(source).toContain('应用为实验模板');
    expect(source).not.toContain('size="lg"');
  });
});
