import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docs = [
  'docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md',
  'docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
];

describe('third mutation candidate docs parity', () => {
  it('documents Task 4.43 across the contract, refactor plan, regression lock, and manual checklist', () => {
    for (const path of docs) {
      const doc = readSource(path);
      expect(doc, path).toContain('Task 4.43');
      expect(doc, path).toContain('POST /data-health/issues/:issueId/dismiss');
      expect(doc, path).toContain('POST /history/:id/data-flag');
    }

    expect(readSource('API_CONTRACT.md')).toContain('Third Mutation Candidate Readiness Audit V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.43: Third Mutation Candidate Readiness Audit V1');
    expect(readSource('docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md')).toContain('## Task 4.43 Follow-up Note');
  });

  it('keeps the Task 4.43 recommendation aligned to a planning-only Task 4.44', () => {
    const combined = docs.map(readSource).join('\n');

    expect(combined).toContain('Task 4.44 Limited History Edit Mutation Prototype Plan V1');
    expect(combined).toContain('planning-only');
    expect(combined).toContain('No third mutation is implemented.');
    expect(combined).toContain('Browser mutation routes remain exactly DataHealth dismiss and History data-flag');
    expect(combined).toContain('localStorage remains source of truth');
    expect(combined).toContain('API results never overwrite AppData or localStorage');
  });

  it('does not instruct forbidden write-path expansion or production readiness', () => {
    const combined = docs.map(readSource).join('\n');

    for (const pattern of [
      /(^|\n)\s*(?:[-*]\s*)?implement history edit now\b/i,
      /(^|\n)\s*(?:[-*]\s*)?implement POST \/history\/:id\/edit now\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable third mutation route now\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable session mutation\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable DataHealth repair\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable backup\/import\/reset over HTTP\b/i,
      /(^|\n)\s*(?:[-*]\s*)?replace localStorage\b/i,
      /(^|\n)\s*(?:[-*]\s*)?make API source of truth\b/i,
      /(^|\n)\s*(?:[-*]\s*)?deploy production backend\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable auth\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable sync\b/i,
      /Task 4\.43[^.\n]*(production ready|production-ready)/i,
    ]) {
      expect(combined).not.toMatch(pattern);
    }
  });
});
