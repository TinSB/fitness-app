import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary, getSessionWarmupSets } from '../src/engines/sessionDetailSummaryEngine';
import { markSessionEdited, updateSessionSet, validateSessionEdit } from '../src/engines/sessionEditEngine';
import { parseDisplayWeightToKg } from '../src/engines/unitConversionEngine';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeSession } from './fixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const makeSessionWithWarmup = (): TrainingSession => ({
  ...makeSession({
    id: 'warmup-edit',
    date: '2026-04-28',
    templateId: 'legs-a',
    exerciseId: 'squat',
    setSpecs: [
      { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
      { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
      { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
    ],
  }),
  focusWarmupSetLogs: [
    {
      id: 'main:squat:warmup:0',
      type: 'warmup',
      weight: 20,
      actualWeightKg: 20,
      reps: 8,
      rir: '',
      done: true,
      note: '',
    },
  ],
});

describe('session warmup editing', () => {
  it('edits warmup weight and keeps the audit history field specific', () => {
    const session = makeSessionWithWarmup();
    const editedWeightKg = parseDisplayWeightToKg(95, 'lb');
    const edited = markSessionEdited(
      updateSessionSet(session, 'squat', 'main:squat:warmup:0', {
        weightKg: editedWeightKg,
        displayWeight: 95,
        displayUnit: 'lb',
        reps: 6,
        rir: 4,
        note: '热身重量补正',
      }),
      ['warmupSets'],
      '历史训练热身组修正',
    );

    const warmup = getSessionWarmupSets(edited)[0].set;
    expect(validateSessionEdit(edited).valid).toBe(true);
    expect(warmup.actualWeightKg).toBeCloseTo(editedWeightKg);
    expect(warmup.displayWeight).toBe(95);
    expect(warmup.displayUnit).toBe('lb');
    expect(warmup.reps).toBe(6);
    expect(warmup.note).toBe('热身重量补正');
    expect(edited.editHistory?.[0].fields).toContain('warmupSets');
  });

  it('does not let warmup edits affect e1RM, PR, or effective sets', () => {
    const session = makeSessionWithWarmup();
    const baseline = buildSessionDetailSummary(session, unitSettings);
    const edited = updateSessionSet(session, 'squat', 'main:squat:warmup:0', {
      weightKg: 180,
      reps: 10,
      rir: 0,
    });
    const next = buildSessionDetailSummary(edited, unitSettings);

    expect(next.warmupVolumeKg).toBeGreaterThan(baseline.warmupVolumeKg);
    expect(next.workingVolumeKg).toBe(baseline.workingVolumeKg);
    expect(next.effectiveSetCount).toBe(baseline.effectiveSetCount);
    expect(buildE1RMProfile([edited], 'squat').best?.e1rmKg).toBe(buildE1RMProfile([session], 'squat').best?.e1rmKg);
    expect(buildPrs([edited]).filter((item) => item.exerciseId === 'squat')).toEqual(buildPrs([session]).filter((item) => item.exerciseId === 'squat'));
  });

  it('still recalculates analytics when a working set is edited', () => {
    const session = makeSessionWithWarmup();
    const baseline = buildSessionDetailSummary(session, unitSettings);
    const edited = updateSessionSet(session, 'squat', 'squat-1', {
      weightKg: 110,
      reps: 6,
      rir: 1,
      techniqueQuality: 'good',
    });
    const next = buildSessionDetailSummary(edited, unitSettings);

    expect(next.workingVolumeKg).toBeGreaterThan(baseline.workingVolumeKg);
    expect(next.effectiveSetCount).toBeGreaterThanOrEqual(baseline.effectiveSetCount);
    expect(buildEffectiveVolumeSummary([edited]).effectiveSets).toBeGreaterThanOrEqual(baseline.effectiveSetCount);
    expect(buildE1RMProfile([edited], 'squat').best?.e1rmKg).toBeGreaterThan(buildE1RMProfile([session], 'squat').best?.e1rmKg || 0);
  });
});
