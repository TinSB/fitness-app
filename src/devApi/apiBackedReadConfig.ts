export type ApiBackedReadEnv = {
  DEV?: boolean | string;
  VITE_IRONPATH_RUNTIME_SOURCE?: string;
  VITE_IRONPATH_DEV_API_BASE_URL?: string;
  VITE_IRONPATH_DEV_API_TIMEOUT_MS?: string | number;
};

export type ApiBackedReadDisabledConfig = {
  enabled: false;
  status: 'disabled';
  reason: 'not_dev' | 'runtime_source_off';
};

export type ApiBackedReadInvalidConfig = {
  enabled: false;
  status: 'invalid';
  error: {
    code: 'api_backed_read_invalid_base_url' | 'api_backed_read_non_localhost_base_url' | 'api_backed_read_invalid_timeout';
    message: string;
  };
};

export type ApiBackedReadEnabledConfig = {
  enabled: true;
  status: 'enabled';
  runtimeSource: typeof API_BACKED_READ_RUNTIME_SOURCE;
  baseUrl: string;
  timeoutMs: number;
};

export type ApiBackedReadConfig =
  | ApiBackedReadDisabledConfig
  | ApiBackedReadInvalidConfig
  | ApiBackedReadEnabledConfig;

export const API_BACKED_READ_RUNTIME_SOURCE = 'api-readonly';
export const DEFAULT_API_BACKED_READ_BASE_URL = 'http://127.0.0.1:8787';
export const DEFAULT_API_BACKED_READ_TIMEOUT_MS = 1500;

const isDevValue = (value: ApiBackedReadEnv['DEV']) => value === true || value === 'true';

const normalizeLocalHostname = (hostname: string) => hostname.toLowerCase().replace(/^\[(.*)]$/, '$1');

const isLocalhostUrl = (url: URL) => {
  const hostname = normalizeLocalHostname(url.hostname);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

const normalizeBaseUrl = (rawBaseUrl: string) => {
  const url = new URL(rawBaseUrl);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
};

const resolveTimeoutMs = (rawTimeout: ApiBackedReadEnv['VITE_IRONPATH_DEV_API_TIMEOUT_MS']) => {
  if (rawTimeout === undefined || rawTimeout === '') return DEFAULT_API_BACKED_READ_TIMEOUT_MS;
  const timeout = typeof rawTimeout === 'number' ? rawTimeout : Number(rawTimeout);
  return Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : null;
};

export const resolveApiBackedReadConfig = (env: ApiBackedReadEnv): ApiBackedReadConfig => {
  if (!isDevValue(env.DEV)) {
    return { enabled: false, status: 'disabled', reason: 'not_dev' };
  }

  if (env.VITE_IRONPATH_RUNTIME_SOURCE !== API_BACKED_READ_RUNTIME_SOURCE) {
    return { enabled: false, status: 'disabled', reason: 'runtime_source_off' };
  }

  const timeoutMs = resolveTimeoutMs(env.VITE_IRONPATH_DEV_API_TIMEOUT_MS);
  if (timeoutMs === null) {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'api_backed_read_invalid_timeout',
        message: 'API-backed read timeout must be a positive number.',
      },
    };
  }

  const rawBaseUrl = env.VITE_IRONPATH_DEV_API_BASE_URL || DEFAULT_API_BACKED_READ_BASE_URL;
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'api_backed_read_invalid_base_url',
        message: 'API-backed read base URL is invalid.',
      },
    };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'api_backed_read_invalid_base_url',
        message: 'API-backed read base URL must use HTTP.',
      },
    };
  }

  if (!isLocalhostUrl(url)) {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'api_backed_read_non_localhost_base_url',
        message: 'API-backed read base URL must be localhost-only.',
      },
    };
  }

  return {
    enabled: true,
    status: 'enabled',
    runtimeSource: API_BACKED_READ_RUNTIME_SOURCE,
    baseUrl: normalizeBaseUrl(rawBaseUrl),
    timeoutMs,
  };
};
