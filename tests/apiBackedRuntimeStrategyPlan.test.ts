import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md';

describe('API-backed runtime strategy plan', () => {
  it('exists and contains the required planning sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Phase 4 Baseline',
      '## LocalStorage Fallback Models',
      '## Migration Approach',
      '## Feature Flag Strategy',
      '## Read / Write Client Architecture',
      '## Offline Strategy',
      '## Rollback Strategy',
      '## Production / Auth / Sync Assumptions',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers fallback, migration, flag, client, offline, rollback, and production assumptions', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'API primary with localStorage read-only fallback',
      'explicit migration window with localStorage backup and rollback',
      'schema/version compatibility plan',
      'migration dry-run and validation report',
      'explicit opt-in',
      'route-specific mutation clients rather than broad arbitrary mutation client',
      'offline write blocking or queueing policy',
      'localStorage backup restore path',
      'production backend environment must be designed',
      'authentication must be designed',
      'sync behavior must be designed',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states this is no implementation and recommends Task 4.71 audit-only', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Do not implement API-backed runtime in Phase 4.');
    expect(doc).toContain('No API-backed runtime is implemented.');
    expect(doc).toContain('localStorage remains source of truth');
    expect(doc).toContain('API results never overwrite AppData or localStorage');
    expect(doc).toContain('Task 4.71 Phase 4 Final Data Safety Audit V1');
    expect(doc).toContain('Task 4.71 must be audit-only.');
    expect(doc).not.toMatch(/implement API-backed runtime now/i);
    expect(doc).not.toMatch(/replace localStorage now/i);
  });
});
