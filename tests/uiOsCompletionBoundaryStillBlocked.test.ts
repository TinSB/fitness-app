import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const doc = readFileSync('docs/UI_OS_COMPLETION_ARCHIVE.md', 'utf8');
const packageJson = readFileSync('package.json', 'utf8');

describe('UI-OS completion boundary still blocked', () => {
  it('confirms source-of-truth training and persistence boundaries', () => {
    for (const expected of [
      'No source-of-truth behavior changed',
      'No training algorithm changed',
      'No warmup algorithm changed directly',
      'No PR / e1RM / effective-set calculation changed',
      'No persistence behavior changed',
      'No AppData schema changed',
      'No stored workout history was mutated',
      'No destructive migration happened',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('confirms cloud deployment SaaS and route boundaries', () => {
    for (const expected of [
      'no default cloud sync',
      'no background sync',
      'no automatic sync worker/timer/polling sync',
      'no production deployment auto-start',
      'no external monitoring upload',
      'no SaaS/multi-user runtime',
      'no billing/public onboarding',
      'blocked repair/reset/import/export HTTP routes remain blocked',
      'POST /data-health/repair/apply',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps exact accepted browser mutation routes at seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    expect(doc).toContain('accepted browser mutation routes remain exactly seven');
  });

  it('confirms package and lockfile boundaries', () => {
    expect(doc).toContain('No package/script/lockfile drift occurred');
    expect(doc).toContain('pnpm-lock.yaml');
    expect(doc).toContain('package-lock.json');
    expect(packageJson).not.toContain('cloud:sync');
    expect(packageJson).not.toContain('deploy:production');
    expect(packageJson).not.toContain('monitoring:upload');
    expect(existsSync('pnpm-lock.yaml')).toBe(false);
  });
});
