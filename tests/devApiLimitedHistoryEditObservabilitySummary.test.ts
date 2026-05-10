import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createDefaultHistorySetEditPatchDraft,
  createHistorySetEditDiagnosticSummary,
  createHistorySetEditMetadata,
  createHistorySetEditSourceContext,
  DevApiHistorySetEditExperimentPanel,
} from '../src/devApi/DevApiHistorySetEditExperiment';
import type { DevApiHistorySetEditMetadata } from '../src/devApi/devApiHistorySetEditClient';
import type { DevApiHistorySetEditEnabledConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { makeRecordData } from './recordDataHealthMutationFixtures';

const config: DevApiHistorySetEditEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'limited-history-edit',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const sourceContext = createHistorySetEditSourceContext(makeRecordData())!;
const metadata: DevApiHistorySetEditMetadata = createHistorySetEditMetadata({
  sessionId: sourceContext.sessionId,
  exerciseId: sourceContext.exerciseId,
  setId: sourceContext.setId,
  changedFields: sourceContext.changedFields,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const snapshot = {
  snapshotId: 'snapshot-history-edit-observability',
  schemaVersion: 1,
  createdAt: '2026-05-10T00:00:01.000Z',
};

describe('limited history edit observability summary', () => {
  it('exposes safe diagnostic states for idle, confirming, pending, success, and failure', () => {
    expect(createHistorySetEditDiagnosticSummary({
      state: { status: 'idle' },
      sourceContext,
      confirmed: false,
    })).toMatchObject({ state: 'idle', snapshotMetadataPresent: false });

    expect(createHistorySetEditDiagnosticSummary({
      state: { status: 'idle' },
      sourceContext,
      confirmed: true,
    })).toMatchObject({ state: 'confirming', targetReference: expect.stringMatching(/^set-/) });

    expect(createHistorySetEditDiagnosticSummary({
      state: {
        status: 'pending',
        sessionId: sourceContext.sessionId,
        exerciseId: sourceContext.exerciseId,
        setId: sourceContext.setId,
        metadata,
        startedAt: '2026-05-10T00:00:00.000Z',
        duplicateSubmitBlocked: true,
      },
      sourceContext,
      confirmed: true,
    })).toMatchObject({
      state: 'pending',
      startedAt: '2026-05-10T00:00:00.000Z',
      duplicateSubmitBlocked: true,
    });

    expect(createHistorySetEditDiagnosticSummary({
      state: {
        status: 'success',
        sessionId: sourceContext.sessionId,
        exerciseId: sourceContext.exerciseId,
        setId: sourceContext.setId,
        metadata,
        snapshot,
        lastAttemptStatus: 200,
        startedAt: '2026-05-10T00:00:00.000Z',
        finishedAt: '2026-05-10T00:00:01.000Z',
      },
      sourceContext,
      confirmed: false,
    })).toMatchObject({
      state: 'success',
      snapshotMetadataPresent: true,
      lastAttemptStatus: 200,
      finishedAt: '2026-05-10T00:00:01.000Z',
    });
  });

  it('sanitizes failure diagnostics without dumping raw response, AppData, localStorage, or SQLite internals', () => {
    const summary = createHistorySetEditDiagnosticSummary({
      state: {
        status: 'failure',
        sessionId: sourceContext.sessionId,
        exerciseId: sourceContext.exerciseId,
        setId: sourceContext.setId,
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
    const markup = renderToStaticMarkup(createElement(DevApiHistorySetEditExperimentPanel, {
      config,
      sourceContext,
      patchDraft: createDefaultHistorySetEditPatchDraft(sourceContext.selectedSet),
      confirmed: false,
      pending: false,
      state: {
        status: 'failure',
        sessionId: sourceContext.sessionId,
        exerciseId: sourceContext.exerciseId,
        setId: sourceContext.setId,
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
    expect(markup).toContain('Target');
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
    expect(markup).not.toMatch(/<button[^>]*>\s*(Repair|Sync|Overwrite|Import|Export|Reset|Apply|Fix)/i);
  });
});
