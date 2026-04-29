import type {
  HealthDataSource,
  HealthImportBatch,
  HealthMetricSample,
  HealthMetricType,
  ImportedWorkoutSample,
} from '../models/training-model';
import {
  APPLE_HEALTH_RECORD_TYPE_MAP,
  APPLE_HEALTH_SLEEP_ASLEEP_VALUES,
  formatAppleWorkoutType,
} from './appleHealthTypeMap';
import {
  aggregateSleepSamplesByWakeDate,
  type AppleHealthXmlImportOptions,
  type AppleHealthXmlImportResult,
} from './appleHealthXmlImportEngine';

export type AppleHealthStreamingImportProgress = {
  type: 'progress';
  processedBytes: number;
  totalBytes: number;
  detectedRecordCount: number;
  importedSampleCount: number;
  importedWorkoutCount: number;
};

export type AppleHealthStreamingImportOptions = AppleHealthXmlImportOptions & {
  chunkSize?: number;
  maxBufferLength?: number;
  signal?: AbortSignal;
  onProgress?: (progress: AppleHealthStreamingImportProgress) => void;
};

export type AppleHealthStreamingImportJob = {
  promise: Promise<AppleHealthXmlImportResult>;
  cancel: () => void;
};

type XmlAttrs = Record<string, string>;
type SleepSegment = {
  startDate: string;
  endDate: string;
  wakeDateKey?: string;
  key: string;
  raw: XmlAttrs;
};

const MB = 1024 * 1024;
const DEFAULT_CHUNK_SIZE = MB;
const DEFAULT_MAX_BUFFER_LENGTH = 2 * MB;
const WARNING_LIMIT = 20;

const XML_RAW_ATTR_ALLOW_LIST = new Set([
  'type',
  'sourceName',
  'unit',
  'startDate',
  'endDate',
  'value',
  'workoutActivityType',
  'duration',
  'durationUnit',
]);

const decodeXmlValue = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

export const parseXmlAttributes = (tagText: string): XmlAttrs => {
  const attrs: XmlAttrs = {};
  const attrPattern = /([A-Za-z0-9_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(tagText)) !== null) {
    attrs[match[1]] = decodeXmlValue(match[2] ?? match[3] ?? '');
  }
  return attrs;
};

const hashText = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

const sanitizeXmlRawAttrs = (attrs: XmlAttrs) =>
  Object.fromEntries(Object.entries(attrs).filter(([key, value]) => XML_RAW_ATTR_ALLOW_LIST.has(key) && value.length < 500));

const toNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeAppleDateText = (value?: string) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2')
    .replace(/\s+([+-]\d{2})(\d{2})$/, '$1:$2');
};

const toIso = (value?: string) => {
  const text = normalizeAppleDateText(value);
  if (!text) return '';
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

const appleHealthDateKey = (value?: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
};

const detectWorkoutSource = (sourceName?: string): HealthDataSource => {
  const source = String(sourceName || '').toLowerCase();
  if (source.includes('watch')) return 'apple_watch_workout';
  return 'apple_health_export';
};

const normalizeSourceName = (sourceName?: string) => {
  const value = String(sourceName || '').trim();
  return value || undefined;
};

const isIntervalWithinRange = (startDate: string, endDate: string, options: AppleHealthXmlImportOptions) => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate || startDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  if (options.fromDate && end < new Date(options.fromDate).getTime()) return false;
  if (options.toDate && start > new Date(options.toDate).getTime()) return false;
  return true;
};

const shouldIncludeMetric = (metricType: HealthMetricType, options: AppleHealthXmlImportOptions) =>
  !options.metricTypes?.length || options.metricTypes.includes(metricType);

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
  const statsPattern = /<WorkoutStatistics(?=[\s/>])([^>]*)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = statsPattern.exec(body)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
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
  batchId: string,
  fileName: string,
  importedAt: string,
  samples: HealthMetricSample[],
  workouts: ImportedWorkoutSample[],
  warnings: string[]
): HealthImportBatch => ({
  id: batchId,
  importedAt,
  source: workouts.length && !samples.length ? 'apple_watch_workout' : 'apple_health_export',
  fileName,
  sampleCount: samples.length,
  workoutCount: workouts.length,
  newSampleCount: samples.length,
  duplicateSampleCount: 0,
  skippedSampleCount: 0,
  newWorkoutCount: workouts.length,
  duplicateWorkoutCount: 0,
  skippedWorkoutCount: 0,
  notes: warnings,
  dataFlag: 'normal',
});

const createAbortError = () => {
  const error = new Error('导入已取消');
  error.name = 'AbortError';
  return error;
};

async function* readBlobAsTextChunks(blob: Blob, chunkSize: number, signal?: AbortSignal) {
  if (chunkSize >= DEFAULT_CHUNK_SIZE && typeof blob.stream === 'function' && typeof TextDecoder !== 'undefined') {
    const reader = blob.stream().getReader();
    const decoder = new TextDecoder('utf-8');
    try {
      while (true) {
        if (signal?.aborted) throw createAbortError();
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        yield { text: decoder.decode(value, { stream: true }), bytes: value.byteLength };
      }
      const tail = decoder.decode();
      if (tail) yield { text: tail, bytes: 0 };
    } finally {
      reader.releaseLock();
    }
    return;
  }

  let offset = 0;
  while (offset < blob.size) {
    if (signal?.aborted) throw createAbortError();
    const chunkBlob = blob.slice(offset, Math.min(blob.size, offset + chunkSize));
    const text = await chunkBlob.text();
    yield { text, bytes: chunkBlob.size };
    offset += chunkSize;
  }
}

const findNextSupportedTag = (buffer: string) => {
  const record = buffer.search(/<Record(?=[\s/>])/);
  const workout = buffer.search(/<Workout(?=[\s/>])/);
  if (record === -1) return workout;
  if (workout === -1) return record;
  return Math.min(record, workout);
};

const startsWithRecord = (text: string) => /^<Record(?=[\s/>])/.test(text);
const startsWithWorkout = (text: string) => /^<Workout(?=[\s/>])/.test(text);

export const parseAppleHealthXmlStreaming = async (
  blob: Blob,
  fileName = 'export.xml',
  options: AppleHealthStreamingImportOptions = {}
): Promise<AppleHealthXmlImportResult> => {
  const importedAt = new Date().toISOString();
  const batchId = `batch-${hashText(`${fileName}:${importedAt}:xml-stream`)}`;
  const warnings: string[] = [];
  let hiddenWarningCount = 0;
  const unsupportedTypes = new Set<string>();
  const samples: HealthMetricSample[] = [];
  const workouts: ImportedWorkoutSample[] = [];
  const sleepSegments: SleepSegment[] = [];
  const seenSamples = new Set<string>();
  const seenWorkouts = new Set<string>();
  const chunkSize = Math.max(64 * 1024, options.chunkSize || DEFAULT_CHUNK_SIZE);
  const maxBufferLength = Math.max(chunkSize * 2, options.maxBufferLength || DEFAULT_MAX_BUFFER_LENGTH);
  let processedBytes = 0;
  let detectedRecordCount = 0;
  let minDate = '';
  let maxDate = '';
  let buffer = '';
  let sawHealthDataRoot = false;
  let sawParserError = false;

  const pushWarning = (message: string) => {
    if (warnings.length < WARNING_LIMIT) {
      warnings.push(message);
    } else {
      hiddenWarningCount += 1;
    }
  };

  const trackDate = (startDate: string, endDate?: string) => {
    if (!startDate) return;
    if (!minDate || startDate < minDate) minDate = startDate;
    const upper = endDate || startDate;
    if (!maxDate || upper > maxDate) maxDate = upper;
  };

  const emitProgress = () => {
    options.onProgress?.({
      type: 'progress',
      processedBytes,
      totalBytes: blob.size,
      detectedRecordCount,
      importedSampleCount: samples.length,
      importedWorkoutCount: workouts.length,
    });
  };

  const processRecord = (tagText: string) => {
    detectedRecordCount += 1;
    const attrs = parseXmlAttributes(tagText);
    const mapping = APPLE_HEALTH_RECORD_TYPE_MAP[attrs.type];
    if (!mapping) {
      if (attrs.type) unsupportedTypes.add(attrs.type);
      return;
    }
    if (!shouldIncludeMetric(mapping.metricType, options)) return;

    const startDate = toIso(attrs.startDate);
    const endDate = toIso(attrs.endDate) || startDate;
    if (!startDate || !isIntervalWithinRange(startDate, endDate, options)) return;
    trackDate(startDate, endDate);

    if (attrs.type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      if (!APPLE_HEALTH_SLEEP_ASLEEP_VALUES.has(attrs.value)) return;
      const key = `${startDate}:${endDate}:${attrs.value}`;
      if (!sleepSegments.some((item) => item.key === key)) {
        sleepSegments.push({ startDate, endDate, wakeDateKey: appleHealthDateKey(attrs.endDate), key, raw: sanitizeXmlRawAttrs(attrs) });
      }
      return;
    }

    const rawValue = toNumber(attrs.value);
    if (rawValue === undefined) {
      pushWarning('发现一条健康记录缺少有效数值，已跳过。');
      return;
    }
    const converted = mapping.convertValue ? mapping.convertValue(rawValue, attrs.unit) : { value: rawValue, unit: attrs.unit || mapping.defaultUnit };
    if (converted.warning) pushWarning(converted.warning);
    const key = `${mapping.metricType}:${startDate}:${converted.value}:${converted.unit}`;
    if (seenSamples.has(key)) return;
    seenSamples.add(key);
    samples.push({
      id: `health-${hashText(key)}`,
      source: 'apple_health_export',
      sourceName: normalizeSourceName(attrs.sourceName),
      deviceSourceName: normalizeSourceName(attrs.sourceName),
      metricType: mapping.metricType,
      startDate,
      endDate,
      value: Math.max(0, converted.value),
      unit: converted.unit,
      importedAt,
      batchId,
      dataFlag: 'normal',
      raw: sanitizeXmlRawAttrs(attrs),
    });
  };

  const processWorkout = (tagText: string, body = '') => {
    if (options.includeWorkouts === false || (options.metricTypes?.length && !options.metricTypes.includes('workout'))) return;
    const attrs = parseXmlAttributes(tagText);
    const startDate = toIso(attrs.startDate);
    const endDate = toIso(attrs.endDate) || startDate;
    if (!startDate || !endDate || !isIntervalWithinRange(startDate, endDate, options)) return;
    const durationMin = durationToMinutes(attrs.duration, attrs.durationUnit);
    if (durationMin === undefined) {
      pushWarning('发现一条外部运动缺少有效时长，已跳过。');
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
      source: detectWorkoutSource(attrs.sourceName),
      sourceName: normalizeSourceName(attrs.sourceName),
      deviceSourceName: normalizeSourceName(attrs.sourceName),
      workoutType,
      startDate,
      endDate,
      durationMin: Math.round(durationMin * 10) / 10,
      activeEnergyKcal: stats.activeEnergyKcal === undefined ? undefined : Math.round(stats.activeEnergyKcal * 10) / 10,
      distanceMeters: stats.distanceMeters === undefined ? undefined : Math.round(stats.distanceMeters),
      importedAt,
      batchId,
      dataFlag: 'normal',
      raw: { ...sanitizeXmlRawAttrs(attrs), statistics: stats },
    });
  };

  const processAvailableTags = (final = false) => {
    while (buffer) {
      const tagStart = findNextSupportedTag(buffer);
      if (tagStart === -1) {
        buffer = buffer.slice(-128);
        return;
      }
      if (tagStart > 0) buffer = buffer.slice(tagStart);

      if (startsWithRecord(buffer)) {
        const endIndex = buffer.indexOf('/>');
        const tagCloseIndex = buffer.indexOf('>');
        if (endIndex === -1 || (tagCloseIndex !== -1 && tagCloseIndex < endIndex)) {
          if (final || buffer.length > maxBufferLength) {
            pushWarning('发现一条结构不完整的健康记录，已跳过。');
            buffer = tagCloseIndex === -1 ? '' : buffer.slice(tagCloseIndex + 1);
            continue;
          }
          return;
        }
        const tagText = buffer.slice(0, endIndex + 2);
        try {
          processRecord(tagText);
        } catch (error) {
          console.error('Apple Health record parse failed.', error);
          pushWarning('发现一条无法解析的健康记录，已跳过。');
        }
        buffer = buffer.slice(endIndex + 2);
        continue;
      }

      if (startsWithWorkout(buffer)) {
        const openEndIndex = buffer.indexOf('>');
        if (openEndIndex === -1) {
          if (final || buffer.length > maxBufferLength) {
            pushWarning('发现一条结构不完整的外部运动，已跳过。');
            buffer = '';
            continue;
          }
          return;
        }
        const openTag = buffer.slice(0, openEndIndex + 1);
        if (/\/\s*>$/.test(openTag)) {
          try {
            processWorkout(openTag, '');
          } catch (error) {
            console.error('Apple Health workout parse failed.', error);
            pushWarning('发现一条无法解析的外部运动，已跳过。');
          }
          buffer = buffer.slice(openEndIndex + 1);
          continue;
        }
        const closeIndex = buffer.indexOf('</Workout>', openEndIndex + 1);
        if (closeIndex === -1) {
          if (final || buffer.length > maxBufferLength) {
            pushWarning('发现一条结构不完整的外部运动，已跳过。');
            buffer = buffer.slice(openEndIndex + 1);
            continue;
          }
          return;
        }
        const body = buffer.slice(openEndIndex + 1, closeIndex);
        try {
          processWorkout(openTag, body);
        } catch (error) {
          console.error('Apple Health workout parse failed.', error);
          pushWarning('发现一条无法解析的外部运动，已跳过。');
        }
        buffer = buffer.slice(closeIndex + '</Workout>'.length);
        continue;
      }

      buffer = buffer.slice(1);
    }
  };

  for await (const chunk of readBlobAsTextChunks(blob, chunkSize, options.signal)) {
    if (options.signal?.aborted) throw createAbortError();
    processedBytes += chunk.bytes;
    buffer += chunk.text;
    if (!sawHealthDataRoot && /<HealthData\b/.test(buffer)) sawHealthDataRoot = true;
    if (!sawParserError && /<parsererror\b/i.test(buffer)) sawParserError = true;
    processAvailableTags(false);
    if (buffer.length > maxBufferLength) {
      pushWarning('发现异常长的 XML 片段，已跳过部分内容。');
      buffer = buffer.slice(-Math.floor(maxBufferLength / 2));
    }
    emitProgress();
  }

  processAvailableTags(true);

  if (!sawHealthDataRoot) pushWarning('文件不是有效的 Apple Health export.xml，未导入任何数据。');
  if (sawParserError) pushWarning('Apple Health XML 包含解析错误，已跳过无法识别的片段。');
  if (unsupportedTypes.size) {
    pushWarning(`已跳过未支持的 Apple Health 类型：${[...unsupportedTypes].slice(0, 8).join(', ')}。`);
  }

  aggregateSleepSamplesByWakeDate(sleepSegments, importedAt, batchId).forEach((sample) => {
    const key = sample.id;
    if (seenSamples.has(key)) return;
    seenSamples.add(key);
    samples.push(sample);
  });

  if (hiddenWarningCount > 0 && warnings.length < WARNING_LIMIT) {
    warnings.push(`还有 ${hiddenWarningCount} 条警告未显示。`);
  }
  if (!samples.length && !workouts.length && !warnings.length) {
    warnings.push('没有找到当前支持的 Apple Health 指标，未导入任何数据。');
  }

  const metricTypes = [...new Set([...samples.map((sample) => sample.metricType), ...(workouts.length ? ['workout'] : [])])].sort();
  const batch = buildBatch(batchId, fileName, importedAt, samples, workouts, warnings);

  emitProgress();
  return {
    samples,
    workouts,
    batch,
    warnings,
    summary: {
      detectedRecordCount,
      importedSampleCount: samples.length,
      importedWorkoutCount: workouts.length,
      dateRange: minDate && maxDate ? { startDate: minDate, endDate: maxDate } : undefined,
      metricTypes,
    },
  };
};

export const isAppleHealthStreamingWorkerSupported = () =>
  typeof Worker !== 'undefined' && typeof URL !== 'undefined';

export const createAppleHealthStreamingImportJob = (
  file: File,
  options: AppleHealthXmlImportOptions = {},
  callbacks: {
    onProgress?: (progress: AppleHealthStreamingImportProgress) => void;
  } = {}
): AppleHealthStreamingImportJob => {
  if (!isAppleHealthStreamingWorkerSupported()) {
    throw new Error('当前浏览器不支持后台解析大型 XML。');
  }

  const worker = new Worker(new URL('../workers/appleHealthXmlImportWorker.ts', import.meta.url), { type: 'module' });
  let settled = false;
  let rejectPromise: ((error: Error) => void) | null = null;

  const promise = new Promise<AppleHealthXmlImportResult>((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data as
        | { type: 'progress'; progress: AppleHealthStreamingImportProgress }
        | { type: 'done'; result: AppleHealthXmlImportResult }
        | { type: 'cancelled' }
        | { type: 'error'; message: string };

      if (message.type === 'progress') {
        callbacks.onProgress?.(message.progress);
        return;
      }

      if (settled) return;
      settled = true;
      worker.terminate();

      if (message.type === 'done') {
        resolve(message.result);
        return;
      }
      if (message.type === 'cancelled') {
        reject(createAbortError());
        return;
      }
      reject(new Error(message.message || 'Apple Health XML 解析失败。'));
    };

    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(new Error(event.message || 'Apple Health XML 后台解析失败。'));
    };

    worker.postMessage({
      type: 'parse',
      file,
      fileName: file.name || 'export.xml',
      options,
    });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.postMessage({ type: 'cancel' });
      worker.terminate();
      rejectPromise?.(createAbortError());
    },
  };
};
