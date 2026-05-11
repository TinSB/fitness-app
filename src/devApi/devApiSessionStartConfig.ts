import {
  resolveDevApiReadOnlyConfig,
  type DevApiReadOnlyEnv,
} from './devApiReadOnlyConfig';

export type DevApiSessionStartEnv = DevApiReadOnlyEnv & Record<string, unknown>;

export type DevApiSessionStartDisabledConfig = {
  enabled: false;
  status: 'disabled';
  reason: 'not_dev' | 'compare_flag_off' | 'mutation_flag_off';
};

export type DevApiSessionStartInvalidConfig = {
  enabled: false;
  status: 'invalid';
  error: {
    code: 'dev_api_invalid_base_url' | 'dev_api_non_localhost_base_url' | 'dev_api_invalid_timeout';
    message: string;
  };
};

export type DevApiSessionStartEnabledConfig = {
  enabled: true;
  status: 'enabled';
  experiment: string;
  baseUrl: string;
  timeoutMs: number;
};

export type DevApiSessionStartConfig =
  | DevApiSessionStartDisabledConfig
  | DevApiSessionStartInvalidConfig
  | DevApiSessionStartEnabledConfig;

export const DEV_API_SESSION_START_EXPERIMENT = ['session', 'start'].join('-');
const mutationExperimentEnvKey = ['VITE', 'IRONPATH', 'DEV', 'API', 'MUTATION', 'EXPERIMENT'].join('_');

export const resolveDevApiSessionStartConfig = (
  env: DevApiSessionStartEnv,
): DevApiSessionStartConfig => {
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
  if (mutationExperiment !== DEV_API_SESSION_START_EXPERIMENT) {
    return {
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    };
  }

  return {
    enabled: true,
    status: 'enabled',
    experiment: DEV_API_SESSION_START_EXPERIMENT,
    baseUrl: readOnlyConfig.baseUrl,
    timeoutMs: readOnlyConfig.timeoutMs,
  };
};
