import { describe, expect, it } from 'vitest';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { markSessionEdited, updateSessionSet } from '../src/engines/sessionEditEngine';
import { deleteTrainingSession, filterAnalyticsHistory, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import type { TrainingSession, TrainingSetLog } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const session = (id: string, date: string, weight = 80, reps = 5): TrainingSession => ({
  ...makeSession({
    id,
    date,
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight, reps, rir: 2, techniqueQuality: 'good' }],
  }),
  startedAt: `${date}T14:00:00.000Z`,
  finishedAt: `${date}T14:45:00.000Z`,
});

const warmupSet = (overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id: 'main:bench-press:warmup:0',
  exerciseId: 'bench-press',
  type: 'warmup',
  weight: 40,
  actualWeightKg: 40,
  reps: 8,
  rir: '',
  done: true,
  ...overrides,
});

const daySessionIds = (history: TrainingSession[], date: string) =>
  buildTrainingCalendar(history, date.slice(0, 7), { includeDataFlags: 'all' })
    .days.find((day) => day.date === date)
    ?.sessions.map((item) => item.sessionId) || [];

describe('record mutation consistency', () => {
  it('updates calendar and history safely when deleting one session or the last session on a date', () => {
    const first = session('first', '2026-05-04');
    const second = session('second', '2026-05-04');
    const data = makeAppData({ history: [first, second] });

    const oneDeleted = deleteTrainingSession(data, 'first', true);
    expect(oneDeleted.ok).toBe(true);
    expect(oneDeleted.data.history.map((item) => item.id)).toEqual(['second']);
    expect(daySessionIds(oneDeleted.data.history, '2026-05-04')).toEqual(['second']);

    const allDeleted = deleteTrainingSession(oneDeleted.data, 'second', true);
    expect(allDeleted.ok).toBe(true);
    expect(allDeleted.data.history).toHaveLength(0);
    expect(daySessionIds(allDeleted.data.history, '2026-05-04')).toEqual([]);
  });

  it('recalculates list and detail summaries from logs after a working-set edit', () => {
    const original = session('working-edit', '2026-05-04', 80, 5);
    const editedSet = updateSessionSet(original, 'bench-press', 'bench-press-1', { weightKg: 100, reps: 6 });
    const edited = markSessionEdited(editedSet, ['sets'], 'working set edit', original);
    const detailSummary = buildSessionDetailSummary(edited);
    const calendarRow = buildTrainingCalendar([edited], '2026-05', { includeDataFlags: 'all' })
      .days.find((day) => day.date === '2026-05-04')
      ?.sessions[0];

    expect(detailSummary).toMatchObject({
      completedWorkingSets: 1,
      workingVolumeKg: 600,
      edited: true,
    });
    expect(calendarRow).toMatchObject({
      sessionId: 'working-edit',
      completedSets: detailSummary.completedWorkingSets,
      totalVolumeKg: detailSummary.workingVolumeKg,
    });
    expect(edited.editHistory?.at(-1)?.affectedStats).toEqual(expect.arrayContaining(['volume', 'effectiveSet']));
  });

  it('updates warmup summary without changing default effective-set statistics', () => {
    const original = session('warmup-edit', '2026-05-04');
    original.focusWarmupSetLogs = [warmupSet()];
    const before = buildSessionDetailSummary(original);
    const edited = {
      ...original,
      focusWarmupSetLogs: [warmupSet({ weight: 45, actualWeightKg: 45 })],
    };
    const audited = markSessionEdited(edited, ['warmupSets'], 'warmup edit', original);
    const after = buildSessionDetailSummary(audited);

    expect(after.warmupSets).toBe(1);
    expect(after.warmupVolumeKg).toBe(360);
    expect(after.effectiveSets).toBe(before.effectiveSets);
    expect(buildEffectiveVolumeSummary([audited]).effectiveSets).toBe(buildEffectiveVolumeSummary([original]).effectiveSets);
    expect(audited.editHistory?.at(-1)?.affectedStats).toEqual(['none']);
  });

  it('keeps test and excluded sessions visible while toggling default analytics inclusion', () => {
    const data = makeAppData({ history: [session('flag-me', '2026-05-04')] });

    const asTest = markSessionDataFlag(data, 'flag-me', 'test');
    expect(asTest.ok).toBe(true);
    expect(asTest.session?.dataFlag).toBe('test');
    expect(filterAnalyticsHistory(asTest.data.history)).toHaveLength(0);
    expect(buildSessionDetailSummary(asTest.session!).excludedFromStats).toBe(true);
    expect(daySessionIds(asTest.data.history, '2026-05-04')).toEqual(['flag-me']);
    expect(buildTrainingCalendar(asTest.data.history, '2026-05', { includeDataFlags: 'all' }).days.find((day) => day.date === '2026-05-04')?.sessions[0]).toMatchObject({ dataFlag: 'test' });

    const restored = markSessionDataFlag(asTest.data, 'flag-me', 'normal');
    expect(restored.ok).toBe(true);
    expect(restored.session?.dataFlag).toBe('normal');
    expect(filterAnalyticsHistory(restored.data.history).map((item) => item.id)).toEqual(['flag-me']);
    expect(buildSessionDetailSummary(restored.session!).excludedFromStats).toBe(false);
  });
});
