import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AVAILABLE_BARBELL_PLATES_LB,
  EQUIPMENT_KINDS,
  LOAD_DISPLAY_MODES,
  READINESS_BIASES,
  ROUNDING_DIRECTIONS,
  ROUNDING_PREFERENCES,
  SET_PURPOSES,
  createDumbbellProfile,
  createOlympicBarbellProfile,
  createPlateLoadedMachineProfile,
  createSelectorizedMachineProfile,
  createSmithMachineProfile,
} from '../src/engines/equipmentAwareLoadModel';

describe('equipment aware load model', () => {
  it('exports all equipment kind values', () => {
    expect(EQUIPMENT_KINDS).toEqual([
      'barbell',
      'smith_machine',
      'dumbbell',
      'selectorized_machine',
      'plate_loaded_machine',
      'cable_stack',
      'bodyweight',
      'assisted_bodyweight',
      'unknown',
    ]);
  });

  it('exports all display rounding readiness and set purpose values', () => {
    expect(LOAD_DISPLAY_MODES).toEqual([
      'total_weight',
      'per_hand',
      'per_side_plates',
      'machine_stack',
      'added_load',
      'bodyweight_adjusted',
      'total_plus_per_side',
    ]);
    expect(ROUNDING_PREFERENCES).toEqual(['conservative', 'nearest', 'progressive', 'readiness_based']);
    expect(READINESS_BIASES).toEqual(['conservative', 'neutral', 'progressive']);
    expect(SET_PURPOSES).toEqual(['warmup', 'working', 'top_set', 'backoff', 'recovery']);
    expect(ROUNDING_DIRECTIONS).toEqual(['none', 'up', 'down', 'nearest', 'minimum_feasible']);
  });

  it('provides default user equipment profiles', () => {
    const olympic = createOlympicBarbellProfile();
    const smith = createSmithMachineProfile();
    const dumbbell = createDumbbellProfile();
    const selectorized = createSelectorizedMachineProfile();
    const plateLoaded = createPlateLoadedMachineProfile();

    expect(olympic.equipmentKind).toBe('barbell');
    expect(olympic.defaultBarWeightLb).toBe(45);
    expect(olympic.displayMode).toBe('total_plus_per_side');
    expect(olympic.roundingPreference).toBe('readiness_based');
    expect(olympic.availablePlatesLb).toEqual([2.5, 5, 10, 25, 45]);

    expect(smith.equipmentKind).toBe('smith_machine');
    expect(smith.defaultBarWeightLb).toBe(25);
    expect(smith.displayMode).toBe('total_plus_per_side');

    expect(dumbbell.equipmentKind).toBe('dumbbell');
    expect(dumbbell.dumbbellIncrementLb).toBe(5);
    expect(dumbbell.displayMode).toBe('per_hand');

    expect(selectorized.equipmentKind).toBe('selectorized_machine');
    expect(selectorized.displayMode).toBe('machine_stack');
    expect(selectorized.roundingPreference).toBe('nearest');

    expect(plateLoaded.equipmentKind).toBe('plate_loaded_machine');
    expect(plateLoaded.availablePlatesLb).toEqual([2.5, 5, 10, 25, 45]);
  });

  it('keeps the default barbell plate inventory stable', () => {
    expect(DEFAULT_AVAILABLE_BARBELL_PLATES_LB).toEqual([2.5, 5, 10, 25, 45]);
  });
});
