import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS 5 History Progress Data Health boundary lock', () => {
  const docPath = 'docs/UI_OS_5_HISTORY_PROGRESS_DATA_HEALTH_REDESIGN.md';

  it('documents baseline evidence redesign scope and next task boundary', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = read(docPath);
    for (const expected of [
      'UI-OS 5',
      'History / Progress / Data Health Redesign',
      'PR #276',
      '423630e96d9fa31344534ecd080bcd598ed3b5de',
      '1106 files / 4514 tests',
      'History',
      'Progress',
      'Data Health',
      'UI-OS 6 is not started by UI-OS 5',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps analytics calculations and Data Health repair semantics explicitly preserved', () => {
    const doc = read(docPath);
    for (const expected of [
      'PR calculations',
      'e1RM calculations',
      'effective-set calculations',
      'analytics engines',
      '`buildPrs`',
      '`buildE1RMProfile`',
      '`buildEffectiveVolumeSummary`',
      '`buildDataHealthViewModel`',
      'Data Health repair semantics',
      '`POST /data-health/repair/apply` remains blocked',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps accepted browser mutation routes exactly seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('keeps redesigned source free of routes cloud sync package and source-of-truth expansion', () => {
    const combined = [read('src/features/RecordView.tsx'), read('src/uiOs/records/RecordOsCards.tsx')].join('\n');
    for (const forbidden of [
      '/data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'cloud:sync',
      'SaaS 已上线',
      'localStorage.setItem',
      'fetch(',
      '@supabase',
      'node:fs',
      'node:path',
      'full AppData',
      '完整 AppData',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it('keeps package and lockfile boundary unchanged', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string>; dependencies?: Record<string, string> };
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.dependencies || {}).not.toHaveProperty('playwright');
    expect(existsSync('pnpm-lock.yaml')).toBe(false);
  });
});
