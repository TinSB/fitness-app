import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/DEPLOYMENT_ENVIRONMENT_SECRETS_STRATEGY.md';

describe('deployment environment secrets strategy', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Deployment Environment Secrets Strategy',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Environment Strategy',
      '## Secrets Storage',
      '## Environment Variables',
      '## Branch Rules and Required Checks',
      '## Vercel Optional Boundary',
      '## Rollback Strategy',
      '## Real Data Safety',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers required deployment and environment strategy topics', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'local',
      'dev',
      'staging',
      'production',
      'secrets storage',
      'environment variable',
      'branch protection',
      'IronPath Validation',
      'Vercel',
      'rollback',
      'no production deployment',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no deployment, secret, or production runtime implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not production deployment implementation.',
      'This is not hosted production configuration.',
      'This is not secrets runtime implementation.',
      'Task 6.6 does not add `.env` files',
      'Task 6.6 adds no Vercel production deployment',
      'do not implement production deployment',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.7', () => {
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
      'Task 6.7 Production Migration, Backup & Rollback Strategy V1',
      'Task 6.7 must be docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
