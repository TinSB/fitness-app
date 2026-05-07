import { describe, expect, it } from 'vitest';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { getSessionCalendarDate } from '../src/engines/trainingCalendarEngine';
import { buildDataHealthViewModel, type DataHealthActionView } from '../src/presenters/dataHealthPresenter';
import type { TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const session = (id: string, date: string): TrainingSession =>
  makeSession({
    id,
    date,
    templateId: 'pull-a',
    exerciseId: 'lat-pulldown',
    setSpecs: [{ weight: 70, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });

const resolveRecordAction = (history: TrainingSession[], action?: DataHealthActionView) => {
  if (!action || action.type !== 'open_session_detail') {
    return { section: 'list' as const, toast: '已打开历史列表。' };
  }
  const target = history.find((item) => item.id === action.targetId);
  if (!target) {
    return { section: 'list' as const, toast: '暂时无法定位到这次训练，已打开历史列表。' };
  }
  return {
    section: 'list' as const,
    sessionId: target.id,
    date: getSessionCalendarDate(target),
    toast: '已打开相关训练。',
  };
};

describe('record and DataHealth consistency', () => {
  it('routes session-scoped DataHealth identity issues to the matching Record detail', () => {
    const identity = session('identity-session', '2026-05-04');
    identity.exercises[0] = {
      ...identity.exercises[0],
      identityInvalid: true,
      legacyActualExerciseId: '__auto_alt_legacy',
      actualExerciseId: undefined,
    };
    identity.exercises[0].sets[0] = {
      ...identity.exercises[0].sets[0],
      identityInvalid: true,
      legacyActualExerciseId: '__auto_alt_legacy',
    };

    const report = buildDataHealthReport(makeAppData({ history: [identity] }));
    const viewModel = buildDataHealthViewModel(report);
    const issue = viewModel.primaryIssues.find((item) => item.title === '动作记录身份需要检查');
    const route = resolveRecordAction([identity], issue?.action);
    const summary = buildSessionDetailSummary(identity);

    expect(issue?.action).toMatchObject({
      type: 'open_session_detail',
      targetId: 'identity-session',
    });
    expect(route).toMatchObject({
      section: 'list',
      sessionId: 'identity-session',
      date: '2026-05-04',
    });
    expect(summary.identityIssueCount).toBeGreaterThan(0);
    expect(issue?.userMessage).toContain('不会把它用于 PR、e1RM 或有效组');
  });

  it('falls back to the history list with a Chinese toast when a DataHealth target session is missing', () => {
    const action: DataHealthActionView = {
      id: 'missing-open-detail',
      label: '查看相关训练',
      type: 'open_session_detail',
      targetId: 'missing-session',
    };

    expect(resolveRecordAction([], action)).toEqual({
      section: 'list',
      toast: '暂时无法定位到这次训练，已打开历史列表。',
    });
  });

  it('keeps Record warning copy aligned with DataHealth issue copy without exposing internal ids in default UI', () => {
    const identity = session('identity-warning', '2026-05-04');
    identity.exercises[0] = {
      ...identity.exercises[0],
      identityInvalid: true,
      legacyActualExerciseId: '__auto_alt_legacy',
      actualExerciseId: undefined,
    };
    const report = buildDataHealthReport(makeAppData({ history: [identity] }));
    const issue = buildDataHealthViewModel(report).primaryIssues.find((item) => item.title === '动作记录身份需要检查');
    const recordWarning = '部分动作身份需要检查，相关组不会进入 PR、e1RM 或有效组。';
    const defaultText = [issue?.title, issue?.userMessage, issue?.action?.label, recordWarning].join('\n');

    expect(issue?.action?.type).toBe('open_session_detail');
    expect(recordWarning).toContain('不会进入 PR、e1RM 或有效组');
    expect(defaultText).not.toMatch(/\b(undefined|null|identityInvalid|legacyActualExerciseId|__auto_alt|identity-warning)\b/);
  });
});
