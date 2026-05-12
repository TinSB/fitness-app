import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('session discard acceptance docs parity', () => {
  it('documents the acceptance and hardening checklist', () => {
    const doc = readSource('docs/SESSION_DISCARD_ACCEPTANCE_HARDENING.md');

    for (const expected of [
      'Task 5.21',
      'POST /sessions/active/discard',
      'Duplicate discard submit',
      'Missing active session',
      'Invalid active session identity',
      'Strong confirmation',
      'Cancel confirmation',
      'Timeout',
      'malformed response',
      'no fake success',
      'Pending submit',
      'Confirmation must reset',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'dedicated test browser profile',
      'dedicated dev DB',
      'Do not use real personal training data',
      'Next recommended task: `Task 5.22 Active Session Full Write-path Regression Lock V1`',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('keeps docs aligned on Task 5.21 and forbidden route boundaries', () => {
    const docs = [
      readSource('docs/SESSION_DISCARD_ACCEPTANCE_HARDENING.md'),
      readSource('docs/SESSION_DISCARD_MUTATION_PROTOTYPE_PLAN.md'),
      readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md'),
      readSource('API_CONTRACT.md'),
      readSource('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Task 5.21',
      '`POST /data-health/issues/:issueId/dismiss`',
      '`POST /history/:id/data-flag`',
      '`POST /history/:id/edit`',
      '`POST /sessions/start`',
      '`POST /sessions/active/patches`',
      '`POST /sessions/active/complete`',
      '`POST /sessions/active/discard`',
      '`POST /data-health/repair/apply`',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'Task 5.22 Active Session Full Write-path Regression Lock V1',
    ]) {
      expect(docs).toContain(expected);
    }

    for (const pattern of [
      /add an eighth mutation route now/i,
      /enable an eighth mutation route now/i,
      /enable DataHealth repair now/i,
      /enable backup\/import\/export over HTTP now/i,
      /enable reset\/recovery over HTTP now/i,
      /replace localStorage now/i,
      /make API source of truth now/i,
      /deploy production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /make .*production-ready now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
