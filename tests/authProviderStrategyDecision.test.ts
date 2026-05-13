import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/AUTH_PROVIDER_STRATEGY_DECISION.md';

describe('auth provider strategy decision', () => {
  it('chooses adapter-first and blocks real provider integration in Phase 10', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 10.3 Auth Provider Strategy Decision V1',
      'Do not integrate a real auth provider in Phase 10.',
      'Use an adapter-first auth boundary before selecting or integrating a real provider.',
      'Real provider integration must wait for a later explicit Phase 11 task',
      'This task is docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('compares the required auth strategy categories', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Custom Auth',
      'Auth.js',
      'Clerk',
      'Supabase Auth',
      'Firebase/Auth0-like Managed Auth',
      'Adapter-First Strategy',
      'Adapter-first is the selected Phase 10 strategy.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents why direct provider integration is blocked', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'no final cloud database is selected',
      'no production deployment runtime exists',
      'no real cloud sync runtime exists',
      'no external monitoring or incident response runtime exists',
      'no provider-specific secret handling has been approved',
      'no account-scoped AppData acceptance run has passed',
      'backend-primary candidate remains explicit opt-in and reversible',
      '`localStorage` remains default, fallback, migration source, and emergency backup',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('defines minimum future provider requirements and package boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'stable user identity',
      'explicit session model',
      'safe logout behavior',
      'safe token and secret handling',
      'local profile to cloud account linking model',
      'data export expectations',
      'No provider dependency is added.',
      'No provider SDK is added.',
      'No login UI is added.',
      'No auth routes are added.',
      'No package dependency, package script, or lockfile changes are authorized.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 10.4 without authorizing a real auth provider', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Recommended next task: Task 10.4 Auth Runtime Skeleton Boundary V1.',
      'Task 10.4 may add a disabled adapter-first auth runtime skeleton only.',
      'Task 10.4 must not integrate a real auth provider.',
      'Task 10.4 is not part of Task 10.3.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
