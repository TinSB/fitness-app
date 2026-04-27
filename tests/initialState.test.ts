import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import { buildTrainingLevelAssessment } from '../src/engines/trainingLevelEngine';
import { emptyData } from '../src/storage/persistence';

describe('zero-data initial state', () => {
  it('starts without fake history, PR, e1RM or effective sets', () => {
    const data = emptyData();

    expect(data.history).toEqual([]);
    expect(buildPrs(data.history)).toEqual([]);
    expect(buildE1RMProfile(data.history, 'bench-press').current).toBeUndefined();
    expect(buildE1RMProfile(data.history, 'bench-press').best).toBeUndefined();

    const effective = buildEffectiveVolumeSummary(data.history);
    expect(effective.completedSets).toBe(0);
    expect(effective.effectiveSets).toBe(0);
    expect(effective.highConfidenceEffectiveSets).toBe(0);
  });

  it('shows empty calendar state without sample sessions', () => {
    const data = emptyData();
    const calendar = buildTrainingCalendar(data.history, '2026-04');

    expect(calendar.days.every((day) => day.totalSessions === 0)).toBe(true);
    expect(calendar.weeklyFrequency).toEqual([]);
  });

  it('treats new user as unknown rather than beginner', () => {
    const assessment = buildTrainingLevelAssessment({ history: emptyData().history });

    expect(assessment.level).toBe('unknown');
    expect(assessment.nextDataNeeded.join(' ')).toContain('2–3');
  });
});
