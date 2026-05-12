import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_BACKEND_ADAPTER_SKELETON_PLAN.md',
].map(readSource).join('\n');

describe('production backend adapter docs parity', () => {
  it('records Task 6.9 across contract, plan, checklist, checkpoint, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.9: Production Backend Adapter Skeleton Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.9: Production Backend Adapter Skeleton Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.9 Production Backend Adapter Skeleton Plan');
    expect(readSource('docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md')).toContain('Task 6.9 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.9 Production Backend Adapter Plan Alignment');
  });

  it('keeps docs aligned on planning-only backend adapter boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.9 Production Backend Adapter Skeleton Plan V1',
      'docs/static tests only',
      'backend adapter boundary',
      'request/response shape',
      'environment boundary',
      'no hosted deployment',
      'no auth',
      'no database migration',
      'no production runtime activation',
      'Task 6.10 Production Backend Adapter Skeleton V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct backend runtime implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /start production backend now/i,
      /auto-listen now/i,
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
