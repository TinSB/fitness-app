import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/SESSION_DISCARD_MUTATION_PROTOTYPE_PLAN.md',
  'docs/SESSION_COMPLETE_ACCEPTANCE_HARDENING.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('session discard mutation docs parity', () => {
  it('records Task 5.19 and points to Task 5.20', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 5.19');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('Task 5.19');
    expect(docs).toContain('Task 5.20 Session Discard Mutation Prototype V1');
  });

  it('keeps route and risk topics aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /sessions/active/discard',
      'unsaved training state',
      'strong confirmation',
      'visible recovery',
      'no history write',
      'source snapshot',
      'idempotencyKey',
      'requestFingerprint',
      'duplicate discard',
      'no fake success',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('does not instruct implementation or broaden scope now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement `?POST \/sessions\/active\/discard`? now/i,
      /enable session discard now/i,
      /enable DataHealth repair/i,
      /enable backup\/import\/export over HTTP/i,
      /enable reset\/recovery over HTTP/i,
      /switch source of truth now/i,
      /replace localStorage now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
