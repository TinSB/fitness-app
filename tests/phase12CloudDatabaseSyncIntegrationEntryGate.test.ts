import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 12 cloud database sync integration entry gate', () => {
  it('records Phase 11 completion evidence and validation', () => {
    const doc = readSource('docs/PHASE12_CLOUD_DATABASE_SYNC_INTEGRATION_ENTRY_GATE.md');

    for (const expected of [
      'Task 11.11 Phase 11 Completion Archive V1 completed in PR #213.',
      '407f2b993b1208c0098e49040b324706e4005637',
      '`npm run api:dev:build`',
      '`npm run typecheck`',
      '`npm test`: 992 files / 3892 tests',
      '`npm run build`',
      'dist token scan clean',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('confirms Phase 11 delivered auth candidate boundaries without cloud production runtime', () => {
    const doc = readSource('docs/PHASE12_CLOUD_DATABASE_SYNC_INTEGRATION_ENTRY_GATE.md');

    for (const expected of [
      'Supabase Auth candidate decision',
      'Auth environment and callback guard',
      'Provider-candidate adapter',
      'Auth session boundary',
      'Login/logout candidate UI',
      'Local account linking dry run',
      'Account-scoped backend-primary auth candidate',
      'Auth failure/emergency local mode',
      'Phase 11 did not implement real cloud sync',
      'production deployment runtime',
      'external monitoring upload',
      'SaaS/multi-user runtime',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('authorizes only guarded Phase 12 candidate categories', () => {
    const doc = readSource('docs/PHASE12_CLOUD_DATABASE_SYNC_INTEGRATION_ENTRY_GATE.md');

    for (const expected of [
      'Cloud database provider and architecture decision',
      'Supabase environment/project guard',
      'Cloud AppData data model strategy',
      'RLS/ownership policy plan',
      'Supabase client dependency authorization',
      'Supabase client adapter candidate',
      'Account-scoped cloud AppData repository candidate',
      'Local-to-cloud migration dry run',
      'Cloud read/pull candidate',
      'Cloud write/push candidate',
      'Manual conflict resolution candidate',
      'Cloud operation journal and idempotency candidate',
      'Cloud fallback/rollback/emergency local mode',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 12.2 only after merge', () => {
    const doc = readSource('docs/PHASE12_CLOUD_DATABASE_SYNC_INTEGRATION_ENTRY_GATE.md');

    expect(doc).toContain('Recommended next task: Task 12.2 Cloud Database Provider & Architecture Decision V1.');
    expect(doc).toContain('Task 12.2 is not part of Task 12.1.');
  });
});
