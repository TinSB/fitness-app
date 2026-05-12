import { describe, expect, it, vi } from 'vitest';
import { bootFromApiSnapshot } from '../src/storage/bootFromApiSnapshot';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

const snapshot = {
  snapshotId: 'snapshot-boot-1',
  createdAt: '2026-05-12T00:00:00.000Z',
  schemaVersion: 1,
  label: 'test snapshot',
};

describe('boot from API snapshot prototype', () => {
  it('loads sanitized AppData from an explicit api-primary-dev snapshot reader', async () => {
    const appData = sanitizeData(makeAppData({
      history: [
        makeSession({
          id: 'api-boot-session',
          date: '2026-05-12',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 5, rir: 2 }],
        }),
      ],
      selectedTemplateId: 'push-a',
    }));

    const result = await bootFromApiSnapshot(
      {
        DEV: true,
        VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
        VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
      },
      {
        readSnapshot: async () => ({
          result: { appData },
          snapshot,
        }),
      },
    );

    expect(result).toMatchObject({
      ok: true,
      source: 'api-primary-dev',
      snapshot,
      localStorageFallbackAvailable: true,
      shouldWriteLocalStorage: false,
      productionReady: false,
    });
    expect(result.ok && result.data.history.map((session) => session.id)).toEqual(['api-boot-session']);
  });

  it('does not write localStorage while loading an API snapshot', async () => {
    const setItem = vi.fn();
    const getItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem });
    const appData = sanitizeData(makeAppData());

    await bootFromApiSnapshot(
      {
        DEV: true,
        VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      },
      {
        readSnapshot: async () => ({ result: { appData }, snapshot }),
      },
    );

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
