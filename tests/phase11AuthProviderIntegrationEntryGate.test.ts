import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE11_AUTH_PROVIDER_INTEGRATION_ENTRY_GATE.md';

describe('phase 11 auth provider integration entry gate', () => {
  it('documents Phase 10 completion evidence and validation baseline', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 10.14 Phase 10 Completion Archive V1',
      'Pull request: #202',
      '`2643473aa794729ecd0457bf46f7b82af586213b`',
      '`npm run api:dev:build` passed',
      '`npm run typecheck` passed',
      '`npm test` passed with 979 files and 3812 tests',
      '`npm run build` passed',
      'dist token scan clean',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records Phase 10 result and authorizes only guarded Phase 11 categories', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'auth/cloud/deployment entry gate',
      'identity ownership contract',
      'adapter-first auth strategy',
      'disabled auth skeleton',
      'account-scoped AppData boundary',
      'cloud sync policy and disabled skeleton',
      'secrets/environment guard',
      'deployment decision and disabled skeleton',
      'monitoring/audit boundary',
      'privacy manual acceptance',
      'auth provider final decision',
      'auth environment/callback guard',
      'auth adapter provider candidate',
      'auth session boundary',
      'login/logout candidate UI',
      'local account linking dry run',
      'account-scoped backend-primary auth candidate',
      'auth failure/logout/emergency local mode',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents provider candidate direction and blocks production expansion', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Supabase Auth',
      'Clerk remains the backup candidate',
      'Auth.js and custom auth are not preferred now',
      'real provider SDK dependency',
      'real cloud sync',
      'production deployment runtime',
      'external monitoring upload',
      'SaaS/multi-user runtime',
      'Recommended next task: Task 11.2 Auth Provider Final Decision V1.',
      'Task 11.2 is not part of Task 11.1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
