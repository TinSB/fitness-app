import { describe, expect, it } from 'vitest';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { markSessionEdited, updateSessionSet } from '../src/engines/sessionEditEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import {
  buildTrainingCalendar,
  buildTrainingCalendarMonthRange,
  getDefaultCalendarDateForMonth,
  getSessionCalendarDate,
  resolveCalendarSelectedDate,
} from '../src/engines/trainingCalendarEngine';
import { deleteTrainingSession, getSessionLocalDate, listSessionHistory } from '../src/engines/sessionHistoryEngine';
import type { SessionDataFlag, TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const session = (
  id: string,
  date: string,
  options: {
    dataFlag?: SessionDataFlag;
    startedAt?: string;
    finishedAt?: string;
    weight?: number;
    reps?: number;
  } = {},
): TrainingSession => ({
  ...makeSession({
    id,
    date,
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: options.weight ?? 80, reps: options.reps ?? 5, rir: 2, techniqueQuality: 'good' }],
  }),
  startedAt: options.startedAt ?? `${date}T10:00:00.000Z`,
  finishedAt: options.finishedAt ?? `${date}T10:50:00.000Z`,
  dataFlag: options.dataFlag,
});

const dayFor = (history: TrainingSession[], month: string, date: string, includeDataFlags?: 'all') =>
  buildTrainingCalendar(history, month, includeDataFlags ? { includeDataFlags } : {}).days.find((day) => day.date === date);

describe('record calendar, history list, detail, and summary data mouth', () => {
  it('shows every session from history on the same local day and keeps data flags viewable', () => {
    const history = [
      session('normal-morning', '2026-05-04', { startedAt: '2026-05-04T13:00:00.000Z' }),
      session('test-noon', '2026-05-04', { dataFlag: 'test', startedAt: '2026-05-04T16:00:00.000Z' }),
      session('excluded-night', '2026-05-04', { dataFlag: 'excluded', startedAt: '2026-05-05T00:00:00.000Z' }),
    ];

    const allDay = dayFor(history, '2026-05', '2026-05-04', 'all');
    const defaultDay = dayFor(history, '2026-05', '2026-05-04');

    expect(allDay?.sessions.map((item) => item.sessionId)).toEqual(['normal-morning', 'test-noon', 'excluded-night']);
    expect(allDay?.sessions.map((item) => item.dataFlag)).toEqual(['normal', 'test', 'excluded']);
    expect(defaultDay?.sessions.map((item) => item.sessionId)).toEqual(['normal-morning']);
    expect(listSessionHistory(history).map((item) => item.id)).toHaveLength(3);
  });

  it('keeps previous-month records reachable through the same calendar date helper', () => {
    const history = [session('april', '2026-04-30'), session('may', '2026-05-02')];
    const range = buildTrainingCalendarMonthRange(history, '2026-05');
    const april = buildTrainingCalendar(history, '2026-04', { includeDataFlags: 'all' });

    expect(range).toMatchObject({ earliestMonth: '2026-04', latestMonth: '2026-05', hasHistory: true });
    expect(april.days.find((day) => day.date === '2026-04-30')?.sessions.map((item) => item.sessionId)).toEqual(['april']);
    expect(getDefaultCalendarDateForMonth(history, '2026-04', '2026-05-05')).toBe('2026-04-30');
  });

  it('updates calendar markers, history list, and summary inputs after deletion', () => {
    const target = session('delete-me', '2026-05-04');
    const keep = session('keep-me', '2026-05-05');
    const data = makeAppData({ history: [target, keep] });

    const result = deleteTrainingSession(data, 'delete-me', true);

    expect(result.ok).toBe(true);
    expect(listSessionHistory(result.data.history).map((item) => item.id)).toEqual(['keep-me']);
    expect(dayFor(result.data.history, '2026-05', '2026-05-04', 'all')?.totalSessions).toBe(0);
    expect(dayFor(result.data.history, '2026-05', '2026-05-05', 'all')?.totalSessions).toBe(1);
    expect(buildEffectiveVolumeSummary(result.data.history).completedSets).toBe(1);
  });

  it('updates day detail and calendar summary from edited set logs', () => {
    const original = session('edit-me', '2026-05-04', { weight: 80, reps: 5 });
    const editedSet = updateSessionSet(original, 'bench-press', 'bench-press-1', { weightKg: 100, reps: 6 });
    const edited = markSessionEdited(editedSet, ['sets'], '正式组修正', original);
    const summary = buildSessionDetailSummary(edited);
    const row = dayFor([edited], '2026-05', '2026-05-04', 'all')?.sessions[0];

    expect(summary).toMatchObject({
      completedWorkingSets: 1,
      workingVolume: 600,
    });
    expect(row).toMatchObject({
      sessionId: 'edit-me',
      completedSets: 1,
      totalVolumeKg: 600,
    });
    expect(edited.editHistory?.[0].afterSummary.workingVolume).toBe(600);
  });

  it('excludes flagged sessions from default statistics while keeping their calendar rows visible when requested', () => {
    const normal = session('normal', '2026-05-04');
    const test = session('test', '2026-05-05', { dataFlag: 'test' });
    const excluded = session('excluded', '2026-05-06', { dataFlag: 'excluded' });
    const history = [normal, test, excluded];

    expect(buildEffectiveVolumeSummary(history).completedSets).toBe(1);
    expect(buildTrainingCalendar(history, '2026-05').days.reduce((sum, day) => sum + day.totalSessions, 0)).toBe(1);
    expect(buildTrainingCalendar(history, '2026-05', { includeDataFlags: 'all' }).days.reduce((sum, day) => sum + day.totalSessions, 0)).toBe(3);
  });

  it('uses one local date mouth for calendar and history so UTC timestamps do not shift records into the wrong local day', () => {
    const lateLocalSession = session('utc-local-day', '2026-05-04', {
      startedAt: '2026-05-04T02:10:00.000Z',
      finishedAt: '2026-05-04T02:45:00.000Z',
    });

    expect(getSessionCalendarDate(lateLocalSession)).toBe('2026-05-03');
    expect(getSessionLocalDate(lateLocalSession)).toBe('2026-05-03');
    expect(buildTrainingCalendar([lateLocalSession], '2026-05', { includeDataFlags: 'all' }).days.find((day) => day.date === '2026-05-03')?.totalSessions).toBe(1);
    expect(buildTrainingCalendar([lateLocalSession], '2026-05', { includeDataFlags: 'all' }).days.find((day) => day.date === '2026-05-04')?.totalSessions).toBe(0);
  });

  it('preserves an in-month selected date across history refreshes instead of resetting to today', () => {
    const initialHistory = [session('first', '2026-05-04'), session('second', '2026-05-20')];
    const refreshedHistory = [session('second', '2026-05-20')];

    expect(resolveCalendarSelectedDate(initialHistory, '2026-05', '2026-05-04', '2026-05-05')).toBe('2026-05-04');
    expect(resolveCalendarSelectedDate(refreshedHistory, '2026-05', '2026-05-04', '2026-05-05')).toBe('2026-05-04');
    expect(resolveCalendarSelectedDate(refreshedHistory, '2026-04', '2026-05-04', '2026-05-05')).toBe('2026-04-01');
  });
});
