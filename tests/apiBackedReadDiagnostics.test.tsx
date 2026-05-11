import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ApiBackedReadDiagnosticsPanel,
  createApiBackedReadConfigDiagnostic,
  getApiBackedReadStatusDisplay,
  type ApiBackedReadDiagnostic,
} from '../src/devApi/ApiBackedReadDiagnostics';

describe('API-backed read diagnostics panel', () => {
  it('builds config diagnostics without enabling source-of-truth migration', () => {
    expect(createApiBackedReadConfigDiagnostic({
      enabled: false,
      status: 'disabled',
      reason: 'runtime_source_off',
    })).toMatchObject({ status: 'disabled' });

    expect(createApiBackedReadConfigDiagnostic({
      enabled: true,
      status: 'enabled',
      runtimeSource: 'api-readonly',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    })).toMatchObject({
      status: 'ready',
      snapshotMetadataPresent: false,
      message: 'API-backed read diagnostics are ready. localStorage remains source of truth.',
    });

    expect(createApiBackedReadConfigDiagnostic({
      enabled: false,
      status: 'invalid',
      error: {
        code: 'api_backed_read_non_localhost_base_url',
        message: 'bad host',
      },
    })).toMatchObject({ status: 'misconfigured' });
  });

  it('renders null when disabled', () => {
    const markup = renderToStaticMarkup(createElement(ApiBackedReadDiagnosticsPanel, {
      diagnostic: {
        status: 'disabled',
        checkedAt: '',
        checkedEndpoints: [],
        snapshotMetadataPresent: false,
      },
    }));
    expect(markup).toBe('');
  });

  it('renders display-only status, snapshot metadata state, and GET endpoint summary', () => {
    const diagnostic: ApiBackedReadDiagnostic = {
      status: 'partial',
      checkedAt: '2026-05-10T00:00:00.000Z',
      checkedEndpoints: [
        { path: '/health', status: 'available' },
        { path: '/app-data/summary', status: 'missing_snapshot_metadata', reason: 'missing snapshot metadata.' },
        { path: '/history/:id', status: 'skipped', reason: 'No stable local history id is available.' },
      ],
      snapshotMetadataPresent: false,
      message: 'API-backed read diagnostics are display only.',
    };

    const markup = renderToStaticMarkup(createElement(ApiBackedReadDiagnosticsPanel, { diagnostic }));

    expect(markup).toContain('API-backed read diagnostics');
    expect(markup).toContain('Partial');
    expect(markup).toContain('not stored');
    expect(markup).toContain('/health');
    expect(markup).toContain('/app-data/summary');
    expect(markup).toContain('/history/:id');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('API results never overwrite AppData or localStorage');
  });

  it('keeps diagnostic text safe and contains no write controls', () => {
    const diagnostic: ApiBackedReadDiagnostic = {
      status: 'error',
      checkedAt: '2026-05-10T00:00:00.000Z',
      checkedEndpoints: [
        { path: '/history', status: 'error', reason: 'Error: stack at sqliteRepository(select * from app_data)' },
      ],
      snapshotMetadataPresent: false,
      message: 'stack trace with repair apply reset instructions',
    };

    const markup = renderToStaticMarkup(createElement(ApiBackedReadDiagnosticsPanel, { diagnostic }));

    expect(markup).toContain('Endpoint returned a diagnostic status.');
    expect(markup).not.toMatch(/sqliteRepository|select \*|stack trace|repair|sync|import|export|reset|apply|fix/i);
    expect(markup).not.toMatch(/<button|role="button"|type="button"/i);
    expect(getApiBackedReadStatusDisplay('unavailable')).toMatchObject({
      explanation: 'API unavailable; App remains usable from localStorage.',
    });
  });
});
