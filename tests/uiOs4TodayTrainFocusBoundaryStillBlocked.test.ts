import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS 4 Today Train Focus redesign boundary lock', () => {
  const docPath = 'docs/UI_OS_4_TODAY_TRAIN_FOCUS_REDESIGN.md';

  it('documents baseline, scope, validation evidence, and next task boundary', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = read(docPath);

    for (const expected of [
      'UI-OS 4',
      'Today / Train / Focus Mode Redesign',
      'PR #275',
      '5e1a76fb173d79439f61cf235ab886dffa093a0f',
      '1104 files / 4504 tests',
      'TodayView',
      'TrainingFocusView',
      'TrainingView',
      'Bench Press warmup theoretical 17 lb still resolves to empty Olympic bar 45 lb',
      'UI-OS 5 is not started by UI-OS 4',
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

  it('documents blocked source-of-truth, route, cloud, package, and lockfile boundaries', () => {
    const doc = read(docPath);
    for (const expected of [
      'localStorage remains default/fallback/migration/emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'accepted browser mutation routes remain exactly seven.',
      'blocked repair/reset/import/export HTTP routes remain blocked.',
      'no default cloud sync.',
      'no background sync.',
      'no new package/dependency/script/lockfile drift',
      'pnpm-lock.yaml remains absent',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps redesigned source free of storage network Supabase backend and Node-only imports', () => {
    const combined = [
      read('src/uiOs/training/TrainingOsCards.tsx'),
      read('src/features/TodayView.tsx'),
      read('src/features/TrainingFocusView.tsx'),
      read('src/features/TrainingView.tsx'),
    ].join('\n');

    for (const forbidden of [
      'localStorage.setItem',
      'sessionStorage.setItem',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '@supabase',
      'node:fs',
      'node:path',
      '/data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'cloud:sync',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it('keeps package files and pnpm lock state unchanged in scope', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string>; dependencies?: Record<string, string> };
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.dependencies || {}).not.toHaveProperty('playwright');
    expect(existsSync('pnpm-lock.yaml')).toBe(false);
  });
});
