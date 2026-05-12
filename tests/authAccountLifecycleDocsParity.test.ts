import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/AUTH_BOUNDARY_ACCOUNT_MODEL_PLAN.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/AUTH_ACCOUNT_LIFECYCLE_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('auth account lifecycle docs parity', () => {
  it('records Task 6.14 across contract, plan, checklist, auth boundary plan, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.14: Auth Account Lifecycle Acceptance V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.14: Auth Account Lifecycle Acceptance V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.14 Auth Account Lifecycle Acceptance');
    expect(readSource('docs/AUTH_BOUNDARY_ACCOUNT_MODEL_PLAN.md')).toContain('Task 6.14 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.14 Auth Account Lifecycle Acceptance Alignment');
  });

  it('keeps docs aligned on auth lifecycle acceptance boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.14 Auth Account Lifecycle Acceptance V1',
      'docs/static tests only',
      'no login/signup runtime',
      'no token/session runtime',
      'account lifecycle gates',
      'deletion/export policy',
      'identity mismatch prevention',
      'Task 6.15 Production Storage Schema Strategy V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct auth runtime implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement login now/i,
      /enable signup now/i,
      /store tokens now/i,
      /enable OAuth now/i,
      /create user table now/i,
      /link local data to account now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
