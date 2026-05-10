import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docs = [
  'docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md',
  'docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
];

describe('limited history edit mutation docs parity', () => {
  it('documents Task 4.44 across the plan, audit, contract, refactor plan, and manual checklist', () => {
    for (const path of docs) {
      const doc = readSource(path);
      expect(doc, path).toContain('Task 4.44');
      expect(doc, path).toContain('POST /data-health/issues/:issueId/dismiss');
      expect(doc, path).toContain('POST /history/:id/data-flag');
    }

    expect(readSource('API_CONTRACT.md')).toContain('Limited History Edit Mutation Prototype Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.44: Limited History Edit Mutation Prototype Plan V1');
    expect(readSource('docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md')).toContain('## Task 4.44 Follow-up Note');
  });

  it('keeps Task 4.44 aligned to planning-only field constraints and blocked implementation', () => {
    const combined = docs.map(readSource).join('\n');

    for (const expected of [
      'This is planning-only.',
      'This does not implement `POST /history/:id/edit`.',
      'This does not add `POST /history/:id/edit` to the App.',
      'This does not expand the current browser mutation allowlist.',
      'Allowed future fields:',
      'Rejected fields and operations:',
      'Task 4.44 result: Plan only.',
      '`POST /history/:id/edit` remains blocked from browser runtime.',
      'Browser mutation routes remain exactly:',
      'localStorage remains source of truth.',
      'API results never overwrite AppData or localStorage.',
      'Next task: none automatic.',
    ]) {
      expect(combined).toContain(expected);
    }
  });

  it('does not instruct forbidden route expansion, source-of-truth migration, or production readiness', () => {
    const combined = docs.map(readSource).join('\n');

    for (const pattern of [
      /(^|\n)\s*(?:[-*]\s*)?implement history edit now\b/i,
      /(^|\n)\s*(?:[-*]\s*)?connect POST \/history\/:id\/edit to App now\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable third mutation route now\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable session mutation\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable DataHealth repair\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable backup\/import\/reset over HTTP\b/i,
      /(^|\n)\s*(?:[-*]\s*)?replace localStorage\b/i,
      /(^|\n)\s*(?:[-*]\s*)?make API source of truth\b/i,
      /(^|\n)\s*(?:[-*]\s*)?deploy production backend\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable auth\b/i,
      /(^|\n)\s*(?:[-*]\s*)?enable sync\b/i,
      /Task 4\.44[^.\n]*(production ready|production-ready)/i,
    ]) {
      expect(combined).not.toMatch(pattern);
    }
  });
});
