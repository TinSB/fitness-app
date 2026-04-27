import type { UnitSettings, WeightUnit } from '../models/training-model';
import { number } from './engineUtils';

export const KG_PER_LB = 0.45359237;

export const DEFAULT_UNIT_SETTINGS: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [2.5, 5, 10],
  customIncrementsLb: [5, 10, 20],
};

const roundOne = (value: number) => Math.round(value * 10) / 10;

export const convertLbToKg = (lb: number) => roundOne(number(lb) * KG_PER_LB);

export const convertKgToLb = (kg: number) => roundOne(number(kg) / KG_PER_LB);

export const parseDisplayWeightToKg = (value: unknown, weightUnit: WeightUnit): number => {
  const parsed = Math.max(0, number(value));
  return weightUnit === 'lb' ? convertLbToKg(parsed) : parsed;
};

export const convertKgToDisplayWeight = (weightKg: unknown, weightUnit: WeightUnit): number => {
  const kg = Math.max(0, number(weightKg));
  return weightUnit === 'lb' ? convertKgToLb(kg) : roundOne(kg);
};

export const roundToIncrement = (value: number, increment: number): number => {
  const safeIncrement = Math.max(0, number(increment));
  if (!safeIncrement) return roundOne(Math.max(0, number(value)));
  return roundOne(Math.round(Math.max(0, number(value)) / safeIncrement) * safeIncrement);
};

export const formatWeight = (weightKg: unknown, unitSettings?: Partial<UnitSettings>): string => {
  const weightUnit = unitSettings?.weightUnit === 'lb' ? 'lb' : 'kg';
  return `${convertKgToDisplayWeight(weightKg, weightUnit)}${weightUnit}`;
};

export const sanitizeUnitSettings = (value: unknown): UnitSettings => {
  const raw = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Partial<UnitSettings>) : {};
  const weightUnit: WeightUnit = raw.weightUnit === 'lb' ? 'lb' : 'kg';
  const customIncrementsKg = Array.isArray(raw.customIncrementsKg)
    ? raw.customIncrementsKg.map(number).filter((item) => item > 0)
    : DEFAULT_UNIT_SETTINGS.customIncrementsKg;
  const customIncrementsLb = Array.isArray(raw.customIncrementsLb)
    ? raw.customIncrementsLb.map(number).filter((item) => item > 0)
    : DEFAULT_UNIT_SETTINGS.customIncrementsLb;

  return {
    weightUnit,
    defaultIncrementKg: Math.max(0.5, number(raw.defaultIncrementKg) || DEFAULT_UNIT_SETTINGS.defaultIncrementKg),
    defaultIncrementLb: Math.max(1, number(raw.defaultIncrementLb) || DEFAULT_UNIT_SETTINGS.defaultIncrementLb),
    customIncrementsKg: customIncrementsKg.length ? customIncrementsKg : DEFAULT_UNIT_SETTINGS.customIncrementsKg,
    customIncrementsLb: customIncrementsLb.length ? customIncrementsLb : DEFAULT_UNIT_SETTINGS.customIncrementsLb,
  };
};
