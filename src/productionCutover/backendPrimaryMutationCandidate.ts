import type { AppData } from '../models/training-model';
import {
  PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS,
  type ProductionWriteShadowRouteId,
} from '../productionApi/productionWriteShadowMode';
import { validateAppDataSchema } from '../storage/appDataValidation';

export type BackendPrimaryMutationCandidateStatus =
  | 'disabled'
  | 'unsupported'
  | 'accepted_candidate'
  | 'no_change'
  | 'rejected'
  | 'failed'
  | 'rollback_required'
  | 'rollback_available';

export type BackendPrimaryMutationCandidateRequest = {
  routeId: ProductionWriteShadowRouteId;
  payload: unknown;
  operationId?: string;
};

export type BackendPrimaryMutationApplyResult =
  | { ok: true; changed: true; nextData: AppData }
  | { ok: true; changed: false; reason: string }
  | { ok: false; reason: string };

export type BackendPrimaryMutationCandidateAdapter = {
  apply: (request: BackendPrimaryMutationCandidateRequest) => Promise<BackendPrimaryMutationApplyResult>;
};

export type BackendPrimaryMutationRepositoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } };

export type BackendPrimaryMutationCandidateRepository = {
  createBackupCandidate: () => BackendPrimaryMutationRepositoryResult<{ backupId: string }>;
  writeAppDataCandidate: (
    input: { data: AppData; backupId: string },
  ) => BackendPrimaryMutationRepositoryResult<{ snapshotId: string }>;
};

export type BackendPrimaryMutationCandidateInput = {
  enabled?: boolean;
  request: BackendPrimaryMutationCandidateRequest;
  adapter?: BackendPrimaryMutationCandidateAdapter;
  repository?: BackendPrimaryMutationCandidateRepository;
  seenOperationIds?: Set<string>;
};

export type BackendPrimaryMutationCandidateResult = {
  status: BackendPrimaryMutationCandidateStatus;
  routeId: ProductionWriteShadowRouteId;
  sourceOfTruth: 'localStorage';
  backendPrimaryCandidate: boolean;
  localStorageMutated: false;
  rollbackAvailable: boolean;
  rollbackRequired: boolean;
  snapshotId?: string;
  reason?: string;
};

const result = (
  status: BackendPrimaryMutationCandidateStatus,
  request: BackendPrimaryMutationCandidateRequest,
  options: Partial<BackendPrimaryMutationCandidateResult> = {},
): BackendPrimaryMutationCandidateResult => ({
  status,
  routeId: request.routeId,
  sourceOfTruth: 'localStorage',
  backendPrimaryCandidate: status !== 'disabled',
  localStorageMutated: false,
  rollbackAvailable: false,
  rollbackRequired: false,
  ...options,
});

export const createBackendPrimaryMutationCandidateOperationSet = () => new Set<string>();

export const runBackendPrimaryMutationCandidate = async ({
  enabled = false,
  request,
  adapter,
  repository,
  seenOperationIds,
}: BackendPrimaryMutationCandidateInput): Promise<BackendPrimaryMutationCandidateResult> => {
  if (!PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS.includes(request.routeId)) {
    return result('unsupported', request, { reason: 'route_not_allowed' });
  }

  if (!enabled) return result('disabled', request);

  if (adapter === undefined || repository === undefined) {
    return result('unsupported', request, { reason: 'mutation_adapter_and_repository_required' });
  }

  if (request.operationId !== undefined && seenOperationIds?.has(request.operationId)) {
    return result('rejected', request, { reason: 'duplicate_operation' });
  }

  const applied = await adapter.apply(request);
  if (!applied.ok) return result('failed', request, { reason: applied.reason });
  if (!applied.changed) return result('no_change', request, { reason: applied.reason });

  if (!validateAppDataSchema(applied.nextData)) {
    return result('rejected', request, { reason: 'next_data_validation_failed' });
  }

  const backup = repository.createBackupCandidate();
  if (!backup.ok) return result('rejected', request, { reason: backup.error.code });

  const write = repository.writeAppDataCandidate({
    data: applied.nextData,
    backupId: backup.value.backupId,
  });

  if (!write.ok) {
    return result('rollback_required', request, {
      rollbackAvailable: true,
      rollbackRequired: true,
      reason: write.error.code,
    });
  }

  if (request.operationId !== undefined) seenOperationIds?.add(request.operationId);

  return result('accepted_candidate', request, {
    rollbackAvailable: true,
    snapshotId: write.value.snapshotId,
  });
};
