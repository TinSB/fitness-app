import { describe, expect, it } from 'vitest';
import {
  createSupabaseBrowserSafeProjectConfig,
  resolveSupabaseEnvironmentProjectGuard,
} from '../src/cloudProduction/supabaseEnvironmentProjectGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('supabase environment project guard', () => {
  it('is disabled by default and emits browser-safe config', () => {
    expect(resolveSupabaseEnvironmentProjectGuard()).toMatchObject({
      ok: false,
      enabled: false,
      environment: 'disabled',
      anonKeyClassified: 'missing',
      serviceRoleBrowserSafe: false,
      errors: [{ code: 'supabase_disabled' }],
    });
    expect(createSupabaseBrowserSafeProjectConfig({
      projectUrl: 'https://project.supabase.co',
      anonKey: 'synthetic-anon-key',
    })).toEqual({
      enabled: false,
      projectUrl: 'https://project.supabase.co',
      anonKeyClassified: 'public_anon_candidate',
      serviceRoleExposed: false,
      containsSecrets: false,
    });
  });

  it('accepts only explicit safe production candidate config', () => {
    expect(resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'production',
      projectUrl: 'https://project.supabase.co',
      anonKey: 'synthetic-anon-key',
      browserConfig: { publicMode: 'candidate' },
    })).toEqual({
      ok: true,
      enabled: true,
      environment: 'production',
      projectUrl: 'https://project.supabase.co',
      anonKeyClassified: 'public_anon_candidate',
      serviceRoleBrowserSafe: false,
      browserSafeConfig: {
        enabled: false,
        projectUrl: 'https://project.supabase.co',
        anonKeyClassified: 'public_anon_candidate',
        serviceRoleExposed: false,
        containsSecrets: false,
      },
      errors: [],
    });
  });

  it('rejects missing and invalid project config', () => {
    expect(resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'production',
    }).errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'project_url_missing',
      'anon_key_missing',
    ]));

    expect(resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'production',
      projectUrl: 'http://project.supabase.co',
      anonKey: 'synthetic-anon-key',
    })).toMatchObject({
      ok: false,
      errors: [{ code: 'project_url_invalid' }],
    });
  });

  it('rejects localhost preview and service role exposure', () => {
    expect(resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'production',
      projectUrl: 'https://localhost',
      anonKey: 'synthetic-anon-key',
    }).errors.map((item) => item.code)).toContain('localhost_not_production');

    expect(resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'preview',
      projectUrl: 'https://branch-preview.vercel.app',
      anonKey: 'synthetic-anon-key',
    }).errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'preview_not_production',
      'config_incomplete',
    ]));

    expect(resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'production',
      projectUrl: 'https://project.supabase.co',
      anonKey: 'synthetic-anon-key',
      serviceRoleKeyPresent: true,
    })).toMatchObject({
      ok: false,
      errors: [{ code: 'service_role_not_browser_safe' }],
    });
  });

  it('rejects sensitive browser config keys without echoing values', () => {
    const result = resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'production',
      projectUrl: 'https://project.supabase.co',
      anonKey: 'synthetic-anon-key',
      browserConfig: {
        publicMode: 'candidate',
        serviceRoleValue: 'synthetic-secret-value',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: 'secret_exposed_to_browser' }],
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-value');
  });

  it('does not import SDKs read env files call networks or expose secrets', () => {
    const source = readSource('src/cloudProduction/supabaseEnvironmentProjectGuard.ts');

    for (const forbidden of [
      '@supabase',
      'supabase-js',
      'fetch(',
      'XMLHttpRequest',
      'process.env',
      '.env',
      '/auth',
      '/account',
      'serviceWorker',
      'backgroundSync',
      'syncQueue',
      'polling',
      'timer',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents guard boundaries and next task', () => {
    const doc = readSource('docs/SUPABASE_ENVIRONMENT_PROJECT_GUARD.md');

    for (const expected of [
      'Task 12.3 Supabase Environment / Project Guard V1',
      'disabled by default',
      'service role key must never enter browser-safe config',
      'No Supabase SDK is installed or imported.',
      'No real environment file is read in tests.',
      'Recommended next task: Task 12.4 Cloud AppData Data Model Strategy V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
