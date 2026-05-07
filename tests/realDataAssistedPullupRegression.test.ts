import { describe, expect, it } from 'vitest';
import { EXERCISE_KNOWLEDGE_OVERRIDES } from '../src/data/exerciseLibrary';
import { buildPrs } from '../src/engines/analytics';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { validateReplacementExerciseId } from '../src/engines/replacementEngine';
import { buildAppDataFromFixture } from './helpers/realDataFixture';

const fixtureData = () => buildAppDataFromFixture('legacy-assisted-pullup-session');

describe('real data assisted pull-up regression', () => {
  it('keeps assisted-pull-up as a valid vertical-pull exercise after sanitize', () => {
    const data = fixtureData();
    const validSession = data.history.find((session) => session.id === 'fixture-assisted-valid');
    const exercise = validSession?.exercises[0];

    expect(validateReplacementExerciseId('assisted-pull-up')).toBe(true);
    expect(EXERCISE_KNOWLEDGE_OVERRIDES['assisted-pull-up']).toMatchObject({
      equivalenceChainId: 'vertical-pull',
      canonicalExerciseId: 'assisted-pull-up',
    });
    expect(EXERCISE_KNOWLEDGE_OVERRIDES['assisted-pull-up'].equivalenceChainId).not.toBe('horizontal-pull');
    expect(exercise).toMatchObject({
      actualExerciseId: 'assisted-pull-up',
      replacementExerciseId: 'assisted-pull-up',
      originalExerciseId: 'lat-pulldown',
    });
    expect(exercise?.identityInvalid).not.toBe(true);
    expect(exercise?.legacyActualExerciseId).toBeUndefined();
    expect(getExerciseRecordPoolId(exercise)).toBe('assisted-pull-up');
  });

  it('preserves invalid and synthetic legacy identities for review instead of active actual ids', () => {
    const data = fixtureData();
    const invalidSession = data.history.find((session) => session.id === 'fixture-assisted-legacy-invalid');
    const exercise = invalidSession?.exercises[0];

    expect(exercise?.actualExerciseId).toBeUndefined();
    expect(exercise?.replacementExerciseId).toBeUndefined();
    expect(exercise).toMatchObject({
      identityInvalid: true,
      legacyActualExerciseId: 'legacy-assisted-pullup',
      legacyReplacementExerciseId: '__auto_alt_assisted_pullup',
    });
    expect(getExerciseRecordPoolId(exercise)).toBe('');
  });

  it('keeps PR, e1RM, and effective volume attributed to the actual assisted pull-up only', () => {
    const data = fixtureData();
    const prs = buildPrs(data.history);
    const effective = buildEffectiveVolumeSummary(data.history);

    expect(prs.map((item) => item.exerciseId)).toContain('assisted-pull-up');
    expect(prs.map((item) => item.exerciseId)).not.toContain('lat-pulldown');
    expect(buildE1RMProfile(data.history, 'assisted-pull-up').best?.exerciseId).toBe('assisted-pull-up');
    expect(buildE1RMProfile(data.history, 'lat-pulldown').best).toBeUndefined();
    expect(effective.completedSets).toBe(1);
    expect(effective.byMuscle.back?.completedSets).toBe(1);
  });

  it('does not report valid assisted-pull-up as a DataHealth identity issue while still reporting the synthetic legacy id', () => {
    const data = fixtureData();
    const report = buildDataHealthReport(data);
    const replacementIssues = report.issues.filter((issue) => issue.category === 'replacement');

    expect(replacementIssues.some((issue) => issue.affectedIds?.includes('fixture-assisted-valid'))).toBe(false);
    expect(replacementIssues.some((issue) => issue.affectedIds?.includes('legacy-assisted-pullup'))).toBe(true);
    expect(replacementIssues.some((issue) => issue.affectedIds?.includes('__auto_alt_assisted_pullup'))).toBe(true);
    expect(JSON.stringify(replacementIssues.map((issue) => ({ title: issue.title, message: issue.message })))).not.toContain('__auto_alt');
  });
});
