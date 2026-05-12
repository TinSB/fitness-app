import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_SECURITY_PRIVACY_FINAL_HARDENING.md',
].map(readSource).join('\n');

describe('production security privacy docs parity', () => {
  it('records Task 6.32 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.32: Production Security & Privacy Final Hardening V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.32: Production Security & Privacy Final Hardening V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.32 Production Security Privacy Final Hardening');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.32 Production Security Privacy Final Hardening Alignment');
  });

  it('keeps docs aligned on final security and privacy boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.32 Production Security & Privacy Final Hardening V1',
      'Raw AppData logging is blocked',
      'localStorage dump logging is blocked',
      'Token and secret logging is blocked',
      'synthetic data only',
      'no auth provider',
      'no cloud sync engine',
      'no deployment config that changes production behavior',
      'Task 6.33 Production Backup, Export, Delete & Recovery Acceptance V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct production implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /enable auth runtime now/i,
      /enable sync runtime now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
      /add monitoring service now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
