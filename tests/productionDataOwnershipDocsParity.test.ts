import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md',
].map(readSource).join('\n');

describe('production data ownership docs parity', () => {
  it('records Task 6.2 across contract, plan, checklist, architecture gate, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.2: Production Data Ownership, Privacy & Security Matrix V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.2: Production Data Ownership, Privacy & Security Matrix V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.2 Production Data Ownership, Privacy & Security Matrix');
    expect(readSource('docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md')).toContain('Task 6.2 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.2 Data Ownership Alignment');
  });

  it('keeps docs aligned on Task 6.2 as docs/static tests only', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.2 Production Data Ownership, Privacy & Security Matrix V1',
      'docs/static tests only',
      'Task 6.3 Auth & User Account Lifecycle Architecture Gate V1',
      'localStorage remains default runtime source',
      'api-primary-dev',
      'not production-ready',
      'training history',
      'active session',
      'screening profile',
      'account identity metadata',
      'auth/session metadata',
      'sync metadata',
      'audit/security logs',
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
