import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE6_HANDOFF_PLAN.md';

describe('Phase 6 handoff plan', () => {
  it('exists and contains required handoff sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 6 Handoff Plan',
      '## Scope / Non-goals',
      '## Phase 5 Final State',
      '## Production Backend Prerequisites',
      '## Auth And User Account Prerequisites',
      '## Cloud Sync Prerequisites',
      '## Deployment Prerequisites',
      '## Monitoring And Operations Prerequisites',
      '## Privacy And Security Prerequisites',
      '## Still Blocked At Phase 5 Exit',
      '## Phase 6 Entry Gate',
      '## Recommended Phase 6 First Task',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers production backend, auth, users, sync, deployment, monitoring, privacy, and security', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'production backend',
      'auth',
      'user accounts',
      'cloud sync',
      'deployment',
      'monitoring',
      'privacy',
      'security',
      'personal training data',
      'Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records Phase 5 final runtime modes, routes, and next Phase 5 task', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'localStorage',
      'api-readonly',
      'api-primary-dev',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'Task 5.41 Phase 5 Completion Archive V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
