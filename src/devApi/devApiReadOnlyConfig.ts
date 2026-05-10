export type DevApiReadOnlyEnv = {
  DEV?: boolean | string;
  VITE_IRONPATH_DEV_API_COMPARE?: string;
  VITE_IRONPATH_DEV_API_BASE_URL?: string;
  VITE_IRONPATH_DEV_API_TIMEOUT_MS?: string | number;
};

export type DevApiReadOnlyDisabledConfig = {
  enabled: false;
  status: 'disabled';
  reason: 'not_dev' | 'flag_off';
};

export type DevApiReadOnlyInvalidConfig = {
  enabled: false;
  status: 'invalid';
  error: {
    code: 'dev_api_invalid_base_url' | 'dev_api_non_localhost_base_url' | 'dev_api_invalid_timeout';
    message: string;
  };
};

export type DevApiReadOnlyEnabledConfig = {
  enabled: true;
  status: 'enabled';
  baseUrl: string;
  timeoutMs: number;
};

export type DevApiReadOnlyConfig =
  | DevApiReadOnlyDisabledConfig
  | DevApiReadOnlyInvalidConfig
  | DevApiReadOnlyEnabledConfig;

export const DEFAULT_DEV_API_READ_ONLY_BASE_URL = 'http://127.0.0.1:8787';
export const DEFAULT_DEV_API_READ_ONLY_TIMEOUT_MS = 1500;

const isDevValue = (value: DevApiReadOnlyEnv['DEV']) => value === true || value === 'true';

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

const resolveTimeoutMs = (rawTimeout: DevApiReadOnlyEnv['VITE_IRONPATH_DEV_API_TIMEOUT_MS']) => {
  if (rawTimeout === undefined || rawTimeout === '') return DEFAULT_DEV_API_READ_ONLY_TIMEOUT_MS;
  const timeout = typeof rawTimeout === 'number' ? rawTimeout : Number(rawTimeout);
  return Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : null;
};

export const resolveDevApiReadOnlyConfig = (env: DevApiReadOnlyEnv): DevApiReadOnlyConfig => {
  if (!isDevValue(env.DEV)) {
    return { enabled: false, status: 'disabled', reason: 'not_dev' };
  }

  if (env.VITE_IRONPATH_DEV_API_COMPARE !== '1') {
    return { enabled: false, status: 'disabled', reason: 'flag_off' };
  }

  const timeoutMs = resolveTimeoutMs(env.VITE_IRONPATH_DEV_API_TIMEOUT_MS);
  if (timeoutMs === null) {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'dev_api_invalid_timeout',
        message: 'Dev API read-only comparison timeout must be a positive number.',
      },
    };
  }

  const rawBaseUrl = env.VITE_IRONPATH_DEV_API_BASE_URL || DEFAULT_DEV_API_READ_ONLY_BASE_URL;
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'dev_api_invalid_base_url',
        message: 'Dev API read-only comparison base URL is invalid.',
      },
    };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'dev_api_invalid_base_url',
        message: 'Dev API read-only comparison base URL must use HTTP.',
      },
    };
  }

  if (!isLocalhostUrl(url)) {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'dev_api_non_localhost_base_url',
        message: 'Dev API read-only comparison base URL must be localhost-only.',
      },
    };
  }

  return {
    enabled: true,
    status: 'enabled',
    baseUrl: normalizeBaseUrl(rawBaseUrl),
    timeoutMs,
  };
};
