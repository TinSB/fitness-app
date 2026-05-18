import {
  type EquipmentKind,
  type EquipmentProfile,
  createDumbbellProfile,
  createOlympicBarbellProfile,
  createPlateLoadedMachineProfile,
  createSelectorizedMachineProfile,
  createSmithMachineProfile,
} from './equipmentAwareLoadModel';

export type ExerciseEquipmentProfileMapping = {
  exerciseName: string;
  normalizedName: string;
  equipmentKind: EquipmentKind;
};

const BARBELL_EXERCISES = [
  'Bench Press',
  'Flat Bench Press',
  'Barbell Bench Press',
  'Squat',
  'Back Squat',
  'Front Squat',
  'Romanian Deadlift',
  'RDL',
  'Deadlift',
  'Conventional Deadlift',
  'Barbell Row',
  'Bent Over Row',
  'Overhead Press',
  'Barbell Shoulder Press',
];

const SMITH_MACHINE_EXERCISES = [
  'Smith Machine Bench Press',
  'Smith Machine Squat',
  'Smith Machine Shoulder Press',
  'Smith Machine Incline Press',
];

const DUMBBELL_EXERCISES = [
  'Dumbbell Bench Press',
  'DB Bench Press',
  'Dumbbell Incline Press',
  'Dumbbell Shoulder Press',
  'Dumbbell Row',
  'One Arm Dumbbell Row',
  'Dumbbell Curl',
  'Hammer Curl',
  'Dumbbell Lateral Raise',
  'Dumbbell Romanian Deadlift',
  'Dumbbell RDL',
  'Dumbbell Fly',
];

const SELECTORIZED_EXERCISES = [
  'Lat Pulldown',
  'Seated Row Machine',
  'Machine Chest Press',
  'Chest Press Machine',
  'Shoulder Press Machine',
  'Leg Extension',
  'Leg Curl',
  'Seated Leg Curl',
  'Lying Leg Curl',
  'Hip Abductor',
  'Hip Adductor',
  'Pec Deck',
  'Rear Delt Machine',
  'Biceps Curl Machine',
  'Triceps Extension Machine',
];

const PLATE_LOADED_EXERCISES = [
  'Leg Press',
  'Hack Squat',
  'Plate Loaded Chest Press',
  'Hammer Strength Chest Press',
  'Plate Loaded Row',
  'Hammer Strength Row',
  'Plate Loaded Shoulder Press',
  'Calf Raise Machine',
  'Seated Calf Raise',
  'Belt Squat',
];

const CABLE_STACK_EXERCISES = [
  'Cable Row',
  'Cable Seated Row',
  'Cable Triceps Pushdown',
  'Triceps Pushdown',
  'Rope Pushdown',
  'Cable Curl',
  'Cable Fly',
  'Cable Lateral Raise',
  'Face Pull',
  'Cable Crunch',
];

const BODYWEIGHT_EXERCISES = [
  'Push Up',
  'Pull Up',
  'Chin Up',
  'Dip',
  'Plank',
  'Bodyweight Squat',
  'Walking Lunge',
  'Sit Up',
  'Crunch',
];

const ASSISTED_BODYWEIGHT_EXERCISES = [
  'Assisted Pull Up',
  'Assisted Dip',
  'Assisted Chin Up',
];

export const normalizeExerciseName = (name: unknown): string =>
  String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\brdls\b/g, 'rdl')
    .replace(/\brdl\b/g, 'romanian deadlift')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toMappings = (exerciseNames: string[], equipmentKind: EquipmentKind): ExerciseEquipmentProfileMapping[] =>
  exerciseNames.map((exerciseName) => ({
    exerciseName,
    normalizedName: normalizeExerciseName(exerciseName),
    equipmentKind,
  }));

const EXERCISE_EQUIPMENT_PROFILE_MAPPINGS: ExerciseEquipmentProfileMapping[] = [
  ...toMappings(BARBELL_EXERCISES, 'barbell'),
  ...toMappings(SMITH_MACHINE_EXERCISES, 'smith_machine'),
  ...toMappings(DUMBBELL_EXERCISES, 'dumbbell'),
  ...toMappings(SELECTORIZED_EXERCISES, 'selectorized_machine'),
  ...toMappings(PLATE_LOADED_EXERCISES, 'plate_loaded_machine'),
  ...toMappings(CABLE_STACK_EXERCISES, 'cable_stack'),
  ...toMappings(ASSISTED_BODYWEIGHT_EXERCISES, 'assisted_bodyweight'),
  ...toMappings(BODYWEIGHT_EXERCISES, 'bodyweight'),
];

const cloneProfile = (profile: EquipmentProfile): EquipmentProfile => ({
  ...profile,
  availablePlatesLb: profile.availablePlatesLb ? [...profile.availablePlatesLb] : undefined,
  machineWeightOptionsLb: profile.machineWeightOptionsLb ? [...profile.machineWeightOptionsLb] : undefined,
});

const createCableStackProfile = (): EquipmentProfile => ({
  ...createSelectorizedMachineProfile(),
  id: 'default-cable-stack',
  name: 'Cable stack',
  equipmentKind: 'cable_stack',
  displayMode: 'machine_stack',
  roundingPreference: 'nearest',
});

const createBodyweightProfile = (): EquipmentProfile => ({
  id: 'default-bodyweight',
  name: 'Bodyweight',
  equipmentKind: 'bodyweight',
  displayMode: 'bodyweight_adjusted',
  includeBaseWeight: false,
  roundingPreference: 'nearest',
});

const createAssistedBodyweightProfile = (): EquipmentProfile => ({
  id: 'default-assisted-bodyweight',
  name: 'Assisted bodyweight',
  equipmentKind: 'assisted_bodyweight',
  displayMode: 'bodyweight_adjusted',
  includeBaseWeight: false,
  roundingPreference: 'nearest',
});

const createUnknownProfile = (): EquipmentProfile => ({
  id: 'default-unknown-custom',
  name: 'Unknown / custom equipment',
  equipmentKind: 'unknown',
  displayMode: 'total_weight',
  includeBaseWeight: false,
  roundingPreference: 'nearest',
  notes: 'Unknown/custom fallback. Configure equipment profile before using equipment-aware recommendations.',
});

export const getDefaultEquipmentProfileByKind = (kind: EquipmentKind): EquipmentProfile => {
  if (kind === 'barbell') return createOlympicBarbellProfile();
  if (kind === 'smith_machine') return createSmithMachineProfile();
  if (kind === 'dumbbell') return createDumbbellProfile();
  if (kind === 'selectorized_machine') return createSelectorizedMachineProfile();
  if (kind === 'plate_loaded_machine') return createPlateLoadedMachineProfile(false);
  if (kind === 'cable_stack') return createCableStackProfile();
  if (kind === 'bodyweight') return createBodyweightProfile();
  if (kind === 'assisted_bodyweight') return createAssistedBodyweightProfile();
  return createUnknownProfile();
};

export const listDefaultEquipmentProfiles = (): EquipmentProfile[] =>
  [
    'barbell',
    'smith_machine',
    'dumbbell',
    'selectorized_machine',
    'plate_loaded_machine',
    'cable_stack',
    'bodyweight',
    'assisted_bodyweight',
    'unknown',
  ].map((kind) => getDefaultEquipmentProfileByKind(kind as EquipmentKind));

export const listExerciseEquipmentProfileMappings = (): ExerciseEquipmentProfileMapping[] =>
  EXERCISE_EQUIPMENT_PROFILE_MAPPINGS.map((mapping) => ({ ...mapping }));

export const inferEquipmentKindFromExerciseName = (name: unknown): EquipmentKind => {
  const normalizedName = normalizeExerciseName(name);
  if (!normalizedName) return 'unknown';

  const exactMatch = EXERCISE_EQUIPMENT_PROFILE_MAPPINGS.find((mapping) => mapping.normalizedName === normalizedName);
  if (exactMatch) return exactMatch.equipmentKind;

  return 'unknown';
};

export const getDefaultEquipmentProfileForExercise = (exerciseNameOrId: unknown): EquipmentProfile =>
  cloneProfile(getDefaultEquipmentProfileByKind(inferEquipmentKindFromExerciseName(exerciseNameOrId)));
