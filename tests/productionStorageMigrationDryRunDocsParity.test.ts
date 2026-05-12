import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_STORAGE_SCHEMA_STRATEGY.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_STORAGE_MIGRATION_DRY_RUN.md',
].map(readSource).join('\n');

describe('production storage migration dry run docs parity', () => {
  it('records Task 6.16 across contract, plan, checklist, schema strategy, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.16: Production Storage Migration Dry-run Prototype V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.16: Production Storage Migration Dry-run Prototype V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.16 Production Storage Migration Dry-run Prototype');
    expect(readSource('docs/PRODUCTION_STORAGE_SCHEMA_STRATEGY.md')).toContain('Task 6.16 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.16 Production Storage Migration Dry-run Alignment');
  });

  it('keeps docs aligned on dry-run-only boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.16 Production Storage Migration Dry-run Prototype V1',
      'pure dry-run utility',
      'writesPerformed: false',
      'no database write',
      'no schema migration',
      'no real-data automation',
      'Task 6.17 Production Storage Backup / Restore Acceptance V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct migration apply now', () => {
    const docs = allDocs();

    for (const pattern of [
      /perform migration apply now/i,
      /write database now/i,
      /create schema migration now/i,
      /use real personal data/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
