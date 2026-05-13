import type {
  ProductionPersistenceAdapter,
  ProductionPersistenceResult,
} from './productionPersistence';

export type ProductionReadContractRequest = {
  method: string;
  path: string;
  requestId?: string;
};

export type ProductionReadContractResponse =
  | {
    ok: true;
    status: 200;
    requestId: string;
    route: string;
    sourceOfTruth: false;
    value: unknown;
  }
  | {
    ok: false;
    status: 404 | 405 | 501;
    requestId: string;
    route: string;
    sourceOfTruth: false;
    error: {
      code: 'production_read_route_not_found'
      | 'production_read_method_not_allowed'
      | 'production_read_not_found'
      | 'production_read_unsupported';
      message: string;
    };
  };

const requestIdFor = (request: ProductionReadContractRequest) =>
  request.requestId?.trim() || 'production-read-contract-request';

const normalizeMethod = (method: string) => method.trim().toUpperCase();

const normalizePath = (path: string) => path.split('?')[0] ?? path;

const successResponse = (
  request: ProductionReadContractRequest,
  route: string,
  value: unknown,
): ProductionReadContractResponse => ({
  ok: true,
  status: 200,
  requestId: requestIdFor(request),
  route,
  sourceOfTruth: false,
  value,
});

const errorResponse = (
  request: ProductionReadContractRequest,
  status: 404 | 405 | 501,
  route: string,
  code: ProductionReadContractResponse extends infer R
    ? R extends { ok: false; error: { code: infer C } } ? C : never
    : never,
  message: string,
): ProductionReadContractResponse => ({
  ok: false,
  status,
  requestId: requestIdFor(request),
  route,
  sourceOfTruth: false,
  error: { code, message },
});

const resultToResponse = <T>(
  request: ProductionReadContractRequest,
  route: string,
  result: ProductionPersistenceResult<T>,
): ProductionReadContractResponse => {
  if (result.ok) return successResponse(request, route, result.value);

  if (result.error.code === 'production_persistence_not_found') {
    return errorResponse(request, 404, route, 'production_read_not_found', 'Production read item was not found.');
  }

  return errorResponse(request, 501, route, 'production_read_unsupported', 'Production read route is not implemented by persistence adapter.');
};

export const handleProductionReadContract = (
  request: ProductionReadContractRequest,
  adapter: ProductionPersistenceAdapter,
): ProductionReadContractResponse => {
  const method = normalizeMethod(request.method);
  const path = normalizePath(request.path);

  const route = path.startsWith('/history/') ? '/history/:id' : path;
  const knownRoutes = new Set([
    '/app-data/summary',
    '/sessions/summary',
    '/history',
    '/history/:id',
    '/data-health/summary',
  ]);

  if (!knownRoutes.has(route)) {
    return errorResponse(request, 404, route, 'production_read_route_not_found', 'Production read route is not recognized.');
  }

  if (method !== 'GET') {
    return errorResponse(request, 405, route, 'production_read_method_not_allowed', 'Production read contract only supports GET.');
  }

  if (route === '/app-data/summary') return resultToResponse(request, route, adapter.readAppDataSummary());
  if (route === '/sessions/summary') return resultToResponse(request, route, adapter.readSessionsSummary());
  if (route === '/history') return resultToResponse(request, route, adapter.readHistory());
  if (route === '/data-health/summary') return resultToResponse(request, route, adapter.readDataHealthSummary());

  const id = decodeURIComponent(path.slice('/history/'.length));
  return resultToResponse(request, route, adapter.readHistoryItem(id));
};
