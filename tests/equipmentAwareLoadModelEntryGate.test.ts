import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('equipment-aware load model entry gate', () => {
  const doc = () => readSource('docs/EQUIPMENT_AWARE_LOAD_MODEL_ENTRY_GATE.md');

  it('records Task 17A identity and Phase 16 baseline evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 17A',
      'Equipment-Aware Load Model Entry Gate',
      'Phase 17 start',
      'Docs/static tests only',
      'Phase 16 complete',
      'Task 16G — Phase 16 Personal-Only Roadmap Archive V1',
      'PR #262',
      'cc3a88ac50d9fe4e454392dde0ddbab73e45db6a',
      '1078 files / 4361 tests',
      'dist token scan clean',
      'Phase 17 was not started before this task.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('captures the owner real-use feedback and example failure', () => {
    const content = doc();

    for (const expected of [
      'one month',
      'records every workout',
      'current single weight unit/model is confusing',
      'real gyms do not have one universal "weight" concept',
      'theoretical training weight from physically loadable gym weight',
      'Bench press warmup recommendation of 17 lb is invalid.',
      'Empty Olympic bar is 45 lb.',
      'empty bar / 45 lb',
      'minimum feasible load / equipment profile issue',
      'UI must remain simple enough to use during training.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records the product decision and required model support', () => {
    const content = doc();

    for (const expected of [
      'Decision: IronPath must add an Equipment-Aware Load Model.',
      'Equipment kind.',
      'Bar weight / base machine weight.',
      'Whether base weight is included.',
      'Available plates.',
      'Dumbbell increment.',
      'Machine-specific stack options or increments.',
      'Display mode.',
      'Feasible load rounding.',
      'Readiness-based rounding preference.',
      'Per-exercise default equipment profile.',
      'Task 17A is an entry gate only and does not build the model.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('lists required equipment categories', () => {
    const content = doc();

    for (const expected of [
      '`barbell`',
      '`smith_machine`',
      '`dumbbell`',
      '`selectorized_machine`',
      '`plate_loaded_machine`',
      '`cable_stack`',
      '`bodyweight`',
      '`assisted_bodyweight`',
      '`unknown`',
      'Fixed/selectorized machine.',
      'Free weights.',
      'Plate-loaded machine.',
      'Unknown / custom equipment.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records user-specific equipment defaults and display preferences', () => {
    const content = doc();

    for (const expected of [
      'Olympic barbell default bar weight: 45 lb.',
      'Smith machine default bar weight: 25 lb.',
      'Barbell plate inventory: 2.5 / 5 / 10 / 25 / 45 lb.',
      'Dumbbell increment: 5 lb.',
      'flat bench press, squat, Romanian deadlift, and barbell row',
      'Barbell display: total weight + per-side plates.',
      'Dumbbell display: per-hand weight.',
      'Selectorized / pin-loaded machine loads are usually recorded according to the machine',
      'machine-specific weight options / increments',
      'optional base machine weight / sled weight',
      'Machine increments vary by machine and cannot be assumed globally.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('lists required display modes and feasible load behavior', () => {
    const content = doc();

    for (const expected of [
      '`total_weight`',
      '`per_hand`',
      '`per_side_plates`',
      '`machine_stack`',
      '`added_load`',
      '`bodyweight_adjusted`',
      '`total_plus_per_side`',
      'Recommendation output should be physically loadable.',
      'Theoretical weight may be kept internally or shown as secondary detail later.',
      'Primary recommendation should be feasible.',
      'Low warmup below bar weight should resolve to empty bar or adjusted warmup.',
      'Dumbbell recommendation should round to available dumbbell increment.',
      'Barbell recommendation should round to possible plate combinations.',
      'Selectorized machine recommendation should round to machine-specific available options.',
      'Plate-loaded machine recommendation should account for configured base weight when enabled.',
      'recent training frequency, readiness, and weight trend',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents future model concepts without implementing them', () => {
    const content = doc();

    for (const expected of [
      'Conceptual `EquipmentKind`',
      'Conceptual `LoadDisplayMode`',
      'Conceptual `EquipmentProfile`',
      '`defaultBarWeightLb`',
      '`baseMachineWeightLb`',
      '`includeBaseWeight`',
      '`availablePlatesLb`',
      '`dumbbellIncrementLb`',
      '`machineWeightOptionsLb`',
      '`machineIncrementLb`',
      '`roundingPreference`',
      'Conceptual `FeasibleLoadResult`',
      '`theoreticalWeight`',
      '`feasibleWeight`',
      '`displayWeight`',
      '`plateBreakdown`',
      '`perSideLoad`',
      '`sourceOfTruthChanged: false`',
      'Equipment profiles must eventually be available for all exercises.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends Task 17B without starting it', () => {
    const content = doc();

    for (const expected of [
      'Task 17B — Equipment-Aware Load Model & Feasible Weight Engine V1',
      'Pure equipment/load model types.',
      'Pure feasible load rounding engine.',
      'Support for barbell / Smith / dumbbell / selectorized machine / plate-loaded machine.',
      'Olympic bar 45 lb default.',
      'Smith bar 25 lb default.',
      'Available plates 2.5 / 5 / 10 / 25 / 45.',
      'Dumbbell 5 lb increment.',
      'Machine-specific options.',
      'Low warmup below bar resolves to empty bar / feasible minimum.',
      'Tests for bench warmup 17 lb -> 45 lb empty bar.',
      'Tests for dumbbell per-hand rounding.',
      'Tests for selectorized machine custom stack options.',
      'Tests for plate-loaded optional base weight.',
      'Task 17A does not start Task 17B.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves safety boundaries and route locks', () => {
    const content = doc();

    for (const expected of [
      'localStorage remains default/fallback/migration/emergency.',
      'localStorage remains default / fallback / migration / emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'conflict resolution remains manual.',
      'rollback / kill switch remains available.',
      'emergency local mode remains available.',
      'api-primary-dev remains dev/local only and not production-ready.',
      'accepted browser mutation routes remain exactly seven.',
      'No eighth browser mutation route was added.',
      '`POST /data-health/repair/apply` remains blocked.',
      'backup/import/export over HTTP remains blocked.',
      'reset/recovery over HTTP remains blocked.',
      'no default cloud sync.',
      'no background sync.',
      'no production deployment auto-start.',
      'no external monitoring upload.',
      'no SaaS/multi-user runtime.',
      'no normalized training tables.',
      'no destructive migration.',
      'no real personal training data in automated tests.',
      'no new package/dependency/script/lockfile drift beyond Phase 12 authorized `@supabase/supabase-js`.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
