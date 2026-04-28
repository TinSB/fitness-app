import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import { deleteTrainingSession, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { makeAppData, makeSession } from './fixtures';

describe('history data quality regression', () => {
  it('excludes test and excluded sessions from analytics while keeping them viewable when requested', () => {
    const normal = makeSession({
      id: 'normal-session',
      date: '2026-04-20',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });
    const test = { ...normal, id: 'test-session', date: '2026-04-21', dataFlag: 'test' as const };
    const excluded = { ...normal, id: 'excluded-session', date: '2026-04-22', dataFlag: 'excluded' as const };
    const history = [normal, test, excluded];

    expect(buildPrs(history).every((pr) => pr.date !== '2026-04-21' && pr.date !== '2026-04-22')).toBe(true);
    expect(buildE1RMProfile(history, 'bench-press').best?.sourceSet.date).toBe('2026-04-20');
    expect(buildEffectiveVolumeSummary(history).completedSets).toBe(1);
    expect(buildTrainingCalendar(history, '2026-04').days.find((day) => day.date === '2026-04-21')?.totalSessions).toBe(0);
    expect(buildTrainingCalendar(history, '2026-04', { includeDataFlags: 'all' }).days.find((day) => day.date === '2026-04-21')?.totalSessions).toBe(1);
  });

  it('removes deleted sessions from calendar and stats', () => {
    const session = makeSession({
      id: 'delete-me',
      date: '2026-04-23',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });
    const data = makeAppData({ history: [session] });
    const deleted = deleteTrainingSession(data, 'delete-me', true);

    expect(deleted.data.history).toHaveLength(0);
    expect(buildTrainingCalendar(deleted.data.history, '2026-04').days.find((day) => day.date === '2026-04-23')?.totalSessions).toBe(0);
    expect(buildPrs(deleted.data.history)).toEqual([]);
  });

  it('restores test data to normal analytics after user confirmation', () => {
    const session = makeSession({
      id: 'restore-me',
      date: '2026-04-23',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });
    const marked = markSessionDataFlag(makeAppData({ history: [session] }), 'restore-me', 'test', true);
    const restored = markSessionDataFlag(marked.data, 'restore-me', 'normal', true);

    expect(buildPrs(marked.data.history)).toEqual([]);
    expect(buildPrs(restored.data.history).length).toBeGreaterThan(0);
  });
});
