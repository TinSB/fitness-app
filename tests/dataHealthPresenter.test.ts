import { describe, expect, it } from 'vitest';
import type { DataHealthIssue, DataHealthReport } from '../src/engines/dataHealthEngine';
import { buildDataHealthViewModel } from '../src/presenters/dataHealthPresenter';

const reportWith = (issues: DataHealthIssue[]): DataHealthReport => ({
  status: issues.some((issue) => issue.severity === 'error') ? 'has_errors' : issues.length ? 'has_warnings' : 'healthy',
  issues,
  summary: 'engine summary',
});

const issue = (input: Partial<DataHealthIssue> & Pick<DataHealthIssue, 'id'>): DataHealthIssue => ({
  severity: 'warning',
  category: 'unknown',
  title: 'synthetic replacement id detected',
  message: 'summary cache mismatch with actualExerciseId missing',
  canAutoFix: false,
  ...input,
});

describe('dataHealthPresenter', () => {
  it('maps synthetic replacement id to product copy', () => {
    const vm = buildDataHealthViewModel(reportWith([
      issue({ id: 'synthetic-replacement-session-1-0-actualExerciseId', severity: 'error', category: 'replacement' }),
    ]));

    expect(vm.statusLabel).toBe('需要处理');
    expect(vm.primaryIssues[0].title).toBe('替代动作记录异常');
    expect(vm.primaryIssues[0].userMessage).toBe('有训练记录使用了旧版替代动作标记，可能影响该动作的历史显示。');
    expect(vm.primaryIssues[0].technicalDetails).toContain('synthetic replacement id detected');
  });

  it('maps summary mismatch to product copy', () => {
    const vm = buildDataHealthViewModel(reportWith([
      issue({ id: 'summary-volume-zero-session-1', category: 'summary' }),
    ]));

    expect(vm.primaryIssues[0].title).toBe('训练汇总可能过期');
    expect(vm.primaryIssues[0].userMessage).toBe('某次训练的顶部汇总和组记录不一致，建议打开该记录确认。');
  });

  it('sorts by severity and shows only three primary issues', () => {
    const vm = buildDataHealthViewModel(reportWith([
      issue({ id: 'info-1', severity: 'info', title: 'info' }),
      issue({ id: 'warning-1', severity: 'warning', title: 'warning' }),
      issue({ id: 'error-1', severity: 'error', title: 'error' }),
      issue({ id: 'warning-2', severity: 'warning', title: 'warning 2' }),
    ]));

    expect(vm.primaryIssues).toHaveLength(3);
    expect(vm.secondaryIssues).toHaveLength(1);
    expect(vm.primaryIssues[0].severityLabel).toBe('需要处理');
    expect(vm.secondaryIssues[0].severityLabel).toBe('提示');
  });

  it('keeps technical details out of default copy', () => {
    const vm = buildDataHealthViewModel(reportWith([
      issue({ id: 'missing-actual-exercise-session-1', severity: 'error', category: 'replacement' }),
    ]));
    const defaultText = [
      vm.statusLabel,
      vm.summary,
      ...vm.primaryIssues.flatMap((item) => [item.title, item.userMessage, item.severityLabel, item.actionLabel || '']),
    ].join('\n');

    expect(defaultText).not.toMatch(/synthetic replacement id|summary cache mismatch|actualExerciseId|undefined|null/);
    expect(vm.primaryIssues[0].technicalDetails).toContain('actualExerciseId');
  });

  it('returns healthy copy when there are no issues', () => {
    const vm = buildDataHealthViewModel(reportWith([]));

    expect(vm.statusTone).toBe('healthy');
    expect(vm.summary).toBe('未发现会影响训练统计的问题。');
    expect(vm.primaryIssues).toEqual([]);
  });
});
