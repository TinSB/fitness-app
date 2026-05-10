import {
  resolveDevApiReadOnlyConfig,
  type DevApiReadOnlyEnv,
} from './devApiReadOnlyConfig';

export type DevApiHistorySetEditEnv = DevApiReadOnlyEnv & Record<string, unknown>;

export type DevApiHistorySetEditDisabledConfig = {
  enabled: false;
  status: 'disabled';
  reason: 'not_dev' | 'compare_flag_off' | 'mutation_flag_off';
};

export type DevApiHistorySetEditInvalidConfig = {
  enabled: false;
  status: 'invalid';
  error: {
    code: 'dev_api_invalid_base_url' | 'dev_api_non_localhost_base_url' | 'dev_api_invalid_timeout';
    message: string;
  };
};

export type DevApiHistorySetEditEnabledConfig = {
  enabled: true;
  status: 'enabled';
  experiment: string;
  baseUrl: string;
  timeoutMs: number;
};

export type DevApiHistorySetEditConfig =
  | DevApiHistorySetEditDisabledConfig
  | DevApiHistorySetEditInvalidConfig
  | DevApiHistorySetEditEnabledConfig;

export const DEV_API_HISTORY_SET_EDIT_EXPERIMENT = ['limited', 'history', 'edit'].join('-');
const mutationExperimentEnvKey = ['VITE', 'IRONPATH', 'DEV', 'API', 'MUTATION', 'EXPERIMENT'].join('_');

export const resolveDevApiHistorySetEditConfig = (
  env: DevApiHistorySetEditEnv,
): DevApiHistorySetEditConfig => {
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
  if (mutationExperiment !== DEV_API_HISTORY_SET_EDIT_EXPERIMENT) {
    return {
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    };
  }

  return {
    enabled: true,
    status: 'enabled',
    experiment: DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
    baseUrl: readOnlyConfig.baseUrl,
    timeoutMs: readOnlyConfig.timeoutMs,
  };
};
