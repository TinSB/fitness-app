import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/SOURCE_OF_TRUTH_CUTOVER_MANUAL_ACCEPTANCE.md';

describe('source-of-truth cutover manual acceptance', () => {
  it('exists and uses checklist acceptance sections', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '# Source-of-Truth Cutover Manual Acceptance',
      '- [ ] Use a dedicated test browser profile.',
      '- [ ] Use synthetic non-personal AppData only.',
      '## LocalStorage-Primary Baseline',
      '## Migration Dry Run',
      '## Backend Repository Candidate',
      '## Backend-Primary Read Candidate',
      '## Backend-Primary Mutation Candidate',
      '## Runtime Switch Guard',
      '## Fallback / Emergency / Rollback',
      '## Pass / Fail Template',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents localStorage, opt-in backend candidate, route lock, and blocked routes', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'localStorage-primary',
      'localStorage fallback, migration source, and emergency backup',
      'backend-primary candidate mode is explicit opt-in',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'eighth browser mutation route',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps production non-goals explicit and recommends Task 9.11', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'No auth/user accounts.',
      'No cloud sync.',
      'No deployment runtime.',
      'No monitoring runtime.',
      'No SaaS/multi-user runtime.',
      'No normalized tables.',
      'No destructive migration.',
      'Real personal data remains excluded',
      'Recommended next task: Task 9.11 Backend-Primary Regression Lock V1.',
      'Task 9.11 is not part of Task 9.10.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
