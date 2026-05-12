import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_MONITORING_LOGGING_PRIVACY_LOCK.md',
].map(readSource).join('\n');

describe('production monitoring logging docs parity', () => {
  it('records Task 6.36 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.36: Production Monitoring & Logging Privacy Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.36: Production Monitoring & Logging Privacy Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.36 Production Monitoring Logging Privacy Lock');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.36 Production Monitoring Logging Privacy Lock Alignment');
  });

  it('keeps docs aligned on monitoring logging privacy boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.36 Production Monitoring & Logging Privacy Lock V1',
      'sensitive data redaction',
      'no raw AppData logging',
      'no localStorage dump',
      'no token or secret logging',
      'privacy-safe diagnostics',
      'future observability gates',
      'Task 6.37 Production Release Candidate Regression Lock V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('does not instruct monitoring or production implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /enable auth runtime now/i,
      /enable sync runtime now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
      /send telemetry now/i,
      /install monitoring provider now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
