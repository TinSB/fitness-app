import { describe, expect, it } from 'vitest';
import { createSupabaseClientAdapterCandidate } from '../src/cloudProduction/supabaseClientAdapterCandidate';
import { resolveSupabaseEnvironmentProjectGuard } from '../src/cloudProduction/supabaseEnvironmentProjectGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

const safeGuard = () => resolveSupabaseEnvironmentProjectGuard({
  enabled: true,
  environment: 'production',
  projectUrl: 'https://project.supabase.co',
  anonKey: 'synthetic-anon-key',
});

describe('supabase client adapter candidate', () => {
  it('is disabled by default', () => {
    const adapter = createSupabaseClientAdapterCandidate();

    expect(adapter).toMatchObject({
      status: 'disabled',
      enabled: false,
      clientCreated: false,
      serviceRoleExposed: false,
      sourceOfTruthChanged: false,
    });
    expect(adapter.readCandidate()).toMatchObject({
      ok: false,
      status: 'disabled',
      errorCode: 'adapter_disabled',
      networkAttempted: false,
      localDataChanged: false,
      sourceOfTruthChanged: false,
    });
  });

  it('fails closed on missing or unsafe config', () => {
    expect(createSupabaseClientAdapterCandidate({ enabled: true }).readCandidate()).toMatchObject({
      ok: false,
      status: 'config_missing',
      errorCode: 'project_guard_missing',
    });

    const unsafe = resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'production',
      projectUrl: 'http://localhost:54321',
      anonKey: 'synthetic-anon-key',
    });
    expect(createSupabaseClientAdapterCandidate({
      enabled: true,
      projectGuard: unsafe,
      anonKeyCandidate: 'synthetic-anon-key',
    }).writeCandidate({ value: 'synthetic' })).toMatchObject({
      ok: false,
      status: 'unsafe_config',
      errorCode: 'project_guard_rejected',
    });
  });

  it('rejects missing anon key and service role presence', () => {
    expect(createSupabaseClientAdapterCandidate({
      enabled: true,
      projectGuard: safeGuard(),
    }).readCandidate()).toMatchObject({
      ok: false,
      status: 'config_missing',
      errorCode: 'anon_key_missing',
    });

    expect(createSupabaseClientAdapterCandidate({
      enabled: true,
      projectGuard: safeGuard(),
      anonKeyCandidate: 'synthetic-anon-key',
      serviceRoleKeyPresent: true,
    }).readCandidate()).toMatchObject({
      ok: false,
      status: 'unsafe_config',
      errorCode: 'service_role_rejected',
    });
  });

  it('creates a client candidate without unit-test network operations', () => {
    let factoryCalled = false;
    const adapter = createSupabaseClientAdapterCandidate({
      enabled: true,
      projectGuard: safeGuard(),
      anonKeyCandidate: 'synthetic-anon-key',
      clientFactory: (projectUrl, anonKey) => {
        factoryCalled = projectUrl === 'https://project.supabase.co' && anonKey === 'synthetic-anon-key';
        return {} as never;
      },
      mockRead: () => ({
        ok: true,
        status: 'read_candidate',
        data: { snapshotId: 'synthetic-snapshot' },
        networkAttempted: false,
        serviceRoleExposed: false,
        localDataChanged: false,
        sourceOfTruthChanged: false,
        message: 'Mocked read candidate.',
      }),
      mockWrite: (data) => ({
        ok: true,
        status: 'write_candidate',
        data,
        networkAttempted: false,
        serviceRoleExposed: false,
        localDataChanged: false,
        sourceOfTruthChanged: false,
        message: 'Mocked write candidate.',
      }),
    });

    expect(factoryCalled).toBe(true);
    expect(adapter).toMatchObject({
      status: 'ready_candidate',
      enabled: true,
      clientCreated: true,
    });
    expect(adapter.readCandidate()).toMatchObject({
      ok: true,
      status: 'read_candidate',
      networkAttempted: false,
      sourceOfTruthChanged: false,
    });
    expect(adapter.writeCandidate({ snapshotId: 'synthetic-write' })).toMatchObject({
      ok: true,
      status: 'write_candidate',
      data: { snapshotId: 'synthetic-write' },
      localDataChanged: false,
    });
  });

  it('requires mocked operations and does not fake success', () => {
    const adapter = createSupabaseClientAdapterCandidate({
      enabled: true,
      projectGuard: safeGuard(),
      anonKeyCandidate: 'synthetic-anon-key',
      clientFactory: () => ({} as never),
    });

    expect(adapter.readCandidate()).toMatchObject({
      ok: false,
      status: 'failed',
      errorCode: 'operation_not_mocked',
    });
    expect(adapter.writeCandidate({ snapshotId: 'synthetic' })).toMatchObject({
      ok: false,
      status: 'failed',
      errorCode: 'operation_not_mocked',
    });
  });

  it('keeps source free of automatic sync and route behavior', () => {
    const source = readSource('src/cloudProduction/supabaseClientAdapterCandidate.ts');
    const app = readSource('src/App.tsx');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'process.env',
      '/auth',
      '/account',
      '/sync',
      '/cloud',
      'backgroundSync',
      'serviceWorker',
      'syncQueue',
      'polling',
      'timer',
      'automaticWorker',
      'localStorage.setItem',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(app).not.toContain('supabaseClientAdapterCandidate');
  });

  it('documents adapter boundaries and next task', () => {
    const doc = readSource('docs/SUPABASE_CLIENT_ADAPTER_CANDIDATE.md');

    for (const expected of [
      'Task 12.7 Supabase Client Adapter Candidate V1',
      '`@supabase/supabase-js` is the only package dependency added in this task.',
      'disabled by default',
      'No real cloud writes in tests.',
      'No service role key in browser-safe config.',
      'No App.tsx automatic integration.',
      'No source-of-truth switch.',
      'Recommended next task: Task 12.8 Account-Scoped Cloud AppData Repository Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
