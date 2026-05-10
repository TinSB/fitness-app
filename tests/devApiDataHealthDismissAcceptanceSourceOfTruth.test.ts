import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototype,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import { dismissDataHealthIssueViaDevApi } from '../src/devApi/devApiDataHealthDismissClient';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const successBody = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'data_health_issue_dismissed',
    message: 'dismissed',
  },
  snapshot: {
    snapshotId: 'snapshot-source-of-truth',
    schemaVersion: 1,
    createdAt: '2026-05-10T00:00:00.000Z',
  },
};

const withTrackedLocalStorage = async (run: (calls: string[]) => Promise<void> | void) => {
  const calls: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => {
        calls.push(`get:${key}`);
        return null;
      }),
      setItem: vi.fn((key: string) => {
        calls.push(`set:${key}`);
      }),
      removeItem: vi.fn((key: string) => {
        calls.push(`remove:${key}`);
      }),
      clear: vi.fn(() => {
        calls.push('clear');
      }),
    },
  });

  try {
    await run(calls);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
};

describe('DataHealth dismiss acceptance source-of-truth integrity', () => {
  it('does not mutate AppData or write localStorage when source context and UI render', async () => {
    await withTrackedLocalStorage((calls) => {
      const data = makeRepairableWeightData();
      const before = JSON.stringify(data);

      createDataHealthDismissSourceContext(data);
      renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototype, { data, config }));

      expect(JSON.stringify(data)).toBe(before);
      expect(calls).toEqual([]);
    });
  });

  it('does not write localStorage or merge API result into AppData on success', async () => {
    await withTrackedLocalStorage(async (calls) => {
      const data = makeRepairableWeightData();
      const before = JSON.stringify(data);
      const sourceContext = createDataHealthDismissSourceContext(data)!;
      const metadata = createDataHealthDismissMetadata({
        issueId: sourceContext.issueId,
        sourceFingerprint: sourceContext.sourceFingerprint,
        nowIso: '2026-05-10T00:00:00.000Z',
      });

      const result = await dismissDataHealthIssueViaDevApi({
        issueId: sourceContext.issueId,
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify(successBody), { status: 200 }),
      });

      expect(result.ok).toBe(true);
      expect(JSON.stringify(data)).toBe(before);
      expect(calls).toEqual([]);
      expect(JSON.stringify(data)).not.toContain('snapshot-source-of-truth');
    });
  });

  it('does not write localStorage or mutate AppData on failure', async () => {
    await withTrackedLocalStorage(async (calls) => {
      const data = makeRepairableWeightData();
      const before = JSON.stringify(data);
      const sourceContext = createDataHealthDismissSourceContext(data)!;
      const metadata = createDataHealthDismissMetadata({
        issueId: sourceContext.issueId,
        sourceFingerprint: sourceContext.sourceFingerprint,
        nowIso: '2026-05-10T00:00:00.000Z',
      });

      const result = await dismissDataHealthIssueViaDevApi({
        issueId: sourceContext.issueId,
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({
          result: {
            ok: false,
            changed: false,
            status: 'database_closed',
            reasonCode: 'database_closed',
            message: 'database closed',
          },
        }), { status: 503 }),
      });

      expect(result.ok).toBe(false);
      expect(JSON.stringify(data)).toBe(before);
      expect(calls).toEqual([]);
    });
  });

  it('keeps read-only comparison behavior separate from the mutation prototype', () => {
    const readOnlyClient = readSource('src/devApi/devApiReadOnlyClient.ts');
    const mutationClient = readSource('src/devApi/devApiDataHealthDismissClient.ts');
    const mutationPrototype = readSource('src/devApi/DevApiDataHealthDismissPrototype.tsx');

    expect(readOnlyClient).not.toContain('/data-health/issues/');
    expect(mutationClient).not.toContain('createDevApiReadOnlyClient');
    expect(mutationPrototype).not.toContain('saveData');
    expect(mutationPrototype).not.toContain('setData');
  });
});
