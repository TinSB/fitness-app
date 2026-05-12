import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/AUTH_BOUNDARY_ACCOUNT_MODEL_PLAN.md';

describe('auth boundary account model plan', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Auth Boundary Account Model Plan',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Account Identity',
      '## Local User to Account Mapping',
      '## Account Creation',
      '## Account Deletion',
      '## Export / Delete Responsibilities',
      '## Token / Session Requirements',
      '## Auth Failure Behavior',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers required account model topics', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'account identity',
      'local anonymous identity',
      'local user to account mapping',
      'account deletion',
      'export',
      'delete',
      'token/session',
      'auth failure',
      'localStorage fallback',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no auth runtime implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not auth runtime implementation.',
      'This is not login/signup implementation.',
      'This is not token/session handling implementation.',
      'This is not OAuth implementation.',
      'This is not user table implementation.',
      'No local data is linked to an account in Task 6.12.',
      'do not implement auth runtime yet',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.13', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`localStorage` remains default runtime source',
      '`api-primary-dev` remains explicit dev/local only',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'Task 6.13 Auth Provider Adapter Skeleton V1',
      'type/interface-only',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
