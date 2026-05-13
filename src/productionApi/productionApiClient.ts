import { resolveProductionApiConfig, type ProductionApiConfigInput, type ProductionApiConfigError } from './productionApiConfig';

export type ProductionApiClientResult<T> =
  | { ok: true; value: T }
  | {
    ok: false;
    error: {
      code: 'production_api_disabled' | 'production_api_config_invalid' | 'production_api_request_failed';
      message: string;
      details?: readonly ProductionApiConfigError[];
    };
  };

export type ProductionApiFetch = (input: string, init?: { method?: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type ProductionApiClient = {
  enabled: boolean;
  getHealth: () => Promise<ProductionApiClientResult<unknown>>;
  getCapabilities: () => Promise<ProductionApiClientResult<unknown>>;
  getAppDataSummary: () => Promise<ProductionApiClientResult<unknown>>;
  getSessionsSummary: () => Promise<ProductionApiClientResult<unknown>>;
  getHistory: () => Promise<ProductionApiClientResult<unknown>>;
  getHistoryDetail: (id: string) => Promise<ProductionApiClientResult<unknown>>;
  getDataHealthSummary: () => Promise<ProductionApiClientResult<unknown>>;
};

const disabledResult = <T>(details: readonly ProductionApiConfigError[]): ProductionApiClientResult<T> => ({
  ok: false,
  error: {
    code: details.some((entry) => entry.code === 'production_api_disabled')
      ? 'production_api_disabled'
      : 'production_api_config_invalid',
    message: 'Production API client is unavailable.',
    details,
  },
});

const requestFailed = <T>(status: number): ProductionApiClientResult<T> => ({
  ok: false,
  error: {
    code: 'production_api_request_failed',
    message: `Production API read request failed with status ${status}.`,
  },
});

const makeRead = <T>(
  config: ReturnType<typeof resolveProductionApiConfig>,
  fetchImpl: ProductionApiFetch,
  path: string,
) => async (): Promise<ProductionApiClientResult<T>> => {
  if (!config.ok) return disabledResult(config.errors);

  const response = await fetchImpl(`${config.baseUrl}${path}`, { method: 'GET' });
  if (!response.ok) return requestFailed(response.status);
  return { ok: true, value: await response.json() as T };
};

export const createProductionApiClient = (
  configInput: ProductionApiConfigInput = {},
  fetchImpl: ProductionApiFetch = fetch,
): ProductionApiClient => {
  const config = resolveProductionApiConfig(configInput);

  return {
    enabled: config.ok,
    getHealth: makeRead(config, fetchImpl, '/health'),
    getCapabilities: makeRead(config, fetchImpl, '/capabilities'),
    getAppDataSummary: makeRead(config, fetchImpl, '/app-data/summary'),
    getSessionsSummary: makeRead(config, fetchImpl, '/sessions/summary'),
    getHistory: makeRead(config, fetchImpl, '/history'),
    getHistoryDetail: (id) => makeRead(config, fetchImpl, `/history/${encodeURIComponent(id)}`)(),
    getDataHealthSummary: makeRead(config, fetchImpl, '/data-health/summary'),
  };
};
