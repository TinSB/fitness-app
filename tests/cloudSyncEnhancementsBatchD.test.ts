import { describe, expect, it } from 'vitest';
import { reconcileCrossDeviceHash } from '../src/cloudSync/crossDeviceHashReconcileEngine';
import { buildDeviceLabel, formatRelativeSyncTime } from '../src/cloudSync/deviceLabelEngine';
import { buildConflictDetailDiff } from '../src/cloudProduction/conflictDetailDiffEngine';
import {
  enqueueOfflineSync,
  flushOfflineSyncQueue,
  loadOfflineSyncQueue,
  peekOfflineSyncQueueDepth,
  saveOfflineSyncQueue,
} from '../src/cloudProduction/offlineSyncQueueEngine';
import type { AppData, TrainingSession } from '../src/models/training-model';

describe('crossDeviceHashReconcileEngine (Feature #39)', () => {
  it('returns aligned when the cloud row matches both last-uploaded and current local hashes', () => {
    const out = reconcileCrossDeviceHash({
      locallyKnownSyncedHash: 'h1',
      currentLocalHash: 'h1',
      cloudRowHash: 'h1',
      cloudRowDeviceId: 'dev-A',
      lastKnownDeviceId: 'dev-A',
    });
    expect(out.state).toBe('aligned');
    expect(out.shouldOfferReupload).toBe(false);
  });

  it('flags local_ahead when cloud still reflects last upload but local has drifted', () => {
    const out = reconcileCrossDeviceHash({
      locallyKnownSyncedHash: 'h1',
      currentLocalHash: 'h2',
      cloudRowHash: 'h1',
      cloudRowDeviceId: 'dev-A',
      lastKnownDeviceId: 'dev-A',
    });
    expect(out.state).toBe('local_ahead');
    expect(out.shouldOfferReupload).toBe(true);
  });

  it('flags cross_device_overwrite when cloud row was written by a different device', () => {
    const out = reconcileCrossDeviceHash({
      locallyKnownSyncedHash: 'h1',
      currentLocalHash: 'h1',
      cloudRowHash: 'h-other',
      cloudRowDeviceId: 'dev-B',
      lastKnownDeviceId: 'dev-A',
    });
    expect(out.state).toBe('cross_device_overwrite');
    expect(out.shouldSurfaceConflict).toBe(true);
    expect(out.shouldClearLocalSyncedHash).toBe(true);
  });

  it('returns no_cloud_row and clears local receipt when the cloud row vanished', () => {
    const out = reconcileCrossDeviceHash({
      locallyKnownSyncedHash: 'h1',
      currentLocalHash: 'h1',
      cloudRowHash: null,
      cloudRowDeviceId: null,
      lastKnownDeviceId: 'dev-A',
    });
    expect(out.state).toBe('no_cloud_row');
    expect(out.shouldClearLocalSyncedHash).toBe(true);
  });
});

describe('deviceLabelEngine (Feature #40)', () => {
  it('labels iPhone Safari as "iPhone · Safari"', () => {
    const out = buildDeviceLabel({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    });
    expect(out.label).toBe('iPhone · Safari');
    expect(out.deviceClass).toBe('iphone');
    expect(out.browser).toBe('safari');
  });

  it('labels Mac Chrome as "Mac · Chrome"', () => {
    const out = buildDeviceLabel({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    });
    expect(out.deviceClass).toBe('mac');
    expect(out.browser).toBe('chrome');
  });

  it('returns fallback when the user agent is empty', () => {
    const out = buildDeviceLabel({ userAgent: '', fallback: '此设备' });
    expect(out.label).toBe('此设备');
  });

  it('formats relative sync time in Chinese minute/hour/day units', () => {
    const now = '2026-05-26T12:00:00.000Z';
    expect(formatRelativeSyncTime('2026-05-26T11:58:00.000Z', now)).toBe('2 分钟前同步');
    expect(formatRelativeSyncTime('2026-05-26T10:00:00.000Z', now)).toBe('2 小时前同步');
    expect(formatRelativeSyncTime('2026-05-24T12:00:00.000Z', now)).toBe('2 天前同步');
    expect(formatRelativeSyncTime(null, now)).toBe('从未同步');
  });
});

const makeAppData = (sessions: TrainingSession[], settings: Record<string, unknown> = {}): AppData =>
  ({
    history: sessions,
    templates: [],
    settings,
    schemaVersion: 8,
  } as unknown as AppData);

const makeSession = (id: string, date: string, overrides: Partial<TrainingSession> = {}): TrainingSession =>
  ({
    id,
    date,
    templateId: 't',
    templateName: 't',
    trainingMode: 'standard',
    exercises: [
      {
        id: 'bench',
        baseId: 'bench',
        name: 'bench',
        sets: [{ weight: 100, reps: 5 }],
      },
    ],
    ...overrides,
  } as unknown as TrainingSession);

describe('conflictDetailDiffEngine (Feature #41)', () => {
  it('groups added / removed / differing sessions and counts each bucket', () => {
    const localOnly = makeSession('local-only', '2026-05-25');
    const sharedSame = makeSession('shared-same', '2026-05-24');
    const sharedDiffLocal = makeSession('shared-diff', '2026-05-23', {
      exercises: [{ id: 'bench', baseId: 'bench', name: 'bench', sets: [{ weight: 100, reps: 5 }] }] as TrainingSession['exercises'],
    });
    const sharedDiffCloud = makeSession('shared-diff', '2026-05-23', {
      exercises: [
        {
          id: 'bench',
          baseId: 'bench',
          name: 'bench',
          sets: [
            { weight: 100, reps: 5 },
            { weight: 100, reps: 5 },
          ],
        },
      ] as TrainingSession['exercises'],
    });
    const cloudOnly = makeSession('cloud-only', '2026-05-22');

    const out = buildConflictDetailDiff({
      local: makeAppData([localOnly, sharedSame, sharedDiffLocal], { theme: 'dark' }),
      cloud: makeAppData([sharedSame, sharedDiffCloud, cloudOnly], { theme: 'light' }),
    });

    expect(out.sessionsLocalOnly).toBe(1);
    expect(out.sessionsCloudOnly).toBe(1);
    expect(out.sessionsBothDiffer).toBe(1);
    expect(out.sessionEntries.find((e) => e.sessionId === 'local-only')?.side).toBe('local_only');
    expect(out.sessionEntries.find((e) => e.sessionId === 'cloud-only')?.side).toBe('cloud_only');
    expect(out.sessionEntries.find((e) => e.sessionId === 'shared-diff')?.side).toBe('both_differ');
    expect(out.settingsEntries.find((e) => e.field === 'theme')?.side).toBe('both_differ');
  });

  it('truncates the session entry list at the configured cap', () => {
    const local = Array.from({ length: 60 }, (_, i) =>
      makeSession(`local-${i}`, `2026-03-${String((i % 28) + 1).padStart(2, '0')}`),
    );
    const out = buildConflictDetailDiff({
      local: makeAppData(local),
      cloud: makeAppData([]),
      maxSessionEntries: 10,
    });
    expect(out.sessionEntries.length).toBe(10);
    expect(out.truncated).toBe(true);
    expect(out.sessionsLocalOnly).toBe(60);
  });
});

describe('offlineSyncQueueEngine (Feature #42)', () => {
  const makeStorage = () => {
    const inner = new Map<string, string>();
    return {
      store: inner,
      adapter: {
        getItem: (key: string) => inner.get(key) ?? null,
        setItem: (key: string, value: string) => inner.set(key, value),
        removeItem: (key: string) => inner.delete(key),
      },
    };
  };

  it('enqueue is idempotent on item id and persists to localStorage adapter', () => {
    const { adapter } = makeStorage();
    const initial = loadOfflineSyncQueue(adapter);
    const next = enqueueOfflineSync(initial, { id: 'a', kind: 'snapshot_write', payload: {} }, '2026-05-26T12:00:00.000Z');
    const again = enqueueOfflineSync(next, { id: 'a', kind: 'snapshot_write', payload: {} });
    expect(again.items.length).toBe(1);
    saveOfflineSyncQueue(again, adapter);
    expect(loadOfflineSyncQueue(adapter).items.length).toBe(1);
  });

  it('flush sends items FIFO and stops on first network error', async () => {
    const state = {
      items: [
        { id: '1', kind: 'snapshot_write', payload: {}, enqueuedAt: '', attemptCount: 0 },
        { id: '2', kind: 'snapshot_write', payload: {}, enqueuedAt: '', attemptCount: 0 },
        { id: '3', kind: 'snapshot_write', payload: {}, enqueuedAt: '', attemptCount: 0 },
      ],
    };
    let calls = 0;
    const result = await flushOfflineSyncQueue(state, async () => {
      calls += 1;
      if (calls === 2) return { ok: false, reason: 'network_error' };
      return { ok: true };
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.flushedCount).toBe(1);
      expect(result.remaining.items[0].id).toBe('2');
      expect(result.reason).toBe('network_error');
    }
  });

  it('peek returns queue depth', () => {
    const state = enqueueOfflineSync({ items: [] }, { id: 'x', kind: 'snapshot_write', payload: {} });
    expect(peekOfflineSyncQueueDepth(state)).toBe(1);
  });
});
