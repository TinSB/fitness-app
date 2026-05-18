import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('equipment profile editing UX docs', () => {
  it('documents Task 17F baseline draft scope fields and next task', () => {
    const content = readSource('docs/EQUIPMENT_PROFILE_EDITING_UX.md');

    for (const expected of [
      'Task 17F',
      'Equipment Profile Editing UX',
      'PR #267',
      'b4d3b6754b390677923e959ae5e9a6b10777bf24',
      '1091 files / 4444 tests',
      'presentational/draft-only',
      'equipmentKind',
      'displayMode',
      'defaultBarWeightLb',
      'baseMachineWeightLb',
      'includeBaseWeight',
      'availablePlatesLb',
      'dumbbellIncrementLb',
      'machineWeightOptionsLb',
      'machineIncrementLb',
      'roundingPreference',
      'Task 17G is recommended next.',
      'Task 17G is not started by Task 17F.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents warning policy and persistence deferral', () => {
    const content = readSource('docs/EQUIPMENT_PROFILE_EDITING_UX.md');

    for (const expected of [
      'Olympic bar 45 lb default is explained.',
      'Smith machine 25 lb default is explained.',
      'Dumbbell per-hand display is explained.',
      'Selectorized machine stack options are explained.',
      'Plate-loaded base/sled weight is optional',
      'Warning when base weight is unknown',
      'Warning when machine stack options and increment are missing.',
      'Warning when unknown/custom exercise needs configuration.',
      'Persistence is deferred.',
      'No copy claims edits affect historical data.',
      'No copy claims edits automatically sync to cloud.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
