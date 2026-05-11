import {
  resolveDevApiReadOnlyConfig,
  type DevApiReadOnlyEnv,
} from './devApiReadOnlyConfig';

export type DevApiSessionCompleteEnv = DevApiReadOnlyEnv & Record<string, unknown>;

export type DevApiSessionCompleteDisabledConfig = {
  enabled: false;
  status: 'disabled';
  reason: 'not_dev' | 'compare_flag_off' | 'mutation_flag_off';
};

export type DevApiSessionCompleteInvalidConfig = {
  enabled: false;
  status: 'invalid';
  error: {
    code: 'dev_api_invalid_base_url' | 'dev_api_non_localhost_base_url' | 'dev_api_invalid_timeout';
    message: string;
  };
};

export type DevApiSessionCompleteEnabledConfig = {
  enabled: true;
  status: 'enabled';
  experiment: string;
  baseUrl: string;
  timeoutMs: number;
};

export type DevApiSessionCompleteConfig =
  | DevApiSessionCompleteDisabledConfig
  | DevApiSessionCompleteInvalidConfig
  | DevApiSessionCompleteEnabledConfig;

export const DEV_API_SESSION_COMPLETE_EXPERIMENT = ['session', 'complete'].join('-');
const mutationExperimentEnvKey = ['VITE', 'IRONPATH', 'DEV', 'API', 'MUTATION', 'EXPERIMENT'].join('_');

export const resolveDevApiSessionCompleteConfig = (
  env: DevApiSessionCompleteEnv,
): DevApiSessionCompleteConfig => {
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
  if (mutationExperiment !== DEV_API_SESSION_COMPLETE_EXPERIMENT) {
    return {
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    };
  }

  return {
    enabled: true,
    status: 'enabled',
    experiment: DEV_API_SESSION_COMPLETE_EXPERIMENT,
    baseUrl: readOnlyConfig.baseUrl,
    timeoutMs: readOnlyConfig.timeoutMs,
  };
};
