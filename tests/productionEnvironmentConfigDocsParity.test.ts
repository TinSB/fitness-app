import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/SYNC_CONFLICT_ACCEPTANCE.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_ENVIRONMENT_CONFIG_BOUNDARY.md',
].map(readSource).join('\n');

describe('production environment config docs parity', () => {
  it('records Task 6.21 across contract, plan, checklist, sync acceptance, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.21: Production Environment Config Boundary V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.21: Production Environment Config Boundary V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.21 Production Environment Config Boundary');
    expect(readSource('docs/SYNC_CONFLICT_ACCEPTANCE.md')).toContain('Task 6.21 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.21 Production Environment Config Alignment');
  });

  it('keeps docs aligned on environment boundary rules', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.21 Production Environment Config Boundary V1',
      'docs/static tests only',
      'local',
      'development',
      'staging',
      'production',
      'secrets separation',
      'no secret values',
      'no production deploy',
      'no runtime production enable by default',
      'Task 6.22 Deployment Runtime Strategy & Staging Plan V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct deployment or production enablement now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /enable production runtime now/i,
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
