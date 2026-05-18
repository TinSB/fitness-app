export const EQUIPMENT_KINDS = [
  'barbell',
  'smith_machine',
  'dumbbell',
  'selectorized_machine',
  'plate_loaded_machine',
  'cable_stack',
  'bodyweight',
  'assisted_bodyweight',
  'unknown',
] as const;

export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

export const LOAD_DISPLAY_MODES = [
  'total_weight',
  'per_hand',
  'per_side_plates',
  'machine_stack',
  'added_load',
  'bodyweight_adjusted',
  'total_plus_per_side',
] as const;

export type LoadDisplayMode = (typeof LOAD_DISPLAY_MODES)[number];

export const ROUNDING_PREFERENCES = ['conservative', 'nearest', 'progressive', 'readiness_based'] as const;

export type RoundingPreference = (typeof ROUNDING_PREFERENCES)[number];

export const READINESS_BIASES = ['conservative', 'neutral', 'progressive'] as const;

export type ReadinessBias = (typeof READINESS_BIASES)[number];

export const SET_PURPOSES = ['warmup', 'working', 'top_set', 'backoff', 'recovery'] as const;

export type SetPurpose = (typeof SET_PURPOSES)[number];

export const ROUNDING_DIRECTIONS = ['none', 'up', 'down', 'nearest', 'minimum_feasible'] as const;

export type RoundingDirection = (typeof ROUNDING_DIRECTIONS)[number];

export type FeasibleLoadReason =
  | 'below_minimum_bar_weight'
  | 'rounded_to_available_plates'
  | 'rounded_to_dumbbell_increment'
  | 'rounded_to_machine_stack_option'
  | 'base_machine_weight_included'
  | 'base_machine_weight_not_included'
  | 'rounded_by_readiness_bias'
  | 'incomplete_equipment_profile';

export type EquipmentProfile = {
  id: string;
  name: string;
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

export type FeasibleLoadInput = {
  theoreticalWeightLb: number;
  equipmentProfile: EquipmentProfile;
  readinessBias?: ReadinessBias;
  recentTrend?: 'decreasing' | 'stable' | 'increasing';
  setPurpose?: SetPurpose;
  preferLowerForWarmups?: boolean;
};

export type PlateBreakdown = {
  perSideLoadLb: number;
  platesPerSideLb: number[];
  totalAddedLoadLb: number;
  totalWeightLb: number;
  barWeightLb: number;
};

export type FeasibleLoadResult = {
  theoreticalWeightLb: number;
  feasibleWeightLb: number;
  displayWeightLb: number;
  displayMode: LoadDisplayMode;
  equipmentKind: EquipmentKind;
  plateBreakdown?: PlateBreakdown;
  perSideLoadLb?: number;
  perHandLoadLb?: number;
  baseWeightIncluded: boolean;
  baseWeightLb?: number;
  isEmptyBar: boolean;
  wasRounded: boolean;
  roundingDirection: RoundingDirection;
  reason: FeasibleLoadReason;
  warnings: string[];
  sourceOfTruthChanged: false;
};

export const DEFAULT_AVAILABLE_BARBELL_PLATES_LB = [2.5, 5, 10, 25, 45] as const;
export const DEFAULT_OLYMPIC_BAR_WEIGHT_LB = 45;
export const DEFAULT_SMITH_BAR_WEIGHT_LB = 25;
export const DEFAULT_DUMBBELL_INCREMENT_LB = 5;

const defaultPlates = () => [...DEFAULT_AVAILABLE_BARBELL_PLATES_LB];

export const createOlympicBarbellProfile = (): EquipmentProfile => ({
  id: 'default-olympic-barbell',
  name: 'Olympic barbell',
  equipmentKind: 'barbell',
  displayMode: 'total_plus_per_side',
  defaultBarWeightLb: DEFAULT_OLYMPIC_BAR_WEIGHT_LB,
  includeBaseWeight: true,
  availablePlatesLb: defaultPlates(),
  roundingPreference: 'readiness_based',
});

export const createSmithMachineProfile = (): EquipmentProfile => ({
  id: 'default-smith-machine',
  name: 'Smith machine',
  equipmentKind: 'smith_machine',
  displayMode: 'total_plus_per_side',
  defaultBarWeightLb: DEFAULT_SMITH_BAR_WEIGHT_LB,
  includeBaseWeight: true,
  availablePlatesLb: defaultPlates(),
  roundingPreference: 'readiness_based',
});

export const createDumbbellProfile = (): EquipmentProfile => ({
  id: 'default-dumbbell',
  name: 'Dumbbell',
  equipmentKind: 'dumbbell',
  displayMode: 'per_hand',
  includeBaseWeight: false,
  dumbbellIncrementLb: DEFAULT_DUMBBELL_INCREMENT_LB,
  roundingPreference: 'readiness_based',
});

export const createSelectorizedMachineProfile = (): EquipmentProfile => ({
  id: 'default-selectorized-machine',
  name: 'Selectorized machine',
  equipmentKind: 'selectorized_machine',
  displayMode: 'machine_stack',
  includeBaseWeight: false,
  roundingPreference: 'nearest',
});

export const createPlateLoadedMachineProfile = (includeBaseWeight = false): EquipmentProfile => ({
  id: 'default-plate-loaded-machine',
  name: 'Plate-loaded machine',
  equipmentKind: 'plate_loaded_machine',
  displayMode: 'total_plus_per_side',
  includeBaseWeight,
  availablePlatesLb: defaultPlates(),
  roundingPreference: 'readiness_based',
});

export const DEFAULT_EQUIPMENT_PROFILES = {
  olympicBarbell: createOlympicBarbellProfile(),
  smithMachine: createSmithMachineProfile(),
  dumbbell: createDumbbellProfile(),
  selectorizedMachine: createSelectorizedMachineProfile(),
  plateLoadedMachine: createPlateLoadedMachineProfile(),
} as const;
