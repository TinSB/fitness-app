import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import type { SessionDataFlag, TrainingSession } from '../src/models/training-model';
import { makeSession } from './fixtures';

const flaggedSession = (dataFlag: SessionDataFlag): TrainingSession =>
  ({
    ...makeSession({
      id: `summary-${dataFlag}`,
      date: '2026-05-04',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
        { weight: 90, reps: 8, rir: 2, techniqueQuality: 'good' },
      ],
    }),
    dataFlag,
  }) as TrainingSession;

describe('test and excluded session detail summary', () => {
  it.each(['test', 'excluded'] as SessionDataFlag[])(
    'shows real session work for %s data while marking it excluded from default statistics',
    (dataFlag) => {
      const session = flaggedSession(dataFlag);
      const summary = buildSessionDetailSummary(session);

      expect(summary).toMatchObject({
        plannedWorkingSets: 2,
        completedWorkingSets: 2,
        workingVolumeKg: 100 * 5 + 90 * 8,
        effectiveSets: 0,
        highConfidenceEffectiveSets: 0,
        excludedFromStats: true,
      });
      expect(summary.excludedReason).toBe(summary.excludedFromStatsReason);
      expect(summary.excludedReason).toContain(dataFlag === 'test' ? '测试' : '排除');
      expect(buildEffectiveVolumeSummary([session]).completedSets).toBe(0);
      expect(buildPrs([session])).toHaveLength(0);
      expect(buildE1RMProfile([session], 'bench-press').best).toBeUndefined();
      expect(JSON.stringify(summary)).not.toMatch(/\b(undefined|null|test|excluded)\b/);
    },
  );
});
