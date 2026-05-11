import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('active session UX docs parity', () => {
  it('records Task 4.58 across contract, refactor, source snapshot, and manual docs', () => {
    expect(readSource('API_CONTRACT.md')).toMatch(/Task 4\.58:? Active Session UX Confirmation & Rollback Plan V1/);
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.58: Active Session UX Confirmation & Rollback Plan V1');
    expect(readSource('docs/ACTIVE_SESSION_SOURCE_SNAPSHOT_IDEMPOTENCY_PLAN.md')).toContain('Task 4.58 Active Session UX Confirmation & Rollback Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.58 Active Session UX Confirmation & Rollback Plan');
  });

  it('keeps the current three-route allowlist and active-session routes blocked', () => {
    const docs = [
      'docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
    ].forEach((route) => expect(docs).toContain(route));

    expect(docs).toContain('No active-session route is implemented');
    expect(docs).toContain('POST /sessions/start');
    expect(docs).toContain('POST /sessions/active/patches');
    expect(docs).toContain('POST /sessions/active/complete');
    expect(docs).toContain('POST /sessions/active/discard');
  });

  it('documents confirmation, rollback, no-fake-success, and source-of-truth boundaries', () => {
    const doc = readSource('docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md');

    expect(doc).toContain('explicit user confirmation');
    expect(doc).toContain('pending');
    expect(doc).toContain('rollback');
    expect(doc).toContain('no automatic retry');
    expect(doc).toMatch(/no optimistic success/i);
    expect(doc).toContain('localStorage remains source of truth');
    expect(doc).toContain('API results never overwrite AppData or localStorage');
    expect(doc).toMatch(/disable `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT`/i);
  });

  it('does not instruct production readiness, source-of-truth migration, or implementation now', () => {
    const docs = [
      'docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    [
      /production-ready active-session backend/i,
      /enable session mutation now/i,
      /implement POST \/sessions\/start now/i,
      /replace localStorage with API/i,
      /make API source of truth/i,
      /enable auth/i,
      /enable sync/i,
      /deploy production backend/i,
    ].forEach((pattern) => expect(docs).not.toMatch(pattern));
  });
});
