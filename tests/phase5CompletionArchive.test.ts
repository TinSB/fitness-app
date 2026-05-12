import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE5_COMPLETION_ARCHIVE.md';

describe('Phase 5 completion archive', () => {
  it('exists and contains required completion sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 5 Completion Archive',
      '## Scope / Non-goals',
      '## Phase 5 Complete',
      '## API Primary Dev Runtime Status',
      '## LocalStorage Fallback Status',
      '## Migration Status',
      '## Final Accepted Runtime Modes',
      '## Final Accepted Browser Mutation Routes',
      '## Final Blocked Routes And Capabilities',
      '## Final Validation Commands',
      '## Phase 6 Handoff',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('marks Phase 5 complete and blocks automatic Phase 6 start', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Phase 5 is complete after Task 5.41 merges.',
      'Do not start Phase 6 automatically.',
      'Do not start Task 6.1 automatically.',
      'Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records API primary, localStorage fallback, migration, routes, and validation commands', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'api-primary-dev',
      'not production-ready',
      'localStorage remains:',
      'fallback source',
      'migration source',
      'dry-run exists and is warning-only/no-write',
      'apply exists as dev-only, backup-first',
      'rollback/recovery exists as dev-only',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'npm run api:dev:build',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'node:http',
      'devDbRecovery',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
