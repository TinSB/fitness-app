import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md';

describe('auth user account lifecycle architecture gate', () => {
  it('exists and contains all required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Auth User Account Lifecycle Architecture Gate',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Lifecycle Actors And States',
      '## Anonymous Local User Boundary',
      '## Future Account Identity Boundary',
      '## Local Data To Account Linking',
      '## Account Creation Lifecycle',
      '## Account Deletion Lifecycle',
      '## Export / Delete Responsibilities',
      '## Auth Failure Behavior',
      '## Identity Mismatch Risk Register',
      '## Required Gates Before Auth Implementation',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('states architecture-only boundaries and no auth implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 6.3 is an auth and user account lifecycle architecture gate.',
      'This is docs/static tests only.',
      'This is not auth implementation.',
      'This is not login/signup implementation.',
      'This is not OAuth implementation.',
      'This is not token/session handling implementation.',
      'This is not user account runtime implementation.',
      'This does not add a user table.',
      'This does not add routes.',
      'This does not add dependencies, package scripts, or lockfile changes.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers required account lifecycle topics and baseline routes', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'anonymous local user',
      'future account identity',
      'local data to account linking',
      'account creation lifecycle',
      'account deletion lifecycle',
      'export/delete responsibilities',
      'auth failure behavior',
      'identity mismatch',
      '`localStorage` remains default runtime source',
      'localStorage fallback',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 6.4 as planning only', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 6.4 Production Backend & Database Architecture Decision V1');
    expect(doc).toContain('Task 6.4 must be planning/docs/static tests only.');
    expect(doc).toContain('Task 6.4 must not implement production backend, normalized schema, auth, sync, deployment, migration, or source-of-truth switching.');
  });
});
