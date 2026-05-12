import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/CLOUD_SYNC_CONFLICT_RESOLUTION_ARCHITECTURE_GATE.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/DEPLOYMENT_ENVIRONMENT_SECRETS_STRATEGY.md',
].map(readSource).join('\n');

describe('deployment environment secrets docs parity', () => {
  it('records Task 6.6 across contract, plan, checklist, sync gate, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.6: Deployment, Environment & Secrets Strategy V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.6: Deployment, Environment & Secrets Strategy V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.6 Deployment Environment Secrets Strategy');
    expect(readSource('docs/CLOUD_SYNC_CONFLICT_RESOLUTION_ARCHITECTURE_GATE.md')).toContain('Task 6.6 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.6 Deployment Environment Secrets Alignment');
  });

  it('keeps docs aligned on planning-only deployment and secrets boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.6 Deployment, Environment & Secrets Strategy V1',
      'docs/static tests only',
      'local/dev/staging/production',
      'secrets storage',
      'environment variables',
      'branch rules',
      'required checks',
      'Vercel optional',
      'rollback strategy',
      'Task 6.7 Production Migration, Backup & Rollback Strategy V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct deployment, source switch, or real data use now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /enable production hosting now/i,
      /commit secret values/i,
      /make Vercel required now/i,
      /enable auth now/i,
      /enable cloud sync now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
