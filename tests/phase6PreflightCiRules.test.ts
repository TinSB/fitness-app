import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('Phase 6 preflight CI and ruleset boundary', () => {
  it('documents required check and merge policy', () => {
    const docs = [
      'docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md',
      'docs/PHASE6_HANDOFF_PLAN.md',
      'docs/PHASE5_COMPLETION_ARCHIVE.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    for (const expected of [
      'IronPath Validation',
      'gh pr checks <PR_NUMBER> --required --watch',
      'Optional Vercel checks must not block merge if GitHub allows normal squash merge',
      'Never use `--admin`',
      'Never bypass branch protection',
      'IronPath Validation failure blocks merge',
    ]) {
      expect(docs).toContain(expected);
    }
  });
});
