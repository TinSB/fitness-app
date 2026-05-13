import { describe, expect, it } from 'vitest';
import {
  createBackendPrimaryMutationCandidateOperationSet,
  runBackendPrimaryMutationCandidate,
  type BackendPrimaryMutationCandidateAdapter,
  type BackendPrimaryMutationCandidateRepository,
} from '../src/productionCutover/backendPrimaryMutationCandidate';
import { PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS } from '../src/productionApi/productionWriteShadowMode';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { emptyData } from '../src/storage/persistence';
import { readSource } from './runtimeBoundaryTestHelpers';

const request = {
  routeId: 'historyEdit' as const,
  payload: { synthetic: true },
  operationId: 'op-1',
};

const successAdapter: BackendPrimaryMutationCandidateAdapter = {
  apply: async () => ({ ok: true, changed: true, nextData: emptyData() }),
};

const repository = (writeOk = true): BackendPrimaryMutationCandidateRepository => ({
  createBackupCandidate: () => ({ ok: true, value: { backupId: 'backup-1' } }),
  writeAppDataCandidate: () => (
    writeOk
      ? { ok: true, value: { snapshotId: 'snapshot-1' } }
      : { ok: false, error: { code: 'write_failed', message: 'synthetic failure' } }
  ),
});

describe('backend primary mutation candidate', () => {
  it('is disabled by default and uses only the seven approved route ids', async () => {
    expect(PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS).toHaveLength(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES.length);
    await expect(runBackendPrimaryMutationCandidate({ request })).resolves.toMatchObject({
      status: 'disabled',
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidate: false,
      localStorageMutated: false,
    });
  });

  it('accepts candidate write only after adapter, validation, backup, and repository write pass', async () => {
    await expect(runBackendPrimaryMutationCandidate({
      enabled: true,
      request,
      adapter: successAdapter,
      repository: repository(),
      seenOperationIds: createBackendPrimaryMutationCandidateOperationSet(),
    })).resolves.toMatchObject({
      status: 'accepted_candidate',
      sourceOfTruth: 'localStorage',
      localStorageMutated: false,
      rollbackAvailable: true,
      rollbackRequired: false,
      snapshotId: 'snapshot-1',
    });
  });

  it('rejects unsupported, missing, no-op, invalid, failed, duplicate, and rollback cases without local mutation', async () => {
    await expect(runBackendPrimaryMutationCandidate({
      enabled: true,
      request: { ...request, routeId: 'notAllowed' as never },
      adapter: successAdapter,
      repository: repository(),
    })).resolves.toMatchObject({ status: 'unsupported', reason: 'route_not_allowed' });

    await expect(runBackendPrimaryMutationCandidate({ enabled: true, request })).resolves.toMatchObject({
      status: 'unsupported',
      reason: 'mutation_adapter_and_repository_required',
    });

    await expect(runBackendPrimaryMutationCandidate({
      enabled: true,
      request,
      adapter: { apply: async () => ({ ok: true, changed: false, reason: 'no_change' }) },
      repository: repository(),
    })).resolves.toMatchObject({ status: 'no_change', localStorageMutated: false });

    await expect(runBackendPrimaryMutationCandidate({
      enabled: true,
      request,
      adapter: { apply: async () => ({ ok: true, changed: true, nextData: { schemaVersion: 1 } as never }) },
      repository: repository(),
    })).resolves.toMatchObject({ status: 'rejected', reason: 'next_data_validation_failed' });

    await expect(runBackendPrimaryMutationCandidate({
      enabled: true,
      request,
      adapter: { apply: async () => ({ ok: false, reason: 'adapter_failed' }) },
      repository: repository(),
    })).resolves.toMatchObject({ status: 'failed', reason: 'adapter_failed' });

    await expect(runBackendPrimaryMutationCandidate({
      enabled: true,
      request,
      adapter: successAdapter,
      repository: repository(false),
    })).resolves.toMatchObject({
      status: 'rollback_required',
      rollbackAvailable: true,
      rollbackRequired: true,
      reason: 'write_failed',
    });

    const seen = createBackendPrimaryMutationCandidateOperationSet();
    await runBackendPrimaryMutationCandidate({ enabled: true, request, adapter: successAdapter, repository: repository(), seenOperationIds: seen });
    await expect(runBackendPrimaryMutationCandidate({ enabled: true, request, adapter: successAdapter, repository: repository(), seenOperationIds: seen }))
      .resolves.toMatchObject({ status: 'rejected', reason: 'duplicate_operation' });
  });

  it('keeps source free of route strings and blocked HTTP surfaces', () => {
    const source = readSource('src/productionCutover/backendPrimaryMutationCandidate.ts');

    for (const route of API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES) {
      expect(source).not.toContain(route);
    }
    for (const forbidden of [
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents Task 9.6 boundaries and next task', () => {
    const doc = readSource('docs/BACKEND_PRIMARY_MUTATION_CANDIDATE.md');

    for (const expected of [
      'Task 9.6 Backend-Primary Mutation Candidate V1',
      'disabled by default',
      'No eighth browser mutation route is authorized.',
      'accepted_candidate',
      'rollback_required',
      'sourceOfTruth: localStorage',
      'localStorageMutated: false',
      'Recommended next task: Task 9.7 Frontend Source-of-Truth Runtime Switch Guard V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
