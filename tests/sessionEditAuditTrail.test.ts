import { describe, expect, it } from 'vitest';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { markSessionEdited, updateSessionSet } from '../src/engines/sessionEditEngine';
import type { UnitSettings } from '../src/models/training-model';
import { makeSession } from './fixtures';

const lbSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const makeEditableSession = () =>
  makeSession({
    id: 'audit-trail-session',
    date: '2026-05-06',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 100, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });

describe('session edit audit trail', () => {
  it('writes one audit entry with display-only before and after text', () => {
    const before = makeEditableSession();
    const afterDraft = updateSessionSet(before, 'bench-press', 'bench-press-1', { weightKg: 102.5, reps: 8, rir: 2 });
    const after = markSessionEdited(afterDraft, ['sets'], '历史训练详情修正', before, lbSettings);
    const entry = after.editHistory?.at(-1);

    expect(entry).toMatchObject({
      editType: 'working_set',
      changedFields: ['weight'],
      affectedStats: ['volume', 'effectiveSet', 'PR', 'e1RM'],
      beforeSummaryText: '正式组 1：220lb × 8 / RIR 2',
      afterSummaryText: '正式组 1：226lb × 8 / RIR 2',
      reason: '历史训练详情修正',
    });
    expect(entry?.beforeSummary?.workingVolume).toBe(100 * 8);
    expect(entry?.afterSummary?.workingVolume).toBe(102.5 * 8);
  });

  it('keeps beforeSummaryText and afterSummaryText as display snapshots only', () => {
    const before = makeEditableSession();
    const edited = markSessionEdited(
      updateSessionSet(before, 'bench-press', 'bench-press-1', { weightKg: 105 }),
      ['sets'],
      '历史训练详情修正',
      before,
    );
    const entry = edited.editHistory?.at(-1);

    expect(entry?.beforeSummaryText).toContain('正式组 1');
    expect(entry?.afterSummaryText).toContain('正式组 1');
    expect(entry?.beforeSummary).toMatchObject({ workingVolume: 800 });
    expect(entry?.afterSummary).toMatchObject({ workingVolume: 840 });
    expect(JSON.stringify(entry)).not.toContain('"exercises"');
    expect(JSON.stringify(entry)).not.toContain('"history"');
  });

  it('does not let editHistory snapshots feed volume or effective-set calculations', () => {
    const session = {
      ...makeEditableSession(),
      editHistory: [
        {
          editedAt: '2026-05-06T12:00:00.000Z',
          fields: ['sets'],
          changedFields: ['weight'],
          beforeSummaryText: '展示快照',
          afterSummaryText: '展示快照',
          beforeSummary: {
            plannedWorkingSets: 999,
            completedWorkingSets: 999,
            effectiveSets: 999,
            warmupSets: 999,
            incompleteSets: 999,
            workingVolume: 999999,
            warmupVolume: 999999,
          },
          afterSummary: {
            plannedWorkingSets: 999,
            completedWorkingSets: 999,
            effectiveSets: 999,
            warmupSets: 999,
            incompleteSets: 999,
            workingVolume: 999999,
            warmupVolume: 999999,
          },
          affectedStats: ['volume', 'effectiveSet'] as const,
        },
      ],
    };

    expect(buildSessionDetailSummary(session).workingVolumeKg).toBe(100 * 8);
    expect(buildEffectiveVolumeSummary([session]).completedSets).toBe(1);
  });
});
