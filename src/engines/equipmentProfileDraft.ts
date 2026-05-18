import {
  type EquipmentKind,
  type EquipmentProfile,
  type LoadDisplayMode,
  type RoundingPreference,
  createDumbbellProfile,
  createOlympicBarbellProfile,
  createPlateLoadedMachineProfile,
  createSelectorizedMachineProfile,
  createSmithMachineProfile,
} from './equipmentAwareLoadModel';

export type EquipmentProfileDraft = {
  equipmentKind: EquipmentKind;
  displayMode: LoadDisplayMode;
  defaultBarWeightLb?: number;
  baseMachineWeightLb?: number;
  includeBaseWeight: boolean;
  availablePlatesLb?: number[];
  dumbbellIncrementLb?: number;
  machineWeightOptionsLb?: number[];
  machineIncrementLb?: number;
  roundingPreference: RoundingPreference;
  notes?: string;
};

export type EquipmentProfileDraftValidationResult = {
  normalizedDraft: EquipmentProfileDraft;
  errors: string[];
  warnings: string[];
  isValid: boolean;
  sourceOfTruthChanged: false;
  persistenceChanged: false;
};

const uniqueSortedPositive = (values?: readonly number[]): number[] | undefined => {
  const normalized = [...new Set((values || []).map((value) => Math.round(Number(value) * 2) / 2).filter((value) => Number.isFinite(value) && value > 0))]
    .sort((left, right) => left - right);
  return normalized.length ? normalized : undefined;
};

const positiveOrUndefined = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed * 2) / 2;
};

const draftFromProfile = (profile: EquipmentProfile): EquipmentProfileDraft => ({
  equipmentKind: profile.equipmentKind,
  displayMode: profile.displayMode,
  defaultBarWeightLb: profile.defaultBarWeightLb,
  baseMachineWeightLb: profile.baseMachineWeightLb,
  includeBaseWeight: profile.includeBaseWeight,
  availablePlatesLb: profile.availablePlatesLb ? [...profile.availablePlatesLb] : undefined,
  dumbbellIncrementLb: profile.dumbbellIncrementLb,
  machineWeightOptionsLb: profile.machineWeightOptionsLb ? [...profile.machineWeightOptionsLb] : undefined,
  machineIncrementLb: profile.machineIncrementLb,
  roundingPreference: profile.roundingPreference,
  notes: profile.notes,
});

export const createDefaultEquipmentProfileDraft = (kind: EquipmentKind): EquipmentProfileDraft => {
  if (kind === 'barbell') return draftFromProfile(createOlympicBarbellProfile());
  if (kind === 'smith_machine') return draftFromProfile(createSmithMachineProfile());
  if (kind === 'dumbbell') return draftFromProfile(createDumbbellProfile());
  if (kind === 'selectorized_machine') return draftFromProfile(createSelectorizedMachineProfile());
  if (kind === 'cable_stack') return { ...draftFromProfile(createSelectorizedMachineProfile()), equipmentKind: 'cable_stack' };
  if (kind === 'plate_loaded_machine') return draftFromProfile(createPlateLoadedMachineProfile(false));
  if (kind === 'bodyweight') {
    return {
      equipmentKind: 'bodyweight',
      displayMode: 'bodyweight_adjusted',
      includeBaseWeight: false,
      roundingPreference: 'nearest',
    };
  }
  if (kind === 'assisted_bodyweight') {
    return {
      equipmentKind: 'assisted_bodyweight',
      displayMode: 'bodyweight_adjusted',
      includeBaseWeight: false,
      roundingPreference: 'nearest',
    };
  }
  return {
    equipmentKind: 'unknown',
    displayMode: 'total_weight',
    includeBaseWeight: false,
    roundingPreference: 'nearest',
    notes: 'Unknown/custom profile needs owner review before live use.',
  };
};

export const normalizeEquipmentProfileDraft = (draft: EquipmentProfileDraft): EquipmentProfileDraft => ({
  ...draft,
  defaultBarWeightLb: positiveOrUndefined(draft.defaultBarWeightLb),
  baseMachineWeightLb: positiveOrUndefined(draft.baseMachineWeightLb),
  availablePlatesLb: uniqueSortedPositive(draft.availablePlatesLb),
  dumbbellIncrementLb: positiveOrUndefined(draft.dumbbellIncrementLb),
  machineWeightOptionsLb: uniqueSortedPositive(draft.machineWeightOptionsLb),
  machineIncrementLb: positiveOrUndefined(draft.machineIncrementLb),
  notes: draft.notes?.trim() || undefined,
});

export const validateEquipmentProfileDraft = (draft: EquipmentProfileDraft): EquipmentProfileDraftValidationResult => {
  const normalizedDraft = normalizeEquipmentProfileDraft(draft);
  const errors: string[] = [];
  const warnings: string[] = [];

  if ((normalizedDraft.equipmentKind === 'barbell' || normalizedDraft.equipmentKind === 'smith_machine') && !normalizedDraft.defaultBarWeightLb) {
    errors.push('bar_weight_required');
  }

  if (normalizedDraft.equipmentKind === 'dumbbell' && !normalizedDraft.dumbbellIncrementLb) {
    errors.push('dumbbell_increment_required');
  }

  if ((normalizedDraft.equipmentKind === 'barbell' || normalizedDraft.equipmentKind === 'smith_machine' || normalizedDraft.equipmentKind === 'plate_loaded_machine') && !normalizedDraft.availablePlatesLb?.length) {
    errors.push('available_plates_required');
  }

  if ((normalizedDraft.equipmentKind === 'selectorized_machine' || normalizedDraft.equipmentKind === 'cable_stack') && !normalizedDraft.machineWeightOptionsLb?.length && !normalizedDraft.machineIncrementLb) {
    warnings.push('machine_stack_options_missing');
  }

  if (normalizedDraft.equipmentKind === 'plate_loaded_machine' && normalizedDraft.includeBaseWeight && !normalizedDraft.baseMachineWeightLb) {
    warnings.push('base_weight_unknown');
  }

  if (normalizedDraft.equipmentKind === 'unknown') {
    warnings.push('unknown_custom_profile_needs_configuration');
  }

  if (draft.machineIncrementLb !== undefined && Number(draft.machineIncrementLb) <= 0) errors.push('machine_increment_must_be_positive');
  if (draft.dumbbellIncrementLb !== undefined && Number(draft.dumbbellIncrementLb) <= 0) errors.push('dumbbell_increment_must_be_positive');
  if (draft.defaultBarWeightLb !== undefined && Number(draft.defaultBarWeightLb) <= 0) errors.push('bar_weight_must_be_positive');

  return {
    normalizedDraft,
    errors,
    warnings,
    isValid: errors.length === 0,
    sourceOfTruthChanged: false,
    persistenceChanged: false,
  };
};
