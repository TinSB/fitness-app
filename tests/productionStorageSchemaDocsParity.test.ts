import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/AUTH_ACCOUNT_LIFECYCLE_ACCEPTANCE.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_STORAGE_SCHEMA_STRATEGY.md',
].map(readSource).join('\n');

describe('production storage schema docs parity', () => {
  it('records Task 6.15 across contract, plan, checklist, auth lifecycle, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.15: Production Storage Schema Strategy V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.15: Production Storage Schema Strategy V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.15 Production Storage Schema Strategy');
    expect(readSource('docs/AUTH_ACCOUNT_LIFECYCLE_ACCEPTANCE.md')).toContain('Task 6.15 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.15 Production Storage Schema Strategy Alignment');
  });

  it('keeps docs aligned on schema strategy boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.15 Production Storage Schema Strategy V1',
      'docs/static tests only',
      'snapshot repository',
      'normalized schema future risk',
      'migration strategy',
      'rollback',
      'backup',
      'no schema implementation',
      'Task 6.16 Production Storage Migration Dry-run Prototype V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct schema implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /create normalized tables now/i,
      /implement schema migration now/i,
      /write production database now/i,
      /run migration now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
