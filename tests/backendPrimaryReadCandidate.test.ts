import { describe, expect, it } from 'vitest';
import {
  runBackendPrimaryReadCandidate,
  type BackendPrimaryReadCandidateAdapter,
} from '../src/productionCutover/backendPrimaryReadCandidate';
import { readSource } from './runtimeBoundaryTestHelpers';

const successAdapter = (value: unknown): BackendPrimaryReadCandidateAdapter => ({
  read: async () => ({ ok: true, value }),
});

describe('backend primary read candidate', () => {
  it('is disabled by default and returns local fallback', async () => {
    await expect(runBackendPrimaryReadCandidate({
      surface: 'app-data-summary',
      localValue: { workouts: 1 },
    })).resolves.toMatchObject({
      status: 'disabled',
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidate: false,
      localStorageMutated: false,
      mutationCalled: false,
      fallbackValue: { workouts: 1 },
    });
  });

  it('returns backend value when explicitly enabled and matching local value', async () => {
    await expect(runBackendPrimaryReadCandidate({
      enabled: true,
      surface: 'sessions-summary',
      localValue: { activeSession: false },
      adapter: successAdapter({ activeSession: false }),
    })).resolves.toMatchObject({
      status: 'success',
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidate: true,
      localStorageMutated: false,
      mutationCalled: false,
      value: { activeSession: false },
    });
  });

  it('falls back safely when adapter is missing or backend unavailable', async () => {
    await expect(runBackendPrimaryReadCandidate({
      enabled: true,
      surface: 'history',
      localValue: [],
    })).resolves.toMatchObject({
      status: 'fallback',
      fallbackValue: [],
      diagnostic: { code: 'backend_read_adapter_required' },
    });

    await expect(runBackendPrimaryReadCandidate({
      enabled: true,
      surface: 'history',
      localValue: [],
      adapter: {
        read: async () => ({ ok: false, code: 'unavailable', message: 'synthetic unavailable' }),
      },
    })).resolves.toMatchObject({
      status: 'unavailable',
      fallbackValue: [],
      diagnostic: { code: 'backend_read_unavailable' },
    });
  });

  it('reports not found and mismatch without mutation or repair', async () => {
    await expect(runBackendPrimaryReadCandidate({
      enabled: true,
      surface: 'history-detail',
      params: { id: 'synthetic-missing' },
      localValue: null,
      adapter: {
        read: async () => ({ ok: false, code: 'not_found', message: 'missing synthetic history' }),
      },
    })).resolves.toMatchObject({
      status: 'not_found',
      sourceOfTruth: 'localStorage',
      localStorageMutated: false,
      mutationCalled: false,
    });

    await expect(runBackendPrimaryReadCandidate({
      enabled: true,
      surface: 'data-health-summary',
      localValue: { issueCount: 0 },
      adapter: successAdapter({ issueCount: 1 }),
    })).resolves.toMatchObject({
      status: 'mismatch',
      sourceOfTruth: 'localStorage',
      localStorageMutated: false,
      mutationCalled: false,
      fallbackValue: { issueCount: 0 },
      diagnostic: { code: 'backend_read_mismatch' },
    });
  });

  it('keeps frontend cutover source free of Node-only imports and route strings', () => {
    const source = readSource('src/productionCutover/backendPrimaryReadCandidate.ts');

    for (const forbidden of [
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
      'POST /sessions/start',
      'POST /data-health/repair/apply',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents Task 9.5 boundaries and next task', () => {
    const doc = readSource('docs/BACKEND_PRIMARY_READ_CANDIDATE.md');

    for (const expected of [
      'Task 9.5 Backend-Primary Read Candidate V1',
      'disabled by default',
      'sourceOfTruth: localStorage',
      'localStorageMutated: false',
      'mutationCalled: false',
      'does not repair, overwrite, sync, or mutate localStorage',
      'Recommended next task: Task 9.6 Backend-Primary Mutation Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
