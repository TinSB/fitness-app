import { describe, expect, it } from 'vitest';
import { resolveSupabaseEnvironmentProjectGuard } from '../src/cloudProduction/supabaseEnvironmentProjectGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 12 browser cloud secret isolation lock', () => {
  it('rejects service role key from browser-safe Supabase config', () => {
    expect(resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'production',
      projectUrl: 'https://project.supabase.co',
      anonKey: 'synthetic-anon-key',
      serviceRoleKeyPresent: true,
    })).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'service_role_not_browser_safe' }),
      ]),
      browserSafeConfig: {
        serviceRoleExposed: false,
        containsSecrets: false,
      },
    });
  });

  it('keeps browser-safe config free of secret values', () => {
    const result = resolveSupabaseEnvironmentProjectGuard({
      enabled: true,
      environment: 'production',
      projectUrl: 'https://project.supabase.co',
      anonKey: 'synthetic-anon-key',
    });

    expect(result.browserSafeConfig).toEqual({
      enabled: false,
      projectUrl: 'https://project.supabase.co',
      anonKeyClassified: 'public_anon_candidate',
      serviceRoleExposed: false,
      containsSecrets: false,
    });
    expect(JSON.stringify(result.browserSafeConfig)).not.toContain('synthetic-anon-key');
  });

  it('keeps cloud production browser source free of service role literals', () => {
    for (const path of [
      'src/cloudProduction/supabaseEnvironmentProjectGuard.ts',
      'src/cloudProduction/supabaseClientAdapterCandidate.ts',
      'src/cloudProduction/cloudAppDataRepositoryCandidate.ts',
    ]) {
      const source = readSource(path);
      expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(source).not.toContain('service_role=');
      expect(source).not.toContain('process.env');
    }
  });
});
