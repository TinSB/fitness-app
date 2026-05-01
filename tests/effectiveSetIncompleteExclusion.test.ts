import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { sessionCompletedSets, sessionVolume } from '../src/engines/engineUtils';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { buildSessionQualityResult } from '../src/engines/sessionQualityEngine';
import type { TrainingSession } from '../src/models/training-model';

const sessionWithIncompleteHeavyDraft = (): TrainingSession => ({
  id: 'session-incomplete-exclusion',
  date: '2026-04-30',
  templateId: 'push-a',
  templateName: '推 A',
  trainingMode: 'hybrid',
  completed: true,
  exercises: [
    {
      id: 'bench-press',
      baseId: 'bench-press',
      name: '卧推',
      muscle: '胸',
      kind: 'compound',
      repMin: 6,
      repMax: 8,
      rest: 150,
      startWeight: 60,
      primaryMuscles: ['chest'],
      sets: [
        {
          id: 'bench-done',
          type: 'straight',
          weight: 80,
          actualWeightKg: 80,
          reps: 8,
          rir: 2,
          done: true,
          techniqueQuality: 'good',
        },
        {
          id: 'bench-incomplete',
          type: 'straight',
          weight: 200,
          actualWeightKg: 200,
          reps: 10,
          rir: 1,
          done: false,
          completionStatus: 'incomplete',
          incompleteReason: 'ended_early',
          techniqueQuality: 'good',
        },
      ],
    },
  ],
});

describe('incomplete sets are excluded from completed training metrics', () => {
  it('does not count done=false sets in completed sets, volume, effective sets, PR, e1RM, or session quality', () => {
    const session = sessionWithIncompleteHeavyDraft();
    const effective = buildEffectiveVolumeSummary([session]);
    const e1rm = buildE1RMProfile([session], 'bench-press');
    const prs = buildPrs([session]);
    const detail = buildSessionDetailSummary(session);
    const quality = buildSessionQualityResult({ session });

    expect(sessionCompletedSets(session)).toBe(1);
    expect(sessionVolume(session)).toBe(80 * 8);
    expect(effective.completedSets).toBe(1);
    expect(effective.effectiveSets).toBe(1);
    expect(detail.completedWorkingSetCount).toBe(1);
    expect(detail.incompleteSetCount).toBe(1);
    expect(detail.workingVolumeKg).toBe(80 * 8);

    expect(e1rm.best?.sourceSet.weightKg).toBe(80);
    expect(e1rm.best?.e1rmKg || 0).toBeLessThan(120);
    expect(prs.some((record) => record.raw === 200 || record.raw === 2000)).toBe(false);
    expect(quality.summary).not.toContain('200');
    expect(quality.summary).not.toMatch(/\b(undefined|null|ended_early|incomplete)\b/);
  });
});
