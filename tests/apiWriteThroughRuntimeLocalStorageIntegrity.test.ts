import { describe, expect, it, vi } from 'vitest';
import { createApiWriteThroughRuntime } from '../src/storage/apiWriteThroughRuntime';
import type { ApiStorageSessionDiscardBody } from '../src/storage/apiStorageAdapter';

const discardBody: ApiStorageSessionDiscardBody = {
  sourceSnapshotHash: 'source-hash',
  sourceSnapshotVersion: 'phase5-write-through-v1',
  mutationId: 'mutation-1',
  idempotencyKey: 'idempotency-1',
  requestFingerprint: 'fingerprint-1',
  confirmed: true,
  activeSessionId: 'active-1',
  confirmDiscard: true,
};

describe('API write-through runtime localStorage integrity', () => {
  it('does not read or write localStorage on success or failure', async () => {
    const getItem = vi.fn();
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem });

    const successRuntime = createApiWriteThroughRuntime(
      {
        DEV: true,
        VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      },
      async () => new Response(JSON.stringify({
        result: {
          ok: true,
          changed: true,
          status: 'success',
          reasonCode: 'session_discarded',
          message: 'discarded',
        },
        snapshot: {
          snapshotId: 'snapshot-write-through-integrity',
          createdAt: '2026-05-12T00:00:00.000Z',
        },
      }), { status: 200 }),
    );
    await successRuntime.writeSessionDiscard(discardBody);

    const failureRuntime = createApiWriteThroughRuntime({ DEV: true });
    await failureRuntime.writeSessionDiscard(discardBody);

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
