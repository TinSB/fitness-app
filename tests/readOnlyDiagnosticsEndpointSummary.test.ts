import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DevApiReadOnlyDiagnosticsPanel, safeEndpointReason } from '../src/devApi/DevApiReadOnlyDiagnostics';
import type { DevApiReadOnlyEndpointDiagnostic } from '../src/devApi/devApiReadOnlyComparison';

describe('read-only diagnostics endpoint summary', () => {
  it('renders compact endpoint statuses including skipped history detail', () => {
    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnosticsPanel, {
      diagnostic: {
        status: 'matching',
        checkedAt: '2026-05-10T00:00:00.000Z',
        checkedEndpoints: [
          { path: '/app-data/summary', status: 'matching', reason: 'Local and Dev API summaries match.' },
          { path: '/sessions/summary', status: 'matching', reason: 'Local and Dev API summaries match.' },
          { path: '/history', status: 'matching', reason: 'Local and Dev API summaries match.' },
          { path: '/history/:id', status: 'skipped', reason: 'No stable local history id is available.' },
          { path: '/data-health/summary', status: 'matching', reason: 'Local and Dev API summaries match.' },
        ],
        mismatchCount: 0,
      },
    }));

    expect(markup).toContain('/app-data/summary');
    expect(markup).toContain('/sessions/summary');
    expect(markup).toContain('/history');
    expect(markup).toContain('/history/:id');
    expect(markup).toContain('/data-health/summary');
    expect(markup).toContain('skipped');
    expect(markup).toContain('No stable local history id');
  });

  it('shows endpoint errors as code and safe message only', () => {
    const endpoint: DevApiReadOnlyEndpointDiagnostic = {
      path: '/app-data/summary',
      status: 'error',
      error: {
        code: 'dev_api_error_response',
        serverCode: 'snapshot_not_found',
        message: 'Snapshot not found',
      },
    };

    expect(safeEndpointReason(endpoint)).toBe('snapshot_not_found: Snapshot not found');
  });

  it('suppresses raw stack, SQLite, and raw response dumps', () => {
    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnosticsPanel, {
      diagnostic: {
        status: 'error',
        checkedAt: '2026-05-10T00:00:00.000Z',
        checkedEndpoints: [
          {
            path: '/app-data/summary',
            status: 'error',
            error: {
              code: 'dev_api_error_response',
              serverCode: 'SQLITE_CORRUPT',
              message: 'SQLITE_CORRUPT stack trace at Database.open {"raw":"payload"}',
            },
          },
        ],
        mismatchCount: 0,
      },
    }));

    expect(markup).not.toContain('SQLITE_CORRUPT');
    expect(markup).toContain('dev_api_error_response');
    expect(markup).toContain('Endpoint returned a diagnostic error.');
    expect(markup).not.toContain('Database.open');
    expect(markup).not.toContain('raw');
    expect(markup).not.toContain('payload');
    expect(markup).not.toContain('stack trace');
  });
});
