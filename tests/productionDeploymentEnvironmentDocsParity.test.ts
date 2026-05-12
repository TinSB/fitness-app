import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_DEPLOYMENT_ENVIRONMENT_FINAL_AUDIT.md',
].map(readSource).join('\n');

describe('production deployment environment docs parity', () => {
  it('records Task 6.35 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.35: Production Deployment & Environment Final Audit V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.35: Production Deployment & Environment Final Audit V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.35 Production Deployment Environment Final Audit');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.35 Production Deployment Environment Final Audit Alignment');
  });

  it('keeps docs aligned on deployment environment boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.35 Production Deployment & Environment Final Audit V1',
      'environments',
      'secrets',
      'branch rules',
      'required checks',
      'rollback',
      'preview vs production',
      'no Vercel required check assumption',
      'no deployment if deployment was not implemented',
      'Task 6.36 Production Monitoring & Logging Privacy Lock V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('does not instruct deployment or production implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /enable auth runtime now/i,
      /enable sync runtime now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
      /add production secret now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
