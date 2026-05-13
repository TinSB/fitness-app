import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE10_PRODUCTION_AUTH_CLOUD_SYNC_DEPLOYMENT_ENTRY_GATE.md';

describe('phase 10 production auth cloud sync deployment entry gate', () => {
  it('documents Phase 9 completion evidence and validation baseline', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 9.12 Phase 9 Completion Archive V1',
      'Pull request: #188',
      '`af71c0c41e9034907ac5a32e2b7fb36de4feb492`',
      '`npm run api:dev:build` passed',
      '`npm run typecheck` passed',
      '`npm test` passed with 961 files and 3726 tests',
      '`npm run build` passed',
      'dist token scan clean',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records Phase 9 result and authorizes only guarded Phase 10 categories', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'cutover entry gate',
      'backend-primary host boundary',
      'AppData repository candidate',
      'migration dry run',
      'read candidate',
      'mutation candidate',
      'runtime switch guard',
      'fallback/rollback/emergency restore',
      'confirmation safety copy',
      'manual acceptance',
      'regression lock',
      'user identity/data ownership contract',
      'auth provider strategy decision',
      'disabled auth runtime skeleton',
      'account-scoped AppData boundary',
      'cloud sync strategy/conflict policy',
      'disabled cloud sync skeleton',
      'secrets/environment guard',
      'deployment target architecture decision',
      'disabled deployment runtime skeleton',
      'monitoring/audit event boundary',
      'privacy/data safety manual acceptance',
      'cloud production regression lock',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(doc).toContain('Backend-primary candidate remains explicit opt-in and reversible.');
  });

  it('blocks real cloud production implementation and recommends Task 10.2 only after merge', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'real auth provider integration',
      'real login/signup UI or runtime',
      'real user accounts runtime',
      'real cloud sync runtime',
      'production deployment runtime',
      'external monitoring or analytics upload',
      'SaaS/multi-user runtime',
      'provider SDK dependency',
      'secrets in the browser bundle',
      'Recommended next task: Task 10.2 User Identity & Data Ownership Contract V1.',
      'Task 10.2 is not part of Task 10.1.',
      'Auto-continue mode may begin Task 10.2 only after Task 10.1 is fully merged.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
