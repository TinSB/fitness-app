import { describe, expect, it } from 'vitest';
import type { DataHealthIssue, DataHealthReport } from '../src/engines/dataHealthEngine';
import { buildDataHealthViewModel } from '../src/presenters/dataHealthPresenter';

const makeIssue = (id: string, overrides: Partial<DataHealthIssue> = {}): DataHealthIssue => ({
  id,
  severity: 'warning',
  category: 'unknown',
  title: 'technical title',
  message: 'technical message',
  affectedIds: ['session-1'],
  canAutoFix: false,
  ...overrides,
});

const vmFor = (issue: DataHealthIssue) => {
  const report: DataHealthReport = {
    status: issue.severity === 'error' ? 'has_errors' : 'has_warnings',
    issues: [issue],
    summary: 'summary',
  };
  return buildDataHealthViewModel(report).primaryIssues[0];
};

describe('data health action presenter', () => {
  it('maps common issue types to actionable navigation', () => {
    expect(vmFor(makeIssue('synthetic-replacement-session-1')).action).toMatchObject({ label: '查看相关训练', type: 'open_record_history' });
    expect(vmFor(makeIssue('summary-volume-zero-session-1', { category: 'summary' })).action).toMatchObject({ label: '查看训练详情', type: 'open_session_detail' });
    expect(vmFor(makeIssue('lb-display-decimal-session-1')).action).toMatchObject({ label: '打开单位设置', type: 'open_unit_settings' });
    expect(vmFor(makeIssue('external-workout-in-history-session-1')).action).toMatchObject({ label: '查看健康数据', type: 'open_health_data' });
    expect(vmFor(makeIssue('missing-actual-exercise-session-1')).action).toMatchObject({ label: '查看相关训练', type: 'open_record_history' });
    expect(vmFor(makeIssue('template-missing-exercise-template-1', { category: 'template' })).action).toMatchObject({ label: '打开计划页', type: 'open_plan' });
    expect(vmFor(makeIssue('backup-suggestion-1')).action).toMatchObject({ label: '导出备份', type: 'open_backup' });
  });

  it('keeps action labels Chinese and hides raw enum keys from default text', () => {
    const issue = vmFor(makeIssue('mixed-display-unit-session-1'));
    const text = [issue.title, issue.userMessage, issue.severityLabel, issue.action?.label].join('\n');

    expect(issue.action?.label).toMatch(/[\u4e00-\u9fff]/);
    expect(text).not.toMatch(/\b(open_unit_settings|warning|unit|undefined|null)\b/);
  });

  it('passes targetId from affectedIds when available', () => {
    const issue = vmFor(makeIssue('summary-completed-zero-session-1', { category: 'summary', affectedIds: ['session-42'] }));

    expect(issue.action?.targetId).toBe('session-42');
  });
});
