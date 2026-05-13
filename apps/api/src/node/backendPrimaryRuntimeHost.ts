export type BackendPrimaryRuntimeHostStatus =
  | 'disabled'
  | 'candidate'
  | 'unsupported'
  | 'not_source_of_truth';

export type BackendPrimaryRuntimeHostCapabilities = {
  status: BackendPrimaryRuntimeHostStatus;
  nodeOnly: true;
  autoListen: false;
  sourceOfTruth: false;
  auth: false;
  cloudSync: false;
  deploymentReady: false;
  monitoringReady: false;
  localStorageRole: 'default_fallback_migration_emergency';
  apiPrimaryDevPromoted: false;
  devRuntimeRunnerHosted: false;
  sqliteSnapshotRepositoryPromoted: false;
};

export type BackendPrimaryRuntimeHost = {
  kind: 'backend-primary-runtime-host-boundary';
  status: BackendPrimaryRuntimeHostStatus;
  enabled: boolean;
  sourceOfTruth: false;
  autoListen: false;
  capabilities: BackendPrimaryRuntimeHostCapabilities;
};

export type BackendPrimaryRuntimeHostOptions = {
  enabled?: boolean;
  status?: BackendPrimaryRuntimeHostStatus;
};

export type BackendPrimaryRuntimeHostRequest = {
  method: string;
  path: string;
  requestId?: string;
};

export type BackendPrimaryRuntimeHostResponse =
  | {
    ok: true;
    status: 200;
    requestId: string;
    sourceOfTruth: false;
    capabilities: BackendPrimaryRuntimeHostCapabilities;
  }
  | {
    ok: false;
    status: 404 | 501;
    requestId: string;
    sourceOfTruth: false;
    error: {
      code: 'backend_primary_host_disabled' | 'backend_primary_host_route_not_found';
      message: string;
    };
  };

export const getBackendPrimaryRuntimeHostCapabilities = (
  status: BackendPrimaryRuntimeHostStatus = 'disabled',
): BackendPrimaryRuntimeHostCapabilities => ({
  status,
  nodeOnly: true,
  autoListen: false,
  sourceOfTruth: false,
  auth: false,
  cloudSync: false,
  deploymentReady: false,
  monitoringReady: false,
  localStorageRole: 'default_fallback_migration_emergency',
  apiPrimaryDevPromoted: false,
  devRuntimeRunnerHosted: false,
  sqliteSnapshotRepositoryPromoted: false,
});

export const createBackendPrimaryRuntimeHost = (
  options: BackendPrimaryRuntimeHostOptions = {},
): BackendPrimaryRuntimeHost => {
  const status = options.status ?? (options.enabled ? 'candidate' : 'disabled');

  return {
    kind: 'backend-primary-runtime-host-boundary',
    status,
    enabled: options.enabled === true,
    sourceOfTruth: false,
    autoListen: false,
    capabilities: getBackendPrimaryRuntimeHostCapabilities(status),
  };
};

const requestIdFor = (request: BackendPrimaryRuntimeHostRequest) =>
  request.requestId?.trim() || 'backend-primary-runtime-host-request';

export const handleBackendPrimaryRuntimeRequest = (
  host: BackendPrimaryRuntimeHost,
  request: BackendPrimaryRuntimeHostRequest,
): BackendPrimaryRuntimeHostResponse => {
  if (request.path !== '/capabilities') {
    return {
      ok: false,
      status: 404,
      requestId: requestIdFor(request),
      sourceOfTruth: false,
      error: {
        code: 'backend_primary_host_route_not_found',
        message: 'Backend-primary runtime host boundary only exposes candidate capabilities.',
      },
    };
  }

  if (!host.enabled) {
    return {
      ok: false,
      status: 501,
      requestId: requestIdFor(request),
      sourceOfTruth: false,
      error: {
        code: 'backend_primary_host_disabled',
        message: 'Backend-primary runtime host boundary is disabled by default.',
      },
    };
  }

  return {
    ok: true,
    status: 200,
    requestId: requestIdFor(request),
    sourceOfTruth: false,
    capabilities: host.capabilities,
  };
};
