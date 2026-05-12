import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_MIGRATION_BACKUP_ROLLBACK_STRATEGY.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md',
].map(readSource).join('\n');

describe('phase 6 architecture checkpoint docs parity', () => {
  it('records Task 6.8 across contract, plan, checklist, migration strategy, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.8: Phase 6 Architecture Checkpoint & Boundary Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.8: Phase 6 Architecture Checkpoint & Boundary Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.8 Phase 6 Architecture Checkpoint Boundary Lock');
    expect(readSource('docs/PRODUCTION_MIGRATION_BACKUP_ROLLBACK_STRATEGY.md')).toContain('Task 6.8 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.8 Architecture Checkpoint Alignment');
  });

  it('keeps docs aligned on checkpoint-only boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1',
      'docs/static tests only',
      'architecture decisions',
      'still-blocked implementation',
      'no production backend runtime',
      'no auth runtime',
      'no sync runtime',
      'no deployment runtime',
      'no normalized schema',
      'Task 6.9 Production Backend Adapter Skeleton Plan V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct runtime implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement production backend runtime now/i,
      /enable auth runtime now/i,
      /enable sync runtime now/i,
      /deploy production now/i,
      /create normalized tables now/i,
      /run migration now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
