import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RUNTIME_SOURCE_DEV_API_BASE_URL,
  DEFAULT_RUNTIME_SOURCE_MODE,
  resolveRuntimeSourceConfig,
  RUNTIME_SOURCE_FLAG_NAME,
  RUNTIME_SOURCE_MODES,
} from '../src/storage/runtimeSourceConfig';

describe('runtime source config prototype', () => {
  it('keeps localStorage as the default and fallback runtime source', () => {
    expect(DEFAULT_RUNTIME_SOURCE_MODE).toBe('localStorage');
    expect(RUNTIME_SOURCE_FLAG_NAME).toBe('VITE_IRONPATH_RUNTIME_SOURCE');
    expect(resolveRuntimeSourceConfig({})).toEqual({
      mode: 'localStorage',
      status: 'default',
      enabled: false,
      fallbackMode: 'localStorage',
      reason: 'missing_runtime_source',
    });
    expect(resolveRuntimeSourceConfig({ VITE_IRONPATH_RUNTIME_SOURCE: 'localStorage' })).toMatchObject({
      mode: 'localStorage',
      status: 'explicit',
      enabled: false,
      fallbackMode: 'localStorage',
    });
  });

  it('defines only the three approved Phase 5 runtime modes', () => {
    expect(RUNTIME_SOURCE_MODES).toEqual(['localStorage', 'api-readonly', 'api-primary-dev']);
  });

  it('falls back to localStorage for invalid or production-like input', () => {
    expect(resolveRuntimeSourceConfig({ DEV: true, VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-prod' })).toMatchObject({
      mode: 'localStorage',
      status: 'fallback',
      reason: 'invalid_runtime_source',
    });
    expect(resolveRuntimeSourceConfig({ DEV: false, VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev' })).toMatchObject({
      mode: 'localStorage',
      status: 'fallback',
      reason: 'not_dev',
    });
  });

  it('enables api-readonly only for dev/local explicit opt-in', () => {
    expect(resolveRuntimeSourceConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-readonly',
    })).toEqual({
      mode: 'api-readonly',
      status: 'enabled',
      enabled: true,
      baseUrl: DEFAULT_RUNTIME_SOURCE_DEV_API_BASE_URL,
      fallbackMode: 'localStorage',
      canReadFromApi: true,
      canWriteToApi: false,
    });
  });

  it('enables api-primary-dev only for dev/local explicit opt-in', () => {
    expect(resolveRuntimeSourceConfig({
      DEV: 'true',
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://localhost:8787/',
    })).toEqual({
      mode: 'api-primary-dev',
      status: 'enabled',
      enabled: true,
      baseUrl: 'http://localhost:8787',
      fallbackMode: 'localStorage',
      canReadFromApi: true,
      canWriteToApi: true,
    });
  });

  it('blocks invalid and non-localhost API base URLs', () => {
    expect(resolveRuntimeSourceConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-readonly',
      VITE_IRONPATH_DEV_API_BASE_URL: 'not a url',
    })).toMatchObject({
      mode: 'localStorage',
      status: 'fallback',
      reason: 'invalid_base_url',
    });
    expect(resolveRuntimeSourceConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://example.com',
    })).toMatchObject({
      mode: 'localStorage',
      status: 'fallback',
      reason: 'non_localhost_base_url',
    });
  });
});
