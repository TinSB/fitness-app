import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_BACKEND_ADAPTER_ACCEPTANCE.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/AUTH_BOUNDARY_ACCOUNT_MODEL_PLAN.md',
].map(readSource).join('\n');

describe('auth boundary docs parity', () => {
  it('records Task 6.12 across contract, plan, checklist, backend acceptance, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.12: Auth Boundary & Account Model Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.12: Auth Boundary & Account Model Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.12 Auth Boundary Account Model Plan');
    expect(readSource('docs/PRODUCTION_BACKEND_ADAPTER_ACCEPTANCE.md')).toContain('Task 6.12 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.12 Auth Boundary Account Model Alignment');
  });

  it('keeps docs aligned on auth planning-only boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.12 Auth Boundary & Account Model Plan V1',
      'docs/static tests only',
      'account identity',
      'local user to account mapping',
      'account deletion',
      'export/delete',
      'token/session requirements',
      'no auth runtime',
      'Task 6.13 Auth Provider Adapter Skeleton V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct auth implementation now', () => {
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
