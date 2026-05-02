import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPendingSessionPatch,
  findActivePendingSessionPatch,
  getActivePendingSessionPatches,
  markExpiredPendingSessionPatches,
  upsertPendingSessionPatch,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import { loadData, sanitizeData, saveData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const patch: SessionPatch = {
  id: 'session-patch-main-only',
  type: 'main_only',
  title: '只做主训练',
  description: '只影响本次训练。',
  reason: '今天时间有限。',
  reversible: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pending session patch persistence', () => {
  it('builds a stable pending patch identity from source fingerprint', () => {
    const first = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-01',
      sourceCoachActionId: 'daily-adjustment-1',
      sourceFingerprint: 'daily-adjustment:pull-a:conservative',
      targetTemplateId: 'pull-a',
    });
    const second = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-01',
      sourceCoachActionId: 'daily-adjustment-1',
      sourceFingerprint: 'daily-adjustment:pull-a:conservative',
      targetTemplateId: 'pull-a',
    });

    expect(first.id).toBe(second.id);
    expect(first.status).toBe('pending');
    expect(first.patches).toEqual([patch]);
  });

  it('dedupes active pending patches with the same source fingerprint', () => {
    const pending = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'same-source',
      targetTemplateId: 'pull-a',
    });

    const first = upsertPendingSessionPatch([], pending);
    const second = upsertPendingSessionPatch(first.pendingPatches, pending);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.pendingPatches).toHaveLength(1);
  });

  it('does not let yesterday pending patch block a new same-source patch today', () => {
    const yesterday = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'same-source',
      targetTemplateId: 'pull-a',
    });
    const today = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-02',
      sourceFingerprint: 'same-source',
      targetTemplateId: 'pull-a',
    });

    const result = upsertPendingSessionPatch([yesterday], today);

    expect(result.created).toBe(true);
    expect(result.pendingPatches).toHaveLength(2);
    expect(new Set(result.pendingPatches.map((item) => item.id)).size).toBe(2);
  });

  it('sanitizes, saves, and loads pendingSessionPatches without losing patches', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const pending = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'persisted-source',
      targetTemplateId: 'pull-a',
    });
    const data = makeAppData({
      pendingSessionPatches: [pending],
      settings: { pendingSessionPatches: [pending] },
    });

    saveData(data);
    const loaded = loadData();

    expect(loaded.pendingSessionPatches).toEqual([pending]);
    expect(loaded.settings.pendingSessionPatches).toEqual([pending]);
  });

  it('sanitizes legacy data without pendingSessionPatches to an empty list', () => {
    const sanitized = sanitizeData(makeAppData({ pendingSessionPatches: undefined }));

    expect(sanitized.pendingSessionPatches).toEqual([]);
    expect(sanitized.settings.pendingSessionPatches).toEqual([]);
  });

  it('does not expose expired or mismatched pending patches as active patches', () => {
    const pending = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-01',
      sourceFingerprint: 'expired-source',
      targetTemplateId: 'pull-a',
    });
    const expired = markExpiredPendingSessionPatches([pending], '2026-05-02');

    expect(findActivePendingSessionPatch(expired, '2026-05-02', 'pull-a')).toBeUndefined();
    expect(getActivePendingSessionPatches([pending], '2026-05-01', 'push-a')).toEqual([]);
  });
});
