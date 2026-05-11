import { describe, expect, it } from 'vitest';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('Session Start hardening boundary', () => {
  it('keeps session start one-route only and blocks active patch/complete/discard', () => {
    expect(DEV_API_SESSION_START_ROUTE).toBe('/sessions/start');
    const source = [
      readSource('src/devApi/devApiSessionStartClient.ts'),
      readSource('src/devApi/DevApiSessionStartPrototype.tsx'),
      readSource('src/devApi/devApiSessionStartConfig.ts'),
    ].join('\n');

    [
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'saveData',
      'loadData',
      'localStorageAdapter',
      'node:http',
      'node:sqlite',
      'serverAdapter',
      'sqliteRepository',
    ].forEach((blocked) => expect(source).not.toContain(blocked));
  });
});
