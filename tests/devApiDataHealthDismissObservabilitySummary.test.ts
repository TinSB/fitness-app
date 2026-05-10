import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createDataHealthDismissDiagnosticSummary,
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototypePanel,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import type { DevApiDataHealthDismissMetadata } from '../src/devApi/devApiDataHealthDismissClient';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const sourceContext = createDataHealthDismissSourceContext(makeRepairableWeightData())!;
const metadata: DevApiDataHealthDismissMetadata = createDataHealthDismissMetadata({
  issueId: sourceContext.issueId,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const snapshot = {
  snapshotId: 'snapshot-observability',
  schemaVersion: 1,
  createdAt: '2026-05-10T00:00:01.000Z',
};

describe('DataHealth dismiss observability summary', () => {
  it('exposes safe diagnostic states for idle, confirming, pending, success, and failure', () => {
    expect(createDataHealthDismissDiagnosticSummary({
      state: { status: 'idle' },
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
    })).toMatchObject({ state: 'idle', snapshotMetadataPresent: false });

    expect(createDataHealthDismissDiagnosticSummary({
      state: { status: 'idle' },
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: true,
    })).toMatchObject({ state: 'confirming', issueId: sourceContext.issueId });

    expect(createDataHealthDismissDiagnosticSummary({
      state: {
        status: 'pending',
        issueId: sourceContext.issueId,
        metadata,
        startedAt: '2026-05-10T00:00:00.000Z',
        duplicateSubmitBlocked: true,
      },
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: true,
    })).toMatchObject({
      state: 'pending',
      startedAt: '2026-05-10T00:00:00.000Z',
      duplicateSubmitBlocked: true,
    });

    expect(createDataHealthDismissDiagnosticSummary({
      state: {
        status: 'success',
        issueId: sourceContext.issueId,
        metadata,
        snapshot,
        lastAttemptStatus: 200,
        startedAt: '2026-05-10T00:00:00.000Z',
        finishedAt: '2026-05-10T00:00:01.000Z',
      },
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
    })).toMatchObject({
      state: 'success',
      snapshotMetadataPresent: true,
      lastAttemptStatus: 200,
      finishedAt: '2026-05-10T00:00:01.000Z',
    });
  });

  it('sanitizes failure diagnostics without dumping raw response, AppData, localStorage, or SQLite internals', () => {
    const summary = createDataHealthDismissDiagnosticSummary({
      state: {
        status: 'failure',
        issueId: sourceContext.issueId,
        metadata,
        lastAttemptStatus: 500,
        error: {
          code: 'dev_mutation_error_response',
          serverCode: 'write_failed',
          message: 'SqliteRepositoryError: write failed {"raw":"response"} AppData localStorage SQLite stack\n at repository.write',
        },
      },
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
    });

    expect(summary).toMatchObject({
      state: 'failure',
      failureCode: 'write_failed',
      lastAttemptStatus: 500,
      snapshotMetadataPresent: false,
    });
    expect(summary.failureMessage).toContain('write_failed');
    expect(summary.recoveryNote).toContain('back up the dev DB');

    const serialized = JSON.stringify(summary);
    for (const blocked of ['SqliteRepositoryError', 'Error:', '{"raw"', 'AppData', 'localStorage', 'SQLite', 'stack']) {
      expect(serialized).not.toContain(blocked);
    }
  });

  it('renders safe diagnostic fields without raw dumps', () => {
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
      pending: false,
      state: {
        status: 'failure',
        issueId: sourceContext.issueId,
        metadata,
        lastAttemptStatus: 503,
        error: {
          code: 'dev_mutation_error_response',
          serverCode: 'database_closed',
          message: 'Database closed stack should not leak',
        },
      },
    }));

    expect(markup).toContain('Mutation state');
    expect(markup).toContain('failure');
    expect(markup).toContain('Target issue');
    expect(markup).toContain('Snapshot metadata');
    expect(markup).toContain('absent');
    expect(markup).toContain('HTTP status');
    expect(markup).toContain('503');
    expect(markup).toContain('Failure code');
    expect(markup).toContain('database_closed');
    expect(markup).toContain('Safe recovery note');
    expect(markup).toContain('Restart the Dev API runner');
    expect(markup).not.toContain('raw response');
    expect(markup).not.toContain('SqliteRepositoryError');
    expect(markup).not.toContain('Error:');
    expect(markup).not.toContain('{&quot;raw&quot;');
  });
});
