import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import { ProfileView } from '../src/features/ProfileView';
import { buildCoachActionListViewModel, buildCoachActionView } from '../src/presenters/coachActionPresenter';
import { CoachActionList } from '../src/ui/CoachActionList';
import { getTemplate, makeAppData } from './fixtures';

const now = '2026-04-29T12:00:00.000Z';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'action-1',
  title: overrides.title || '查看教练建议',
  description: overrides.description || '点击后只会打开相关页面，不会自动修改数据。',
  source: overrides.source || 'dataHealth',
  actionType: overrides.actionType || 'open_data_health',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? false,
  reversible: overrides.reversible ?? false,
  createdAt: overrides.createdAt || now,
  targetId: overrides.targetId,
  targetType: overrides.targetType,
  reason: overrides.reason || '这条建议来自已有训练和数据健康检查。',
});

describe('coach action UI', () => {
  it('shows only the top one or two high priority actions on Today', () => {
    const data = makeAppData();
    const actions = [
      makeAction({ id: 'medium', title: '稍后查看训练量', priority: 'medium', source: 'volumeAdaptation', actionType: 'review_volume' }),
      makeAction({ id: 'urgent', title: '优先检查数据健康', priority: 'urgent', source: 'dataHealth', actionType: 'open_data_health' }),
      makeAction({ id: 'high', title: '查看今日恢复建议', priority: 'high', source: 'recovery', actionType: 'apply_temporary_session_adjustment' }),
    ];

    const text = visibleText(
      <TodayView
        data={data}
        selectedTemplate={getTemplate('push-a')}
        suggestedTemplate={getTemplate('pull-a')}
        weeklyPrescription={buildWeeklyPrescription(data)}
        coachActions={actions}
        trainingMode="hybrid"
        onModeChange={noop}
        onStatusChange={noop}
        onSorenessToggle={noop}
        onTemplateSelect={noop}
        onUseSuggestion={noop}
        onStart={noop}
        onResume={noop}
        onCoachAction={noop}
        onDismissCoachAction={noop}
      />,
    );

    expect(text).toContain('教练建议');
    expect(text).toContain('优先检查数据健康');
    expect(text).toContain('查看今日恢复建议');
    expect(text).not.toContain('稍后查看训练量');
  });

  it('shows the full Coach Action inbox on My with status filters', () => {
    const data = makeAppData();
    const actions = [
      makeAction({ id: 'pending', title: '待处理建议', status: 'pending' }),
      makeAction({ id: 'applied', title: '已采用建议', status: 'applied' }),
      makeAction({ id: 'dismissed', title: '已忽略建议', status: 'dismissed' }),
      makeAction({ id: 'expired', title: '已过期建议', status: 'expired' }),
    ];

    const text = visibleText(
      <ProfileView
        data={data}
        unitSettings={data.unitSettings}
        coachActions={actions}
        onUpdateUnitSettings={noop}
        onRestoreData={noop}
        onUpdateHealthData={noop}
        onOpenAssessment={noop}
        onOpenRecordData={noop}
        onCoachAction={noop}
        onDismissCoachAction={noop}
      />,
    );

    expect(text).toContain('教练动作收件箱');
    expect(text).toContain('待处理');
    expect(text).toContain('已采用');
    expect(text).toContain('已忽略');
    expect(text).toContain('已过期');
    expect(text).toContain('待处理建议');
  });

  it('separates pending, applied, dismissed, and expired actions in the list view model', () => {
    const viewModel = buildCoachActionListViewModel([
      makeAction({ id: 'pending', status: 'pending' }),
      makeAction({ id: 'applied', status: 'applied' }),
      makeAction({ id: 'dismissed', status: 'dismissed' }),
      makeAction({ id: 'expired', status: 'expired' }),
    ]);

    expect(viewModel.pending).toHaveLength(1);
    expect(viewModel.applied).toHaveLength(1);
    expect(viewModel.dismissed).toHaveLength(1);
    expect(viewModel.expired).toHaveLength(1);
  });

  it('wires data and session actions to visible routing paths in App', () => {
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain("action.actionType === 'open_data_health'");
    expect(source).toContain("openProfileTarget('health_data')");
    expect(source).toContain("action.actionType === 'review_session'");
    expect(source).toContain("setProgressTarget({ section: 'list'");
    expect(source).toContain('采用本次临时调整？');
    expect(source).toContain('buildSessionPatchesFromDailyAdjustment');
    expect(source).toContain('revertSessionPatches');
  });

  it('labels implemented daily temporary adjustments as adoption', () => {
    const view = buildCoachActionView(
      makeAction({
        id: 'daily-adjustment',
        source: 'dailyAdjustment',
        actionType: 'apply_temporary_session_adjustment',
        requiresConfirmation: true,
      }),
    );
    const text = visibleText(
      <CoachActionList
        viewModel={{
          pending: [view],
          applied: [],
          dismissed: [],
          expired: [],
          failed: [],
          totalCount: 1,
        }}
        onAction={noop}
        onDismiss={noop}
      />,
    );

    expect(view.primaryLabel).toBe('采用本次调整');
    expect(text).toContain('采用本次调整');
  });

  it('keeps CoachAction UI text localized without raw enum or empty values', () => {
    const viewModel = buildCoachActionListViewModel([
      makeAction({ id: 'data', source: 'dataHealth', actionType: 'open_data_health', priority: 'urgent' }),
      makeAction({ id: 'session', source: 'sessionQuality', actionType: 'review_session', priority: 'medium' }),
    ]);
    const text = visibleText(<CoachActionList viewModel={viewModel} onAction={noop} onDismiss={noop} />);

    expect(text).toMatch(/[\u4e00-\u9fa5]/);
    expect(text).not.toMatch(
      /\b(undefined|null|dataHealth|sessionQuality|open_data_health|review_session|pending|applied|dismissed|expired|failed|urgent|high|medium|low)\b/,
    );
  });
});
