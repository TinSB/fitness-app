import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE9_PRODUCTION_SOURCE_OF_TRUTH_CUTOVER_ENTRY_GATE.md';

describe('phase 9 production source-of-truth cutover entry gate', () => {
  it('documents Phase 8 completion evidence and validation baseline', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 8.14 Phase 8 Completion Archive V1',
      'Pull request: #176',
      '`445ba77e323363b2fb55bb216104981a70ca6f78`',
      '`npm run api:dev:build` passed',
      '`npm run typecheck` passed',
      '`npm test` passed with 945 files and 3657 tests',
      '`npm run build` passed',
      'dist token scan clean',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records Phase 8 result and authorizes only guarded Phase 9 categories', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Node-only runtime skeleton boundary',
      'config guard',
      'health/capability handlers',
      'persistence adapter boundary',
      'read contract',
      'disabled frontend API client skeleton',
      'diagnostic dual-read comparison',
      'mutation guard',
      'write shadow mode',
      'backend-primary runtime host boundary',
      'backend AppData repository candidate',
      'cutover data migration dry run',
      'backend-primary read candidate',
      'backend-primary mutation candidate',
      'frontend source-of-truth runtime switch guard',
      'fallback / rollback / emergency restore',
      'cutover confirmation UX / safety copy',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(doc).toContain('Backend-primary candidate mode must remain explicit opt-in, reversible, and disabled by default.');
  });

  it('blocks production expansion and recommends Task 9.2 only after merge', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'auth runtime',
      'user accounts runtime',
      'cloud sync runtime',
      'deployment runtime',
      'monitoring runtime',
      'SaaS/multi-user runtime',
      'backend-primary as automatic default source',
      'api-primary-dev production promotion',
      'devApiRunner production deployment',
      'node:sqlite snapshot repository as production multi-user database',
      'Recommended next task: Task 9.2 Backend-Primary Runtime Host Boundary V1.',
      'Task 9.2 is not part of Task 9.1.',
      'Auto-continue mode may begin Task 9.2 only after Task 9.1 is fully merged.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
