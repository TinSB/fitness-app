import type {
  HealthDataSource,
  HealthImportBatch,
  HealthMetricSample,
  HealthMetricType,
  ImportedWorkoutSample,
} from '../models/training-model';
import { parseAppleHealthXml, type AppleHealthXmlImportOptions } from './appleHealthXmlImportEngine';

type HealthImportResult = {
  samples: HealthMetricSample[];
  workouts: ImportedWorkoutSample[];
  batch: HealthImportBatch;
  warnings: string[];
  summary?: ReturnType<typeof parseAppleHealthXml>['summary'];
};

const HEALTH_METRIC_TYPES: HealthMetricType[] = [
  'sleep_duration',
  'resting_heart_rate',
  'hrv',
  'heart_rate',
  'steps',
  'active_energy',
  'exercise_minutes',
  'body_weight',
  'body_fat',
  'vo2max',
  'workout',
];

const SOURCE_VALUES: HealthDataSource[] = ['apple_health_export', 'apple_watch_workout', 'third_party_csv', 'manual_import', 'unknown'];

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '');

const hashText = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

const normalizeDateToIso = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!text) return '';
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const normalizeHealthMetricType = (value: unknown): HealthMetricType | undefined => {
  const key = normalizeKey(String(value || ''));
  const aliases: Record<string, HealthMetricType> = {
    sleep: 'sleep_duration',
    sleepduration: 'sleep_duration',
    sleepanalysis: 'sleep_duration',
    hkcategorytypeidentifiersleepanalysis: 'sleep_duration',
    restingheartrate: 'resting_heart_rate',
    restingheart: 'resting_heart_rate',
    hkquantitytypeidentifierrestingheartrate: 'resting_heart_rate',
    hrv: 'hrv',
    heartratevariability: 'hrv',
    heartratevariabilitysdnn: 'hrv',
    hkquantitytypeidentifierheartratevariabilitysdnn: 'hrv',
    heartrate: 'heart_rate',
    hkquantitytypeidentifierheartrate: 'heart_rate',
    steps: 'steps',
    stepcount: 'steps',
    hkquantitytypeidentifierstepcount: 'steps',
    activeenergy: 'active_energy',
    activeenergyburned: 'active_energy',
    activeenergykcal: 'active_energy',
    hkquantitytypeidentifieractiveenergyburned: 'active_energy',
    exerciseminutes: 'exercise_minutes',
    appleexercisetime: 'exercise_minutes',
    hkquantitytypeidentifierappleexercisetime: 'exercise_minutes',
    bodyweight: 'body_weight',
    bodymass: 'body_weight',
    hkquantitytypeidentifierbodymass: 'body_weight',
    bodyfat: 'body_fat',
    bodyfatpercentage: 'body_fat',
    vo2max: 'vo2max',
    workout: 'workout',
  };
  if (aliases[key]) return aliases[key];
  return HEALTH_METRIC_TYPES.includes(value as HealthMetricType) ? (value as HealthMetricType) : undefined;
};

export const normalizeHealthDataSource = (value: unknown, fallback: HealthDataSource = 'unknown'): HealthDataSource => {
  const key = normalizeKey(String(value || ''));
  if (SOURCE_VALUES.includes(value as HealthDataSource)) return value as HealthDataSource;
  if (key.includes('watch')) return 'apple_watch_workout';
  if (key.includes('applehealth') || key.includes('healthkit')) return 'apple_health_export';
  if (key.includes('csv')) return 'third_party_csv';
  if (key.includes('manual')) return 'manual_import';
  return fallback;
};

const getField = (record: Record<string, unknown>, aliases: string[]) => {
  const lookup = new Map(Object.entries(record).map(([key, value]) => [normalizeKey(key), value]));
  for (const alias of aliases) {
    const value = lookup.get(normalizeKey(alias));
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
};

const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
};

const knownCsvHeaders = new Set([
  'type',
  'metric',
  'metrictype',
  'startdate',
  'start',
  'date',
  'enddate',
  'end',
  'value',
  'unit',
  'source',
  'workouttype',
  'durationmin',
  'activeenergykcal',
  'avgheartrate',
  'maxheartrate',
  'distancemeters',
]);

const buildSample = (record: Record<string, unknown>, importedAt: string, fallbackSource: HealthDataSource, warnings: string[]) => {
  const metricType = normalizeHealthMetricType(getField(record, ['metricType', 'metric', 'type']));
  if (!metricType || metricType === 'workout') {
    if (!metricType) warnings.push('发现无法识别的数据类型，已跳过一条健康样本。');
    return null;
  }
  const value = toNumber(getField(record, ['value']));
  const startDate = normalizeDateToIso(getField(record, ['startDate', 'start', 'date']));
  if (value === undefined || !startDate) {
    warnings.push(`健康样本 ${metricType} 缺少有效日期或数值，已跳过。`);
    return null;
  }
  const source = normalizeHealthDataSource(getField(record, ['source']), fallbackSource);
  const unit = String(getField(record, ['unit']) || '');
  const key = `${source}:${metricType}:${startDate}:${value}:${unit}`;
  return {
    id: `health-${hashText(key)}`,
    source,
    metricType,
    startDate,
    endDate: normalizeDateToIso(getField(record, ['endDate', 'end'])) || undefined,
    value: Math.max(0, value),
    unit,
    importedAt,
    dataFlag: 'normal',
    raw: record,
  } satisfies HealthMetricSample;
};

const buildWorkout = (record: Record<string, unknown>, importedAt: string, fallbackSource: HealthDataSource, warnings: string[]) => {
  const workoutType = String(getField(record, ['workoutType', 'type', 'metricType']) || '外部活动');
  const durationMin = toNumber(getField(record, ['durationMin', 'value']));
  const startDate = normalizeDateToIso(getField(record, ['startDate', 'start', 'date']));
  const endDate = normalizeDateToIso(getField(record, ['endDate', 'end'])) || startDate;
  if (durationMin === undefined || !startDate || !endDate) {
    warnings.push(`外部活动 ${workoutType} 缺少有效时间或时长，已跳过。`);
    return null;
  }
  const source = normalizeHealthDataSource(getField(record, ['source']), fallbackSource);
  const key = `${source}:${workoutType}:${startDate}:${endDate}:${durationMin}`;
  return {
    id: `workout-${hashText(key)}`,
    source,
    workoutType,
    startDate,
    endDate,
    durationMin: Math.max(0, durationMin),
    activeEnergyKcal: toNumber(getField(record, ['activeEnergyKcal', 'activeEnergy'])),
    avgHeartRate: toNumber(getField(record, ['avgHeartRate'])),
    maxHeartRate: toNumber(getField(record, ['maxHeartRate'])),
    distanceMeters: toNumber(getField(record, ['distanceMeters', 'distance'])),
    importedAt,
    dataFlag: 'normal',
    raw: record,
  } satisfies ImportedWorkoutSample;
};

const parseRecords = (records: Record<string, unknown>[], importedAt: string, fallbackSource: HealthDataSource, warnings: string[]) => {
  const samples: HealthMetricSample[] = [];
  const workouts: ImportedWorkoutSample[] = [];

  records.forEach((record) => {
    const metricType = normalizeHealthMetricType(getField(record, ['metricType', 'metric', 'type']));
    const hasWorkoutFields = getField(record, ['workoutType']) !== undefined || metricType === 'workout';
    if (hasWorkoutFields) {
      const workout = buildWorkout(record, importedAt, fallbackSource, warnings);
      if (workout) workouts.push(workout);
      return;
    }
    const sample = buildSample(record, importedAt, fallbackSource, warnings);
    if (sample) samples.push(sample);
  });

  const sampleMap = new Map(samples.map((sample) => [`${sample.source}:${sample.metricType}:${sample.startDate}:${sample.value}:${sample.unit}`, sample]));
  const workoutMap = new Map(workouts.map((workout) => [`${workout.source}:${workout.workoutType}:${workout.startDate}:${workout.durationMin}`, workout]));

  return {
    samples: [...sampleMap.values()],
    workouts: [...workoutMap.values()],
  };
};

export const parseHealthImportFile = (fileText: string, fileName = 'health-import', options?: AppleHealthXmlImportOptions): HealthImportResult => {
  const warnings: string[] = [];
  const importedAt = new Date().toISOString();
  const trimmed = String(fileText || '').trim();
  const fallbackSource: HealthDataSource = fileName.toLowerCase().endsWith('.csv') ? 'third_party_csv' : 'unknown';

  if (trimmed && (fileName.toLowerCase().endsWith('.xml') || trimmed.includes('<HealthData'))) {
    return parseAppleHealthXml(fileText, fileName, options);
  }

  if (!trimmed) {
    warnings.push('文件为空，未导入任何健康数据。');
  } else if (trimmed.startsWith('<')) {
    warnings.push('当前版本不直接解析 Apple Health XML。请先使用第三方导出工具或快捷指令导出 CSV/JSON。');
  }

  let samples: HealthMetricSample[] = [];
  let workouts: ImportedWorkoutSample[] = [];

  if (trimmed && !trimmed.startsWith('<')) {
    try {
      if (fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed) as unknown;
        const root = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
        const sampleRecords = Array.isArray(root.samples) ? root.samples : Array.isArray(parsed) ? parsed : [];
        const workoutRecords = Array.isArray(root.workouts) ? root.workouts : [];
        const parsedSamples = parseRecords(sampleRecords.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)), importedAt, 'manual_import', warnings);
        const parsedWorkouts = parseRecords(workoutRecords.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)), importedAt, 'apple_watch_workout', warnings);
        samples = [...parsedSamples.samples, ...parsedWorkouts.samples];
        workouts = [...parsedSamples.workouts, ...parsedWorkouts.workouts];
      } else {
        const rows = parseCsvRows(trimmed);
        const headers = rows[0] || [];
        const normalizedHeaders = headers.map(normalizeKey);
        const unknownHeaders = normalizedHeaders.filter((header) => header && !knownCsvHeaders.has(header));
        if (unknownHeaders.length) warnings.push(`发现未识别 CSV 列：${unknownHeaders.slice(0, 5).join(', ')}。这些列已保留在原始记录中。`);
        const records = rows.slice(1).map((row) =>
          Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
        );
        const parsedCsv = parseRecords(records, importedAt, fallbackSource, warnings);
        samples = parsedCsv.samples;
        workouts = parsedCsv.workouts;
      }
    } catch {
      warnings.push('文件解析失败，当前数据没有被导入或覆盖。');
    }
  }

  const source = samples[0]?.source || workouts[0]?.source || (workouts.length && !samples.length ? 'apple_watch_workout' : fallbackSource);
  const batch: HealthImportBatch = {
    id: `batch-${hashText(`${fileName}:${importedAt}:${samples.length}:${workouts.length}`)}`,
    importedAt,
    source,
    fileName,
    sampleCount: samples.length,
    workoutCount: workouts.length,
    notes: warnings,
    dataFlag: 'normal',
  };

  return { samples, workouts, batch, warnings };
};
