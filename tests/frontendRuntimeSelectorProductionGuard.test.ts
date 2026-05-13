import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/FRONTEND_RUNTIME_SELECTOR_PRODUCTION_GUARD.md';

describe('frontend runtime selector production guard', () => {
  it('documents production runtime selector guard rules', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '# Frontend Runtime Selector Production Guard',
      'frontend runtime selection',
      '`localStorage` remains default runtime source',
      '`api-primary-dev` remains explicit dev/local only',
      'Environment variables must not silently enable production backend',
      'Production build must not enable dev API source-of-truth accidentally.',
      'Preview deployment does not equal production backend readiness.',
      'Vercel deployment does not authorize production backend.',
      'Task 7.9 is not started by Task 7.8.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks dist token expectations in the guard doc', () => {
    const doc = readSource(docPath);

    for (const token of [
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
    ]) {
      expect(doc).toContain(token);
    }
  });

  it('keeps current selector and route defaults unchanged', () => {
    expect(createRuntimeSourceSelector({ DEV: false })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toHaveLength(7);
  });
});
