import {
  DEFAULT_AVAILABLE_BARBELL_PLATES_LB,
  DEFAULT_DUMBBELL_INCREMENT_LB,
  DEFAULT_OLYMPIC_BAR_WEIGHT_LB,
  DEFAULT_SMITH_BAR_WEIGHT_LB,
  type EquipmentKind,
  type EquipmentProfile,
  type FeasibleLoadInput,
  type FeasibleLoadReason,
  type FeasibleLoadResult,
  type LoadDisplayMode,
  type PlateBreakdown,
  type ReadinessBias,
  type RoundingDirection,
  type RoundingPreference,
  type SetPurpose,
  createDumbbellProfile,
  createOlympicBarbellProfile,
  createPlateLoadedMachineProfile,
  createSelectorizedMachineProfile,
  createSmithMachineProfile,
} from './equipmentAwareLoadModel';

const SCALE = 2;

const toUnits = (value: number | undefined): number => Math.max(0, Math.round((Number.isFinite(value) ? Number(value) : 0) * SCALE));
const fromUnits = (value: number): number => Math.round(value) / SCALE;
const unique = <T>(values: T[]): T[] => [...new Set(values)];

const normalizePositiveNumbers = (values?: readonly number[]): number[] =>
  unique((values || []).map((value) => fromUnits(toUnits(value))).filter((value) => value > 0)).sort((a, b) => a - b);

const normalizePlates = (profile: EquipmentProfile): number[] => {
  const plates = normalizePositiveNumbers(profile.availablePlatesLb);
  return plates.length ? plates : [...DEFAULT_AVAILABLE_BARBELL_PLATES_LB];
};

const normalizeOptions = (values?: readonly number[]): number[] => normalizePositiveNumbers(values);

const effectiveRoundingPreference = (
  roundingPreference: RoundingPreference | undefined,
  readinessBias: ReadinessBias | undefined,
  setPurpose: SetPurpose | undefined,
  preferLowerForWarmups?: boolean,
): Exclude<RoundingPreference, 'readiness_based'> => {
  if (setPurpose === 'warmup' && preferLowerForWarmups !== false) return 'conservative';
  if (setPurpose === 'recovery') return 'conservative';
  if (roundingPreference && roundingPreference !== 'readiness_based') return roundingPreference;
  if (setPurpose === 'top_set' && readinessBias === 'progressive') return 'progressive';
  if (readinessBias === 'conservative') return 'conservative';
  if (readinessBias === 'progressive') return 'progressive';
  return 'nearest';
};

const roundingDirection = (theoretical: number, feasible: number, preference: RoundingPreference): RoundingDirection => {
  if (feasible === theoretical) return 'none';
  if (preference === 'nearest') return 'nearest';
  return feasible > theoretical ? 'up' : 'down';
};

const result = (input: {
  theoreticalWeightLb: number;
  feasibleWeightLb: number;
  displayWeightLb?: number;
  displayMode: LoadDisplayMode;
  equipmentKind: EquipmentKind;
  plateBreakdown?: PlateBreakdown;
  perSideLoadLb?: number;
  perHandLoadLb?: number;
  baseWeightIncluded?: boolean;
  baseWeightLb?: number;
  isEmptyBar?: boolean;
  roundingDirection: RoundingDirection;
  reason: FeasibleLoadReason;
  warnings?: string[];
}): FeasibleLoadResult => ({
  theoreticalWeightLb: fromUnits(toUnits(input.theoreticalWeightLb)),
  feasibleWeightLb: fromUnits(toUnits(input.feasibleWeightLb)),
  displayWeightLb: fromUnits(toUnits(input.displayWeightLb ?? input.feasibleWeightLb)),
  displayMode: input.displayMode,
  equipmentKind: input.equipmentKind,
  plateBreakdown: input.plateBreakdown,
  perSideLoadLb: input.perSideLoadLb,
  perHandLoadLb: input.perHandLoadLb,
  baseWeightIncluded: Boolean(input.baseWeightIncluded),
  baseWeightLb: input.baseWeightLb,
  isEmptyBar: Boolean(input.isEmptyBar),
  wasRounded: fromUnits(toUnits(input.theoreticalWeightLb)) !== fromUnits(toUnits(input.feasibleWeightLb)),
  roundingDirection: input.roundingDirection,
  reason: input.reason,
  warnings: input.warnings || [],
  sourceOfTruthChanged: false,
});

export const getDefaultEquipmentProfile = (kind: EquipmentKind): EquipmentProfile => {
  if (kind === 'barbell') return createOlympicBarbellProfile();
  if (kind === 'smith_machine') return createSmithMachineProfile();
  if (kind === 'dumbbell') return createDumbbellProfile();
  if (kind === 'selectorized_machine' || kind === 'cable_stack') return {
    ...createSelectorizedMachineProfile(),
    equipmentKind: kind,
    id: `default-${kind}`,
    name: kind === 'cable_stack' ? 'Cable stack' : 'Selectorized machine',
  };
  if (kind === 'plate_loaded_machine') return createPlateLoadedMachineProfile();
  return {
    id: `default-${kind}`,
    name: kind === 'unknown' ? 'Unknown equipment' : kind,
    equipmentKind: kind,
    displayMode: kind === 'bodyweight' || kind === 'assisted_bodyweight' ? 'bodyweight_adjusted' : 'total_weight',
    includeBaseWeight: false,
    roundingPreference: 'nearest',
  };
};

export const chooseFeasibleCandidate = (
  theoreticalWeightLb: number,
  candidatesLb: readonly number[],
  roundingPreference: RoundingPreference = 'nearest',
  readinessBias: ReadinessBias = 'neutral',
  setPurpose: SetPurpose = 'working',
): number => {
  const candidates = normalizeOptions(candidatesLb);
  if (!candidates.length) return fromUnits(toUnits(theoreticalWeightLb));
  const theoreticalUnits = toUnits(theoreticalWeightLb);
  const candidateUnits = candidates.map(toUnits).sort((a, b) => a - b);
  const lower = [...candidateUnits].reverse().find((candidate) => candidate <= theoreticalUnits);
  const upper = candidateUnits.find((candidate) => candidate >= theoreticalUnits);
  const preference = effectiveRoundingPreference(roundingPreference, readinessBias, setPurpose);

  if (preference === 'conservative') return fromUnits(lower ?? candidateUnits[0]);
  if (preference === 'progressive') return fromUnits(upper ?? candidateUnits[candidateUnits.length - 1]);
  if (lower === undefined) return fromUnits(upper ?? candidateUnits[0]);
  if (upper === undefined) return fromUnits(lower);
  const lowerDistance = Math.abs(theoreticalUnits - lower);
  const upperDistance = Math.abs(upper - theoreticalUnits);
  return fromUnits(lowerDistance <= upperDistance ? lower : upper);
};

const buildAddedLoadBreakdown = (addedLoadLb: number, platesLb: readonly number[], barWeightLb: number): PlateBreakdown => {
  let remainingUnits = Math.max(0, Math.round(toUnits(addedLoadLb) / 2));
  const plates = normalizePositiveNumbers(platesLb).sort((a, b) => b - a);
  const platesPerSideLb: number[] = [];

  for (const plate of plates) {
    const plateUnits = toUnits(plate);
    while (plateUnits > 0 && remainingUnits >= plateUnits) {
      platesPerSideLb.push(plate);
      remainingUnits -= plateUnits;
    }
  }

  const perSideLoadLb = platesPerSideLb.reduce((sum, plate) => sum + plate, 0);
  const totalAddedLoadLb = fromUnits(toUnits(perSideLoadLb * 2));
  return {
    perSideLoadLb,
    platesPerSideLb,
    totalAddedLoadLb,
    totalWeightLb: fromUnits(toUnits(barWeightLb + totalAddedLoadLb)),
    barWeightLb,
  };
};

const buildFeasiblePlateCandidates = (baseWeightLb: number, platesLb: readonly number[], maxTheoreticalLb: number): number[] => {
  const smallestPlate = Math.min(...normalizePositiveNumbers(platesLb));
  const step = smallestPlate * 2;
  const maxTarget = Math.max(baseWeightLb, maxTheoreticalLb + step * 6);
  const values: number[] = [];
  for (let valueUnits = toUnits(baseWeightLb); valueUnits <= toUnits(maxTarget); valueUnits += toUnits(step)) {
    values.push(fromUnits(valueUnits));
  }
  return values;
};

export const buildPlateBreakdown = (totalWeightLb: number, profile: EquipmentProfile): PlateBreakdown => {
  const barWeightLb = profile.defaultBarWeightLb ?? 0;
  const addedLoadLb = Math.max(0, fromUnits(toUnits(totalWeightLb - barWeightLb)));
  return buildAddedLoadBreakdown(addedLoadLb, normalizePlates(profile), barWeightLb);
};

const resolveBarLikeFeasibleLoad = (
  input: FeasibleLoadInput,
  fallbackBarWeightLb: number,
  equipmentKind: Extract<EquipmentKind, 'barbell' | 'smith_machine'>,
): FeasibleLoadResult => {
  const profile = input.equipmentProfile;
  const theoreticalWeightLb = fromUnits(toUnits(input.theoreticalWeightLb));
  const barWeightLb = profile.defaultBarWeightLb ?? fallbackBarWeightLb;
  const plates = normalizePlates(profile);

  if (theoreticalWeightLb <= barWeightLb) {
    const emptyBreakdown = buildAddedLoadBreakdown(0, plates, barWeightLb);
    return result({
      theoreticalWeightLb,
      feasibleWeightLb: barWeightLb,
      displayMode: profile.displayMode,
      equipmentKind,
      plateBreakdown: emptyBreakdown,
      perSideLoadLb: 0,
      baseWeightIncluded: true,
      baseWeightLb: barWeightLb,
      isEmptyBar: true,
      roundingDirection: theoreticalWeightLb === barWeightLb ? 'none' : 'minimum_feasible',
      reason: theoreticalWeightLb === barWeightLb ? 'rounded_to_available_plates' : 'below_minimum_bar_weight',
    });
  }

  const preference = effectiveRoundingPreference(
    profile.roundingPreference,
    input.readinessBias,
    input.setPurpose,
    input.preferLowerForWarmups,
  );
  const candidates = buildFeasiblePlateCandidates(barWeightLb, plates, theoreticalWeightLb);
  const feasibleWeightLb = chooseFeasibleCandidate(theoreticalWeightLb, candidates, preference, input.readinessBias, input.setPurpose);
  const breakdown = buildPlateBreakdown(feasibleWeightLb, { ...profile, defaultBarWeightLb: barWeightLb, availablePlatesLb: plates });

  return result({
    theoreticalWeightLb,
    feasibleWeightLb,
    displayMode: profile.displayMode,
    equipmentKind,
    plateBreakdown: breakdown,
    perSideLoadLb: breakdown.perSideLoadLb,
    baseWeightIncluded: true,
    baseWeightLb: barWeightLb,
    isEmptyBar: breakdown.totalAddedLoadLb === 0,
    roundingDirection: roundingDirection(theoreticalWeightLb, feasibleWeightLb, preference),
    reason: profile.roundingPreference === 'readiness_based' || input.readinessBias ? 'rounded_by_readiness_bias' : 'rounded_to_available_plates',
  });
};

export const resolveBarbellFeasibleLoad = (input: FeasibleLoadInput): FeasibleLoadResult =>
  resolveBarLikeFeasibleLoad(input, DEFAULT_OLYMPIC_BAR_WEIGHT_LB, 'barbell');

export const resolveSmithMachineFeasibleLoad = (input: FeasibleLoadInput): FeasibleLoadResult =>
  resolveBarLikeFeasibleLoad(input, DEFAULT_SMITH_BAR_WEIGHT_LB, 'smith_machine');

export const resolveDumbbellFeasibleLoad = (input: FeasibleLoadInput): FeasibleLoadResult => {
  const profile = input.equipmentProfile;
  const theoreticalWeightLb = fromUnits(toUnits(input.theoreticalWeightLb));
  const increment = profile.dumbbellIncrementLb && profile.dumbbellIncrementLb > 0 ? profile.dumbbellIncrementLb : DEFAULT_DUMBBELL_INCREMENT_LB;
  const maxCandidate = Math.max(theoreticalWeightLb + increment * 4, increment);
  const candidates: number[] = [];
  for (let valueUnits = toUnits(increment); valueUnits <= toUnits(maxCandidate); valueUnits += toUnits(increment)) {
    candidates.push(fromUnits(valueUnits));
  }
  const preference = effectiveRoundingPreference(profile.roundingPreference, input.readinessBias, input.setPurpose, input.preferLowerForWarmups);
  const feasibleWeightLb = chooseFeasibleCandidate(theoreticalWeightLb, candidates, preference, input.readinessBias, input.setPurpose);

  return result({
    theoreticalWeightLb,
    feasibleWeightLb,
    displayMode: 'per_hand',
    equipmentKind: 'dumbbell',
    perHandLoadLb: feasibleWeightLb,
    roundingDirection: roundingDirection(theoreticalWeightLb, feasibleWeightLb, preference),
    reason: profile.roundingPreference === 'readiness_based' || input.readinessBias ? 'rounded_by_readiness_bias' : 'rounded_to_dumbbell_increment',
  });
};

export const resolveSelectorizedMachineFeasibleLoad = (input: FeasibleLoadInput): FeasibleLoadResult => {
  const profile = input.equipmentProfile;
  const theoreticalWeightLb = fromUnits(toUnits(input.theoreticalWeightLb));
  const options = normalizeOptions(profile.machineWeightOptionsLb);
  const increment = profile.machineIncrementLb && profile.machineIncrementLb > 0 ? profile.machineIncrementLb : 0;
  const candidates = options.length
    ? options
    : increment
      ? Array.from({ length: Math.max(1, Math.ceil((theoreticalWeightLb + increment * 4) / increment)) }, (_, index) =>
          fromUnits(toUnits((index + 1) * increment)),
        )
      : [theoreticalWeightLb];
  const preference = effectiveRoundingPreference(profile.roundingPreference, input.readinessBias, input.setPurpose, input.preferLowerForWarmups);
  const feasibleWeightLb = chooseFeasibleCandidate(theoreticalWeightLb, candidates, preference, input.readinessBias, input.setPurpose);

  return result({
    theoreticalWeightLb,
    feasibleWeightLb,
    displayMode: 'machine_stack',
    equipmentKind: profile.equipmentKind === 'cable_stack' ? 'cable_stack' : 'selectorized_machine',
    roundingDirection: roundingDirection(theoreticalWeightLb, feasibleWeightLb, preference),
    reason: options.length || increment ? 'rounded_to_machine_stack_option' : 'incomplete_equipment_profile',
    warnings: options.length || increment ? [] : ['incomplete_equipment_profile'],
  });
};

export const resolvePlateLoadedMachineFeasibleLoad = (input: FeasibleLoadInput): FeasibleLoadResult => {
  const profile = input.equipmentProfile;
  const theoreticalWeightLb = fromUnits(toUnits(input.theoreticalWeightLb));
  const plates = normalizePlates(profile);
  const hasBase = typeof profile.baseMachineWeightLb === 'number' && Number.isFinite(profile.baseMachineWeightLb);
  const baseWeightLb = profile.includeBaseWeight && hasBase ? Math.max(0, profile.baseMachineWeightLb || 0) : 0;
  const targetAddedLoadLb = Math.max(0, theoreticalWeightLb - baseWeightLb);
  const preference = effectiveRoundingPreference(profile.roundingPreference, input.readinessBias, input.setPurpose, input.preferLowerForWarmups);
  const addedCandidates = buildFeasiblePlateCandidates(0, plates, targetAddedLoadLb);
  const feasibleAddedLoadLb = chooseFeasibleCandidate(targetAddedLoadLb, addedCandidates, preference, input.readinessBias, input.setPurpose);
  const feasibleWeightLb = fromUnits(toUnits(baseWeightLb + feasibleAddedLoadLb));
  const breakdown = buildAddedLoadBreakdown(feasibleAddedLoadLb, plates, baseWeightLb);
  const baseWeightIncluded = profile.includeBaseWeight && hasBase;
  const warnings = baseWeightIncluded ? [] : ['base_machine_weight_not_included'];

  return result({
    theoreticalWeightLb,
    feasibleWeightLb,
    displayWeightLb: baseWeightIncluded ? feasibleWeightLb : feasibleAddedLoadLb,
    displayMode: profile.displayMode,
    equipmentKind: 'plate_loaded_machine',
    plateBreakdown: breakdown,
    perSideLoadLb: breakdown.perSideLoadLb,
    baseWeightIncluded,
    baseWeightLb: baseWeightIncluded ? baseWeightLb : undefined,
    roundingDirection: roundingDirection(theoreticalWeightLb, feasibleWeightLb, preference),
    reason: baseWeightIncluded ? 'base_machine_weight_included' : 'base_machine_weight_not_included',
    warnings,
  });
};

const resolveUnknownFeasibleLoad = (input: FeasibleLoadInput): FeasibleLoadResult => {
  const profile = input.equipmentProfile;
  const theoreticalWeightLb = fromUnits(toUnits(input.theoreticalWeightLb));
  return result({
    theoreticalWeightLb,
    feasibleWeightLb: theoreticalWeightLb,
    displayMode: profile.displayMode || 'total_weight',
    equipmentKind: profile.equipmentKind || 'unknown',
    roundingDirection: 'none',
    reason: 'incomplete_equipment_profile',
    warnings: ['incomplete_equipment_profile'],
  });
};

export const resolveFeasibleLoad = (input: FeasibleLoadInput): FeasibleLoadResult => {
  if (input.equipmentProfile.equipmentKind === 'barbell') return resolveBarbellFeasibleLoad(input);
  if (input.equipmentProfile.equipmentKind === 'smith_machine') return resolveSmithMachineFeasibleLoad(input);
  if (input.equipmentProfile.equipmentKind === 'dumbbell') return resolveDumbbellFeasibleLoad(input);
  if (input.equipmentProfile.equipmentKind === 'selectorized_machine' || input.equipmentProfile.equipmentKind === 'cable_stack') {
    return resolveSelectorizedMachineFeasibleLoad(input);
  }
  if (input.equipmentProfile.equipmentKind === 'plate_loaded_machine') return resolvePlateLoadedMachineFeasibleLoad(input);
  return resolveUnknownFeasibleLoad(input);
};

export const formatFeasibleLoadSummary = (resolved: FeasibleLoadResult): string => {
  if (resolved.plateBreakdown && resolved.displayMode === 'total_plus_per_side') {
    const plates = resolved.plateBreakdown.platesPerSideLb.length ? resolved.plateBreakdown.platesPerSideLb.join(' + ') : 'empty bar';
    return `${resolved.feasibleWeightLb} lb total (${plates} per side)`;
  }
  if (resolved.perHandLoadLb !== undefined) return `${resolved.perHandLoadLb} lb per hand`;
  return `${resolved.displayWeightLb} lb`;
};
