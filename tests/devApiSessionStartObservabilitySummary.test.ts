import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createSessionStartDiagnosticSummary,
  createSessionStartMetadata,
  createSessionStartSourceContext,
  DevApiSessionStartPrototypePanel,
} from '../src/devApi/DevApiSessionStartPrototype';
import type { DevApiSessionStartEnabledConfig } from '../src/devApi/devApiSessionStartConfig';
import { makeAppData } from './fixtures';

const config: DevApiSessionStartEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-start',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const sourceContext = createSessionStartSourceContext(makeAppData())!;
const metadata = createSessionStartMetadata({
  sourceContext,
  nowIso: '2026-05-11T00:00:00.000Z',
});

const snapshot = {
  snapshotId: 'snapshot-session-start-observability',
  schemaVersion: 1,
  createdAt: '2026-05-11T00:00:01.000Z',
};

describe('session start observability summary', () => {
  it('exposes safe diagnostic states for idle, confirming, pending, success, and failure', () => {
    expect(createSessionStartDiagnosticSummary({
      state: { status: 'idle' },
      sourceContext,
      confirmed: false,
    })).toMatchObject({ state: 'idle', snapshotMetadataPresent: false });

    expect(createSessionStartDiagnosticSummary({
      state: { status: 'idle' },
      sourceContext,
      confirmed: true,
    })).toMatchObject({ state: 'confirming', targetReference: expect.stringMatching(/^template-/) });

    expect(createSessionStartDiagnosticSummary({
      state: {
        status: 'pending',
        templateId: sourceContext.templateId,
        metadata,
        startedAt: '2026-05-11T00:00:00.000Z',
        duplicateSubmitBlocked: true,
      },
      sourceContext,
      confirmed: true,
    })).toMatchObject({
      state: 'pending',
      startedAt: '2026-05-11T00:00:00.000Z',
      duplicateSubmitBlocked: true,
    });

    expect(createSessionStartDiagnosticSummary({
      state: {
        status: 'success',
        templateId: sourceContext.templateId,
        metadata,
        snapshot,
        lastAttemptStatus: 200,
        startedAt: '2026-05-11T00:00:00.000Z',
        finishedAt: '2026-05-11T00:00:01.000Z',
      },
      sourceContext,
      confirmed: false,
    })).toMatchObject({
      state: 'success',
      snapshotMetadataPresent: true,
      lastAttemptStatus: 200,
      finishedAt: '2026-05-11T00:00:01.000Z',
    });
  });

  it('sanitizes failure diagnostics without dumping raw response, AppData, localStorage, or SQLite internals', () => {
    const summary = createSessionStartDiagnosticSummary({
      state: {
        status: 'failure',
        templateId: sourceContext.templateId,
        metadata,
        lastAttemptStatus: 500,
        error: {
          code: 'dev_mutation_error_response',
          serverCode: 'write_failed',
          message: 'SqliteRepositoryError: write failed {"raw":"response"} AppData localStorage SQLite stack\n at repository.write',
        },
      },
      sourceContext,
      confirmed: false,
    });

    expect(summary).toMatchObject({
      state: 'failure',
      failureCode: 'write_failed',
      lastAttemptStatus: 500,
      snapshotMetadataPresent: false,
    });
    expect(summary.failureMessage).toContain('write_failed');
    expect(summary.recoveryNote).toContain('dev DB copy');

    const serialized = JSON.stringify(summary);
    for (const blocked of ['SqliteRepositoryError', 'Error:', '{"raw"', 'AppData', 'localStorage', 'SQLite', 'stack']) {
      expect(serialized).not.toContain(blocked);
    }
  });

  it('renders safe diagnostic fields without raw dumps or recovery controls', () => {
    const markup = renderToStaticMarkup(createElement(DevApiSessionStartPrototypePanel, {
      config,
      sourceContext,
      confirmed: false,
      pending: false,
      state: {
        status: 'failure',
        templateId: sourceContext.templateId,
        metadata,
        lastAttemptStatus: 503,
        error: {
          code: 'dev_mutation_error_response',
          serverCode: 'database_closed',
          message: 'Database closed stack should not leak',
        },
      },
    }));

    expect(markup).toContain('Status: Failure');
    expect(markup).toContain('Source snapshot:');
    expect(markup).toContain('Target reference:');
    expect(markup).toContain('database_closed');
    expect(markup).toContain('Restart the Dev API runner');
    expect(markup).not.toContain('raw response');
    expect(markup).not.toContain('SqliteRepositoryError');
    expect(markup).not.toContain('Error:');
    expect(markup).not.toMatch(/<button[^>]*>\s*(Repair|Sync|Overwrite|Import|Export|Reset|Apply|Fix)\s*</i);
  });
});
