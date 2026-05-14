import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 13 production deployment monitoring release hardening entry gate', () => {
  const doc = () => readSource('docs/PHASE13_PRODUCTION_DEPLOYMENT_MONITORING_RELEASE_HARDENING_ENTRY_GATE.md');

  it('verifies Phase 12 completion evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 12.18 Phase 12 Completion Archive V1',
      'Final Phase 12 PR: #231.',
      'c8c202724586bb0ba413ad8f62ca1eed11d18dfe',
      '`npm run api:dev:build`: passed.',
      '`npm run typecheck`: passed.',
      '`npm test`: passed, 1014 files / 4029 tests.',
      '`npm run build`: passed.',
      'Dist token scan: clean.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms Phase 12 additions and non-implemented production behavior', () => {
    const content = doc();

    for (const expected of [
      'Supabase DB candidate.',
      'Supabase client adapter candidate.',
      'Account-scoped cloud AppData repository.',
      'Cloud pull candidate.',
      'Cloud push candidate.',
      'Default cloud sync.',
      'Background sync.',
      'Production deployment runtime.',
      'External monitoring upload.',
      'SaaS/multi-user runtime.',
      'Real personal training data.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('authorizes only guarded Phase 13 categories and recommends Task 13.2', () => {
    const content = doc();

    for (const expected of [
      'Environment matrix / release channel policy.',
      'Production deployment config guard.',
      'Backend deployment package boundary.',
      'Monitoring/audit adapter candidate.',
      'Diagnostics/incident snapshot.',
      'Rollback/kill switch.',
      'Phase 13 archive.',
      'Recommended next task: Task 13.2 Environment Matrix & Release Channel Policy V1.',
      'Task 13.2 is not part of Task 13.1.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
