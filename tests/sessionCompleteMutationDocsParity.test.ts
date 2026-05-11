import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/SESSION_COMPLETE_MUTATION_PROTOTYPE_PLAN.md',
  'docs/SESSION_PATCH_PROTOTYPE_ACCEPTANCE_HARDENING.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('session complete mutation docs parity', () => {
  it('records Task 5.16 and points to Task 5.17', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 5.16');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('Task 5.16');
    expect(docs).toContain('Task 5.17 Session Complete Mutation Prototype V1');
  });

  it('keeps route and risk topics aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /sessions/active/complete',
      'duplicate complete',
      'active session missing',
      'history duplicate',
      'source snapshot',
      'idempotencyKey',
      'requestFingerprint',
      'failure recovery',
      'no fake success',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('does not instruct implementation or broaden scope now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement `?POST \/sessions\/active\/complete`? now/i,
      /enable session complete now/i,
      /implement session discard now/i,
      /enable DataHealth repair/i,
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
