import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/DEPLOYMENT_RUNTIME_STRATEGY_STAGING_PLAN.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
].map(readSource).join('\n');

describe('environment validation docs parity', () => {
  it('records Task 6.23 across contract, plan, checklist, deployment plan, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.23: Secrets & Environment Validation Skeleton V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.23: Secrets & Environment Validation Skeleton V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.23 Secrets Environment Validation Skeleton');
    expect(readSource('docs/DEPLOYMENT_RUNTIME_STRATEGY_STAGING_PLAN.md')).toContain('Task 6.23 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.23 Secrets Environment Validation Alignment');
  });

  it('keeps docs aligned on safe skeleton boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.23 Secrets & Environment Validation Skeleton V1',
      'safe environment validation skeleton',
      'no secret values',
      'no production deployment',
      'no auth provider',
      'no sync provider',
      'no package changes',
      'Task 6.24 Observability / Logging Privacy Skeleton V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct deployment, provider setup, or secret values now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /add secret values now/i,
      /configure auth provider now/i,
      /configure sync provider now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
