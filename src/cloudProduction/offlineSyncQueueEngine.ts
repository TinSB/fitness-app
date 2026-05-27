// Feature #42: An in-memory + localStorage-backed queue for mutations
// that should reach the cloud but are blocked by being offline. The queue
// is opaque to the rest of the app — callers only see enqueue / flush /
// peek. The actual transport (Supabase REST, fetch, whatever) is injected
// at flush time so this engine has no hard dependency on the network.
//
// We persist the queue under a single localStorage key so a tab reload
// while offline does not lose pending writes. On flush, items are sent in
// FIFO order; the first failure stops the flush so retries preserve
// chronological order.

export type OfflineSyncQueueItem = {
  id: string;
  kind: 'snapshot_write' | 'snapshot_delete' | 'profile_update' | 'custom';
  payload: unknown;
  enqueuedAt: string;
  attemptCount: number;
};

export type OfflineSyncQueueState = {
  items: OfflineSyncQueueItem[];
};

export type OfflineSyncQueueStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const STORAGE_KEY = 'ironpath_offline_sync_queue_v1';
const MAX_ATTEMPT = 5;

const emptyState = (): OfflineSyncQueueState => ({ items: [] });

const safeParse = (raw: string | null): OfflineSyncQueueState => {
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as Partial<OfflineSyncQueueState> | null;
    if (!parsed || !Array.isArray(parsed.items)) return emptyState();
    return {
      items: parsed.items.filter(
        (item): item is OfflineSyncQueueItem =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.enqueuedAt === 'string' &&
          typeof item.attemptCount === 'number',
      ),
    };
  } catch {
    return emptyState();
  }
};

const getDefaultStorage = (): OfflineSyncQueueStorageLike | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
};

export const loadOfflineSyncQueue = (
  storage: OfflineSyncQueueStorageLike | null = getDefaultStorage(),
): OfflineSyncQueueState => {
  if (!storage) return emptyState();
  try {
    return safeParse(storage.getItem(STORAGE_KEY));
  } catch {
    return emptyState();
  }
};

export const saveOfflineSyncQueue = (
  state: OfflineSyncQueueState,
  storage: OfflineSyncQueueStorageLike | null = getDefaultStorage(),
): void => {
  if (!storage) return;
  try {
    if (state.items.length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* QuotaExceeded — drop silently; next enqueue will try again. */
  }
};

export type EnqueueInput = Omit<OfflineSyncQueueItem, 'enqueuedAt' | 'attemptCount'>;

export const enqueueOfflineSync = (
  state: OfflineSyncQueueState,
  item: EnqueueInput,
  nowIso?: string,
): OfflineSyncQueueState => {
  // Dedupe by id so an at-least-once caller (PWA visibility change firing
  // again on resume) does not double-enqueue.
  if (state.items.some((existing) => existing.id === item.id)) return state;
  return {
    items: [
      ...state.items,
      {
        ...item,
        enqueuedAt: nowIso ?? new Date().toISOString(),
        attemptCount: 0,
      },
    ],
  };
};

export type FlushResult =
  | { ok: true; remaining: OfflineSyncQueueState; flushedCount: number }
  | {
      ok: false;
      remaining: OfflineSyncQueueState;
      flushedCount: number;
      failedItemId: string;
      reason: 'network_error' | 'item_rejected' | 'max_attempts_exceeded';
    };

export type FlushTransport = (
  item: OfflineSyncQueueItem,
) => Promise<{ ok: true } | { ok: false; reason: 'network_error' | 'item_rejected' }>;

export const flushOfflineSyncQueue = async (
  state: OfflineSyncQueueState,
  transport: FlushTransport,
): Promise<FlushResult> => {
  let remaining = state.items.slice();
  let flushedCount = 0;
  while (remaining.length) {
    const next = remaining[0];
    if (next.attemptCount >= MAX_ATTEMPT) {
      return {
        ok: false,
        remaining: { items: remaining },
        flushedCount,
        failedItemId: next.id,
        reason: 'max_attempts_exceeded',
      };
    }
    const attempt = { ...next, attemptCount: next.attemptCount + 1 };
    const result = await transport(attempt);
    if (result.ok) {
      remaining = remaining.slice(1);
      flushedCount += 1;
      continue;
    }
    if (result.reason === 'item_rejected') {
      remaining = [attempt, ...remaining.slice(1)];
      return {
        ok: false,
        remaining: { items: remaining },
        flushedCount,
        failedItemId: next.id,
        reason: 'item_rejected',
      };
    }
    remaining = [attempt, ...remaining.slice(1)];
    return {
      ok: false,
      remaining: { items: remaining },
      flushedCount,
      failedItemId: next.id,
      reason: 'network_error',
    };
  }
  return { ok: true, remaining: { items: remaining }, flushedCount };
};

export const peekOfflineSyncQueueDepth = (state: OfflineSyncQueueState): number =>
  state.items.length;
