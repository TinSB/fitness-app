import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dismissDataHealthIssueToday, type DataHealthReport } from '../src/engines/dataHealthEngine';
import type { CoachAutomationSummary } from '../src/engines/coachAutomationEngine';
import { todayKey } from '../src/engines/engineUtils';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { DEFAULT_UNIT_SETTINGS } from '../src/engines/unitConversionEngine';
import { ProfileView } from '../src/features/ProfileView';
import { RecordView } from '../src/features/RecordView';
import { makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const report: DataHealthReport = {
  status: 'has_warnings',
  summary: '数据健康检查发现需要复查的问题。',
  issues: [
    {
      id: 'summary-volume-zero-session-1',
      severity: 'warning',
      category: 'summary',
      title: '训练汇总可能过期',
      message: '某次训练的顶部汇总和组记录不一致，建议打开该记录确认。',
      affectedIds: ['session-1'],
      canAutoFix: false,
    },
  ],
};

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const coachAutomationSummary = { dataHealth: report } as unknown as CoachAutomationSummary;

const renderProfile = (dismissed = false) => {
  const dismissedDataHealthIssues = dismissed
    ? [dismissDataHealthIssueToday('summary-volume-zero-session-1', todayKey())]
    : [];
  const data = makeAppData({
    unitSettings: DEFAULT_UNIT_SETTINGS,
    dismissedDataHealthIssues,
    settings: { dismissedDataHealthIssues },
  });
  return visibleText(
    React.createElement(ProfileView, {
      data,
      unitSettings: data.unitSettings,
      coachAutomationSummary,
      onUpdateUnitSettings: noop,
      onRestoreData: noop,
      onUpdateHealthData: noop,
      onOpenAssessment: noop,
      onOpenRecordData: noop,
      onDataHealthAction: noop,
    }),
  );
};

const renderRecord = (dismissed = false) => {
  const dismissedDataHealthIssues = dismissed
    ? [dismissDataHealthIssueToday('summary-volume-zero-session-1', todayKey())]
    : [];
  const data = makeAppData({
    unitSettings: DEFAULT_UNIT_SETTINGS,
    dismissedDataHealthIssues,
    settings: { dismissedDataHealthIssues },
  });
  return visibleText(
    React.createElement(RecordView, {
      data,
      unitSettings: data.unitSettings,
      coachAutomationSummary,
      weeklyPrescription: buildWeeklyPrescription(data),
      bodyWeightInput: '',
      setBodyWeightInput: noop,
      onSaveBodyWeight: noop,
      onDeleteSession: noop,
      onMarkSessionDataFlag: noop,
      onEditSession: noop,
      onUpdateUnitSettings: noop,
      onRestoreData: noop,
      onDataHealthAction: noop,
      initialSection: 'data',
    }),
  );
};

describe('Profile and Record DataHealth dismiss UI', () => {
  it('shows a dismiss button before the issue is dismissed', () => {
    const text = renderProfile(false);

    expect(text).toContain('训练汇总可能过期');
    expect(text).toContain('查看训练详情');
    expect(text).toContain('暂不处理');
  });

  it('hides the issue immediately once dismissed for today and shows an empty state', () => {
    const text = renderProfile(true);

    expect(text).not.toContain('训练汇总可能过期');
    expect(text).toContain('暂无待处理数据健康问题');
  });

  it('uses the same dismissed issue filtering in Record data management', () => {
    const before = renderRecord(false);
    const after = renderRecord(true);

    expect(before).toContain('训练汇总可能过期');
    expect(before).toContain('暂不处理');
    expect(after).not.toContain('训练汇总可能过期');
    expect(after).toContain('暂无待处理数据健康问题');
  });

  it('wires DataHealth dismiss to AppData state instead of a toast-only path', () => {
    const appSource = readFileSync('src/App.tsx', 'utf8');
    const presenterSource = readFileSync('src/presenters/dataHealthPresenter.ts', 'utf8');

    expect(appSource).toContain("action.type === 'dismiss'");
    expect(appSource).toContain('dismissedDataHealthIssues: nextDismissed');
    expect(appSource).toContain('dismissDataHealthIssueToday(issueId, dismissedAt)');
    expect(appSource).toContain('已暂不处理，今天不再提醒。');
    expect(presenterSource).toContain('filterDismissedDataHealthIssues');
    expect(presenterSource).toContain('dismissAction');
  });
});
