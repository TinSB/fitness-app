export type BackendDeploymentPackageState =
  | 'deployment_disabled'
  | 'not_configured'
  | 'config_invalid'
  | 'candidate_ready'
  | 'deployment_not_started'
  | 'unsupported';

export type BackendDeploymentReadiness = 'unavailable' | 'candidate_ready';

export type BackendDeploymentConfigValidation = {
  ok: boolean;
  state: 'missing' | 'invalid' | 'valid' | 'unsupported';
  errors: string[];
};

export type BackendDeploymentPackageCapabilities = {
  backendEntryCapability: BackendDeploymentReadiness;
  startMode: 'disabled' | 'manual_candidate_only';
  healthReadiness: BackendDeploymentReadiness;
  capabilitiesReadiness: BackendDeploymentReadiness;
  readCandidateReadiness: BackendDeploymentReadiness;
  writeCandidateReadiness: BackendDeploymentReadiness;
  deploymentState: BackendDeploymentPackageState;
  deploymentStarted: false;
  autoStart: false;
  autoListen: false;
  bindsNetworkPort: false;
  sourceOfTruthChanged: false;
  defaultCloudSync: false;
  apiPrimaryDevPromoted: false;
  devRuntimeHostedAsProduction: false;
  sqliteSnapshotPromoted: false;
  localStorageRole: 'default_fallback_migration_emergency';
};

export type BackendDeploymentPackageBoundaryInput = {
  enabled?: boolean;
  backendEntryAvailable?: boolean;
  healthCandidateAvailable?: boolean;
  capabilitiesCandidateAvailable?: boolean;
  readCandidateAvailable?: boolean;
  writeCandidateAvailable?: boolean;
  configValidation?: BackendDeploymentConfigValidation;
  unsupportedRuntime?: boolean;
};

export type BackendDeploymentPackageBoundary = {
  kind: 'backend-deployment-package-boundary';
  state: BackendDeploymentPackageState;
  enabled: boolean;
  nodeOnly: true;
  configValidation: BackendDeploymentConfigValidation;
  capabilities: BackendDeploymentPackageCapabilities;
};

const defaultConfigValidation = (): BackendDeploymentConfigValidation => ({
  ok: false,
  state: 'missing',
  errors: ['config_missing'],
});

const unavailableReadiness = 'unavailable' as const;
const candidateReadiness = 'candidate_ready' as const;

const readiness = (available?: boolean): BackendDeploymentReadiness =>
  available === true ? candidateReadiness : unavailableReadiness;

export const resolveBackendDeploymentPackageState = (
  input: BackendDeploymentPackageBoundaryInput = {},
): BackendDeploymentPackageState => {
  if (input.unsupportedRuntime === true) return 'unsupported';
  if (input.enabled !== true) return 'deployment_disabled';

  const configValidation = input.configValidation ?? defaultConfigValidation();
  if (configValidation.state === 'missing') return 'not_configured';
  if (!configValidation.ok || configValidation.state === 'invalid') return 'config_invalid';

  const allCandidatesReady = [
    input.backendEntryAvailable,
    input.healthCandidateAvailable,
    input.capabilitiesCandidateAvailable,
    input.readCandidateAvailable,
    input.writeCandidateAvailable,
  ].every((item) => item === true);

  return allCandidatesReady ? 'candidate_ready' : 'deployment_not_started';
};

export const createBackendDeploymentPackageCapabilities = (
  state: BackendDeploymentPackageState,
  input: BackendDeploymentPackageBoundaryInput = {},
): BackendDeploymentPackageCapabilities => ({
  backendEntryCapability: readiness(input.backendEntryAvailable),
  startMode: state === 'candidate_ready' ? 'manual_candidate_only' : 'disabled',
  healthReadiness: readiness(input.healthCandidateAvailable),
  capabilitiesReadiness: readiness(input.capabilitiesCandidateAvailable),
  readCandidateReadiness: readiness(input.readCandidateAvailable),
  writeCandidateReadiness: readiness(input.writeCandidateAvailable),
  deploymentState: state,
  deploymentStarted: false,
  autoStart: false,
  autoListen: false,
  bindsNetworkPort: false,
  sourceOfTruthChanged: false,
  defaultCloudSync: false,
  apiPrimaryDevPromoted: false,
  devRuntimeHostedAsProduction: false,
  sqliteSnapshotPromoted: false,
  localStorageRole: 'default_fallback_migration_emergency',
});

export const createBackendDeploymentPackageBoundary = (
  input: BackendDeploymentPackageBoundaryInput = {},
): BackendDeploymentPackageBoundary => {
  const configValidation = input.configValidation ?? defaultConfigValidation();
  const state = resolveBackendDeploymentPackageState(input);

  return {
    kind: 'backend-deployment-package-boundary',
    state,
    enabled: input.enabled === true && state === 'candidate_ready',
    nodeOnly: true,
    configValidation,
    capabilities: createBackendDeploymentPackageCapabilities(state, input),
  };
};
