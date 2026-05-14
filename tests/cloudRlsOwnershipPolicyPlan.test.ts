import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('cloud RLS ownership policy plan', () => {
  it('defines ownership fields', () => {
    const doc = readSource('docs/CLOUD_RLS_OWNERSHIP_POLICY_PLAN.md');

    for (const expected of [
      'account_id',
      'owner_user_id',
      'device_owner_id',
      'local_owner_id',
      'cloud_account_owner',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('defines read write delete emergency service role and anonymous local policy intent', () => {
    const doc = readSource('docs/CLOUD_RLS_OWNERSHIP_POLICY_PLAN.md');

    for (const expected of [
      'Read policy: a user can read only their own cloud AppData.',
      'Write policy: a user can write only their own cloud AppData.',
      'Delete policy: deletion is blocked until a later explicit data lifecycle phase.',
      'Emergency restore policy: local emergency restore remains local and does not require cloud.',
      'Service role safety: service role never enters browser.',
      'Anonymous local data rule: anonymous local data cannot auto-upload.',
      'Owner mismatch must reject.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('marks SQL as draft only and not applied', () => {
    const doc = readSource('docs/CLOUD_RLS_OWNERSHIP_POLICY_PLAN.md');

    expect((doc.match(/DRAFT ONLY \/ NOT APPLIED/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(doc).toContain('These notes are intentionally not executable migration files.');
  });

  it('keeps runtime package schema and migration changes absent', () => {
    const doc = readSource('docs/CLOUD_RLS_OWNERSHIP_POLICY_PLAN.md');
    const packageJson = JSON.parse(readSource('package.json')) as { dependencies: Record<string, string> };

    expect(packageJson.dependencies).not.toHaveProperty('@supabase/supabase-js');
    for (const expected of [
      'Applying SQL',
      'Adding database migrations',
      'Creating cloud tables',
      'Adding Supabase dependency in this task',
      'Browser service role usage',
      'Anonymous local auto-upload',
      'Default cloud sync',
      'Background sync',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 12.6 only', () => {
    const doc = readSource('docs/CLOUD_RLS_OWNERSHIP_POLICY_PLAN.md');

    expect(doc).toContain('Recommended next task: Task 12.6 Supabase Client Dependency Authorization V1.');
  });
});
