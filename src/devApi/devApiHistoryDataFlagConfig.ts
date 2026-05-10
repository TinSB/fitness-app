import {
  resolveDevApiReadOnlyConfig,
  type DevApiReadOnlyEnv,
} from './devApiReadOnlyConfig';

export type DevApiHistoryDataFlagEnv = DevApiReadOnlyEnv & {
  VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT?: string;
};

export type DevApiHistoryDataFlagDisabledConfig = {
  enabled: false;
  status: 'disabled';
  reason: 'not_dev' | 'compare_flag_off' | 'mutation_flag_off';
};

export type DevApiHistoryDataFlagInvalidConfig = {
  enabled: false;
  status: 'invalid';
  error: {
    code: 'dev_api_invalid_base_url' | 'dev_api_non_localhost_base_url' | 'dev_api_invalid_timeout';
    message: string;
  };
};

export type DevApiHistoryDataFlagEnabledConfig = {
  enabled: true;
  status: 'enabled';
  experiment: 'history-data-flag';
  baseUrl: string;
  timeoutMs: number;
};

export type DevApiHistoryDataFlagConfig =
  | DevApiHistoryDataFlagDisabledConfig
  | DevApiHistoryDataFlagInvalidConfig
  | DevApiHistoryDataFlagEnabledConfig;

export const DEV_API_HISTORY_DATA_FLAG_EXPERIMENT = 'history-data-flag';

export const resolveDevApiHistoryDataFlagConfig = (
  env: DevApiHistoryDataFlagEnv,
): DevApiHistoryDataFlagConfig => {
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

  if (env.VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT !== DEV_API_HISTORY_DATA_FLAG_EXPERIMENT) {
    return {
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    };
  }

  return {
    enabled: true,
    status: 'enabled',
    experiment: DEV_API_HISTORY_DATA_FLAG_EXPERIMENT,
    baseUrl: readOnlyConfig.baseUrl,
    timeoutMs: readOnlyConfig.timeoutMs,
  };
};
