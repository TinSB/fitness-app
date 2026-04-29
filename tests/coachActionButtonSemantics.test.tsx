import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildCoachActionView } from '../src/presenters/coachActionPresenter';
import { CoachActionCard } from '../src/ui/CoachActionCard';

const now = '2026-04-29T12:00:00.000Z';

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'coach-action',
  title: overrides.title || '查看教练建议',
  description: overrides.description || '点击后会打开明确位置，不会自动修改数据。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'review_volume',
  priority: overrides.priority || 'low',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? false,
  reversible: overrides.reversible ?? false,
  createdAt: overrides.createdAt || now,
  targetId: overrides.targetId,
  targetType: overrides.targetType,
  reason: overrides.reason || '这条建议来自训练记录分析。',
});

describe('coach action button semantics', () => {
  it('uses a secondary button for viewing volume advice', () => {
    const view = buildCoachActionView(makeAction({ actionType: 'review_volume', targetId: 'back', targetType: 'muscle' }));

    expect(view.primaryLabel).toBe('查看训练量建议');
    expect(view.primaryVariant).toBe('secondary');
    expect(view.isExecutable).toBe(false);
  });

  it('uses a primary button only for actionable draft creation', () => {
    const view = buildCoachActionView(
      makeAction({
        actionType: 'create_plan_adjustment_preview',
        targetId: 'back',
        targetType: 'muscle',
        requiresConfirmation: true,
        reversible: true,
      }),
    );

    expect(view.primaryLabel).toBe('生成调整草案');
    expect(view.primaryVariant).toBe('primary');
    expect(view.isExecutable).toBe(true);
  });

  it('does not promise draft creation when target data is missing', () => {
    const view = buildCoachActionView(makeAction({ actionType: 'create_plan_adjustment_preview', targetId: undefined, targetType: undefined }));

    expect(view.primaryLabel).toBe('查看建议');
    expect(view.primaryVariant).toBe('secondary');
    expect(view.disabledReason).toContain('缺少');
  });

  it('renders view-only actions as visible buttons instead of disabled text', () => {
    const view = buildCoachActionView(makeAction({ actionType: 'review_volume', targetId: 'back', targetType: 'muscle' }));
    const markup = renderToStaticMarkup(<CoachActionCard action={view} onPrimary={() => undefined} />);

    expect(markup).toContain('查看训练量建议');
    expect(markup).toContain('bg-white');
    expect(markup).not.toContain('undefined');
    expect(markup).not.toContain('review_volume');
  });
});
