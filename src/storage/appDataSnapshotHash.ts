import type { AppData } from '../models/training-model';
import { exportAppData } from './backup';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(',')}}`;
};

export const hashText = (text: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `phase19b-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

// Normalize through the same export pipeline used to write backups and
// cloud snapshots so the local hash matches independent of whether the
// caller already ran sanitizeData. Without this normalization the local
// in-memory AppData (mutated by reducers since the last load) hashed
// differently from its sanitized JSON, which caused:
//   - localBackupDryRunUi.backupReady to stay false (backup hash vs.
//     local hash never matched -> "查看将同步的内容" never surfaced and
//     the cloud-sync toggle stayed grey)
//   - cloudParityCheck to report local-vs-cloud disagreement on the very
//     first upload (-> "发现冲突" pill stuck on the panel even though
//     the user had never actually conflicted).
// The normalization is a defensive no-op when the input is already
// canonical (sanitizeData is idempotent on its own output).
const canonicalForHash = (appData: unknown): unknown => {
  if (appData == null) return appData;
  try {
    return JSON.parse(exportAppData(appData as AppData));
  } catch {
    return appData;
  }
};

export const buildAppDataSnapshotHash = (appData: unknown): string =>
  hashText(stableStringify(canonicalForHash(appData)));
