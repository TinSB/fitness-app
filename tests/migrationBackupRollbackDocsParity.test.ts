import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md',
  'docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md',
  'docs/API_CLIENT_RUNTIME_STRATEGY.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('migration backup and rollback docs parity', () => {
  it('records Task 5.5 across docs and keeps Task 5.6 next', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.5 Migration Backup & Rollback Strategy V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.5: Migration Backup & Rollback Strategy V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.5 Migration Backup & Rollback Strategy');

    const docs = allDocs();
    expect(docs).toContain('docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md');
    expect(docs).toContain('Task 5.6 Offline / PWA Conflict Strategy V1');
  });

  it('keeps backup, dry-run, apply, rollback, corrupt snapshot, and schema mismatch wording aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'backup-first',
      'localStorage backup',
      'SQLite snapshot backup',
      'dry-run',
      'apply',
      'Rollback',
      'corrupt',
      'schema mismatch',
      'Do not delete localStorage.',
      'Do not auto-switch runtime source.',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps source-of-truth and implementation boundaries aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'localStorage remains source of truth',
      'API results never overwrite AppData',
      'No migration dry-run is implemented.',
      'No migration apply is implemented.',
      'No API-backed runtime is implemented.',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/switch source of truth now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});

