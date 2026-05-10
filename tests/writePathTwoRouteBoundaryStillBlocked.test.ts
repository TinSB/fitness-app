import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const runtimeEntries = () =>
  collectSrcRuntimeFiles().map((file) => [relativePath(file), stripComments(readFileSync(file, 'utf8'))] as const);

const approvedMutationFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
  'src/devApi/devApiHistoryDataFlagClient.ts',
  'src/devApi/devApiHistoryDataFlagConfig.ts',
  'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
]);

const blockedRoutes = [
  '/sessions/start',
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
  '/history/:id/edit',
  '/data-health/repair/apply',
  '/backup/import',
  '/backup/export',
  '/reset/',
  '/recovery/',
];

const blockedTokens = [
  'node:http',
  'node:sqlite',
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'devApiRunner',
  'devDbRecovery',
];

const thirdMutationClientPaths = [
  'src/devApi/devApiThirdMutationClient.ts',
  'src/devApi/DevApiThirdMutationPrototype.tsx',
  'src/devApi/devApiSessionMutationClient.ts',
  'src/devApi/devApiHistoryEditClient.ts',
  'src/devApi/devApiDataHealthRepairClient.ts',
  'src/devApi/devApiMutationClient.ts',
  'src/api/mutations.ts',
  'src/mutationClient.ts',
];

const collectFilesIfDirectory = (path: string): string[] => {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (!stat.isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const next = join(path, entry.name);
    if (entry.isDirectory()) return collectFilesIfDirectory(next);
    return [next];
  });
};

describe('write-path two-route boundary still blocked', () => {
  it('keeps App.tsx and src runtime free of blocked mutation routes', () => {
    const appSource = stripComments(readSource('src/App.tsx'));
    for (const route of blockedRoutes) expect(appSource).not.toContain(route);

    for (const [path, source] of runtimeEntries()) {
      const blocked = blockedRoutes.filter((route) => source.includes(route));
      expect(blocked, `${path} should not include blocked routes`).toEqual([]);

      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not issue browser POST`).not.toMatch(/method\s*:\s*['"`]POST['"`]/);
      }
    }
  });

  it('does not add third mutation clients or third mutation feature flags', () => {
    for (const path of thirdMutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const allSrc = runtimeEntries().map(([, source]) => source).join('\n');
    expect(allSrc).not.toMatch(/third-mutation|session-mutation|history-edit|datahealth-repair/i);
  });

  it('keeps API-backed localStorage, package scripts, and dist pollution blocked', () => {
    const adapter = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(adapter).not.toContain('fetch(');
    expect(adapter).not.toContain('/data-health/issues/');
    expect(adapter).not.toContain('/history/:id/data-flag');

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = Object.keys(packageJson.scripts || {});
    expect(scripts.filter((script) => /mutation|integration|prod|production|auth|sync|playwright|cypress/i.test(script))).toEqual([]);

    const dist = resolve(repoRoot(), 'dist');
    if (!existsSync(dist)) return;
    const files = collectFilesIfDirectory(dist).filter((path) => statSync(path).isFile());
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const offenders = blockedTokens.filter((token) => source.includes(token));
      expect(offenders, `${relativePath(file)} should not include blocked build tokens`).toEqual([]);
    }
  });
});
