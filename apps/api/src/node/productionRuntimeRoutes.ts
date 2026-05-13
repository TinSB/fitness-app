import {
  createProductionRuntimeCapabilities,
  type ProductionRuntimeSkeletonCapabilities,
} from './productionRuntimeSkeleton';

export type ProductionRuntimeRouteRequest = {
  method: string;
  path: string;
  requestId?: string;
};

export type ProductionRuntimeRouteResponse =
  | {
    ok: true;
    status: 200;
    requestId: string;
    body: {
      route: '/health';
      status: 'ok';
      runtimeAvailable: false;
      sourceOfTruth: false;
    } | {
      route: '/capabilities';
      capabilities: ProductionRuntimeSkeletonCapabilities;
    };
  }
  | {
    ok: false;
    status: 404 | 405;
    requestId: string;
    error: {
      code: 'production_route_not_found' | 'production_route_method_not_allowed';
      message: string;
    };
  };

const requestIdFor = (request: ProductionRuntimeRouteRequest) =>
  request.requestId?.trim() || 'production-runtime-route-request';

const normalizeMethod = (method: string) => method.trim().toUpperCase();

const normalizePath = (path: string) => path.split('?')[0] ?? path;

const knownRoutes = new Set(['/health', '/capabilities']);

const errorResponse = (
  request: ProductionRuntimeRouteRequest,
  status: 404 | 405,
  code: 'production_route_not_found' | 'production_route_method_not_allowed',
  message: string,
): ProductionRuntimeRouteResponse => ({
  ok: false,
  status,
  requestId: requestIdFor(request),
  error: { code, message },
});

export const handleProductionRuntimeRoute = (
  request: ProductionRuntimeRouteRequest,
): ProductionRuntimeRouteResponse => {
  const method = normalizeMethod(request.method);
  const path = normalizePath(request.path);

  if (!knownRoutes.has(path)) {
    return errorResponse(request, 404, 'production_route_not_found', 'Production runtime route is not recognized.');
  }

  if (method !== 'GET') {
    return errorResponse(request, 405, 'production_route_method_not_allowed', 'Production runtime route only supports GET.');
  }

  if (path === '/health') {
    return {
      ok: true,
      status: 200,
      requestId: requestIdFor(request),
      body: {
        route: '/health',
        status: 'ok',
        runtimeAvailable: false,
        sourceOfTruth: false,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    requestId: requestIdFor(request),
    body: {
      route: '/capabilities',
      capabilities: createProductionRuntimeCapabilities('scaffold_only'),
    },
  };
};
