import { describe, expect, it } from 'vitest';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import { deleteTrainingSession } from '../src/engines/sessionHistoryEngine';
import { makeAppData, makeSession } from './fixtures';

const makeHistorySession = (id = 'delete-me') =>
  makeSession({
    id,
    date: '2026-04-30',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
  });

describe('session delete feedback', () => {
  it('returns a clear success message and removes the session from calendar inputs', () => {
    const data = makeAppData({ history: [makeHistorySession()] });

    const result = deleteTrainingSession(data, 'delete-me', true);
    const calendar = buildTrainingCalendar(result.data.history, '2026-04', { includeDataFlags: 'all' });

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.message).toBe('训练已删除。');
    expect(result.data.history).toHaveLength(0);
    expect(calendar.days.find((day) => day.date === '2026-04-30')?.totalSessions).toBe(0);
  });

  it('fails explicitly when the session cannot be found', () => {
    const data = makeAppData({ history: [makeHistorySession()] });

    const result = deleteTrainingSession(data, 'missing-session', true);

    expect(result.ok).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.message).toBe('暂时无法定位到这次训练。');
    expect(result.data.history).toHaveLength(1);
  });
});
