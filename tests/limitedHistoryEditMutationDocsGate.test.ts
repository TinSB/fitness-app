import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docs = {
  api: () => readSource('API_CONTRACT.md'),
  refactor: () => readSource('FULL_STACK_REFACTOR_PLAN.md'),
  plan: () => readSource('docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md'),
  audit: () => readSource('docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md'),
  manual: () => readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md'),
  gate: () => readSource('docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md'),
};

const forbiddenInstructionPatterns = [
  /(^|\n)\s*(?:[-*]\s*)?implement history edit now\b/i,
  /(^|\n)\s*(?:[-*]\s*)?enable third mutation route now\b/i,
  /(^|\n)\s*(?:[-*]\s*)?connect POST \/history\/:id\/edit to App now\b/i,
  /(^|\n)\s*(?:[-*]\s*)?replace localStorage\b/i,
  /(^|\n)\s*(?:[-*]\s*)?make API source of truth\b/i,
  /(^|\n)\s*(?:[-*]\s*)?deploy production backend\b/i,
  /(^|\n)\s*(?:[-*]\s*)?enable auth\b/i,
  /(^|\n)\s*(?:[-*]\s*)?enable sync\b/i,
];

describe('limited history edit mutation docs gate', () => {
  it('documents Task 4.45 in the API contract and full-stack plan', () => {
    const api = docs.api();
    const refactor = docs.refactor();

    for (const doc of [api, refactor]) {
      expect(doc).toContain('Task 4.45');
      expect(doc).toContain('Limited History Edit Mutation Prototype Readiness Gate V1');
      expect(doc).toContain('no third mutation route');
      expect(doc).toContain('Task 4.46 Limited History Edit Mutation Prototype V1');
      expect(doc).toContain('explicit user approval');
    }

    expect(api).toContain('Task 4.45 result is ready for a user-approved implementation prompt, but not direct implementation.');
    expect(refactor).toContain('The next recommended task is `Task 4.46 Limited History Edit Mutation Prototype V1` only with explicit user approval.');
  });

  it('adds Task 4.45 follow-up notes to the Task 4.44 plan and Task 4.43 audit', () => {
    const plan = docs.plan();
    const audit = docs.audit();

    for (const doc of [plan, audit]) {
      expect(doc).toContain('## Task 4.45 Follow-up Note');
      expect(doc).toContain('docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md');
      expect(doc).toContain('does not implement `POST /history/:id/edit`');
      expect(doc).toContain('does not add a third browser mutation route');
      expect(doc).toContain('Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`');
      expect(doc).toContain('Task 4.46 Limited History Edit Mutation Prototype V1 requires explicit user approval and must not auto-start.');
    }
  });

  it('adds manual acceptance checklist notes while keeping history edit gate-only', () => {
    const manual = docs.manual();

    for (const expected of [
      'Task 4.45 adds the limited history edit mutation readiness gate',
      'limited history edit remains gate-only and not implemented',
      'Confirm Task 4.45 is readiness gate only.',
      'Confirm limited history edit remains gate-only and not implemented.',
      'Confirm `POST /history/:id/edit` remains blocked from browser runtime.',
      'Confirm no third browser mutation route is added.',
      'Confirm Task 4.46 Limited History Edit Mutation Prototype V1 requires explicit user approval and must not auto-start.',
    ]) {
      expect(manual).toContain(expected);
    }
  });

  it('does not instruct forbidden implementation, source-of-truth, production, auth, or sync work', () => {
    const combined = [
      docs.api(),
      docs.refactor(),
      docs.plan(),
      docs.audit(),
      docs.manual(),
      docs.gate(),
    ].join('\n');

    for (const pattern of forbiddenInstructionPatterns) {
      expect(combined).not.toMatch(pattern);
    }
  });
});
