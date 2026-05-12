export type RuntimeSourceMode = 'localStorage' | 'api-readonly' | 'api-primary-dev';

export type RuntimeSourceEnv = {
  DEV?: boolean | string;
  VITE_IRONPATH_RUNTIME_SOURCE?: string;
  VITE_IRONPATH_DEV_API_BASE_URL?: string;
};

export type RuntimeSourceLocalStorageConfig = {
  mode: 'localStorage';
  status: 'default' | 'explicit' | 'fallback';
  enabled: false;
  fallbackMode: 'localStorage';
  reason?:
    | 'missing_runtime_source'
    | 'invalid_runtime_source'
    | 'not_dev'
    | 'invalid_base_url'
    | 'non_localhost_base_url';
};

export type RuntimeSourceApiReadonlyConfig = {
  mode: 'api-readonly';
  status: 'enabled';
  enabled: true;
  baseUrl: string;
  fallbackMode: 'localStorage';
  canReadFromApi: true;
  canWriteToApi: false;
};

export type RuntimeSourceApiPrimaryDevConfig = {
  mode: 'api-primary-dev';
  status: 'enabled';
  enabled: true;
  baseUrl: string;
  fallbackMode: 'localStorage';
  canReadFromApi: true;
  canWriteToApi: true;
};

export type RuntimeSourceConfig =
  | RuntimeSourceLocalStorageConfig
  | RuntimeSourceApiReadonlyConfig
  | RuntimeSourceApiPrimaryDevConfig;

export const RUNTIME_SOURCE_FLAG_NAME = 'VITE_IRONPATH_RUNTIME_SOURCE';
export const DEFAULT_RUNTIME_SOURCE_MODE: RuntimeSourceMode = 'localStorage';
export const DEFAULT_RUNTIME_SOURCE_DEV_API_BASE_URL = 'http://127.0.0.1:8787';

export const RUNTIME_SOURCE_MODES: readonly RuntimeSourceMode[] = [
  'localStorage',
  'api-readonly',
  'api-primary-dev',
];

const isDevValue = (value: RuntimeSourceEnv['DEV']) => value === true || value === 'true';

const normalizeMode = (value: RuntimeSourceEnv['VITE_IRONPATH_RUNTIME_SOURCE']) => {
  const mode = typeof value === 'string' ? value.trim() : '';
  return mode || DEFAULT_RUNTIME_SOURCE_MODE;
};

const isRuntimeSourceMode = (value: string): value is RuntimeSourceMode =>
  RUNTIME_SOURCE_MODES.includes(value as RuntimeSourceMode);

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

const localStorageConfig = (
  status: RuntimeSourceLocalStorageConfig['status'],
  reason?: RuntimeSourceLocalStorageConfig['reason'],
): RuntimeSourceLocalStorageConfig => ({
  mode: 'localStorage',
  status,
  enabled: false,
  fallbackMode: 'localStorage',
  ...(reason ? { reason } : {}),
});

export const resolveRuntimeSourceConfig = (env: RuntimeSourceEnv): RuntimeSourceConfig => {
  const requestedMode = normalizeMode(env.VITE_IRONPATH_RUNTIME_SOURCE);

  if (requestedMode === 'localStorage') {
    return localStorageConfig(env.VITE_IRONPATH_RUNTIME_SOURCE ? 'explicit' : 'default', env.VITE_IRONPATH_RUNTIME_SOURCE ? undefined : 'missing_runtime_source');
  }

  if (!isRuntimeSourceMode(requestedMode)) {
    return localStorageConfig('fallback', 'invalid_runtime_source');
  }

  if (!isDevValue(env.DEV)) {
    return localStorageConfig('fallback', 'not_dev');
  }

  const rawBaseUrl = env.VITE_IRONPATH_DEV_API_BASE_URL || DEFAULT_RUNTIME_SOURCE_DEV_API_BASE_URL;
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    return localStorageConfig('fallback', 'invalid_base_url');
  }

  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !isLocalhostUrl(url)) {
    return localStorageConfig('fallback', url.protocol === 'http:' || url.protocol === 'https:' ? 'non_localhost_base_url' : 'invalid_base_url');
  }

  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  if (requestedMode === 'api-readonly') {
    return {
      mode: 'api-readonly',
      status: 'enabled',
      enabled: true,
      baseUrl,
      fallbackMode: 'localStorage',
      canReadFromApi: true,
      canWriteToApi: false,
    };
  }

  return {
    mode: 'api-primary-dev',
    status: 'enabled',
    enabled: true,
    baseUrl,
    fallbackMode: 'localStorage',
    canReadFromApi: true,
    canWriteToApi: true,
  };
};
