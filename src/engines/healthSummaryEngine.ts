import type { HealthMetricSample, ImportedWorkoutSample } from '../models/training-model';
import { convertLbToKg } from './unitConversionEngine';

export type HealthSummary = {
  latestSleepHours?: number;
  latestRestingHeartRate?: number;
  latestHrv?: number;
  latestSteps?: number;
  latestActiveEnergyKcal?: number;
  latestBodyWeightKg?: number;
  recentWorkoutCount: number;
  recentWorkoutMinutes: number;
  recentHighActivityDays: number;
  notes: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type HealthSummaryDateRange = {
  startDate?: string;
  endDate?: string;
  days?: number;
};

const toDate = (value?: string) => {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const startOfRange = (endDate: Date, days: number) => {
  const start = new Date(endDate);
  start.setDate(start.getDate() - Math.max(1, days) + 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const inRange = (value: string, startDate: Date, endDate: Date) => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed >= startDate && parsed <= endDate;
};

const latestSample = (samples: HealthMetricSample[], metricType: HealthMetricSample['metricType']) =>
  samples
    .filter((sample) => sample.metricType === metricType)
    .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];

const averagePreviousSamples = (samples: HealthMetricSample[], latest?: HealthMetricSample) => {
  if (!latest) return undefined;
  const previous = samples.filter((sample) => sample.id !== latest.id && sample.startDate < latest.startDate).map((sample) => sample.value);
  if (previous.length < 3) return undefined;
  return previous.reduce((sum, value) => sum + value, 0) / previous.length;
};

const localDateKey = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const normalizeBodyWeightKg = (sample?: HealthMetricSample) => {
  if (!sample) return undefined;
  return sample.unit.toLowerCase().includes('lb') ? convertLbToKg(sample.value) : sample.value;
};

export const buildHealthSummary = (
  samples: HealthMetricSample[] = [],
  workouts: ImportedWorkoutSample[] = [],
  dateRange: HealthSummaryDateRange = {}
): HealthSummary => {
  const endDate = toDate(dateRange.endDate);
  endDate.setHours(23, 59, 59, 999);
  const startDate = dateRange.startDate ? toDate(dateRange.startDate) : startOfRange(endDate, dateRange.days || 7);
  const activeSamples = samples.filter((sample) => sample.dataFlag !== 'excluded' && inRange(sample.startDate, startDate, endDate));
  const activeWorkouts = workouts.filter((workout) => workout.dataFlag !== 'excluded' && inRange(workout.startDate, startDate, endDate));

  const sleep = latestSample(activeSamples, 'sleep_duration');
  const restingHeartRate = latestSample(activeSamples, 'resting_heart_rate');
  const hrv = latestSample(activeSamples, 'hrv');
  const steps = latestSample(activeSamples, 'steps');
  const activeEnergy = latestSample(activeSamples, 'active_energy');
  const bodyWeight = latestSample(activeSamples, 'body_weight');
  const exerciseMinutesSamples = activeSamples.filter((sample) => sample.metricType === 'exercise_minutes');

  const minutesByDay = new Map<string, number>();
  activeWorkouts.forEach((workout) => {
    const key = localDateKey(workout.startDate);
    minutesByDay.set(key, (minutesByDay.get(key) || 0) + workout.durationMin);
  });
  exerciseMinutesSamples.forEach((sample) => {
    const key = localDateKey(sample.startDate);
    minutesByDay.set(key, (minutesByDay.get(key) || 0) + sample.value);
  });

  const activeEnergyByDay = new Map<string, number>();
  activeSamples
    .filter((sample) => sample.metricType === 'active_energy')
    .forEach((sample) => {
      const key = localDateKey(sample.startDate);
      activeEnergyByDay.set(key, (activeEnergyByDay.get(key) || 0) + sample.value);
    });
  activeWorkouts.forEach((workout) => {
    if (!workout.activeEnergyKcal) return;
    const key = localDateKey(workout.startDate);
    activeEnergyByDay.set(key, (activeEnergyByDay.get(key) || 0) + workout.activeEnergyKcal);
  });

  const highActivityDays = new Set<string>();
  minutesByDay.forEach((minutes, day) => {
    if (minutes >= 60) highActivityDays.add(day);
  });
  activeEnergyByDay.forEach((kcal, day) => {
    if (kcal >= 500) highActivityDays.add(day);
  });

  const usableDataPoints = activeSamples.length + activeWorkouts.length;
  const activeDays = new Set([...activeSamples.map((sample) => localDateKey(sample.startDate)), ...activeWorkouts.map((workout) => localDateKey(workout.startDate))]).size;
  const confidence: HealthSummary['confidence'] = usableDataPoints >= 8 && activeDays >= 4 ? 'high' : usableDataPoints >= 3 && activeDays >= 2 ? 'medium' : 'low';
  const notes = ['导入健康数据仅作恢复/活动负荷参考，不作医疗诊断。'];
  if (!usableDataPoints) notes.push('最近 7 天没有可用健康数据。');
  const rhrBaseline = averagePreviousSamples(activeSamples.filter((sample) => sample.metricType === 'resting_heart_rate'), restingHeartRate);
  if (restingHeartRate && rhrBaseline !== undefined && restingHeartRate.value >= rhrBaseline + 5) {
    notes.push('静息心率高于近期导入基线，恢复可能偏低。');
  }
  const hrvBaseline = averagePreviousSamples(activeSamples.filter((sample) => sample.metricType === 'hrv'), hrv);
  if (hrv && hrvBaseline !== undefined && hrv.value <= hrvBaseline * 0.85) {
    notes.push('HRV 低于近期导入基线，恢复可能偏低。');
  }

  return {
    latestSleepHours: sleep?.value,
    latestRestingHeartRate: restingHeartRate?.value,
    latestHrv: hrv?.value,
    latestSteps: steps?.value,
    latestActiveEnergyKcal: activeEnergy?.value,
    latestBodyWeightKg: normalizeBodyWeightKg(bodyWeight),
    recentWorkoutCount: activeWorkouts.length,
    recentWorkoutMinutes: Math.round(activeWorkouts.reduce((sum, workout) => sum + workout.durationMin, 0)),
    recentHighActivityDays: highActivityDays.size,
    notes,
    confidence,
  };
};
