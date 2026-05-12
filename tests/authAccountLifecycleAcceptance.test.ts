import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAuthProviderAdapterSkeleton } from '../src/auth/authBoundary';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/AUTH_ACCOUNT_LIFECYCLE_ACCEPTANCE.md';

describe('auth account lifecycle acceptance', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Auth Account Lifecycle Acceptance',
      '## Scope / Non-goals',
      '## Accepted Auth Skeleton Baseline',
      '## No Login / Signup Runtime',
      '## No Token / Session Runtime',
      '## Account Lifecycle Gates',
      '## Deletion / Export Policy',
      '## Identity Mismatch Prevention',
      '## Route and Source-of-truth Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('accepts only unavailable auth skeleton behavior', () => {
    expect(createAuthProviderAdapterSkeleton().resolveCurrentIdentity()).toEqual({
      ok: false,
      status: 'not-implemented',
      reason: 'auth_runtime_not_implemented',
      message: 'Auth provider adapter skeleton is type-only and has no runtime sign-in flow.',
    });
  });

  it('locks lifecycle gates, deletion/export, and identity mismatch prevention', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'account creation',
      'local data linking',
      'account deletion',
      'export-before-delete',
      'backup retention',
      'audit retention',
      'identity mismatch',
      'wrong account',
      'no fake success',
      'no silent localStorage overwrite',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.15', () => {
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
      'Task 6.15 Production Storage Schema Strategy V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
