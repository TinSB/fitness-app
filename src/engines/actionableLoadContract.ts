import type { EquipmentProfile, ReadinessBias, RoundingPreference, SetPurpose } from './equipmentAwareLoadModel';
import { buildActionableEquipmentAwarePrescription, type EquipmentAwareActionablePrescriptionResult } from './equipmentAwareActionablePrescription';
import { number } from './engineUtils';
import type { UnitSettings } from '../models/training-model';

export type ActionableLoadContractInput = {
  exerciseName: string;
  rawTheoreticalLoadKg: unknown;
  plannedReps?: unknown;
  plannedRir?: unknown;
  setPurpose: SetPurpose;
  unitSettings?: Partial<UnitSettings>;
  readinessBias?: ReadinessBias;
  roundingPreference?: RoundingPreference;
  equipmentProfile?: EquipmentProfile;
  showTheoreticalDetail?: boolean;
};

export type ActionableLoadContractResult = {
  rawTheoreticalLoadKg?: number;
  actionableLoadKg?: number;
  validationBaselineKg?: number;
  prescription: EquipmentAwareActionablePrescriptionResult;
  rawTheoreticalLoadIsValidationBaseline: false;
  sourceOfTruthChanged: false;
  persistenceChanged: false;
  routeSurfaceChanged: false;
};

export const resolveActionableLoadContract = (input: ActionableLoadContractInput): ActionableLoadContractResult => {
  const rawTheoreticalLoadKg = number(input.rawTheoreticalLoadKg) > 0 ? number(input.rawTheoreticalLoadKg) : undefined;
  const prescription = buildActionableEquipmentAwarePrescription({
    exerciseName: input.exerciseName,
    plannedWeightKg: rawTheoreticalLoadKg,
    plannedReps: input.plannedReps,
    plannedRir: input.plannedRir,
    setPurpose: input.setPurpose,
    unitSettings: input.unitSettings,
    readinessBias: input.readinessBias,
    roundingPreference: input.roundingPreference,
    equipmentProfile: input.equipmentProfile,
    showTheoreticalDetail: input.showTheoreticalDetail,
  });
  const actionableLoadKg = number(prescription.actionableWeightKg) > 0 ? number(prescription.actionableWeightKg) : rawTheoreticalLoadKg;

  return {
    rawTheoreticalLoadKg,
    actionableLoadKg,
    validationBaselineKg: actionableLoadKg,
    prescription,
    rawTheoreticalLoadIsValidationBaseline: false,
    sourceOfTruthChanged: false,
    persistenceChanged: false,
    routeSurfaceChanged: false,
  };
};
