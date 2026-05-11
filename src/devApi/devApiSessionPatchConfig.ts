import {
  resolveDevApiReadOnlyConfig,
  type DevApiReadOnlyEnv,
} from './devApiReadOnlyConfig';

export type DevApiSessionPatchEnv = DevApiReadOnlyEnv & Record<string, unknown>;

export type DevApiSessionPatchDisabledConfig = {
  enabled: false;
  status: 'disabled';
  reason: 'not_dev' | 'compare_flag_off' | 'mutation_flag_off';
};

export type DevApiSessionPatchInvalidConfig = {
  enabled: false;
  status: 'invalid';
  error: {
    code: 'dev_api_invalid_base_url' | 'dev_api_non_localhost_base_url' | 'dev_api_invalid_timeout';
    message: string;
  };
};

export type DevApiSessionPatchEnabledConfig = {
  enabled: true;
  status: 'enabled';
  experiment: string;
  baseUrl: string;
  timeoutMs: number;
};

export type DevApiSessionPatchConfig =
  | DevApiSessionPatchDisabledConfig
  | DevApiSessionPatchInvalidConfig
  | DevApiSessionPatchEnabledConfig;

export const DEV_API_SESSION_PATCH_EXPERIMENT = ['session', 'patch'].join('-');
const mutationExperimentEnvKey = ['VITE', 'IRONPATH', 'DEV', 'API', 'MUTATION', 'EXPERIMENT'].join('_');

export const resolveDevApiSessionPatchConfig = (
  env: DevApiSessionPatchEnv,
): DevApiSessionPatchConfig => {
  const readOnlyConfig = resolveDevApiReadOnlyConfig(env);

  if (readOnlyConfig.status === 'invalid') {
    return {
      enabled: false,
      status: 'invalid',
      error: readOnlyConfig.error,
    };
  }

  if (!readOnlyConfig.enabled) {
    return {
      enabled: false,
      status: 'disabled',
      reason: readOnlyConfig.reason === 'not_dev' ? 'not_dev' : 'compare_flag_off',
    };
  }

  const mutationExperiment = (env as Record<string, unknown>)[mutationExperimentEnvKey];
  if (mutationExperiment !== DEV_API_SESSION_PATCH_EXPERIMENT) {
    return {
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    };
  }

  return {
    enabled: true,
    status: 'enabled',
    experiment: DEV_API_SESSION_PATCH_EXPERIMENT,
    baseUrl: readOnlyConfig.baseUrl,
    timeoutMs: readOnlyConfig.timeoutMs,
  };
};
