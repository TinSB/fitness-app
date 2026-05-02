import { describe, expect, it } from 'vitest';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { makeAppData, makeSession } from './fixtures';

const sessionWithMissingActual = (id: string) => {
  const session = makeSession({
    id,
    date: '2026-04-30',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 6 }],
  });
  session.exercises = session.exercises.map((exercise) => ({
    ...exercise,
    actualExerciseId: 'legacy-missing-exercise',
  }));
  return session;
};

describe('DataHealth issue identity', () => {
  it('generates the same id for the same underlying issue across recalculations', () => {
    const appData = makeAppData({ history: [sessionWithMissingActual('session-a')] });

    const first = buildDataHealthReport(appData);
    const second = buildDataHealthReport(appData);

    expect(first.issues.map((issue) => issue.id)).toEqual(second.issues.map((issue) => issue.id));
    expect(first.issues.some((issue) => issue.id === 'missing-actual-exercise-session-a-0')).toBe(true);
  });

  it('does not reuse ids across different affected sessions', () => {
    const first = buildDataHealthReport(makeAppData({ history: [sessionWithMissingActual('session-a')] }));
    const second = buildDataHealthReport(makeAppData({ history: [sessionWithMissingActual('session-b')] }));

    expect(first.issues.map((issue) => issue.id)).toContain('missing-actual-exercise-session-a-0');
    expect(second.issues.map((issue) => issue.id)).toContain('missing-actual-exercise-session-b-0');
    expect(first.issues.map((issue) => issue.id)).not.toContain('missing-actual-exercise-session-b-0');
  });

  it('does not use time or random values in generated issue ids', () => {
    const report = buildDataHealthReport(makeAppData({ history: [sessionWithMissingActual('session-a')] }));
    const ids = report.issues.map((issue) => issue.id).join('\n');

    expect(ids).not.toMatch(/\d{13}|random|Date\.now|undefined|null/);
  });
});
