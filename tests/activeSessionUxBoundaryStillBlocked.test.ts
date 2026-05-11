import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';

const root = process.cwd();

const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const listFiles = (dir: string): string[] => {
  const fullDir = resolve(root, dir);
  return readdirSync(fullDir).flatMap((entry) => {
    const full = join(fullDir, entry);
    const relative = `${dir}/${entry}`.replace(/\\/g, '/');
    if (statSync(full).isDirectory()) {
      return listFiles(relative);
    }
    return [relative];
  });
};

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('active session UX boundary remains constrained', () => {
  it('keeps the browser mutation allowlist at the current four routes', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
      `POST ${DEV_API_SESSION_START_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
    ]);
  });

  it('allows the session-start prototype files and blocks other active-session route calls', () => {
    [
      'src/devApi/devApiSessionStartConfig.ts',
      'src/devApi/devApiSessionStartClient.ts',
      'src/devApi/DevApiSessionStartPrototype.tsx',
    ].forEach((path) => expect(existsSync(resolve(root, path))).toBe(true));

    const runtimeSource = listFiles('src')
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .map((path) => stripComments(read(path)))
      .join('\n');

    [
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
    ].forEach((blocked) => expect(runtimeSource).not.toContain(blocked));
  });

  it('keeps storage and package boundaries unchanged', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const dependencyNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ];
    const scriptNames = Object.keys(packageJson.scripts ?? {});
    const persistence = read('src/storage/persistence.ts') + read('src/storage/localStorageAdapter.ts');

    expect(dependencyNames).not.toEqual(expect.arrayContaining(['playwright', 'cypress']));
    expect(scriptNames.some((name) => /session-start|active-session|mutation|sync|auth|production-backend/i.test(name))).toBe(false);
    expect(persistence).not.toMatch(/fetch\s*\(/);
    expect(persistence).not.toMatch(/\/sessions\//);
    expect(read('src/App.tsx')).not.toContain('/sessions/start');
  });
});
