import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/MIGRATION_ROLLBACK_RECOVERY_HARDENING.md';

describe('migration rollback recovery hardening docs', () => {
  it('documents required rollback and recovery sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Migration Rollback & Recovery Hardening',
      '## Scope / Non-goals',
      '## Restore LocalStorage Backup',
      '## Restore Dev DB Backup',
      '## Corrupt Snapshot Handling',
      '## Schema Mismatch Handling',
      '## Clear Failure State',
      '## Accepted Browser Mutation Routes',
      '## Still Blocked',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers restore, corrupt snapshot, schema mismatch, and failure state topics', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'restore localStorage backup',
      'restore dev DB',
      'corrupt backup',
      'schema mismatch',
      'failureStateCleared: true',
      'failureStateCleared: false',
      'Task 5.36 Migration Regression Lock V1',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('updates parity docs and keeps forbidden routes blocked', () => {
    const docs = [
      docPath,
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    expect(docs).toContain('Task 5.35');
    expect(docs).toContain('Migration Rollback & Recovery Hardening');
    expect(docs).toContain('Task 5.36 Migration Regression Lock V1');
    expect(docs).not.toMatch(/enable HTTP reset route|enable HTTP recovery route|delete localStorage now|switch source of truth now|enable production backend now|enable auth now|enable sync now|enable eighth browser mutation route/i);
  });
});
