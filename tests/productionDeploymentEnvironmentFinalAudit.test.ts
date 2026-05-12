import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_DEPLOYMENT_ENVIRONMENT_FINAL_AUDIT.md';

describe('production deployment environment final audit', () => {
  it('documents required final audit sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Deployment Environment Final Audit',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Environments',
      '## Secrets',
      '## Branch Rules and Required Checks',
      '## Rollback',
      '## Preview vs Production Distinction',
      '## No Deployment If Not Implemented',
      '## Route and Source-of-truth Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers deployment and environment audit requirements', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'local, development, staging, and production',
      'Secret values must not be committed',
      'Required PR check remains GitHub Actions `IronPath Validation`',
      'gh pr checks <PR_NUMBER> --required --watch',
      'Optional Vercel checks must not block merge',
      'Never use `--admin`',
      'Never bypass branch protection',
      'Preview deployments, if present, are optional',
      'record `not implemented` and must not deploy production',
      'Task 6.36 Production Monitoring & Logging Privacy Lock V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
