import { describe, expect, it } from 'vitest';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_RELEASE_READINESS_CHECKLIST.md';

describe('production release readiness checklist', () => {
  it('documents checklist non-authorization', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '# Production Release Readiness Checklist',
      'This checklist does not authorize implementation.',
      'It does not authorize production source-of-truth switch.',
      'It must be completed before a future production release or source-of-truth switch.',
      'Task 7.10 is not started by Task 7.9.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('includes every required checklist area', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'production backend readiness',
      'auth/user identity readiness',
      'user data ownership readiness',
      'cloud sync readiness',
      'database/data-model readiness',
      'backup/export readiness',
      'migration dry-run readiness',
      'rollback readiness',
      'localStorage emergency backup readiness',
      'privacy/security readiness',
      'deployment readiness',
      'monitoring/diagnostics readiness',
      'failure-mode readiness',
      'manual acceptance readiness',
      'route surface readiness',
      'environment variable safety readiness',
      'Vercel/frontend deployment boundary readiness',
      'no real personal training data in tests',
      'no destructive migration',
      'no api-primary-dev promotion',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps source boundary and blocked implementation intact', () => {
    const doc = readSource(docPath);

    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    for (const expected of [
      'production backend runtime',
      'auth runtime',
      'cloud sync runtime',
      'deployment runtime',
      'monitoring runtime',
      'source-of-truth switching',
      'route expansion',
      'normalized tables',
      'destructive migration',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
