import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
].map(readSource).join('\n');

describe('observability redaction docs parity', () => {
  it('records Task 6.24 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.24: Observability / Logging Privacy Skeleton V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.24: Observability / Logging Privacy Skeleton V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.24 Observability Logging Privacy Skeleton');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.24 Observability Logging Privacy Alignment');
  });

  it('keeps docs aligned on privacy-safe logging skeleton boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.24 Observability / Logging Privacy Skeleton V1',
      'privacy-safe redaction utility',
      'no external logging service',
      'no raw AppData logging',
      'no localStorage dump',
      'no token/secret logging',
      'Task 6.25 Production Readiness Security Hardening V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct external observability or raw data logging now', () => {
    const docs = allDocs();

    for (const pattern of [
      /enable external logging now/i,
      /log raw AppData now/i,
      /dump localStorage now/i,
      /log tokens now/i,
      /log secrets now/i,
      /deploy monitoring now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
