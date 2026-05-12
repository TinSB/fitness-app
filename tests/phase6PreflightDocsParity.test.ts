import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE5_COMPLETION_ARCHIVE.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md',
].map(readSource).join('\n');

describe('Phase 6 preflight docs parity', () => {
  it('records Task 6.0 across contract, plan, checklist, archive, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.0: Phase 6 Preflight & Production Boundary Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.0: Phase 6 Preflight & Production Boundary Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.0 Phase 6 Preflight Production Boundary Lock');
    expect(readSource('docs/PHASE5_COMPLETION_ARCHIVE.md')).toContain('Task 6.0 Phase 6 Preflight & Production Boundary Lock V1');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.0 Phase 6 Preflight & Production Boundary Lock V1');
  });

  it('keeps docs aligned on Phase 5 baseline and Task 6.1 architecture gate only', () => {
    const docs = allDocs();

    for (const expected of [
      'Phase 5 completed',
      'localStorage remains default runtime source',
      'api-primary-dev',
      'not production-ready',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1',
      'architecture gate only',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct production implementation or unsafe source/data behavior', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement production backend now/i,
      /enable auth now/i,
      /enable cloud sync now/i,
      /deploy production now/i,
      /switch source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
      /use real personal training data in automated tasks now/i,
      /add normalized tables now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
