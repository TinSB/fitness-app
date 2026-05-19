import { buildActionableEquipmentAwarePrescription } from './equipmentAwareActionablePrescription';
import { number } from './engineUtils';

export type PracticalWarmupExercise = {
  id?: string;
  name?: string;
  kind?: string;
  fatigueCost?: string;
  progressionUnitKg?: number;
  warmupPreference?: string;
};

export type PracticalWarmupPolicyInput = {
  workWeightKg: unknown;
  exercise: PracticalWarmupExercise;
  intent?: 'normal' | 'pr_test' | 'max' | 'very_heavy';
  allowLowRepWarmups?: boolean;
};

export type PracticalWarmupSet = {
  weight: number;
  reps: number;
  label?: string;
};

export type PracticalWarmupPolicyResult = {
  warmupSets: PracticalWarmupSet[];
  maxWarmupSets: number;
  intent: 'normal' | 'pr_test' | 'max' | 'very_heavy';
  allowsLowRepWarmups: boolean;
  usesEquipmentAwareFeasibleLoads: true;
  sourceOfTruthChanged: false;
  persistenceChanged: false;
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const exerciseLabel = (exercise: PracticalWarmupExercise) => `${exercise.id || ''} ${exercise.name || ''}`.toLowerCase();

const isNoWarmupExercise = (exercise: PracticalWarmupExercise): boolean => {
  const label = exerciseLabel(exercise);
  return (
    normalize(exercise.warmupPreference) === 'never' ||
    label.includes('mobility') ||
    label.includes('灵活') ||
    label.includes('correction') ||
    label.includes('corrective') ||
    label.includes('纠偏') ||
    label.includes('activation') ||
    label.includes('breathing') ||
    label.includes('stretch')
  );
};

const isMachineOrDumbbell = (exercise: PracticalWarmupExercise): boolean => {
  const label = exerciseLabel(exercise);
  return (
    normalize(exercise.kind) === 'machine' ||
    normalize(exercise.kind) === 'isolation' ||
    label.includes('dumbbell') ||
    label.includes('db') ||
    label.includes('machine') ||
    label.includes('cable') ||
    label.includes('pulldown') ||
    label.includes('leg press')
  );
};

const isHeavyBarbellCompound = (exercise: PracticalWarmupExercise, workWeightKg: number): boolean => {
  const label = exerciseLabel(exercise);
  const barbellPattern =
    label.includes('bench') ||
    label.includes('squat') ||
    label.includes('deadlift') ||
    label.includes('press') ||
    label.includes('row') ||
    label.includes('barbell');
  return normalize(exercise.kind) === 'compound' && barbellPattern && (workWeightKg >= 60 || normalize(exercise.fatigueCost) === 'high');
};

const explicitLowRepIntent = (input: Pick<PracticalWarmupPolicyInput, 'intent' | 'allowLowRepWarmups'>) =>
  Boolean(input.allowLowRepWarmups || input.intent === 'pr_test' || input.intent === 'max' || input.intent === 'very_heavy');

const ratiosFor = (
  exercise: PracticalWarmupExercise,
  workWeightKg: number,
  allowLowRepWarmups: boolean,
): Array<{ ratio: number; reps: number; label: string }> => {
  if (isNoWarmupExercise(exercise) || workWeightKg < 25) return [];

  if (isMachineOrDumbbell(exercise)) {
    return [{ ratio: workWeightKg < 40 ? 0.55 : 0.6, reps: 8, label: '适应组' }];
  }

  if (isHeavyBarbellCompound(exercise, workWeightKg)) {
    if (allowLowRepWarmups) {
      return [
        { ratio: 0.35, reps: 8, label: '热身组' },
        { ratio: 0.6, reps: 4, label: '热身组' },
        { ratio: 0.82, reps: 2, label: '热身组' },
      ];
    }
    return [
      { ratio: 0.35, reps: 10, label: '热身组' },
      { ratio: 0.55, reps: 6, label: '热身组' },
      { ratio: 0.75, reps: 4, label: '热身组' },
    ];
  }

  return [
    { ratio: 0.45, reps: 8, label: '热身组' },
    { ratio: 0.65, reps: 5, label: '热身组' },
  ];
};

const resolveActionableWarmupWeightKg = (exercise: PracticalWarmupExercise, theoreticalWeightKg: number, reps: number): number => {
  const actionable = buildActionableEquipmentAwarePrescription({
    exerciseName: exercise.name || exercise.id || '',
    plannedWeightKg: theoreticalWeightKg,
    plannedReps: reps,
    setPurpose: 'warmup',
  });
  return number(actionable.actionableWeightKg ?? theoreticalWeightKg);
};

export const buildPracticalWarmupPolicy = (input: PracticalWarmupPolicyInput): PracticalWarmupPolicyResult => {
  const workWeightKg = number(input.workWeightKg);
  const intent = input.intent || 'normal';
  const allowsLowRepWarmups = explicitLowRepIntent(input);
  const ratios = ratiosFor(input.exercise, workWeightKg, allowsLowRepWarmups);
  const maxWarmupSets = Math.min(3, ratios.length);
  const warmupSets: PracticalWarmupSet[] = [];

  for (const item of ratios.slice(0, 3)) {
    const reps = allowsLowRepWarmups ? item.reps : Math.max(3, item.reps);
    const theoreticalWeightKg = workWeightKg * item.ratio;
    const actionableWeightKg = resolveActionableWarmupWeightKg(input.exercise, theoreticalWeightKg, reps);
    if (!actionableWeightKg || actionableWeightKg >= workWeightKg) continue;
    if (warmupSets.some((set) => Math.abs(set.weight - actionableWeightKg) < 0.01)) continue;
    warmupSets.push({
      weight: actionableWeightKg,
      reps,
      label: item.label,
    });
  }

  return {
    warmupSets: warmupSets.slice(0, maxWarmupSets),
    maxWarmupSets,
    intent,
    allowsLowRepWarmups,
    usesEquipmentAwareFeasibleLoads: true,
    sourceOfTruthChanged: false,
    persistenceChanged: false,
  };
};
