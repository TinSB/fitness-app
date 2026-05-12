import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_BACKEND_ADAPTER_SKELETON_PLAN.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_BACKEND_ADAPTER_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('production backend adapter acceptance docs parity', () => {
  it('records Task 6.11 across contract, plan, checklist, skeleton plan, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.11: Production Backend Adapter Acceptance V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.11: Production Backend Adapter Acceptance V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.11 Production Backend Adapter Acceptance');
    expect(readSource('docs/PRODUCTION_BACKEND_ADAPTER_SKELETON_PLAN.md')).toContain('Task 6.11 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.11 Production Backend Adapter Acceptance Alignment');
  });

  it('keeps docs aligned on acceptance boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.11 Production Backend Adapter Acceptance V1',
      'Node-only isolation',
      'no browser pollution',
      'no auto-listen',
      'no auth runtime',
      'no deployment runtime',
      'safe error envelopes',
      'no production data',
      'Task 6.12 Auth Boundary & Account Model Plan V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct activation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /activate production backend now/i,
      /start listening now/i,
      /enable auth runtime now/i,
      /deploy production now/i,
      /run database migration now/i,
      /use production data now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
