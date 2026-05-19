import {
  type EquipmentProfile,
  type FeasibleLoadResult,
  type LoadDisplayMode,
  type ReadinessBias,
  type RoundingPreference,
  type SetPurpose,
} from './equipmentAwareLoadModel';
import { resolveFeasibleLoad } from './feasibleLoadEngine';
import { getDefaultEquipmentProfileForExercise } from './exerciseEquipmentProfiles';

export type EquipmentAwareRecommendationDisplayLocale = 'zh' | 'en' | 'bilingual';

export type EquipmentAwareRecommendationDisplayInput = {
  exerciseName: string;
  theoreticalWeightLb: number;
  setPurpose: SetPurpose;
  readinessBias?: ReadinessBias;
  roundingPreference?: RoundingPreference;
  equipmentProfile?: EquipmentProfile;
  showTheoreticalDetail?: boolean;
  locale?: EquipmentAwareRecommendationDisplayLocale;
};

export type EquipmentAwareRecommendationDisplayResult = {
  exerciseName: string;
  equipmentKind: EquipmentProfile['equipmentKind'];
  displayMode: LoadDisplayMode;
  theoreticalWeightLb: number;
  feasibleWeightLb: number;
  primaryLabel: string;
  secondaryLabel: string;
  detailLabel: string;
  plateBreakdownLabel?: string;
  warningLabel?: string;
  reasonLabel: string;
  isFeasible: boolean;
  isEmptyBar: boolean;
  wasRounded: boolean;
  sourceOfTruthChanged: false;
  trainingAlgorithmChanged: false;
};

const formatLb = (value: number): string => {
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(1)}`;
};

const cloneProfile = (profile: EquipmentProfile): EquipmentProfile => ({
  ...profile,
  availablePlatesLb: profile.availablePlatesLb ? [...profile.availablePlatesLb] : undefined,
  machineWeightOptionsLb: profile.machineWeightOptionsLb ? [...profile.machineWeightOptionsLb] : undefined,
});

const withRoundingOverride = (profile: EquipmentProfile, roundingPreference?: RoundingPreference): EquipmentProfile => {
  const cloned = cloneProfile(profile);
  return roundingPreference ? { ...cloned, roundingPreference } : cloned;
};

const platesLabel = (plates?: readonly number[]): string | undefined => {
  if (!plates?.length) return undefined;
  return `每边 ${plates.map(formatLb).join(' + ')}`;
};

const equipmentDetailLabel = (resolved: FeasibleLoadResult): string => {
  if (resolved.equipmentKind === 'barbell' && resolved.baseWeightLb !== undefined) {
    return `杆重 ${formatLb(resolved.baseWeightLb)} lb 已计入`;
  }
  if (resolved.equipmentKind === 'smith_machine' && resolved.baseWeightLb !== undefined) {
    return `Smith 杆重 ${formatLb(resolved.baseWeightLb)} lb 已计入`;
  }
  if (resolved.equipmentKind === 'plate_loaded_machine' && resolved.baseWeightIncluded && resolved.baseWeightLb !== undefined) {
    return `器械自重/底座重量 ${formatLb(resolved.baseWeightLb)} lb 已计入`;
  }
  if (resolved.equipmentKind === 'dumbbell') return '哑铃按每只手记录，不合并双手总重量';
  if (resolved.equipmentKind === 'selectorized_machine' || resolved.equipmentKind === 'cable_stack') return '按器械插片/重量栈显示';
  return '显示值仅用于训练建议展示，不写入训练数据';
};

const reasonLabel = (resolved: FeasibleLoadResult): string => {
  if (resolved.reason === 'below_minimum_bar_weight') {
    if (resolved.equipmentKind === 'smith_machine') return '理论重量低于 Smith 杆重，使用空杆';
    return '理论重量低于空杆，使用空杆热身';
  }
  if (resolved.reason === 'rounded_to_available_plates') return '已按可装载杠铃片调整到可执行重量';
  if (resolved.reason === 'rounded_to_dumbbell_increment') return '已按哑铃 5 lb 递增调整';
  if (resolved.reason === 'rounded_to_machine_stack_option') return '已按器械重量栈/插片选项调整';
  if (resolved.reason === 'base_machine_weight_included') return '已按配置计入器械自重/底座重量';
  if (resolved.reason === 'base_machine_weight_not_included') return '器械自重未计入，仅显示已加重量';
  if (resolved.reason === 'rounded_by_readiness_bias') return '已按准备度和可装载重量调整';
  return '未知器械档案，建议之后配置器械';
};

const warningLabel = (resolved: FeasibleLoadResult): string | undefined => {
  if (resolved.warnings.includes('base_machine_weight_not_included')) return '器械自重未计入';
  if (resolved.warnings.includes('incomplete_equipment_profile')) return '未知器械档案，建议之后配置器械';
  return undefined;
};

const primaryLabel = (resolved: FeasibleLoadResult): string => {
  if (resolved.isEmptyBar && resolved.equipmentKind === 'smith_machine') return `史密斯空杆 ${formatLb(resolved.feasibleWeightLb)} lb`;
  if (resolved.isEmptyBar && resolved.equipmentKind === 'barbell') return `空杆 ${formatLb(resolved.feasibleWeightLb)} lb`;
  if (resolved.equipmentKind === 'dumbbell') return `每只手 ${formatLb(resolved.perHandLoadLb ?? resolved.displayWeightLb)} lb`;
  if (resolved.equipmentKind === 'selectorized_machine' || resolved.equipmentKind === 'cable_stack') {
    return `插片 ${formatLb(resolved.displayWeightLb)} lb`;
  }
  if (resolved.equipmentKind === 'plate_loaded_machine' && !resolved.baseWeightIncluded) return `加重 ${formatLb(resolved.displayWeightLb)} lb`;
  return `${formatLb(resolved.feasibleWeightLb)} lb 总重量`;
};

const secondaryLabel = (resolved: FeasibleLoadResult): string => {
  if (resolved.perSideLoadLb !== undefined) return `每边 ${formatLb(resolved.perSideLoadLb)} lb`;
  if (resolved.equipmentKind === 'dumbbell') return '按每只手显示';
  if (resolved.equipmentKind === 'selectorized_machine' || resolved.equipmentKind === 'cable_stack') return '插片重量';
  if (resolved.equipmentKind === 'unknown') return '未知/自定义器械';
  return '实际可做重量';
};

const detailLabel = (resolved: FeasibleLoadResult, showTheoreticalDetail?: boolean): string => {
  const detail = equipmentDetailLabel(resolved);
  if (!showTheoreticalDetail || !resolved.wasRounded) return detail;
  return `${detail}；理论计算：${formatLb(resolved.theoreticalWeightLb)} lb；实际可做：${formatLb(resolved.feasibleWeightLb)} lb`;
};

export const buildEquipmentAwareRecommendationDisplay = (
  input: EquipmentAwareRecommendationDisplayInput,
): EquipmentAwareRecommendationDisplayResult => {
  const profile = withRoundingOverride(
    input.equipmentProfile ?? getDefaultEquipmentProfileForExercise(input.exerciseName),
    input.roundingPreference,
  );
  const resolved = resolveFeasibleLoad({
    theoreticalWeightLb: input.theoreticalWeightLb,
    equipmentProfile: profile,
    readinessBias: input.readinessBias,
    setPurpose: input.setPurpose,
  });

  return {
    exerciseName: input.exerciseName,
    equipmentKind: resolved.equipmentKind,
    displayMode: resolved.displayMode,
    theoreticalWeightLb: resolved.theoreticalWeightLb,
    feasibleWeightLb: resolved.feasibleWeightLb,
    primaryLabel: primaryLabel(resolved),
    secondaryLabel: secondaryLabel(resolved),
    detailLabel: detailLabel(resolved, input.showTheoreticalDetail),
    plateBreakdownLabel: platesLabel(resolved.plateBreakdown?.platesPerSideLb),
    warningLabel: warningLabel(resolved),
    reasonLabel: reasonLabel(resolved),
    isFeasible: !resolved.warnings.includes('incomplete_equipment_profile'),
    isEmptyBar: resolved.isEmptyBar,
    wasRounded: resolved.wasRounded,
    sourceOfTruthChanged: false,
    trainingAlgorithmChanged: false,
  };
};
