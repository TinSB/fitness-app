export type ProductionWriteShadowStatus = 'disabled' | 'unsupported' | 'accepted_shadow' | 'rejected' | 'failed';

export const PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS = [
  'dataHealthDismiss',
  'historyDataFlag',
  'historyEdit',
  'sessionStart',
  'activeSessionPatches',
  'activeSessionComplete',
  'activeSessionDiscard',
] as const;

export type ProductionWriteShadowRouteId = typeof PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS[number];

export type ProductionWriteShadowRequest = {
  routeId: ProductionWriteShadowRouteId;
  payload: unknown;
  operationId?: string;
};

export type ProductionWriteShadowAdapterResult =
  | { ok: true; accepted: true; shadowId: string }
  | { ok: true; accepted: false; reason: string }
  | { ok: false; reason: string };

export type ProductionWriteShadowAdapter = {
  submitShadow: (request: ProductionWriteShadowRequest) => Promise<ProductionWriteShadowAdapterResult>;
};

export type ProductionWriteShadowModeInput = {
  enabled?: boolean;
  request: ProductionWriteShadowRequest;
  adapter?: ProductionWriteShadowAdapter;
};

export type ProductionWriteShadowModeResult = {
  status: ProductionWriteShadowStatus;
  sourceOfTruth: false;
  localStorageMutated: false;
  routeId: ProductionWriteShadowRouteId;
  shadowId?: string;
  reason?: string;
};

export const createInMemoryProductionWriteShadowAdapter = (): ProductionWriteShadowAdapter => {
  const seenOperationIds = new Set<string>();

  return {
    submitShadow: async (request) => {
      if (request.operationId !== undefined) {
        if (seenOperationIds.has(request.operationId)) {
          return { ok: true, accepted: false, reason: 'duplicate_operation' };
        }
        seenOperationIds.add(request.operationId);
      }

      return {
        ok: true,
        accepted: true,
        shadowId: `shadow:${request.routeId}:${request.operationId ?? 'no-operation-id'}`,
      };
    },
  };
};

export const runProductionWriteShadowMode = async ({
  enabled = false,
  request,
  adapter,
}: ProductionWriteShadowModeInput): Promise<ProductionWriteShadowModeResult> => {
  if (!PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS.includes(request.routeId)) {
    return {
      status: 'unsupported',
      sourceOfTruth: false,
      localStorageMutated: false,
      routeId: request.routeId,
      reason: 'route_not_allowed',
    };
  }

  if (!enabled) {
    return {
      status: 'disabled',
      sourceOfTruth: false,
      localStorageMutated: false,
      routeId: request.routeId,
    };
  }

  if (adapter === undefined) {
    return {
      status: 'unsupported',
      sourceOfTruth: false,
      localStorageMutated: false,
      routeId: request.routeId,
      reason: 'shadow_adapter_required',
    };
  }

  try {
    const result = await adapter.submitShadow(request);
    if (!result.ok) {
      return {
        status: 'failed',
        sourceOfTruth: false,
        localStorageMutated: false,
        routeId: request.routeId,
        reason: result.reason,
      };
    }

    if (!result.accepted) {
      return {
        status: 'rejected',
        sourceOfTruth: false,
        localStorageMutated: false,
        routeId: request.routeId,
        reason: result.reason,
      };
    }

    return {
      status: 'accepted_shadow',
      sourceOfTruth: false,
      localStorageMutated: false,
      routeId: request.routeId,
      shadowId: result.shadowId,
    };
  } catch {
    return {
      status: 'failed',
      sourceOfTruth: false,
      localStorageMutated: false,
      routeId: request.routeId,
      reason: 'shadow_adapter_failed',
    };
  }
};
