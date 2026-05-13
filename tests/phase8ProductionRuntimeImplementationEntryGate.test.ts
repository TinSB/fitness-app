import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE8_PRODUCTION_RUNTIME_IMPLEMENTATION_ENTRY_GATE.md';

describe('phase 8 production runtime implementation entry gate', () => {
  it('documents Phase 7 completion evidence and validation baseline', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 7.10 Phase 7 Completion Archive V1',
      'Pull request: #162',
      '`934b79c47029943c3c34a53d8c044e34a10c3aa3`',
      '`npm run api:dev:build` passed',
      '`npm run typecheck` passed',
      '`npm test` passed with 926 files and 3591 tests',
      '`npm run build` passed',
      'dist token scan clean',
      'Phase 7 stayed within authorization, planning, guard, readiness, and archive scope.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('authorizes only narrow Phase 8 implementation categories', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Node-only production runtime skeleton boundary',
      'production runtime config guard',
      'health/capability route-like handling',
      'production persistence adapter interface',
      'minimal read contract implementation',
      'disabled-by-default frontend production API client',
      'diagnostic-only dual-read comparison',
      'production mutation contract guard',
      'write shadow mode that is not source-of-truth',
      'boundary regression tests',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(doc).toContain('Authorization is limited to explicit Task 8.x scopes.');
  });

  it('blocks full production capabilities and recommends Task 8.2 only after merge', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'full production backend',
      'auth runtime',
      'user accounts runtime',
      'cloud sync runtime',
      'deployment runtime',
      'monitoring runtime',
      'production source-of-truth switch',
      'api-primary-dev production promotion',
      'devApiRunner production deployment',
      'node:sqlite snapshot repository as production multi-user database',
      'eighth browser mutation route',
      'Recommended next task: Task 8.2 Production Runtime Skeleton Boundary V1.',
      'Task 8.2 is not part of Task 8.1.',
      'Auto-continue mode may begin Task 8.2 only after Task 8.1 is fully merged.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
