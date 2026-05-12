import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md',
].map(readSource).join('\n');

describe('auth user account docs parity', () => {
  it('records Task 6.3 across contract, plan, checklist, data ownership, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.3: Auth & User Account Lifecycle Architecture Gate V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.3: Auth & User Account Lifecycle Architecture Gate V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.3 Auth & User Account Lifecycle Architecture Gate');
    expect(readSource('docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md')).toContain('Task 6.3 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.3 Auth Account Lifecycle Alignment');
  });

  it('keeps docs aligned on architecture-only auth boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.3 Auth & User Account Lifecycle Architecture Gate V1',
      'docs/static tests only',
      'anonymous local user',
      'future account identity',
      'local data to account linking',
      'account deletion lifecycle',
      'identity mismatch',
      'Task 6.4 Production Backend & Database Architecture Decision V1',
      'localStorage remains default runtime source',
      'api-primary-dev',
      'not production-ready',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct auth implementation or unsafe account behavior', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement auth now/i,
      /enable login now/i,
      /enable signup now/i,
      /enable OAuth now/i,
      /store tokens now/i,
      /create user table now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
      /use real personal training data in automated tasks now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
