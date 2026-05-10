import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createDataHealthDismissDiagnosticSummary,
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototypePanel,
  formatDataHealthDismissIssueReference,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const sourceContext = createDataHealthDismissSourceContext(makeRepairableWeightData())!;
const metadata = createDataHealthDismissMetadata({
  issueId: sourceContext.issueId,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const docs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
  'docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('DataHealth dismiss regression observability/docs lock', () => {
  it('keeps diagnostic summary safe and test-visible without raw dumps', () => {
    const summary = createDataHealthDismissDiagnosticSummary({
      state: {
        status: 'failure',
        issueId: sourceContext.issueId,
        metadata,
        lastAttemptStatus: 500,
        error: {
          code: 'dev_mutation_error_response',
          serverCode: 'write_failed',
          message: 'SqliteRepositoryError: {"raw":"response"} AppData localStorage SQLite stack at repo',
        },
      },
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
    });

    expect(summary).toMatchObject({
      state: 'failure',
      issueId: sourceContext.issueId,
      failureCode: 'write_failed',
      snapshotMetadataPresent: false,
      lastAttemptStatus: 500,
    });
    const serialized = JSON.stringify(summary);
    for (const blocked of ['SqliteRepositoryError', '{"raw"', 'AppData', 'localStorage', 'SQLite', 'stack']) {
      expect(serialized).not.toContain(blocked);
    }
  });

  it('redacts visible issue id in UI while preserving safe diagnostics', () => {
    const safeReference = formatDataHealthDismissIssueReference(sourceContext.issueId);
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
        error: {
          code: 'dev_mutation_error_response',
          serverCode: 'database_closed',
          message: 'Database closed',
        },
      },
    }));

    expect(safeReference).toMatch(/^issue-[a-f0-9]{8}$/);
    expect(markup).toContain(safeReference);
    expect(markup).not.toContain(sourceContext.issueId);
    expect(markup).toContain('Snapshot metadata');
    expect(markup).toContain('Failure code');
    expect(markup).toContain('Safe recovery note');
    expect(markup).not.toMatch(/raw response|SqliteRepositoryError|Error:|AppData|SQLite/i);
  });

  it('keeps docs aligned with one-route regression lock and manual recovery boundaries', () => {
    const allDocs = docs();

    for (const phrase of [
      'Task 4.33',
      'DataHealth Dismiss Regression Lock V1',
      'POST /data-health/issues/:issueId/dismiss',
      'localStorage remains source of truth',
      'no fake success',
      'snapshot metadata',
      'manual and dev-only',
      'no production readiness',
      'no second mutation route',
    ]) {
      expect(allDocs).toContain(phrase);
    }

    for (const pattern of [
      /enable session mutation now/i,
      /enable history mutation now/i,
      /enable repair mutation now/i,
      /enable backup\/import\/reset over HTTP now/i,
      /replace localStorage now/i,
      /make API source of truth now/i,
      /deploy production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
    ]) {
      expect(allDocs).not.toMatch(pattern);
    }
  });
});
