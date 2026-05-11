import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('session patch prototype acceptance docs', () => {
  it('documents the acceptance and hardening checklist', () => {
    const doc = readSource('docs/SESSION_PATCH_PROTOTYPE_ACCEPTANCE_HARDENING.md');

    for (const expected of [
      'Task 5.15',
      'POST /sessions/active/patches',
      'Duplicate patch submit',
      'Out-of-order patch',
      'Stale source snapshot',
      'Invalid active session id',
      'Timeout',
      'no fake success',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'dedicated test browser profile',
      'dedicated dev DB',
      'Do not use real personal training data',
      'Next recommended task: `Task 5.16 Session Complete Mutation Prototype Plan V1`',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('keeps forbidden route and production boundaries explicit', () => {
    const doc = readSource('docs/SESSION_PATCH_PROTOTYPE_ACCEPTANCE_HARDENING.md');

    for (const expected of [
      '`POST /sessions/active/complete`',
      '`POST /sessions/active/discard`',
      '`POST /data-health/repair/apply`',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'production backend',
      'auth',
      'sync',
      'cloud',
      'deployment',
    ]) {
      expect(doc).toContain(expected);
    }

    for (const pattern of [
      /enable session complete now/i,
      /enable session discard now/i,
      /replace localStorage now/i,
      /make API source of truth now/i,
      /production-ready/i,
    ]) {
      expect(doc).not.toMatch(pattern);
    }
  });
});
