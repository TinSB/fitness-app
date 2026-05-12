import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md',
].map(readSource).join('\n');

describe('production architecture docs parity', () => {
  it('records Task 6.1 across contract, plan, checklist, preflight, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.1: Production Backend, Auth, Sync & Deployment Architecture Gate V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.1: Production Backend, Auth, Sync & Deployment Architecture Gate V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate');
    expect(readSource('docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md')).toContain('Task 6.1 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.1 Architecture Gate Alignment');
  });

  it('keeps docs aligned on Task 6.1 as architecture gate only', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1',
      'architecture gate only',
      'Task 6.2 Production Data Ownership, Privacy & Security Matrix V1',
      'docs/static tests only',
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
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct production implementation or unsafe data behavior', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement production backend now/i,
      /enable auth now/i,
      /enable cloud sync now/i,
      /deploy production now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
      /use real personal training data in automated tasks now/i,
      /add normalized tables now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
