import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_ENVIRONMENT_CONFIG_BOUNDARY.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/DEPLOYMENT_RUNTIME_STRATEGY_STAGING_PLAN.md',
].map(readSource).join('\n');

describe('deployment runtime docs parity', () => {
  it('records Task 6.22 across contract, plan, checklist, environment boundary, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.22: Deployment Runtime Strategy & Staging Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.22: Deployment Runtime Strategy & Staging Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.22 Deployment Runtime Strategy Staging Plan');
    expect(readSource('docs/PRODUCTION_ENVIRONMENT_CONFIG_BOUNDARY.md')).toContain('Task 6.22 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.22 Deployment Runtime Strategy Alignment');
  });

  it('keeps docs aligned on deployment planning boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.22 Deployment Runtime Strategy & Staging Plan V1',
      'docs/static tests only',
      'staging vs production',
      'rollback',
      'preview deployments optional',
      'no production deployment implementation',
      'Task 6.23 Secrets & Environment Validation Skeleton V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct production deployment now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /enable hosted production runtime now/i,
      /add deployment config now/i,
      /add secret values now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
