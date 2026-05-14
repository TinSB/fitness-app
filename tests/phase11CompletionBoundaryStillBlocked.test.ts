import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 11 completion boundary still blocked', () => {
  it('keeps accepted browser mutation routes exactly seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('keeps localStorage default and backend-primary candidate explicit', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });

    const archive = readSource('docs/PHASE11_COMPLETION_ARCHIVE.md');
    expect(archive).toContain('Backend-primary candidate remains explicit opt-in and reversible.');
    expect(archive).toContain('`localStorage` remains default, fallback, migration source, and emergency backup.');
  });

  it('keeps provider SDK dependency package script and lockfile drift blocked', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.dependencies).not.toHaveProperty('@supabase/supabase-js');
    expect(packageJson.dependencies).not.toHaveProperty('@clerk/clerk-react');
    expect(packageJson.dependencies).not.toHaveProperty('next-auth');
    expect(Object.keys(packageJson.scripts).filter((script) => /auth|sync|monitor/i.test(script))).toEqual([]);
    expect(readSource('docs/PHASE11_COMPLETION_ARCHIVE.md')).toContain('No package dependency, package script, or lockfile changes were made.');
  });

  it('keeps cloud sync deployment monitoring SaaS normalized tables and destructive migration blocked', () => {
    const archive = readSource('docs/PHASE11_COMPLETION_ARCHIVE.md');

    for (const expected of [
      'No real cloud sync is implemented.',
      'No production deployment runtime is implemented.',
      'No external monitoring upload is implemented.',
      'No SaaS or multi-user production runtime is implemented.',
      'No normalized tables or destructive migration are added.',
      'Real personal training data remains excluded.',
    ]) {
      expect(archive).toContain(expected);
    }
  });
});
