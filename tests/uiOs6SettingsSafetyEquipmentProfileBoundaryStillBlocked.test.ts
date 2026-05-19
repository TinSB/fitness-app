import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const read = (path: string) => readFileSync(path, 'utf8');
const docPath = 'docs/UI_OS_6_SETTINGS_SAFETY_EQUIPMENT_PROFILE_REDESIGN.md';

describe('UI-OS 6 Settings Safety Equipment Profile boundary lock', () => {
  const doc = read(docPath);
  const profileSource = read('src/features/ProfileView.tsx');
  const cardsSource = read('src/uiOs/settings/SettingsOsCards.tsx');
  const packageJson = read('package.json');

  it('documents UI-OS 5 baseline, scope, and next task state', () => {
    expect(existsSync(docPath)).toBe(true);
    for (const expected of [
      'UI-OS 6',
      'Settings / Safety / Equipment Profile Redesign',
      'PR #277',
      '5bb9f1b27a94732cc803724e96dd4835a9b39f5d',
      '1108 files / 4523 tests',
      'source-of-truth behavior',
      'persistence behavior',
      'UI-OS 7 is not started',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves exact accepted browser mutation route inventory', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    expect(doc).toContain('No eighth browser mutation route was added');
  });

  it('keeps blocked route and cloud boundaries documented', () => {
    for (const expected of [
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'POST /data-health/repair/apply',
      'no default cloud sync',
      'no background sync',
      'no production deployment auto-start',
      'no external monitoring upload',
      'no SaaS/multi-user runtime',
      'no destructive migration',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('does not add forbidden runtime behavior to the settings shell', () => {
    const combined = `${profileSource}\n${cardsSource}`;
    for (const forbidden of [
      '/data-health/repair/apply',
      'backup/import/export over HTTP route',
      'reset/recovery over HTTP route',
      'localStorage.setItem',
      'fetch(',
      '@supabase',
      'node:fs',
      'node:path',
      'automaticSyncEnabled',
      'backgroundSync',
      'cloudSyncWorker',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it('keeps package and lockfile boundaries static', () => {
    expect(packageJson).not.toContain('cloud:sync');
    expect(packageJson).not.toContain('deploy:production');
    expect(packageJson).not.toContain('monitoring:upload');
    expect(existsSync('pnpm-lock.yaml')).toBe(false);
  });
});
