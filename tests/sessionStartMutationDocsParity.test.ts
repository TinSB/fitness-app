import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('session start mutation prototype plan docs parity', () => {
  it('records Task 4.59 across contract, refactor, UX, and manual docs', () => {
    expect(readSource('API_CONTRACT.md')).toMatch(/Task 4\.59:? Session Start Mutation Prototype Plan V1/);
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.59: Session Start Mutation Prototype Plan V1');
    expect(readSource('docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md')).toContain('Task 4.59 Session Start Mutation Prototype Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.59 Session Start Mutation Prototype Plan');
  });

  it('documents the future one-route plan and current three-route allowlist', () => {
    const docs = [
      'docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    expect(docs).toContain('POST /sessions/start');
    expect(docs).toMatch(/no session-start route is implemented/i);
    [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
    ].forEach((route) => expect(docs).toContain(route));
  });

  it('documents payload metadata, confirmation, duplicate prevention, recovery, and manual acceptance', () => {
    const text = readSource('docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md');

    [
      'sourceSnapshotHash',
      'sourceSnapshotVersion',
      'mutationId',
      'idempotencyKey',
      'requestFingerprint',
      'confirmation',
      'duplicate start',
      'no automatic retry',
      'Recovery remains manual and local-first',
      'Manual Acceptance Plan',
    ].forEach((term) => expect(text).toContain(term));
  });

  it('does not instruct active patch, complete, discard, production, or source-of-truth migration implementation', () => {
    const docs = [
      'docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    [
      /implement active session patches now/i,
      /implement active session complete now/i,
      /implement active session discard now/i,
      /replace localStorage with API/i,
      /make API source of truth/i,
      /deploy production backend/i,
      /enable auth/i,
      /enable sync/i,
    ].forEach((pattern) => expect(docs).not.toMatch(pattern));
  });
});
