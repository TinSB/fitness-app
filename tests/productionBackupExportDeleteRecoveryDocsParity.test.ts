import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_BACKUP_EXPORT_DELETE_RECOVERY_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('production backup export delete recovery docs parity', () => {
  it('records Task 6.33 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.33: Production Backup, Export, Delete & Recovery Acceptance V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.33: Production Backup, Export, Delete & Recovery Acceptance V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.33 Production Backup Export Delete Recovery Acceptance');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.33 Production Backup Export Delete Recovery Acceptance Alignment');
  });

  it('keeps docs aligned on backup export delete recovery boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.33 Production Backup, Export, Delete & Recovery Acceptance V1',
      'backup-first',
      'export policy',
      'delete policy',
      'account deletion implications',
      'restore verification',
      'rollback drill',
      'no destructive automated real-data operation',
      'no silent overwrite',
      'Task 6.34 Production Sync / Conflict Final Audit V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('does not instruct blocked implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /enable auth runtime now/i,
      /enable sync runtime now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
      /perform destructive restore now/i,
      /add backup\/export route now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
