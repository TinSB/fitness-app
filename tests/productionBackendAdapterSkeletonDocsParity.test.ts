import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_BACKEND_ADAPTER_SKELETON_PLAN.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
].map(readSource).join('\n');

describe('production backend adapter skeleton docs parity', () => {
  it('records Task 6.10 across contract, plan, checklist, skeleton plan, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.10: Production Backend Adapter Skeleton V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.10: Production Backend Adapter Skeleton V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.10 Production Backend Adapter Skeleton');
    expect(readSource('docs/PRODUCTION_BACKEND_ADAPTER_SKELETON_PLAN.md')).toContain('Task 6.10 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.10 Production Backend Adapter Skeleton Alignment');
  });

  it('keeps docs aligned on inert Node-only skeleton boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.10 Production Backend Adapter Skeleton V1',
      'Node-only',
      'inert by default',
      'safe error envelopes',
      'production_backend_not_activated',
      'route_not_allowed',
      'no auto-listen behavior',
      'no deployment',
      'no auth',
      'no database migration',
      'Task 6.11 Production Backend Adapter Acceptance V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct production activation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /start listening now/i,
      /deploy hosted backend now/i,
      /enable auth now/i,
      /run database migration now/i,
      /activate production runtime now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
