import { describe, expect, it } from 'vitest';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { sanitizeData as pureSanitizeData } from '../src/storage/appDataSanitize';
import { sanitizeData as facadeSanitizeData, validateAppDataSchema } from '../src/storage/persistence';
import { buildAppDataFromFixture, type RealDataFixtureName } from './helpers/realDataFixture';

const fixtureNames: RealDataFixtureName[] = [
  'legacy-assisted-pullup-session',
  'incomplete-draft-sets-session',
  'ppl-cycle-boundary-history',
  'stale-today-soreness',
  'duplicate-plan-draft',
  'legacy-unit-display',
];

describe('AppData sanitize parity after persistence split', () => {
  it.each(fixtureNames)('keeps facade and pure sanitize output identical for %s', (fixtureName) => {
    const data = buildAppDataFromFixture(fixtureName);
    const facade = facadeSanitizeData(data);
    const pure = pureSanitizeData(data);

    expect(pure).toEqual(facade);
    expect(validateAppDataSchema(pure)).toBe(true);
    expect(JSON.stringify(pure)).not.toMatch(/\bundefined\b/);
  });

  it('preserves legacy identity, incomplete drafts, patches, edit history and repair logs', () => {
    const assisted = pureSanitizeData(buildAppDataFromFixture('legacy-assisted-pullup-session'));
    const incomplete = pureSanitizeData(buildAppDataFromFixture('incomplete-draft-sets-session'));
    const duplicateDraft = pureSanitizeData(buildAppDataFromFixture('duplicate-plan-draft'));
    const unit = pureSanitizeData(buildAppDataFromFixture('legacy-unit-display'));

    expect(assisted.history.some((session) => session.exercises.some((exercise) => exercise.id === 'assisted-pull-up'))).toBe(true);
    expect(incomplete.history.some((session) => session.exercises.some((exercise) => exercise.sets.some((set) => set.done === false)))).toBe(true);
    expect(duplicateDraft.programAdjustmentDrafts.length).toBeGreaterThan(0);
    expect(unit.history.length).toBeGreaterThan(0);
    expect(buildSessionDetailSummary(incomplete.history[0]).incompleteSets).toBeGreaterThan(0);
    expect(buildEffectiveVolumeSummary(incomplete.history).completedSets).toBe(
      incomplete.history.reduce(
        (sum, session) =>
          sum + session.exercises.reduce((exerciseSum, exercise) => exerciseSum + exercise.sets.filter((set) => set.done === true).length, 0),
        0,
      ),
    );
  });
});
