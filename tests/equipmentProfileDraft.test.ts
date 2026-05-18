import { describe, expect, it } from 'vitest';
import {
  createDefaultEquipmentProfileDraft,
  normalizeEquipmentProfileDraft,
  validateEquipmentProfileDraft,
  type EquipmentProfileDraft,
} from '../src/engines/equipmentProfileDraft';

describe('equipment profile draft', () => {
  it('creates default drafts for required equipment categories', () => {
    expect(createDefaultEquipmentProfileDraft('barbell')).toMatchObject({
      equipmentKind: 'barbell',
      defaultBarWeightLb: 45,
      displayMode: 'total_plus_per_side',
    });
    expect(createDefaultEquipmentProfileDraft('smith_machine')).toMatchObject({
      equipmentKind: 'smith_machine',
      defaultBarWeightLb: 25,
    });
    expect(createDefaultEquipmentProfileDraft('dumbbell')).toMatchObject({
      equipmentKind: 'dumbbell',
      displayMode: 'per_hand',
      dumbbellIncrementLb: 5,
    });
    expect(createDefaultEquipmentProfileDraft('selectorized_machine').displayMode).toBe('machine_stack');
    expect(createDefaultEquipmentProfileDraft('plate_loaded_machine').availablePlatesLb).toEqual([2.5, 5, 10, 25, 45]);
    expect(createDefaultEquipmentProfileDraft('cable_stack')).toMatchObject({ equipmentKind: 'cable_stack', displayMode: 'machine_stack' });
    expect(createDefaultEquipmentProfileDraft('bodyweight').displayMode).toBe('bodyweight_adjusted');
    expect(createDefaultEquipmentProfileDraft('assisted_bodyweight').displayMode).toBe('bodyweight_adjusted');
    expect(createDefaultEquipmentProfileDraft('unknown').equipmentKind).toBe('unknown');
  });

  it('normalizes positive sorted unique plate and machine option arrays without mutating input', () => {
    const draft: EquipmentProfileDraft = {
      ...createDefaultEquipmentProfileDraft('barbell'),
      availablePlatesLb: [45, 2.5, -10, 5, 5, 10.2],
      machineWeightOptionsLb: [90, 30, 30, 15],
      notes: '  owner note  ',
    };
    const before = JSON.stringify(draft);

    const normalized = normalizeEquipmentProfileDraft(draft);

    expect(normalized.availablePlatesLb).toEqual([2.5, 5, 10, 45]);
    expect(normalized.machineWeightOptionsLb).toEqual([15, 30, 90]);
    expect(normalized.notes).toBe('owner note');
    expect(JSON.stringify(draft)).toBe(before);
  });

  it('validates barbell smith dumbbell and machine requirements', () => {
    expect(validateEquipmentProfileDraft({ ...createDefaultEquipmentProfileDraft('barbell'), defaultBarWeightLb: 0 }).errors).toContain('bar_weight_required');
    expect(validateEquipmentProfileDraft({ ...createDefaultEquipmentProfileDraft('smith_machine'), defaultBarWeightLb: -25 }).errors).toContain('bar_weight_required');
    expect(validateEquipmentProfileDraft({ ...createDefaultEquipmentProfileDraft('dumbbell'), dumbbellIncrementLb: 0 }).errors).toContain('dumbbell_increment_required');

    const selectorized = validateEquipmentProfileDraft(createDefaultEquipmentProfileDraft('selectorized_machine'));
    expect(selectorized.errors).toEqual([]);
    expect(selectorized.warnings).toContain('machine_stack_options_missing');

    const cable = validateEquipmentProfileDraft({ ...createDefaultEquipmentProfileDraft('cable_stack'), machineIncrementLb: 10 });
    expect(cable.warnings).not.toContain('machine_stack_options_missing');
  });

  it('warns for plate-loaded unknown base and unknown custom profiles without blocking drafts', () => {
    const plateLoaded = validateEquipmentProfileDraft({
      ...createDefaultEquipmentProfileDraft('plate_loaded_machine'),
      includeBaseWeight: true,
      baseMachineWeightLb: undefined,
    });
    const unknown = validateEquipmentProfileDraft(createDefaultEquipmentProfileDraft('unknown'));

    expect(plateLoaded.isValid).toBe(true);
    expect(plateLoaded.warnings).toContain('base_weight_unknown');
    expect(unknown.isValid).toBe(true);
    expect(unknown.warnings).toContain('unknown_custom_profile_needs_configuration');
  });

  it('keeps validation side-effect flags false', () => {
    const result = validateEquipmentProfileDraft(createDefaultEquipmentProfileDraft('barbell'));

    expect(result.sourceOfTruthChanged).toBe(false);
    expect(result.persistenceChanged).toBe(false);
  });
});
