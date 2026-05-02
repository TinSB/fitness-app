import { describe, expect, it } from 'vitest';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

describe('DataHealth identity issue', () => {
  it('reports sanitized invalid exercise identity without exposing synthetic id in default copy', () => {
    const session = makeSession({
      id: 'identity-health-session',
      date: '2026-04-30',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6 }],
    });
    session.exercises[0] = {
      ...session.exercises[0],
      originalExerciseId: 'bench-press',
      actualExerciseId: '__auto_alt',
    };
    const data = sanitizeData(makeAppData({ history: [session] }));
    const report = buildDataHealthReport(data);
    const identityIssue = report.issues.find((issue) => issue.title === '动作记录身份需要检查');

    if (!identityIssue) throw new Error('expected identity issue');
    expect(identityIssue).toMatchObject({
      severity: 'error',
      category: 'replacement',
      title: '动作记录身份需要检查',
      canAutoFix: false,
    });
    expect(identityIssue.message).toContain('不会把它用于 PR、e1RM 或有效组');
    expect(identityIssue.message).not.toContain('__auto_alt');
    expect(identityIssue.affectedIds).toEqual(expect.arrayContaining(['identity-health-session', '__auto_alt']));
    expect(report.status).toBe('has_errors');
    expect(JSON.stringify(report)).not.toContain('undefined');
    expect(JSON.stringify(report)).not.toContain('null');
  });
});
