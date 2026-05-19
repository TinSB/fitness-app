import type { EquipmentProfile, ReadinessBias, RoundingPreference, SetPurpose } from './equipmentAwareLoadModel';
import type { EquipmentAwareRecommendationDisplayResult } from './equipmentAwareRecommendationDisplay';
import { buildEquipmentAwareRecommendationDisplay } from './equipmentAwareRecommendationDisplay';
import { number } from './engineUtils';
import { convertKgToDisplayWeight, convertLbToKg, formatWeight } from './unitConversionEngine';
import type { UnitSettings } from '../models/training-model';

export type EquipmentAwareActionablePrescriptionInput = {
  exerciseName: string;
  plannedWeightKg: unknown;
  plannedReps?: unknown;
  plannedRir?: unknown;
  setPurpose: SetPurpose;
  unitSettings?: Partial<UnitSettings>;
  readinessBias?: ReadinessBias;
  roundingPreference?: RoundingPreference;
  equipmentProfile?: EquipmentProfile;
  showTheoreticalDetail?: boolean;
};

export type EquipmentAwareActionablePrescriptionResult = {
  primaryDisplayWeightLabel: string;
  primaryPrescriptionLabel: string;
  actionableWeightKg?: number;
  theoreticalWeightLb?: number;
  feasibleWeightLb?: number;
  detailLabels: string[];
  shouldUseFeasibleLoad: boolean;
  warning?: string;
  displayResult?: EquipmentAwareRecommendationDisplayResult;
  sourceOfTruthChanged: false;
  trainingAlgorithmChanged: false;
};

const positive = (value: unknown): number | undefined => {
  const safe = number(value);
  return safe > 0 ? safe : undefined;
};

const buildPrescriptionLabel = (weightLabel: string, reps?: unknown, rir?: unknown): string => {
  const safeReps = positive(reps);
  const safeRir = typeof rir === 'number' && Number.isFinite(rir) ? rir : undefined;
  return [
    safeReps ? `${weightLabel} × ${safeReps} 次` : weightLabel,
    safeRir !== undefined ? `${safeRir} RIR 余力` : '',
  ].filter(Boolean).join(' · ');
};

const shouldUseDisplayResult = (displayResult: EquipmentAwareRecommendationDisplayResult): boolean =>
  displayResult.isFeasible && displayResult.equipmentKind !== 'unknown' && Number.isFinite(displayResult.feasibleWeightLb) && displayResult.feasibleWeightLb > 0;

const isLabel = (value: string | undefined): value is string => Boolean(value);

export const buildActionableEquipmentAwarePrescription = (
  input: EquipmentAwareActionablePrescriptionInput,
): EquipmentAwareActionablePrescriptionResult => {
  const plannedWeightKg = positive(input.plannedWeightKg);
  const fallbackWeightLabel = plannedWeightKg ? formatWeight(plannedWeightKg, input.unitSettings) : '待输入';

  if (!plannedWeightKg) {
    return {
      primaryDisplayWeightLabel: fallbackWeightLabel,
      primaryPrescriptionLabel: buildPrescriptionLabel(fallbackWeightLabel, input.plannedReps, input.plannedRir),
      detailLabels: [],
      shouldUseFeasibleLoad: false,
      warning: '缺少可用的计划重量，保留原始处方显示',
      sourceOfTruthChanged: false,
      trainingAlgorithmChanged: false,
    };
  }

  const theoreticalWeightLb = convertKgToDisplayWeight(plannedWeightKg, 'lb');
  const displayResult = buildEquipmentAwareRecommendationDisplay({
    exerciseName: input.exerciseName,
    theoreticalWeightLb,
    setPurpose: input.setPurpose,
    readinessBias: input.readinessBias,
    roundingPreference: input.roundingPreference,
    equipmentProfile: input.equipmentProfile,
    showTheoreticalDetail: input.showTheoreticalDetail,
    locale: 'bilingual',
  });
  const shouldUseFeasibleLoad = shouldUseDisplayResult(displayResult);
  const primaryDisplayWeightLabel = shouldUseFeasibleLoad ? displayResult.primaryLabel : fallbackWeightLabel;
  const actionableWeightKg = shouldUseFeasibleLoad && displayResult.wasRounded ? convertLbToKg(displayResult.feasibleWeightLb) : plannedWeightKg;
  const detailLabels = shouldUseFeasibleLoad
    ? [displayResult.secondaryLabel, displayResult.plateBreakdownLabel, displayResult.detailLabel, displayResult.reasonLabel].filter(isLabel)
    : [displayResult.warningLabel || '未知器械档案，保留原始处方重量'];

  return {
    primaryDisplayWeightLabel,
    primaryPrescriptionLabel: buildPrescriptionLabel(primaryDisplayWeightLabel, input.plannedReps, input.plannedRir),
    actionableWeightKg,
    theoreticalWeightLb: displayResult.theoreticalWeightLb,
    feasibleWeightLb: displayResult.feasibleWeightLb,
    detailLabels,
    shouldUseFeasibleLoad,
    warning: shouldUseFeasibleLoad ? displayResult.warningLabel : displayResult.warningLabel || '未知器械档案，保留原始处方重量',
    displayResult,
    sourceOfTruthChanged: false,
    trainingAlgorithmChanged: false,
  };
};
