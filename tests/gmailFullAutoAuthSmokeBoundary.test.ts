import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('Gmail Full Auto Auth Smoke Test V1 boundary', () => {
  it('keeps the Gmail auth smoke test env-gated and limited to local test secrets', () => {
    const source = readSource('tests/gmailFullAutoAuthSmoke.test.ts');

    for (const expected of [
      'IRONPATH_AUTH_SMOKE_EMAIL',
      'IRONPATH_AUTH_SMOKE_BASE_URL',
      'GOOGLE_GMAIL_CLIENT_ID',
      'GOOGLE_GMAIL_CLIENT_SECRET',
      'GOOGLE_GMAIL_REFRESH_TOKEN',
      'missing Gmail smoke env',
    ]) {
      expect(source).toContain(expected);
    }

    for (const forbidden of [
      'GMAIL_PASSWORD',
      'GOOGLE_PASSWORD',
      'SUPABASE_SERVICE_ROLE_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_SUPABASE_URL',
      'BROWSER_USE_API_KEY',
      'VERCEL',
      '.env.production',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not print email bodies links tokens or Gmail credentials', () => {
    const source = readSource('tests/gmailFullAutoAuthSmoke.test.ts');

    for (const forbidden of [
      'console.log(loginLink)',
      'console.log(accessToken)',
      'console.log(text)',
      'console.log(message)',
      'console.log(values)',
      'console.log(process.env',
      'print(loginLink)',
      'print(page_info())',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain('redact(');
  });

  it('keeps browser automation isolated from normal Chrome cookies and local data deletion', () => {
    const source = readSource('tests/gmailFullAutoAuthSmoke.test.ts');

    expect(source).toContain('--user-data-dir=');
    expect(source).toContain('mkdtempSync');
    expect(source).toContain('BU_CDP_URL');

    for (const forbidden of [
      '--profile-directory',
      '--profile-directory=Default',
      'Cookies',
      'localStorage.clear',
      'localStorage.removeItem',
      'indexedDB.deleteDatabase',
      'navigator.serviceWorker',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('keeps sync upload download cloud-primary default and background behavior blocked', () => {
    const source = [
      readSource('tests/gmailFullAutoAuthSmoke.test.ts'),
      readSource('src/cloudProduction/supabaseAuthRuntimeAdapter.ts'),
      readSource('src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx'),
      readSource('src/uiOs/settings/cloudSyncAuthActionController.ts'),
    ].join('\n');

    for (const forbidden of [
      'runCloudPushCandidate',
      'runCloudPullCandidate',
      'writeCloudAppDataCandidate',
      'uploadPerformed: true',
      'downloadPerformed: true',
      'cloudPrimaryEnabled: true',
      'defaultSyncEnabled: true',
      'backgroundWorkEnabled: true',
      'sourceOfTruthChanged: true',
      'localStorageDeleted: true',
      'setInterval',
      'backgroundSync',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('does not change schemas routes storage package files or add pnpm lockfile', () => {
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml')), 'pnpm-lock.yaml should remain absent').toBe(false);

    for (const path of [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'src/models/training-model.ts',
      'src/models/training-data.schema.json',
      'src/storage/persistence.ts',
      'apps/api/src/index.ts',
    ]) {
      const diff = execFileSync('git', ['diff', '--', path], {
        cwd: repoRoot(),
        encoding: 'utf8',
      }).trim();
      expect(diff, `${path} should not change`).toBe('');
    }
  });

  it('keeps source free of stored Gmail credentials and unrelated Gmail mailbox reads', () => {
    const source = readFileSync(resolve(repoRoot(), 'tests/gmailFullAutoAuthSmoke.test.ts'), 'utf8');

    expect(source).toContain('to:${env.IRONPATH_AUTH_SMOKE_EMAIL}');
    expect(source).toContain('from:noreply@mail.app.supabase.io');
    expect(source).toContain('newer_than:15m');
    expect(source).toContain('format=full');

    for (const forbidden of [
      'messages?maxResults',
      'users/me/messages?maxResults',
      'format=raw',
      'labelIds=INBOX',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
