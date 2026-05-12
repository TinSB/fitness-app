import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_ROLLBACK_INCIDENT_RUNBOOK.md',
].map(readSource).join('\n');

describe('production rollback incident docs parity', () => {
  it('records Task 6.27 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.27: Production Rollback & Incident Runbook V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.27: Production Rollback & Incident Runbook V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.27 Production Rollback Incident Runbook');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.27 Production Rollback Incident Alignment');
  });

  it('keeps docs aligned on rollback and incident boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.27 Production Rollback & Incident Runbook V1',
      'rollback',
      'incident detection',
      'data safety',
      'restore verification',
      'privacy incident handling',
      'no runtime implementation',
      'Task 6.28 Production Data Export / Delete Plan V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('does not instruct runtime incident handling now', () => {
    const docs = allDocs();

    for (const pattern of [
      /enable incident runtime now/i,
      /deploy production now/i,
      /restore real data now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
