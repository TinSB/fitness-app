import type { AppData } from '../../../../packages/contracts/src';
import {
  handleReadMirrorRequest,
  READ_MIRROR_ROUTES,
  type ReadMirrorResponse,
} from '../readMirror';
import {
  handleRecordDataHealthMutationRequest,
  RECORD_DATA_HEALTH_MUTATION_ROUTES,
} from '../recordDataHealthMutation';
import {
  handleSessionMutationRequest,
  SESSION_MUTATION_ROUTES,
} from '../sessionMutation';
import {
  SqliteRepositoryError,
  type SqliteRepositoryErrorCode,
  type SqliteSnapshotWriteResult,
  type createSqliteRepository,
} from '../sqliteRepository';
import { sanitizeData } from '../../../../src/storage/appDataSanitize';

export type ServerAdapterRequest = {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string>;
  nowIso?: string;
};

export type ServerAdapterError = {
  code: string;
  message: string;
};

export type ServerAdapterResponse<TResult = unknown> = {
  status: number;
  result?: TResult;
  error?: ServerAdapterError;
  snapshot?: SqliteSnapshotWriteResult;
};

type SqliteRepository = ReturnType<typeof createSqliteRepository>;

type AdapterRouteKind = 'read' | 'session_mutation' | 'record_data_health_mutation';

type AdapterRoute = {
  method: 'GET' | 'POST';
  path: string;
  kind: AdapterRouteKind;
  match: (path: string) => boolean;
};

export const SERVER_ADAPTER_READ_ROUTES = READ_MIRROR_ROUTES.map(({ method, path }) => ({ method, path }));
export const SERVER_ADAPTER_SESSION_MUTATION_ROUTES = SESSION_MUTATION_ROUTES.map(({ method, path }) => ({
  method,
  path,
}));
export const SERVER_ADAPTER_RECORD_DATA_HEALTH_MUTATION_ROUTES = RECORD_DATA_HEALTH_MUTATION_ROUTES.map(
  ({ method, path }) => ({
    method,
    path,
  }),
);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const routePatternToRegex = (pattern: string) =>
  new RegExp(`^${pattern.split('/').map((part) => (part.startsWith(':') ? '[^/]+' : escapeRegex(part))).join('/')}$`);

const routeMatches = (pattern: string, path: string) => routePatternToRegex(pattern).test(path);

const ADAPTER_ROUTES: AdapterRoute[] = [
  ...SERVER_ADAPTER_READ_ROUTES.map(({ method, path }) => ({
    method,
    path,
    kind: 'read' as const,
    match: (requestPath: string) => routeMatches(path, requestPath),
  })),
  ...SERVER_ADAPTER_SESSION_MUTATION_ROUTES.map(({ method, path }) => ({
    method,
    path,
    kind: 'session_mutation' as const,
    match: (requestPath: string) => routeMatches(path, requestPath),
  })),
  ...SERVER_ADAPTER_RECORD_DATA_HEALTH_MUTATION_ROUTES.map(({ method, path }) => ({
    method,
    path,
    kind: 'record_data_health_mutation' as const,
    match: (requestPath: string) => routeMatches(path, requestPath),
  })),
];

export const SERVER_ADAPTER_ROUTES = ADAPTER_ROUTES.map(({ method, path, kind }) => ({ method, path, kind }));

export type CreateServerAdapterOptions = {
  repository: SqliteRepository;
  clock?: () => string;
};

const nowIso = (request: ServerAdapterRequest, clock?: () => string) =>
  typeof request.nowIso === 'string' && request.nowIso.trim()
    ? request.nowIso
    : clock?.() || new Date().toISOString();

const unsupportedResult = (message: string) => ({
  ok: false,
  changed: false,
  status: 'unsupported',
  reasonCode: 'unsupported_route',
  message,
});

const repositoryStatusCode = (code: SqliteRepositoryErrorCode) => {
  if (code === 'snapshot_not_found') return 404;
  if (code === 'import_rejected') return 400;
  if (code === 'database_closed') return 503;
  return 500;
};

const repositoryErrorResponse = (error: unknown): ServerAdapterResponse => {
  if (error instanceof SqliteRepositoryError) {
    return {
      status: repositoryStatusCode(error.code),
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }
  return {
    status: 500,
    error: {
      code: 'repository_error',
      message: 'Repository operation failed.',
    },
  };
};

const healthRepositoryStatus = (repository: SqliteRepository) => {
  try {
    repository.database.prepare('SELECT value FROM app_meta WHERE key = ? LIMIT 1').get('repository_schema_version');
    return { ok: true as const, status: 'ready' as const };
  } catch (error) {
    if (error instanceof SqliteRepositoryError) {
      return {
        ok: false as const,
        status: 'degraded' as const,
        error: { code: error.code, message: error.message },
      };
    }
    const message = error instanceof Error ? error.message : '';
    const code = /closed|not open|database is not open/i.test(message) ? 'database_closed' : 'repository_error';
    return {
      ok: false as const,
      status: 'degraded' as const,
      error: {
        code,
        message: code === 'database_closed' ? 'SQLite repository is closed.' : 'Repository health check failed.',
      },
    };
  }
};

const healthResponse = (repository: SqliteRepository): ServerAdapterResponse => ({
  status: 200,
  result: {
    ok: true,
    service: 'ironpath-server-adapter',
    mode: 'node-only server adapter skeleton',
    runtimeServer: false,
    readRoutes: SERVER_ADAPTER_READ_ROUTES,
    sessionMutationRoutes: SERVER_ADAPTER_SESSION_MUTATION_ROUTES,
    recordDataHealthMutationRoutes: SERVER_ADAPTER_RECORD_DATA_HEALTH_MUTATION_ROUTES,
    repository: healthRepositoryStatus(repository),
  },
});

const resolveRoute = (request: ServerAdapterRequest) => {
  const pathMatch = ADAPTER_ROUTES.find((route) => route.match(request.path));
  if (!pathMatch) return { status: 404 as const, route: undefined };
  if (pathMatch.method !== request.method) return { status: 405 as const, route: pathMatch };
  return { status: 200 as const, route: pathMatch };
};

const snapshotLabelForRoute = (route: AdapterRoute) => `mutation:${route.path}`;

const readLatestAppData = (repository: SqliteRepository): AppData => repository.readSnapshot();

export const createServerAdapter = ({ repository, clock }: CreateServerAdapterOptions) => {
  const handleRequest = (request: ServerAdapterRequest): ServerAdapterResponse => {
    const resolved = resolveRoute(request);
    if (!resolved.route) {
      return { status: 404, result: unsupportedResult('Server adapter route not found.') };
    }
    if (resolved.status === 405) {
      return { status: 405, result: unsupportedResult('Server adapter route does not support this method.') };
    }

    if (resolved.route.kind === 'read' && resolved.route.path === '/health') {
      return healthResponse(repository);
    }

    let data: AppData;
    try {
      data = readLatestAppData(repository);
    } catch (error) {
      return repositoryErrorResponse(error);
    }

    if (resolved.route.kind === 'read') {
      const readResponse: ReadMirrorResponse = handleReadMirrorRequest(data, {
        method: request.method,
        path: request.path,
      });
      return { status: readResponse.status, result: readResponse.body };
    }

    const mutationRequest = {
      method: request.method,
      path: request.path,
      body: request.body,
      nowIso: request.nowIso || nowIso(request, clock),
    };
    const mutationResponse =
      resolved.route.kind === 'session_mutation'
        ? handleSessionMutationRequest(data, mutationRequest)
        : handleRecordDataHealthMutationRequest(data, mutationRequest);

    if (!mutationResponse.nextData) {
      return { status: mutationResponse.status, result: mutationResponse.result };
    }

    try {
      const snapshot = repository.writeSnapshot(sanitizeData(mutationResponse.nextData), {
        createdAt: nowIso(request, clock),
        label: snapshotLabelForRoute(resolved.route),
      });
      return {
        status: mutationResponse.status,
        result: mutationResponse.result,
        snapshot,
      };
    } catch (error) {
      return repositoryErrorResponse(error);
    }
  };

  return { handleRequest };
};
