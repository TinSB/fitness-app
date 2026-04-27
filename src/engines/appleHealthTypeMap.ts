import type { HealthMetricType } from '../models/training-model';
import { convertLbToKg } from './unitConversionEngine';

export type AppleHealthRecordMapping = {
  metricType: HealthMetricType;
  defaultUnit: string;
  convertValue?: (value: number, unit?: string) => { value: number; unit: string; warning?: string };
};

const normalizeUnit = (unit?: string) => String(unit || '').trim().toLowerCase();

const identityUnit = (fallbackUnit: string) => (value: number, unit?: string) => ({
  value,
  unit: unit || fallbackUnit,
});

const convertHeartRate = (value: number, unit?: string) => {
  const normalized = normalizeUnit(unit);
  if (!normalized || normalized === 'bpm' || normalized === 'count/min') return { value, unit: 'bpm' };
  return { value, unit: unit || 'bpm', warning: `心率单位 ${unit} 未识别，已保留原数值。` };
};

const convertHrv = (value: number, unit?: string) => {
  const normalized = normalizeUnit(unit);
  if (!normalized || normalized === 'ms') return { value, unit: 'ms' };
  return { value, unit: unit || 'ms', warning: `HRV 单位 ${unit} 未识别，已保留原数值。` };
};

const convertEnergy = (value: number, unit?: string) => {
  const normalized = normalizeUnit(unit);
  if (!normalized || normalized === 'kcal' || normalized === 'cal') return { value, unit: 'kcal' };
  if (normalized === 'kj') return { value: Math.round((value / 4.184) * 10) / 10, unit: 'kcal' };
  return { value, unit: unit || 'kcal', warning: `活动能量单位 ${unit} 未转换，已保留原单位。` };
};

const convertBodyWeight = (value: number, unit?: string) => {
  const normalized = normalizeUnit(unit);
  if (!normalized || normalized === 'kg') return { value, unit: 'kg' };
  if (normalized === 'lb' || normalized === 'lbs') return { value: convertLbToKg(value), unit: 'kg' };
  return { value, unit: unit || 'kg', warning: `体重单位 ${unit} 未识别，已保留原数值。` };
};

const convertPercent = (value: number, unit?: string) => {
  const normalized = normalizeUnit(unit);
  if (normalized === '%' || normalized === 'percent') return { value, unit: '%' };
  if (value <= 1) return { value: Math.round(value * 1000) / 10, unit: '%' };
  return { value, unit: '%' };
};

export const APPLE_HEALTH_RECORD_TYPE_MAP: Record<string, AppleHealthRecordMapping> = {
  HKQuantityTypeIdentifierRestingHeartRate: {
    metricType: 'resting_heart_rate',
    defaultUnit: 'bpm',
    convertValue: convertHeartRate,
  },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: {
    metricType: 'hrv',
    defaultUnit: 'ms',
    convertValue: convertHrv,
  },
  HKQuantityTypeIdentifierHeartRate: {
    metricType: 'heart_rate',
    defaultUnit: 'bpm',
    convertValue: convertHeartRate,
  },
  HKQuantityTypeIdentifierStepCount: {
    metricType: 'steps',
    defaultUnit: 'count',
    convertValue: identityUnit('count'),
  },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    metricType: 'active_energy',
    defaultUnit: 'kcal',
    convertValue: convertEnergy,
  },
  HKQuantityTypeIdentifierAppleExerciseTime: {
    metricType: 'exercise_minutes',
    defaultUnit: 'min',
    convertValue: identityUnit('min'),
  },
  HKQuantityTypeIdentifierBodyMass: {
    metricType: 'body_weight',
    defaultUnit: 'kg',
    convertValue: convertBodyWeight,
  },
  HKQuantityTypeIdentifierBodyFatPercentage: {
    metricType: 'body_fat',
    defaultUnit: '%',
    convertValue: convertPercent,
  },
  HKQuantityTypeIdentifierVO2Max: {
    metricType: 'vo2max',
    defaultUnit: 'ml/kg/min',
    convertValue: identityUnit('ml/kg/min'),
  },
  HKCategoryTypeIdentifierSleepAnalysis: {
    metricType: 'sleep_duration',
    defaultUnit: 'h',
  },
};

export const APPLE_HEALTH_SLEEP_ASLEEP_VALUES = new Set([
  'HKCategoryValueSleepAnalysisAsleep',
  'HKCategoryValueSleepAnalysisAsleepCore',
  'HKCategoryValueSleepAnalysisAsleepDeep',
  'HKCategoryValueSleepAnalysisAsleepREM',
]);

export const formatAppleWorkoutType = (value?: string) => {
  const raw = String(value || '').replace(/^HKWorkoutActivityType/, '');
  const labels: Record<string, string> = {
    TraditionalStrengthTraining: '传统力量训练',
    FunctionalStrengthTraining: '功能力量训练',
    Running: '跑步',
    Walking: '步行',
    Cycling: '骑行',
    Hiking: '徒步',
    Swimming: '游泳',
    Yoga: '瑜伽',
    Badminton: '羽毛球',
    Basketball: '篮球',
    Tennis: '网球',
    Soccer: '足球',
    Other: '其他运动',
  };
  return labels[raw] || raw || '外部活动';
};

export const isSupportedAppleHealthType = (type?: string) => Boolean(type && APPLE_HEALTH_RECORD_TYPE_MAP[type]);
