import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/DEPLOYMENT_RUNTIME_STRATEGY_STAGING_PLAN.md';

describe('deployment runtime strategy staging plan', () => {
  it('documents required deployment and staging sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Deployment Runtime Strategy Staging Plan',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Staging vs Production',
      '## Preview Deployments',
      '## Rollback Strategy',
      '## Deployment Boundaries',
      '## Route and Source-of-truth Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('keeps deployment planning explicit and non-runtime', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is docs/static tests only.',
      'This is not production deployment implementation.',
      'Task 6.22 does not create staging, production, preview, or hosted runtime.',
      'No production deployment is implemented.',
      'No hosted production runtime is implemented.',
      'No deployment config is added.',
      'No secret values are added.',
      'No production source-of-truth switch is approved.',
      'Task 6.23 Secrets & Environment Validation Skeleton V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents required check policy and optional preview behavior', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Preview deployments may remain optional for Codex PRs.',
      'IronPath Validation',
      'gh pr checks <PR_NUMBER> --required --watch',
      'Optional Vercel checks must not block merge if GitHub allows normal squash merge.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
