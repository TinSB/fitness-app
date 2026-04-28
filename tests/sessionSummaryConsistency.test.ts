import { describe, expect, it } from 'vitest';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary, getSessionSupportSets, getSessionWarmupSets, getSessionWorkingSets, groupSessionSetsByType } from '../src/engines/sessionDetailSummaryEngine';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import { formatSetType, formatSessionVolumeLabel } from '../src/i18n/formatters';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeSession } from './fixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const makeMixedSession = (dataFlag?: TrainingSession['dataFlag']): TrainingSession => ({
  ...makeSession({
    id: 'summary-mixed',
    date: '2026-04-28',
    templateId: 'legs-a',
    exerciseId: 'squat',
    setSpecs: [
      { weight: 75, reps: 6, rir: 2, techniqueQuality: 'good' },
      { weight: 75, reps: 6, rir: 2, techniqueQuality: 'good' },
      { weight: 75, reps: 6, rir: 2, techniqueQuality: 'good' },
    ],
  }),
  dataFlag: dataFlag || 'normal',
  focusWarmupSetLogs: [
    { id: 'main:squat:warmup:0', type: 'warmup', weight: 20, actualWeightKg: 20, reps: 8, rir: '', done: true },
    { id: 'main:squat:warmup:1', type: 'warmup', weight: 40, actualWeightKg: 40, reps: 5, rir: '', done: true },
    { id: 'main:squat:warmup:2', type: 'warmup', weight: 60, actualWeightKg: 60, reps: 3, rir: '', done: true },
  ],
  supportExerciseLogs: [
    {
      moduleId: 'corr-ankle',
      exerciseId: 'knee-to-wall',
      exerciseName: '膝触墙踝活动',
      blockType: 'correction',
      plannedSets: 2,
      completedSets: 1,
    },
  ],
});

describe('session summary consistency', () => {
  it('groups warmup, working, and support sets without mixing sources', () => {
    const session = makeMixedSession();
    const grouped = groupSessionSetsByType(session);

    expect(getSessionWarmupSets(session)).toHaveLength(3);
    expect(getSessionWorkingSets(session)).toHaveLength(3);
    expect(getSessionSupportSets(session)).toHaveLength(1);
    expect(grouped.exerciseGroups[0].warmupSets.every((item) => item.set.type === 'warmup')).toBe(true);
    expect(grouped.exerciseGroups[0].workingSets.every((item) => item.category === 'working')).toBe(true);
  });

  it('uses formal working-set volume and separate warmup count in detail summary', () => {
    const session = makeMixedSession();
    const summary = buildSessionDetailSummary(session, unitSettings);

    expect(summary.warmupSetCount).toBe(3);
    expect(summary.workingSetCount).toBe(3);
    expect(summary.supportSetCount).toBe(1);
    expect(summary.workingVolumeKg).toBe(75 * 6 * 3);
    expect(summary.warmupVolumeKg).toBe(20 * 8 + 40 * 5 + 60 * 3);
    expect(summary.totalDisplayVolume).toBe('1350kg');
    expect(formatSessionVolumeLabel()).toBe('总量');
    expect(formatSetType('warmup')).toBe('热身组');
    expect(formatSetType('working')).toBe('正式组');
    expect(formatSetType('support')).toBe('辅助动作');
  });

  it('keeps calendar session rows aligned with session detail summary', () => {
    const session = makeMixedSession();
    const summary = buildSessionDetailSummary(session, unitSettings);
    const day = buildTrainingCalendar([session], '2026-04').days.find((item) => item.date === '2026-04-28');
    const row = day?.sessions[0];

    expect(row?.completedSets).toBe(summary.workingSetCount);
    expect(row?.effectiveSets).toBe(summary.effectiveSetCount);
    expect(row?.totalVolumeKg).toBe(summary.workingVolumeKg);
  });

  it('shows test and excluded session data while excluding them from analytics engines', () => {
    const testSession = makeMixedSession('test');
    const excludedSession = makeMixedSession('excluded');

    expect(buildSessionDetailSummary(testSession, unitSettings).workingSetCount).toBe(3);
    expect(buildSessionDetailSummary(excludedSession, unitSettings).workingSetCount).toBe(3);
    expect(buildEffectiveVolumeSummary([testSession, excludedSession]).completedSets).toBe(0);
    expect(buildE1RMProfile([testSession, excludedSession], 'squat').current).toBeUndefined();
  });
});
