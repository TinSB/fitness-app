import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DEV_API_READ_ONLY_BASE_URL,
  DEFAULT_DEV_API_READ_ONLY_TIMEOUT_MS,
  resolveDevApiReadOnlyConfig,
} from '../src/devApi/devApiReadOnlyConfig';

describe('dev API read-only config', () => {
  it('keeps the comparison flag off by default', () => {
    expect(resolveDevApiReadOnlyConfig({ DEV: true })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'flag_off',
    });
  });

  it('enables only in dev mode with explicit compare flag', () => {
    const config = resolveDevApiReadOnlyConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
    });

    expect(config).toMatchObject({
      enabled: true,
      status: 'enabled',
      baseUrl: DEFAULT_DEV_API_READ_ONLY_BASE_URL,
      timeoutMs: DEFAULT_DEV_API_READ_ONLY_TIMEOUT_MS,
    });
  });

  it('stays disabled in production-like mode even with the compare flag', () => {
    expect(
      resolveDevApiReadOnlyConfig({
        DEV: false,
        VITE_IRONPATH_DEV_API_COMPARE: '1',
      }),
    ).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('accepts only localhost base URLs', () => {
    expect(
      resolveDevApiReadOnlyConfig({
        DEV: true,
        VITE_IRONPATH_DEV_API_COMPARE: '1',
        VITE_IRONPATH_DEV_API_BASE_URL: 'http://localhost:8787',
      }),
    ).toMatchObject({ enabled: true });
    expect(
      resolveDevApiReadOnlyConfig({
        DEV: true,
        VITE_IRONPATH_DEV_API_COMPARE: '1',
        VITE_IRONPATH_DEV_API_BASE_URL: 'http://[::1]:8787',
      }),
    ).toMatchObject({ enabled: true });
    expect(
      resolveDevApiReadOnlyConfig({
        DEV: true,
        VITE_IRONPATH_DEV_API_COMPARE: '1',
        VITE_IRONPATH_DEV_API_BASE_URL: 'https://api.example.com',
      }),
    ).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'dev_api_non_localhost_base_url' },
    });
  });

  it('allows a testable timeout override and rejects invalid timeout values', () => {
    expect(
      resolveDevApiReadOnlyConfig({
        DEV: true,
        VITE_IRONPATH_DEV_API_COMPARE: '1',
        VITE_IRONPATH_DEV_API_TIMEOUT_MS: '3000',
      }),
    ).toMatchObject({ enabled: true, timeoutMs: 3000 });
    expect(
      resolveDevApiReadOnlyConfig({
        DEV: true,
        VITE_IRONPATH_DEV_API_COMPARE: '1',
        VITE_IRONPATH_DEV_API_TIMEOUT_MS: '0',
      }),
    ).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'dev_api_invalid_timeout' },
    });
  });

  it('does not touch localStorage while resolving config', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });

    resolveDevApiReadOnlyConfig({ DEV: true, VITE_IRONPATH_DEV_API_COMPARE: '1' });

    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
