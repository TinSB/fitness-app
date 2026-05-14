export type DeploymentRuntimeStatus =
  | 'disabled'
  | 'not_configured'
  | 'config_invalid'
  | 'ready_candidate'
  | 'deployment_not_implemented';

export type DeploymentTargetKind =
  | 'separate-node-api'
  | 'vercel-serverless-candidate'
  | 'managed-backend-candidate'
  | 'self-hosted-candidate';

export type DeploymentRuntimeErrorCode =
  | 'deployment_disabled'
  | 'target_required'
  | 'production_url_required'
  | 'production_url_invalid'
  | 'hosting_config_not_implemented'
  | 'deployment_not_implemented';

export type DeploymentRuntimeConfig = {
  enabled?: boolean;
  targetKind?: DeploymentTargetKind;
  productionUrl?: string;
  hostingConfigPresent?: boolean;
};

export type DeploymentCapabilityModel = {
  status: DeploymentRuntimeStatus;
  enabled: boolean;
  targetKind: DeploymentTargetKind | null;
  canDeploy: false;
  canStartServer: false;
  hasHostingConfig: false;
  packageScriptsRequired: false;
};

export type DeploymentRuntimeError = {
  code: DeploymentRuntimeErrorCode;
  message: string;
};

export type DeploymentReadinessResult = DeploymentCapabilityModel & {
  ok: boolean;
  errors: DeploymentRuntimeError[];
};

const error = (code: DeploymentRuntimeErrorCode, message: string): DeploymentRuntimeError => ({ code, message });

const baseCapability = (
  status: DeploymentRuntimeStatus,
  targetKind: DeploymentTargetKind | null,
  enabled = false,
): DeploymentCapabilityModel => ({
  status,
  enabled,
  targetKind,
  canDeploy: false,
  canStartServer: false,
  hasHostingConfig: false,
  packageScriptsRequired: false,
});

const isProductionUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
};

export const getDeploymentRuntimeCapabilities = (
  config: DeploymentRuntimeConfig = {},
): DeploymentCapabilityModel => {
  if (config.enabled !== true) return baseCapability('disabled', null);
  if (!config.targetKind) return baseCapability('not_configured', null);
  if (!isProductionUrl(config.productionUrl) || config.hostingConfigPresent === true) {
    return baseCapability('config_invalid', config.targetKind);
  }
  return baseCapability('ready_candidate', config.targetKind, true);
};

export const validateDeploymentRuntimeConfig = (
  config: DeploymentRuntimeConfig = {},
): DeploymentReadinessResult => {
  const errors: DeploymentRuntimeError[] = [];
  const capabilities = getDeploymentRuntimeCapabilities(config);

  if (config.enabled !== true) {
    errors.push(error('deployment_disabled', 'Deployment runtime skeleton is disabled by default.'));
  }

  if (config.enabled === true && !config.targetKind) {
    errors.push(error('target_required', 'Deployment target kind is required for future deployment candidate readiness.'));
  }

  if (config.enabled === true && !config.productionUrl) {
    errors.push(error('production_url_required', 'Production URL is required for future deployment candidate readiness.'));
  } else if (config.enabled === true && !isProductionUrl(config.productionUrl)) {
    errors.push(error('production_url_invalid', 'Production URL must be a valid HTTPS non-local URL.'));
  }

  if (config.hostingConfigPresent === true) {
    errors.push(error('hosting_config_not_implemented', 'Hosting config is not implemented in Phase 10.'));
  }

  if (config.enabled === true && errors.length === 0) {
    errors.push(error('deployment_not_implemented', 'Deployment runtime is not implemented in Phase 10.'));
  }

  return {
    ...capabilities,
    ok: false,
    status: errors.length > 0 && capabilities.status === 'ready_candidate'
      ? 'deployment_not_implemented'
      : capabilities.status,
    errors,
  };
};

export const createDeploymentRuntimeSkeleton = (
  config: DeploymentRuntimeConfig = {},
): DeploymentReadinessResult => validateDeploymentRuntimeConfig(config);
