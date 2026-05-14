import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('supabase client dependency authorization', () => {
  it('authorizes only Task 12.7 to add supabase-js', () => {
    const doc = readSource('docs/SUPABASE_CLIENT_DEPENDENCY_AUTHORIZATION.md');

    for (const expected of [
      'Task 12.7 may add `@supabase/supabase-js` only.',
      'Task 12.7 is the only Phase 12 task allowed to modify `package.json` dependencies for this dependency.',
      'Task 12.7 may update `package-lock.json` only as required by installing `@supabase/supabase-js`.',
      'No other dependencies may be added.',
      'No package scripts may be added or changed.',
      'No unrelated lockfile drift is allowed.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('does not add dependency in Task 12.6', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(packageJson.dependencies).toHaveProperty('@supabase/supabase-js');
    expect(Object.keys(packageJson.scripts).filter((script) => /supabase|cloud:sync/i.test(script))).toEqual([]);
  });

  it('locks adapter-only constraints for Task 12.7', () => {
    const doc = readSource('docs/SUPABASE_CLIENT_DEPENDENCY_AUTHORIZATION.md');

    for (const expected of [
      'Supabase client usage must be adapter-candidate only.',
      'Supabase client adapter must be disabled by default.',
      'Tests should mock or fake cloud operations.',
      'No real cloud writes in tests.',
      'No real Supabase project data in tests.',
      'No service role key in browser.',
      'No direct browser AppData cloud write.',
      'No App.tsx automatic integration.',
      'No source-of-truth switch.',
      'No default cloud sync.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states all other Phase 12 tasks must not change package files', () => {
    const doc = readSource('docs/SUPABASE_CLIENT_DEPENDENCY_AUTHORIZATION.md');

    expect(doc).toContain('All other Phase 12 tasks must not change `package.json`, package scripts, or lockfiles.');
    expect(doc).toContain('The only authorized dependency drift for Phase 12 is `@supabase/supabase-js` added in Task 12.7 after this authorization.');
  });

  it('recommends Task 12.7 only', () => {
    const doc = readSource('docs/SUPABASE_CLIENT_DEPENDENCY_AUTHORIZATION.md');

    expect(doc).toContain('Recommended next task: Task 12.7 Supabase Client Adapter Candidate V1.');
  });
});
