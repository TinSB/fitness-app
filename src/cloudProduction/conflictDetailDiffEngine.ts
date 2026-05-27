import type { AppData, TrainingSession } from '../models/training-model';

// Feature #41: When a sync conflict is surfaced, give the UI enough
// structured detail to render a left/right diff grouped by session date
// (or "settings" / "templates" for non-session containers) instead of the
// current opaque "hash mismatch" pill.
//
// Diff buckets:
//   * sessions added on one side only
//   * sessions present on both sides but with different exercises / set logs
//   * top-level settings / templates differences
//
// We cap the number of session entries returned so the UI doesn't try to
// render thousands of rows when the user has been training for years —
// the cap is configurable so tests can pin a deterministic surface.

export type ConflictSessionDiffEntry = {
  sessionId: string;
  date: string;
  side: 'local_only' | 'cloud_only' | 'both_differ';
  summary: string;
};

export type ConflictSettingsDiffEntry = {
  field: string;
  side: 'local_only' | 'cloud_only' | 'both_differ';
};

export type ConflictDetailDiff = {
  sessionEntries: ConflictSessionDiffEntry[];
  settingsEntries: ConflictSettingsDiffEntry[];
  sessionsLocalOnly: number;
  sessionsCloudOnly: number;
  sessionsBothDiffer: number;
  truncated: boolean;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(',')}}`;
};

const sessionFingerprint = (session: TrainingSession): string => {
  const exerciseSummary = (session.exercises ?? []).map((exercise) => ({
    id: exercise.id,
    setCount: Array.isArray(exercise.sets) ? exercise.sets.length : exercise.sets,
    completion: (exercise as { completionStatus?: string }).completionStatus,
  }));
  return stableStringify({
    id: session.id,
    date: session.date,
    templateId: session.templateId,
    completed: session.completed,
    finishedAt: session.finishedAt,
    exerciseSummary,
  });
};

const summariseDiffSide = (local?: TrainingSession, cloud?: TrainingSession): string => {
  if (local && !cloud) return `本地有 ${local.exercises?.length ?? 0} 个动作，云端无此训练`;
  if (!local && cloud) return `云端有 ${cloud.exercises?.length ?? 0} 个动作，本地无此训练`;
  const localSets = (local?.exercises ?? []).reduce(
    (sum, ex) => sum + (Array.isArray(ex.sets) ? ex.sets.length : 0),
    0,
  );
  const cloudSets = (cloud?.exercises ?? []).reduce(
    (sum, ex) => sum + (Array.isArray(ex.sets) ? ex.sets.length : 0),
    0,
  );
  return `本地 ${localSets} 组 / 云端 ${cloudSets} 组`;
};

export type ConflictDetailDiffInput = {
  local: Pick<AppData, 'history' | 'templates' | 'settings'> & Partial<AppData>;
  cloud: Pick<AppData, 'history' | 'templates' | 'settings'> & Partial<AppData>;
  maxSessionEntries?: number;
};

export const buildConflictDetailDiff = (
  input: ConflictDetailDiffInput,
): ConflictDetailDiff => {
  const cap = input.maxSessionEntries ?? 25;
  const localById = new Map(input.local.history?.map((s) => [s.id, s]) ?? []);
  const cloudById = new Map(input.cloud.history?.map((s) => [s.id, s]) ?? []);

  const entries: ConflictSessionDiffEntry[] = [];
  let sessionsLocalOnly = 0;
  let sessionsCloudOnly = 0;
  let sessionsBothDiffer = 0;

  for (const [id, local] of localById) {
    const cloud = cloudById.get(id);
    if (!cloud) {
      sessionsLocalOnly += 1;
      entries.push({
        sessionId: id,
        date: local.date,
        side: 'local_only',
        summary: summariseDiffSide(local, undefined),
      });
      continue;
    }
    if (sessionFingerprint(local) !== sessionFingerprint(cloud)) {
      sessionsBothDiffer += 1;
      entries.push({
        sessionId: id,
        date: local.date,
        side: 'both_differ',
        summary: summariseDiffSide(local, cloud),
      });
    }
  }
  for (const [id, cloud] of cloudById) {
    if (localById.has(id)) continue;
    sessionsCloudOnly += 1;
    entries.push({
      sessionId: id,
      date: cloud.date,
      side: 'cloud_only',
      summary: summariseDiffSide(undefined, cloud),
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  const truncated = entries.length > cap;
  const trimmed = truncated ? entries.slice(0, cap) : entries;

  const settingsEntries: ConflictSettingsDiffEntry[] = [];
  const localSettings = (input.local.settings ?? {}) as Record<string, unknown>;
  const cloudSettings = (input.cloud.settings ?? {}) as Record<string, unknown>;
  const settingsKeys = new Set([...Object.keys(localSettings), ...Object.keys(cloudSettings)]);
  for (const key of settingsKeys) {
    const hasLocal = key in localSettings;
    const hasCloud = key in cloudSettings;
    if (hasLocal && !hasCloud) settingsEntries.push({ field: key, side: 'local_only' });
    else if (!hasLocal && hasCloud) settingsEntries.push({ field: key, side: 'cloud_only' });
    else if (stableStringify(localSettings[key]) !== stableStringify(cloudSettings[key])) {
      settingsEntries.push({ field: key, side: 'both_differ' });
    }
  }

  return {
    sessionEntries: trimmed,
    settingsEntries,
    sessionsLocalOnly,
    sessionsCloudOnly,
    sessionsBothDiffer,
    truncated,
  };
};
