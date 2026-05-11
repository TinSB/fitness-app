import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('session complete acceptance docs parity', () => {
  it('documents the acceptance and hardening checklist', () => {
    const doc = readSource('docs/SESSION_COMPLETE_ACCEPTANCE_HARDENING.md');

    for (const expected of [
      'Task 5.18',
      'POST /sessions/active/complete',
      'Duplicate complete submit',
      'Missing active session',
      'Invalid active session identity',
      'Incomplete main work',
      'Timeout',
      'malformed response',
      'no fake success',
      'pending submit',
      'Confirmation must reset',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'dedicated test browser profile',
      'dedicated dev DB',
      'Do not use real personal training data',
      'Next recommended task: `Task 5.19 Session Discard Mutation Prototype Plan V1`',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('keeps docs aligned on Task 5.18 and forbidden route boundaries', () => {
    const docs = [
      readSource('docs/SESSION_COMPLETE_ACCEPTANCE_HARDENING.md'),
      readSource('docs/SESSION_COMPLETE_MUTATION_PROTOTYPE_PLAN.md'),
      readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md'),
      readSource('API_CONTRACT.md'),
      readSource('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Task 5.18',
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
      'Task 5.19 Session Discard Mutation Prototype Plan V1',
    ]) {
      expect(docs).toContain(expected);
    }

    for (const pattern of [
      /enable session discard now/i,
      /implement session discard now/i,
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
