import { describe, expect, it, vi } from 'vitest';
import {
  API_BACKED_READ_RUNTIME_SOURCE,
  DEFAULT_API_BACKED_READ_BASE_URL,
  DEFAULT_API_BACKED_READ_TIMEOUT_MS,
  resolveApiBackedReadConfig,
} from '../src/devApi/apiBackedReadConfig';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('API-backed read config', () => {
  it('defaults off and requires dev mode', () => {
    expect(resolveApiBackedReadConfig({})).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });

    expect(resolveApiBackedReadConfig({
      DEV: false,
      VITE_IRONPATH_RUNTIME_SOURCE: API_BACKED_READ_RUNTIME_SOURCE,
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('enables only for explicit api-readonly runtime source', () => {
    expect(resolveApiBackedReadConfig({ DEV: true })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'runtime_source_off',
    });

    expect(resolveApiBackedReadConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'runtime_source_off',
    });

    expect(resolveApiBackedReadConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: API_BACKED_READ_RUNTIME_SOURCE,
    })).toMatchObject({
      enabled: true,
      status: 'enabled',
      runtimeSource: 'api-readonly',
      baseUrl: DEFAULT_API_BACKED_READ_BASE_URL,
      timeoutMs: DEFAULT_API_BACKED_READ_TIMEOUT_MS,
    });
  });

  it('keeps base URL localhost-only and timeout explicit', () => {
    expect(resolveApiBackedReadConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: API_BACKED_READ_RUNTIME_SOURCE,
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://localhost:8787/api/',
      VITE_IRONPATH_DEV_API_TIMEOUT_MS: '3000',
    })).toMatchObject({
      enabled: true,
      baseUrl: 'http://localhost:8787/api',
      timeoutMs: 3000,
    });

    expect(resolveApiBackedReadConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: API_BACKED_READ_RUNTIME_SOURCE,
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://example.com',
    })).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'api_backed_read_non_localhost_base_url' },
    });

    expect(resolveApiBackedReadConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: API_BACKED_READ_RUNTIME_SOURCE,
      VITE_IRONPATH_DEV_API_TIMEOUT_MS: '0',
    })).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'api_backed_read_invalid_timeout' },
    });
  });

  it('does not read or write localStorage and has no persistence imports', () => {
    const getItem = vi.fn();
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem });

    resolveApiBackedReadConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: API_BACKED_READ_RUNTIME_SOURCE,
    });

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();

    const source = readSource('src/devApi/apiBackedReadConfig.ts');
    expect(source).not.toMatch(/saveData|loadData|localStorageAdapter|setItem|getItem/);
  });
});
