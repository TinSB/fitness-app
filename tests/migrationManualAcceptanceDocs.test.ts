import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/MIGRATION_ACCEPTANCE_MANUAL.md';

describe('migration manual acceptance docs', () => {
  it('documents required acceptance sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Migration Acceptance / Manual Acceptance',
      '## Scope / Non-goals',
      '## Safety Requirements',
      '## Valid LocalStorage Acceptance',
      '## Invalid LocalStorage Acceptance',
      '## Legacy Data Acceptance',
      '## Backup Restore Acceptance',
      '## SQLite Snapshot Read Acceptance',
      '## Rollback Acceptance',
      '## Accepted Browser Mutation Routes',
      '## Manual Runbook',
      '## Manual Pass / Fail Template',
      '## Still Blocked',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers valid, invalid, legacy, backup restore, SQLite read, and rollback topics', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'valid localStorage',
      'invalid localStorage',
      'legacy payload',
      'backup restore',
      'SQLite snapshot metadata',
      'rollback',
      'dedicated test browser profile',
      'dedicated dev DB',
      'Do not use real personal training data.',
      'Task 5.35 Migration Rollback & Recovery Hardening V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('updates contract, refactor plan, and manual checklist parity without forbidden instructions', () => {
    const docs = [
      docPath,
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    for (const expected of [
      'Task 5.34',
      'Migration Acceptance / Manual Acceptance',
      'Task 5.35 Migration Rollback & Recovery Hardening V1',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/delete localStorage now|switch source of truth now|enable production backend now|enable auth now|enable sync now|enable reset\/recovery over HTTP|enable eighth browser mutation route/i);
  });
});
