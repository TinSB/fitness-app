import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_READINESS_SECURITY_HARDENING.md',
].map(readSource).join('\n');

describe('production readiness security hardening docs parity', () => {
  it('records Task 6.25 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.25: Production Readiness Security Hardening V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.25: Production Readiness Security Hardening V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.25 Production Readiness Security Hardening');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.25 Production Readiness Security Hardening Alignment');
  });

  it('keeps docs aligned on security hardening boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.25 Production Readiness Security Hardening V1',
      'secret leakage',
      'sensitive data logging',
      'route boundaries',
      'privacy controls',
      'no auth runtime',
      'no deployment runtime',
      'Task 6.26 Production Manual Acceptance Runbook V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct production runtime or sensitive logging now', () => {
    const docs = allDocs();

    for (const pattern of [
      /enable auth runtime now/i,
      /deploy production now/i,
      /enable sync runtime now/i,
      /log raw AppData now/i,
      /dump localStorage now/i,
      /log tokens now/i,
      /log secrets now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
