import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/SESSION_PATCH_MUTATION_PROTOTYPE_PLAN.md',
  'docs/ACTIVE_SESSION_WRITE_COVERAGE_GAP_AUDIT.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('session patch mutation docs parity', () => {
  it('records Task 5.13 and points to Task 5.14', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 5.13');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('Task 5.13');
    expect(docs).toContain('Task 5.14 Session Patch Mutation Prototype V1');
  });

  it('keeps route and risk topics aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /sessions/active/patches',
      'patch ordering',
      'stale step',
      'duplicate',
      'partial update',
      'current set',
      'sourceSnapshotHash',
      'idempotencyKey',
      'requestFingerprint',
      'no fake success',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('does not instruct implementation or broaden scope now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement `?POST \/sessions\/active\/patches`? now/i,
      /enable session patch now/i,
      /implement session complete now/i,
      /implement session discard now/i,
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
