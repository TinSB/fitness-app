import type { AppData, DataRepairLogEntry } from '../../models/training-model';
import type { RepairDryRunBeforeAfter } from '../appDataRepairTypes';

export const hashIdempotencyKey = (repairId: string, affectedIds: string[]): string => {
  const sorted = [...new Set(affectedIds.map(String))].sort();
  let hash = 0;
  const payload = `${repairId}|${sorted.join('|')}`;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return `idem_${repairId}_${(hash >>> 0).toString(36)}_${sorted.length}`;
};

export const sampleBeforeAfter = (
  items: RepairDryRunBeforeAfter[],
  limit = 3,
): RepairDryRunBeforeAfter[] => items.slice(0, limit);

export const isoTimestamp = (override?: string): string => override || new Date().toISOString();

export const buildReceipt = (params: {
  repairId: string;
  category: DataRepairLogEntry['category'];
  action: string;
  affectedIds: string[];
  beforeSummary: string;
  afterSummary: string;
  repairedAt?: string;
  before?: unknown;
  after?: unknown;
}): DataRepairLogEntry => {
  const stamp = isoTimestamp(params.repairedAt);
  const entry: DataRepairLogEntry = {
    id: `${params.repairId}-${stamp}`,
    repairId: params.repairId,
    createdAt: stamp,
    repairedAt: stamp,
    category: params.category,
    action: params.action,
    affectedIds: [...new Set(params.affectedIds.filter(Boolean).map(String))],
    beforeSummary: params.beforeSummary,
    afterSummary: params.afterSummary,
  };
  if (params.before !== undefined) entry.before = params.before;
  if (params.after !== undefined) entry.after = params.after;
  return entry;
};

export const parseIsoDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const daysBetween = (later: Date, earlier: Date): number => {
  const ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
};

export const todayDate = (): Date => {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
};

export const cloneAppData = (appData: AppData): AppData =>
  JSON.parse(JSON.stringify(appData)) as AppData;

export const computeAppDataHash = (appData: AppData): string => {
  const skeleton = {
    schemaVersion: appData.schemaVersion,
    historyLength: (appData.history || []).length,
    historyIds: (appData.history || []).map((s) => s?.id || ''),
    todayStatusDate: appData.todayStatus?.date,
    issueScoresKeys: Object.keys(appData.screeningProfile?.adaptiveState?.issueScores || {}).sort(),
    issueScoresSum: Object.values(appData.screeningProfile?.adaptiveState?.issueScores || {}).reduce(
      (sum, value) => (typeof value === 'number' ? sum + value : sum),
      0,
    ),
    healthLatest: (() => {
      const samples = appData.healthMetricSamples || [];
      const workouts = appData.importedWorkoutSamples || [];
      const dates: number[] = [];
      samples.forEach((s) => {
        const t = parseIsoDate(s.startDate);
        if (t) dates.push(t.getTime());
      });
      workouts.forEach((w) => {
        const t = parseIsoDate(w.startDate);
        if (t) dates.push(t.getTime());
      });
      if (!dates.length) return null;
      return Math.max(...dates);
    })(),
  };
  const payload = JSON.stringify(skeleton);
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return `appdata_${(hash >>> 0).toString(36)}_${(appData.history || []).length}`;
};
