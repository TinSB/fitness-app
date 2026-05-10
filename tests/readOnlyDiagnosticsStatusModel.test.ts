import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEV_API_READ_ONLY_STATUS_MODEL,
  DevApiReadOnlyDiagnosticsPanel,
  createDevApiMisconfiguredDiagnostic,
} from '../src/devApi/DevApiReadOnlyDiagnostics';
import type { DevApiReadOnlyDiagnosticStatus } from '../src/devApi/devApiReadOnlyComparison';

const statuses: DevApiReadOnlyDiagnosticStatus[] = [
  'disabled',
  'checking',
  'matching',
  'mismatch',
  'unavailable',
  'error',
  'misconfigured',
];

describe('read-only diagnostics status model', () => {
  it('covers every status with safe label, explanation, and severity', () => {
    expect(Object.keys(DEV_API_READ_ONLY_STATUS_MODEL).sort()).toEqual([...statuses].sort());
    statuses.forEach((status) => {
      const display = DEV_API_READ_ONLY_STATUS_MODEL[status];
      expect(display.label).toEqual(expect.any(String));
      expect(display.explanation).toEqual(expect.any(String));
      expect(['neutral', 'info', 'warning', 'error']).toContain(display.severity);
      expect(display.label.length).toBeGreaterThan(0);
      expect(display.explanation.length).toBeGreaterThan(0);
    });
  });

  it('keeps disabled normalized but invisible', () => {
    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnosticsPanel, {
      diagnostic: {
        status: 'disabled',
        checkedAt: '',
        checkedEndpoints: [],
        mismatchCount: 0,
      },
    }));

    expect(DEV_API_READ_ONLY_STATUS_MODEL.disabled.severity).toBe('neutral');
    expect(markup).toBe('');
  });

  it('treats mismatch as warning-only diagnostics', () => {
    const display = DEV_API_READ_ONLY_STATUS_MODEL.mismatch;

    expect(display.severity).toBe('warning');
    expect(display.explanation).toContain('localStorage remains source of truth');
    expect(display.explanation).toContain('No data was changed');
    expect(display.explanation).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix)\b/i);
  });

  it('keeps unavailable non-fatal and App-safe', () => {
    const display = DEV_API_READ_ONLY_STATUS_MODEL.unavailable;

    expect(display.severity).toBe('warning');
    expect(display.explanation).toContain('app continues normally using localStorage');
    expect(display.explanation).not.toMatch(/\b(fatal|blocked|cannot use|stop training)\b/i);
  });

  it('keeps misconfiguration copy safe', () => {
    const diagnostic = createDevApiMisconfiguredDiagnostic('VITE_IRONPATH_DEV_API_BASE_URL=https://api.example.com');
    const markup = renderToStaticMarkup(createElement(DevApiReadOnlyDiagnosticsPanel, { diagnostic }));

    expect(markup).toContain('Misconfigured');
    expect(markup).toContain('localhost');
    expect(markup).not.toContain('VITE_IRONPATH_DEV_API_BASE_URL');
    expect(markup).not.toContain('https://api.example.com');
  });
});
