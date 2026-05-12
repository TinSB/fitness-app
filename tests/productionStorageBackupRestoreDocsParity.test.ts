import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_STORAGE_MIGRATION_DRY_RUN.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_STORAGE_BACKUP_RESTORE_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('production storage backup restore docs parity', () => {
  it('records Task 6.17 across contract, plan, checklist, dry-run doc, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.17: Production Storage Backup / Restore Acceptance V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.17: Production Storage Backup / Restore Acceptance V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.17 Production Storage Backup Restore Acceptance');
    expect(readSource('docs/PRODUCTION_STORAGE_MIGRATION_DRY_RUN.md')).toContain('Task 6.17 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.17 Production Storage Backup Restore Alignment');
  });

  it('keeps docs aligned on backup restore acceptance boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.17 Production Storage Backup / Restore Acceptance V1',
      'docs/static tests only',
      'backup-first',
      'restore verification',
      'rollback drill',
      'no real data automation',
      'no destructive restore',
      'Task 6.18 Cloud Sync Model Plan V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct backup restore runtime now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement backup runtime now/i,
      /perform destructive restore now/i,
      /write database now/i,
      /enable backup export route now/i,
      /enable reset route now/i,
      /use real personal data/i,
      /switch production source of truth now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
