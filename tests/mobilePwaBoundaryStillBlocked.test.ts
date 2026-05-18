import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('mobile PWA boundary still blocked', () => {
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

  it('does not add service worker background sync upload push route or storage behavior to source', () => {
    const source = [
      readSource('src/personalProduction/mobilePwaPersonalUseCopy.ts'),
      readSource('src/personalProduction/MobilePwaPersonalUsePanel.tsx'),
    ].join('\n');

    for (const forbidden of [
      'navigator.serviceWorker',
      'serviceWorker',
      'syncManager',
      'PushManager',
      'Notification.requestPermission',
      'fetch(',
      'sendBeacon',
      '@supabase',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'sourceOfTruthChanged: true',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('keeps docs from claiming blocked mobile capabilities are enabled', () => {
    const content = readSource('docs/MOBILE_PWA_PERSONAL_USE_POLISH_PACK.md');

    for (const forbidden of [
      'service-worker sync is enabled',
      'background sync is enabled',
      'automatic upload is enabled',
      'push notification is enabled',
      'cloud sync is enabled',
      'production deployment is live',
      'external monitoring upload is active',
      'SaaS is started',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('keeps package scripts and dependency surface locked', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.dependencies['@supabase/supabase-js']).toBeDefined();
    for (const forbidden of ['@sentry', 'sentry', 'analytics', 'telemetry', 'stripe', 'clerk', 'next-auth', 'workbox']) {
      expect(JSON.stringify(packageJson.dependencies)).not.toContain(forbidden);
      expect(JSON.stringify(packageJson.devDependencies)).not.toContain(forbidden);
    }
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('billing:start');
  });
});
