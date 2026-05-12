import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/DEPLOYMENT_ENVIRONMENT_SECRETS_STRATEGY.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_MIGRATION_BACKUP_ROLLBACK_STRATEGY.md',
].map(readSource).join('\n');

describe('production migration backup rollback docs parity', () => {
  it('records Task 6.7 across contract, plan, checklist, deployment strategy, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.7: Production Migration, Backup & Rollback Strategy V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.7: Production Migration, Backup & Rollback Strategy V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.7 Production Migration Backup Rollback Strategy');
    expect(readSource('docs/DEPLOYMENT_ENVIRONMENT_SECRETS_STRATEGY.md')).toContain('Task 6.7 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.7 Production Migration Backup Rollback Alignment');
  });

  it('keeps docs aligned on planning-only migration and rollback boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.7 Production Migration, Backup & Rollback Strategy V1',
      'docs/static tests only',
      'backup-first',
      'dry-run',
      'apply',
      'rollback',
      'recovery drill',
      'export/delete implications',
      'no destructive migration',
      'Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct migration or real data automation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /run destructive migration now/i,
      /migrate real personal data now/i,
      /delete localStorage now/i,
      /switch production source of truth now/i,
      /enable backup export route now/i,
      /enable reset route now/i,
      /deploy production now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
