import type { HealthDataSource, HealthImportBatch, HealthMetricSample, HealthMetricType, ImportedWorkoutSample } from '../models/training-model';
import {
  APPLE_HEALTH_RECORD_TYPE_MAP,
  APPLE_HEALTH_SLEEP_ASLEEP_VALUES,
  formatAppleWorkoutType,
  isSupportedAppleHealthType,
} from './appleHealthTypeMap';

export type AppleHealthXmlImportOptions = {
  fromDate?: string;
  toDate?: string;
  metricTypes?: HealthMetricType[];
  includeWorkouts?: boolean;
};

export type AppleHealthXmlImportResult = {
  samples: HealthMetricSample[];
  workouts: ImportedWorkoutSample[];
  batch: HealthImportBatch;
  warnings: string[];
  summary: {
    detectedRecordCount: number;
    importedSampleCount: number;
    importedWorkoutCount: number;
    dateRange?: {
      startDate: string;
      endDate: string;
    };
    metricTypes: string[];
  };
};

type XmlAttrs = Record<string, string>;

const hashText = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

const parseAttrs = (text: string): XmlAttrs => {
  const attrs: XmlAttrs = {};
  const attrPattern = /([A-Za-z0-9_:.-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(text)) !== null) {
    attrs[match[1]] = match[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  return attrs;
};

const toNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toIso = (value?: string) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

const localDateKey = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const startOfLocalDateIso = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toISOString();

const detectSource = (sourceName?: string): HealthDataSource => {
  const source = String(sourceName || '').toLowerCase();
  if (source.includes('watch')) return 'apple_watch_workout';
  return 'apple_health_export';
};

const isWithinRange = (startDate: string, options: AppleHealthXmlImportOptions) => {
  const time = new Date(startDate).getTime();
  if (Number.isNaN(time)) return false;
  if (options.fromDate && time < new Date(options.fromDate).getTime()) return false;
  if (options.toDate && time > new Date(options.toDate).getTime()) return false;
  return true;
};

const shouldIncludeMetric = (metricType: HealthMetricType, options: AppleHealthXmlImportOptions) =>
  !options.metricTypes?.length || options.metricTypes.includes(metricType);

const parseRecordTags = (xmlText: string) => {
  const records: XmlAttrs[] = [];
  const recordPattern = /<Record\b([^>]*)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = recordPattern.exec(xmlText)) !== null) {
    records.push(parseAttrs(match[1]));
  }
  return records;
};

const parseWorkoutTags = (xmlText: string) => {
  const workouts: Array<{ attrs: XmlAttrs; body: string }> = [];
  const workoutPattern = /<Workout\b([^>]*)>([\s\S]*?)<\/Workout>/g;
  let match: RegExpExecArray | null;
  while ((match = workoutPattern.exec(xmlText)) !== null) {
    workouts.push({ attrs: parseAttrs(match[1]), body: match[2] });
  }
  const selfClosingWorkoutPattern = /<Workout\b([^>]*)\/>/g;
  while ((match = selfClosingWorkoutPattern.exec(xmlText)) !== null) {
    workouts.push({ attrs: parseAttrs(match[1]), body: '' });
  }
  return workouts;
};

const durationToMinutes = (duration?: string, unit?: string) => {
  const value = toNumber(duration);
  if (value === undefined) return undefined;
  const normalized = String(unit || 'min').toLowerCase();
  if (normalized.startsWith('sec')) return value / 60;
  if (normalized.startsWith('h')) return value * 60;
  return value;
};

const distanceToMeters = (value?: string, unit?: string) => {
  const parsed = toNumber(value);
  if (parsed === undefined) return undefined;
  const normalized = String(unit || '').toLowerCase();
  if (normalized === 'km') return parsed * 1000;
  if (normalized === 'mi') return parsed * 1609.344;
  if (normalized === 'ft') return parsed * 0.3048;
  return parsed;
};

const activeEnergyToKcal = (value?: string, unit?: string) => {
  const parsed = toNumber(value);
  if (parsed === undefined) return undefined;
  const normalized = String(unit || 'kcal').toLowerCase();
  if (normalized === 'kj') return parsed / 4.184;
  return parsed;
};

const readWorkoutStatistics = (body: string) => {
  let activeEnergyKcal: number | undefined;
  let distanceMeters: number | undefined;
  const statsPattern = /<WorkoutStatistics\b([^>]*)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = statsPattern.exec(body)) !== null) {
    const attrs = parseAttrs(match[1]);
    if (attrs.type === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
      activeEnergyKcal = activeEnergyToKcal(attrs.sum || attrs.value, attrs.unit);
    }
    if (String(attrs.type || '').toLowerCase().includes('distance')) {
      distanceMeters = distanceToMeters(attrs.sum || attrs.value, attrs.unit);
    }
  }
  return { activeEnergyKcal, distanceMeters };
};

const buildBatch = (
  fileName: string,
  importedAt: string,
  samples: HealthMetricSample[],
  workouts: ImportedWorkoutSample[],
  warnings: string[]
): HealthImportBatch => ({
  id: `batch-${hashText(`${fileName}:${importedAt}:${samples.length}:${workouts.length}:xml`)}`,
  importedAt,
  source: workouts.length && !samples.length ? 'apple_watch_workout' : 'apple_health_export',
  fileName,
  sampleCount: samples.length,
  workoutCount: workouts.length,
  notes: warnings,
  dataFlag: 'normal',
});

export const parseAppleHealthXml = (
  xmlText: string,
  fileName = 'export.xml',
  options: AppleHealthXmlImportOptions = {}
): AppleHealthXmlImportResult => {
  const importedAt = new Date().toISOString();
  const warnings: string[] = [];
  const trimmed = String(xmlText || '').trim();
  if (!trimmed || !trimmed.includes('<HealthData')) {
    warnings.push('文件不是有效的 Apple Health export.xml，未导入任何数据。');
    const batch = buildBatch(fileName, importedAt, [], [], warnings);
    return {
      samples: [],
      workouts: [],
      batch,
      warnings,
      summary: { detectedRecordCount: 0, importedSampleCount: 0, importedWorkoutCount: 0, metricTypes: [] },
    };
  }

  const records = parseRecordTags(trimmed);
  const unsupportedTypes = new Set<string>();
  const sleepSegmentsByDay = new Map<string, Array<{ startDate: string; endDate: string; key: string }>>();
  const samples: HealthMetricSample[] = [];
  const seenSamples = new Set<string>();
  let minDate = '';
  let maxDate = '';

  const trackDate = (startDate: string, endDate?: string) => {
    if (!startDate) return;
    if (!minDate || startDate < minDate) minDate = startDate;
    const upper = endDate || startDate;
    if (!maxDate || upper > maxDate) maxDate = upper;
  };

  records.forEach((attrs) => {
    const mapping = APPLE_HEALTH_RECORD_TYPE_MAP[attrs.type];
    if (!mapping) {
      if (attrs.type) unsupportedTypes.add(attrs.type);
      return;
    }
    if (!shouldIncludeMetric(mapping.metricType, options)) return;

    const startDate = toIso(attrs.startDate);
    const endDate = toIso(attrs.endDate) || startDate;
    if (!startDate || !isWithinRange(startDate, options)) return;
    trackDate(startDate, endDate);

    if (attrs.type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      if (!APPLE_HEALTH_SLEEP_ASLEEP_VALUES.has(attrs.value)) {
        if (String(attrs.value || '').includes('Asleep') === false) warnings.push('发现非睡眠 asleep 片段，已跳过 InBed/Awake。');
        return;
      }
      const day = localDateKey(startDate);
      const key = `${startDate}:${endDate}:${attrs.value}`;
      const list = sleepSegmentsByDay.get(day) || [];
      if (!list.some((item) => item.key === key)) list.push({ startDate, endDate, key });
      sleepSegmentsByDay.set(day, list);
      return;
    }

    const rawValue = toNumber(attrs.value);
    if (rawValue === undefined) {
      warnings.push(`${attrs.type} 缺少有效数值，已跳过。`);
      return;
    }
    const converted = mapping.convertValue ? mapping.convertValue(rawValue, attrs.unit) : { value: rawValue, unit: attrs.unit || mapping.defaultUnit };
    if (converted.warning) warnings.push(converted.warning);
    const key = `${mapping.metricType}:${startDate}:${converted.value}:${converted.unit}`;
    if (seenSamples.has(key)) return;
    seenSamples.add(key);
    samples.push({
      id: `health-${hashText(key)}`,
      source: detectSource(attrs.sourceName),
      metricType: mapping.metricType,
      startDate,
      endDate,
      value: Math.max(0, converted.value),
      unit: converted.unit,
      importedAt,
      dataFlag: 'normal',
      raw: attrs,
    });
  });

  sleepSegmentsByDay.forEach((segments, day) => {
    const sorted = segments.sort((left, right) => left.startDate.localeCompare(right.startDate));
    let totalMs = 0;
    let cursorEnd = 0;
    sorted.forEach((segment) => {
      const start = new Date(segment.startDate).getTime();
      const end = new Date(segment.endDate).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
      const adjustedStart = Math.max(start, cursorEnd);
      if (end > adjustedStart) totalMs += end - adjustedStart;
      cursorEnd = Math.max(cursorEnd, end);
    });
    if (!totalMs) return;
    const startDate = sorted[0]?.startDate || startOfLocalDateIso(day);
    const endDate = sorted[sorted.length - 1]?.endDate || startDate;
    const value = Math.round((totalMs / 3600000) * 10) / 10;
    const key = `sleep_duration:${day}:${value}:h`;
    if (seenSamples.has(key)) return;
    seenSamples.add(key);
    samples.push({
      id: `health-${hashText(key)}`,
      source: 'apple_health_export',
      metricType: 'sleep_duration',
      startDate,
      endDate,
      value,
      unit: 'h',
      importedAt,
      dataFlag: 'normal',
      raw: { day, segments: sorted },
    });
  });

  const workouts: ImportedWorkoutSample[] = [];
  const seenWorkouts = new Set<string>();
  if (options.includeWorkouts !== false && (!options.metricTypes?.length || options.metricTypes.includes('workout'))) {
    parseWorkoutTags(trimmed).forEach(({ attrs, body }) => {
      const startDate = toIso(attrs.startDate);
      const endDate = toIso(attrs.endDate) || startDate;
      if (!startDate || !endDate || !isWithinRange(startDate, options)) return;
      const durationMin = durationToMinutes(attrs.duration, attrs.durationUnit);
      if (durationMin === undefined) {
        warnings.push('发现缺少有效 duration 的 Workout，已跳过。');
        return;
      }
      trackDate(startDate, endDate);
      const stats = readWorkoutStatistics(body);
      const workoutType = formatAppleWorkoutType(attrs.workoutActivityType);
      const key = `${workoutType}:${startDate}:${endDate}:${durationMin}`;
      if (seenWorkouts.has(key)) return;
      seenWorkouts.add(key);
      workouts.push({
        id: `workout-${hashText(key)}`,
        source: detectSource(attrs.sourceName),
        workoutType,
        startDate,
        endDate,
        durationMin: Math.round(durationMin * 10) / 10,
        activeEnergyKcal: stats.activeEnergyKcal === undefined ? undefined : Math.round(stats.activeEnergyKcal * 10) / 10,
        distanceMeters: stats.distanceMeters === undefined ? undefined : Math.round(stats.distanceMeters),
        importedAt,
        dataFlag: 'normal',
        raw: { ...attrs, statistics: stats },
      });
    });
  }

  if (unsupportedTypes.size) {
    warnings.push(`已跳过未支持的 Apple Health 类型：${[...unsupportedTypes].slice(0, 8).join(', ')}。`);
  }

  const metricTypes = [...new Set([...samples.map((sample) => sample.metricType), ...(workouts.length ? ['workout'] : [])])].sort();
  const batch = buildBatch(fileName, importedAt, samples, workouts, warnings);

  return {
    samples,
    workouts,
    batch,
    warnings,
    summary: {
      detectedRecordCount: records.length,
      importedSampleCount: samples.length,
      importedWorkoutCount: workouts.length,
      dateRange: minDate && maxDate ? { startDate: minDate, endDate: maxDate } : undefined,
      metricTypes,
    },
  };
};

export const isAppleHealthXmlText = (text: string) => String(text || '').trim().startsWith('<?xml') || String(text || '').includes('<HealthData');

export { isSupportedAppleHealthType };
