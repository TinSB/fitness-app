import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const lockDoc = 'docs/MIGRATION_REGRESSION_LOCK.md';

const docs = () => [
  lockDoc,
  'docs/LOCALSTORAGE_TO_SQLITE_MIGRATION_DRY_RUN.md',
  'docs/LOCALSTORAGE_TO_SQLITE_MIGRATION_APPLY_PROTOTYPE.md',
  'docs/MIGRATION_ACCEPTANCE_MANUAL.md',
  'docs/MIGRATION_ROLLBACK_RECOVERY_HARDENING.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('migration regression docs parity', () => {
  it('documents required migration regression lock sections', () => {
    const doc = readSource(lockDoc);

    for (const section of [
      '# Migration Regression Lock',
      '## Scope / Non-goals',
      '## Locked Migration State',
      '## Dry-run Lock',
      '## Apply Lock',
      '## Rollback Lock',
      '## No Destructive Import Lock',
      '## Accepted Browser Mutation Routes',
      '## Blocked Routes And Capabilities',
      '## Source-of-truth Lock',
      '## Browser Build Isolation',
      '## Coverage Inventory',
      '## Manual Inventory',
      '## Future Work Gate',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('keeps docs aligned on migration state, routes, and source-of-truth', () => {
    const all = docs();

    for (const expected of [
      'Task 5.36',
      'Migration Regression Lock V1',
      'Task 5.37 Phase 5 Final Source-of-truth Audit V1',
      'backup-first',
      'rollback',
      'no destructive',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'localStorage remains',
      'api-primary-dev',
    ]) {
      expect(all).toContain(expected);
    }
  });

  it('does not instruct production readiness, destructive import, or blocked route enablement', () => {
    const all = docs();

    for (const pattern of [
      /production ready/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /enable cloud/i,
      /delete localStorage now/i,
      /clear localStorage now/i,
      /silently overwrite localStorage now/i,
      /silently overwrite AppData now/i,
      /enable DataHealth repair/i,
      /enable backup\/import\/export over HTTP/i,
      /enable reset\/recovery over HTTP/i,
      /enable eighth browser mutation route/i,
      /start Phase 6 implementation now/i,
    ]) {
      expect(all).not.toMatch(pattern);
    }
  });
});
