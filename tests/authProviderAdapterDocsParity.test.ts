import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/AUTH_BOUNDARY_ACCOUNT_MODEL_PLAN.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
].map(readSource).join('\n');

describe('auth provider adapter docs parity', () => {
  it('records Task 6.13 across contract, plan, checklist, auth boundary plan, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.13: Auth Provider Adapter Skeleton V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.13: Auth Provider Adapter Skeleton V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.13 Auth Provider Adapter Skeleton');
    expect(readSource('docs/AUTH_BOUNDARY_ACCOUNT_MODEL_PLAN.md')).toContain('Task 6.13 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.13 Auth Provider Adapter Skeleton Alignment');
  });

  it('keeps docs aligned on type/interface-only auth skeleton boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.13 Auth Provider Adapter Skeleton V1',
      'type/interface-only',
      'auth_runtime_not_implemented',
      'stores no credentials',
      'starts no provider flow',
      'performs no network request',
      'writes no browser storage',
      'no real auth',
      'Task 6.14 Auth Account Lifecycle Acceptance V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct auth implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement real auth now/i,
      /add login UI now/i,
      /store tokens now/i,
      /enable OAuth now/i,
      /integrate provider now/i,
      /add auth route now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
