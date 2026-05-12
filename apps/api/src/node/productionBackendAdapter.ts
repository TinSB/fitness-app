export type ProductionBackendEnvironment = 'local' | 'staging' | 'production';

export type ProductionBackendAdapterRequest = {
  method: string;
  path: string;
  requestId?: string;
  headers?: Record<string, string>;
  body?: unknown;
  sourceSnapshot?: {
    id: string;
    version: string;
  };
};

export type ProductionBackendAdapterError = {
  code: 'production_backend_not_activated' | 'route_not_allowed' | 'route_not_implemented';
  message: string;
  retryable: boolean;
};

export type ProductionBackendAdapterResponse = {
  ok: false;
  status: 404 | 501 | 503;
  requestId: string;
  error: ProductionBackendAdapterError;
};

export type ProductionBackendAdapterRoute = {
  method: 'POST';
  path: string;
};

export type ProductionBackendAdapter = {
  kind: 'production-backend-adapter-skeleton';
  environment: ProductionBackendEnvironment;
  autoListen: false;
  activated: false;
  acceptedBrowserMutationRoutes: readonly ProductionBackendAdapterRoute[];
  handle: (request: ProductionBackendAdapterRequest) => ProductionBackendAdapterResponse;
};

export const PRODUCTION_BACKEND_ADAPTER_ACCEPTED_BROWSER_MUTATION_ROUTES = [
  { method: 'POST', path: '/data-health/issues/:issueId/dismiss' },
  { method: 'POST', path: '/history/:id/data-flag' },
  { method: 'POST', path: '/history/:id/edit' },
  { method: 'POST', path: '/sessions/start' },
  { method: 'POST', path: '/sessions/active/patches' },
  { method: 'POST', path: '/sessions/active/complete' },
  { method: 'POST', path: '/sessions/active/discard' },
] as const satisfies readonly ProductionBackendAdapterRoute[];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const routePatternToRegex = (pattern: string) =>
  new RegExp(`^${pattern.split('/').map((part) => (part.startsWith(':') ? '[^/]+' : escapeRegex(part))).join('/')}$`);

const routeMatches = (pattern: string, path: string) => routePatternToRegex(pattern).test(path);

const normalizeMethod = (method: string) => method.trim().toUpperCase();

const normalizePath = (path: string) => path.split('?')[0] ?? path;

const requestIdFor = (request: ProductionBackendAdapterRequest) =>
  request.requestId?.trim() || 'production-backend-adapter-skeleton-request';

const isAcceptedRoute = (request: ProductionBackendAdapterRequest) => {
  const method = normalizeMethod(request.method);
  const path = normalizePath(request.path);
  return PRODUCTION_BACKEND_ADAPTER_ACCEPTED_BROWSER_MUTATION_ROUTES.some((route) =>
    route.method === method && routeMatches(route.path, path),
  );
};

const errorResponse = (
  request: ProductionBackendAdapterRequest,
  status: ProductionBackendAdapterResponse['status'],
  error: ProductionBackendAdapterError,
): ProductionBackendAdapterResponse => ({
  ok: false,
  status,
  requestId: requestIdFor(request),
  error,
});

export const createProductionBackendAdapter = (
  environment: ProductionBackendEnvironment = 'local',
): ProductionBackendAdapter => ({
  kind: 'production-backend-adapter-skeleton',
  environment,
  autoListen: false,
  activated: false,
  acceptedBrowserMutationRoutes: PRODUCTION_BACKEND_ADAPTER_ACCEPTED_BROWSER_MUTATION_ROUTES,
  handle: (request) => {
    if (!isAcceptedRoute(request)) {
      return errorResponse(request, 404, {
        code: 'route_not_allowed',
        message: 'Production backend adapter skeleton only recognizes the accepted browser mutation route allowlist.',
        retryable: false,
      });
    }

    return errorResponse(request, 503, {
      code: 'production_backend_not_activated',
      message: 'Production backend adapter skeleton is inert and does not execute production writes.',
      retryable: false,
    });
  },
});
