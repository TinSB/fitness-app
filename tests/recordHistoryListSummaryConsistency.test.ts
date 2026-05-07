import { describe, expect, it } from 'vitest';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { getSessionHistorySortKey, listSessionHistory } from '../src/engines/sessionHistoryEngine';
import { getSessionCalendarDate } from '../src/engines/trainingCalendarEngine';
import { formatExerciseName } from '../src/i18n/formatters';
import type { TrainingSession } from '../src/models/training-model';
import { makeSession } from './fixtures';

const session = (id: string, date: string, weight = 80, reps = 5): TrainingSession =>
  makeSession({
    id,
    date,
    templateId: 'pull-a',
    exerciseId: 'barbell-row',
    setSpecs: [{ weight, reps, rir: 2, techniqueQuality: 'good' }],
  });

describe('record history list and detail summary consistency', () => {
  it('uses buildSessionDetailSummary for list and detail instead of stale cached summary fields', () => {
    const stale = {
      ...session('stale-cache', '2026-05-04', 100, 6),
      summary: { completedWorkingSets: 99, effectiveSets: 99, totalVolumeKg: 99999 },
      completedSets: 99,
      effectiveSetCount: 99,
      totalVolumeKg: 99999,
    } as TrainingSession & Record<string, unknown>;

    const listed = listSessionHistory([stale])[0];
    const listSummary = buildSessionDetailSummary(listed);
    const detailSummary = buildSessionDetailSummary(stale);

    expect(listSummary).toMatchObject({
      plannedWorkingSets: 1,
      completedWorkingSets: 1,
      workingVolumeKg: 600,
    });
    expect(detailSummary).toMatchObject({
      plannedWorkingSets: listSummary.plannedWorkingSets,
      completedWorkingSets: listSummary.completedWorkingSets,
      effectiveSets: listSummary.effectiveSets,
      workingVolumeKg: listSummary.workingVolumeKg,
    });
    expect(listSummary.completedWorkingSets).not.toBe(99);
    expect(listSummary.workingVolumeKg).not.toBe(99999);
  });

  it('uses the local calendar date helper for history ordering and display labels', () => {
    const lateLocal = {
      ...session('late-local', '2026-05-04'),
      startedAt: '2026-05-04T02:10:00.000Z',
      finishedAt: '2026-05-04T02:45:00.000Z',
    };
    const nextDay = {
      ...session('next-day', '2026-05-04'),
      startedAt: '2026-05-04T14:00:00.000Z',
      finishedAt: '2026-05-04T14:45:00.000Z',
    };

    expect(getSessionCalendarDate(lateLocal)).toBe('2026-05-03');
    expect(getSessionHistorySortKey(lateLocal)).toContain('2026-05-03');
    expect(listSessionHistory([lateLocal, nextDay]).map((item) => item.id)).toEqual(['next-day', 'late-local']);
  });

  it('keeps replacement original and actual display names consistent between list and detail copy', () => {
    const replacement = session('replacement', '2026-05-04');
    replacement.exercises[0] = {
      ...replacement.exercises[0],
      originalExerciseId: 'barbell-row',
      actualExerciseId: 'chest-supported-row',
      replacementExerciseId: 'chest-supported-row',
      id: 'chest-supported-row',
      name: '胸托划船',
    };

    const summary = buildSessionDetailSummary(replacement);
    const detailCopy = `原计划：${formatExerciseName(replacement.exercises[0].originalExerciseId)} / 实际执行：${formatExerciseName(replacement.exercises[0].actualExerciseId)}`;
    const listCopy = `${formatExerciseName(replacement.exercises[0].originalExerciseId)} → ${formatExerciseName(replacement.exercises[0].actualExerciseId)}`;

    expect(summary.completedWorkingSets).toBe(1);
    expect(detailCopy).toContain('原计划：杠铃划船');
    expect(detailCopy).toContain('实际执行：胸托划船');
    expect(listCopy).toBe('杠铃划船 → 胸托划船');
    expect([detailCopy, listCopy].join('\n')).not.toMatch(/\b(undefined|null|barbell-row|chest-supported-row)\b/);
  });
});
