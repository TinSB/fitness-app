import { describe, expect, it } from 'vitest';
import {
  getDefaultEquipmentProfileByKind,
  getDefaultEquipmentProfileForExercise,
  inferEquipmentKindFromExerciseName,
  listDefaultEquipmentProfiles,
  listExerciseEquipmentProfileMappings,
  normalizeExerciseName,
} from '../src/engines/exerciseEquipmentProfiles';

describe('exercise equipment profiles', () => {
  it('provides required default profiles by kind', () => {
    const olympic = getDefaultEquipmentProfileByKind('barbell');
    const smith = getDefaultEquipmentProfileByKind('smith_machine');
    const dumbbell = getDefaultEquipmentProfileByKind('dumbbell');
    const selectorized = getDefaultEquipmentProfileByKind('selectorized_machine');
    const plateLoaded = getDefaultEquipmentProfileByKind('plate_loaded_machine');
    const cable = getDefaultEquipmentProfileByKind('cable_stack');
    const bodyweight = getDefaultEquipmentProfileByKind('bodyweight');
    const assisted = getDefaultEquipmentProfileByKind('assisted_bodyweight');
    const unknown = getDefaultEquipmentProfileByKind('unknown');

    expect(olympic.equipmentKind).toBe('barbell');
    expect(olympic.defaultBarWeightLb).toBe(45);
    expect(olympic.availablePlatesLb).toEqual([2.5, 5, 10, 25, 45]);
    expect(olympic.displayMode).toBe('total_plus_per_side');

    expect(smith.equipmentKind).toBe('smith_machine');
    expect(smith.defaultBarWeightLb).toBe(25);

    expect(dumbbell.equipmentKind).toBe('dumbbell');
    expect(dumbbell.displayMode).toBe('per_hand');
    expect(dumbbell.dumbbellIncrementLb).toBe(5);

    expect(selectorized.equipmentKind).toBe('selectorized_machine');
    expect(selectorized.displayMode).toBe('machine_stack');
    expect(selectorized.roundingPreference).toBe('nearest');

    expect(plateLoaded.equipmentKind).toBe('plate_loaded_machine');
    expect(plateLoaded.availablePlatesLb).toEqual([2.5, 5, 10, 25, 45]);
    expect(plateLoaded.includeBaseWeight).toBe(false);

    expect(cable.equipmentKind).toBe('cable_stack');
    expect(cable.displayMode).toBe('machine_stack');

    expect(bodyweight.equipmentKind).toBe('bodyweight');
    expect(bodyweight.displayMode).toBe('bodyweight_adjusted');

    expect(assisted.equipmentKind).toBe('assisted_bodyweight');
    expect(assisted.displayMode).toBe('bodyweight_adjusted');

    expect(unknown.equipmentKind).toBe('unknown');
    expect(unknown.displayMode).toBe('total_weight');
    expect(unknown.notes).toContain('Unknown/custom fallback');
  });

  it('maps required barbell Smith and dumbbell exercises', () => {
    for (const name of ['Bench Press', 'Flat Bench Press', 'Squat', 'Romanian Deadlift', 'RDL', 'Barbell Row']) {
      expect(inferEquipmentKindFromExerciseName(name)).toBe('barbell');
      expect(getDefaultEquipmentProfileForExercise(name).equipmentKind).toBe('barbell');
    }

    expect(getDefaultEquipmentProfileForExercise('Smith Machine Squat').equipmentKind).toBe('smith_machine');
    expect(getDefaultEquipmentProfileForExercise('Dumbbell Bench Press').equipmentKind).toBe('dumbbell');
    expect(getDefaultEquipmentProfileForExercise('DB Bench Press').equipmentKind).toBe('dumbbell');
  });

  it('maps required machine cable and bodyweight exercises', () => {
    expect(getDefaultEquipmentProfileForExercise('Lat Pulldown').equipmentKind).toBe('selectorized_machine');
    expect(getDefaultEquipmentProfileForExercise('Seated Row Machine').equipmentKind).toBe('selectorized_machine');
    expect(getDefaultEquipmentProfileForExercise('Leg Press').equipmentKind).toBe('plate_loaded_machine');
    expect(getDefaultEquipmentProfileForExercise('Hammer Strength Row').equipmentKind).toBe('plate_loaded_machine');
    expect(getDefaultEquipmentProfileForExercise('Cable Triceps Pushdown').equipmentKind).toBe('cable_stack');
    expect(getDefaultEquipmentProfileForExercise('Face Pull').equipmentKind).toBe('cable_stack');
    expect(getDefaultEquipmentProfileForExercise('Pull Up').equipmentKind).toBe('bodyweight');
    expect(getDefaultEquipmentProfileForExercise('Assisted Pull Up').equipmentKind).toBe('assisted_bodyweight');
  });

  it('normalizes matching across case spaces punctuation and aliases', () => {
    expect(normalizeExerciseName('  DB--Bench   Press!! ')).toBe('dumbbell bench press');
    expect(normalizeExerciseName('RDL')).toBe('romanian deadlift');
    expect(getDefaultEquipmentProfileForExercise('  db---bench press  ').equipmentKind).toBe('dumbbell');
    expect(getDefaultEquipmentProfileForExercise('romanian_deadlift').equipmentKind).toBe('barbell');
    expect(getDefaultEquipmentProfileForExercise('TRICEPS   PUSHDOWN').equipmentKind).toBe('cable_stack');
    expect(getDefaultEquipmentProfileForExercise('smith.machine.squat').equipmentKind).toBe('smith_machine');
  });

  it('returns unknown profile safely for empty or unmapped names', () => {
    expect(inferEquipmentKindFromExerciseName('')).toBe('unknown');
    expect(inferEquipmentKindFromExerciseName(null)).toBe('unknown');
    expect(getDefaultEquipmentProfileForExercise('').equipmentKind).toBe('unknown');
    expect(getDefaultEquipmentProfileForExercise('Owner Custom Odd Lift').equipmentKind).toBe('unknown');
  });

  it('returns fresh profile copies to avoid mutation leaks', () => {
    const first = getDefaultEquipmentProfileForExercise('Bench Press');
    first.availablePlatesLb?.push(100);

    const second = getDefaultEquipmentProfileForExercise('Bench Press');
    expect(second.availablePlatesLb).toEqual([2.5, 5, 10, 25, 45]);

    const defaults = listDefaultEquipmentProfiles();
    defaults[0].availablePlatesLb?.push(100);
    expect(getDefaultEquipmentProfileByKind('barbell').availablePlatesLb).toEqual([2.5, 5, 10, 25, 45]);
  });

  it('lists default profiles and explicit mappings as copies', () => {
    const profiles = listDefaultEquipmentProfiles();
    const mappings = listExerciseEquipmentProfileMappings();

    expect(profiles.map((profile) => profile.equipmentKind)).toEqual([
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
    expect(mappings.some((mapping) => mapping.exerciseName === 'Bench Press' && mapping.equipmentKind === 'barbell')).toBe(true);
    expect(mappings.some((mapping) => mapping.exerciseName === 'Assisted Pull Up' && mapping.equipmentKind === 'assisted_bodyweight')).toBe(true);
  });
});
