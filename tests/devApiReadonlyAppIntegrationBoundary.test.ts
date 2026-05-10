import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectRuntimeSourceFiles,
  collectSrcRuntimeFiles,
  expectSourceNotToContain,
  readSource,
  relativePath,
  repoRoot,
} from './runtimeBoundaryTestHelpers';

const nodeOnlyRuntimeTokens = [
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'devApiRunner',
  'devDbRecovery',
  'node:http',
  'node:sqlite',
];

const allowedScriptNames = new Set([
  'dev',
  'api:dev:build',
  'api:dev',
  'build',
  'build:stats',
  'build:size-check',
  'predeploy:check',
  'preview',
  'typecheck',
  'test',
  'test:watch',
]);

const apiClientCandidates = [
  'src/apiClient.ts',
  'src/apiClient.tsx',
  'src/services/apiClient.ts',
  'src/services/apiClient.tsx',
  'src/hooks/useApiData.ts',
  'src/hooks/useApiData.tsx',
  'src/api',
];

const devApiClientPattern = /^devApi.*\.(ts|tsx)$/i;

const devApiWiringPattern =
  /createDevLocalApiLauncher|devApiRunner|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devDbRecovery|localhost:8787|\/app-data\/summary|\/sessions\/summary|\/history|\/data-health\/summary|api:dev/i;

const readCandidateSourceFiles = (path: string): string[] => {
  if (!existsSync(path)) return [];
  const entry = readdirSync(path, { withFileTypes: true });
  return entry.flatMap((item) => {
    const child = join(path, item.name);
    if (item.isDirectory()) return collectRuntimeSourceFiles(child);
    return /\.(ts|tsx)$/.test(item.name) ? [child] : [];
  });
};

describe('dev API read-only App integration boundaries', () => {
  it('keeps App.tsx free of Node-only API integration', () => {
    expectSourceNotToContain(resolve(repoRoot(), 'src/App.tsx'), nodeOnlyRuntimeTokens);
  });

  it('keeps production src runtime free of Node built-ins', () => {
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, ['node:http', 'node:sqlite']));
  });

  it('keeps browser-facing API index from exporting Node-only runtime', () => {
    const sharedIndexPath = resolve(repoRoot(), 'apps/api/src/index.ts');

    expectSourceNotToContain(sharedIndexPath, nodeOnlyRuntimeTokens);
    expectSourceNotToContain(sharedIndexPath, ['./node', './node/', 'node/index']);
  });

  it('does not introduce frontend API client files wired to the dev API stack', () => {
    const candidateFiles = apiClientCandidates.flatMap((candidate) => {
      const absolute = resolve(repoRoot(), candidate);
      if (!existsSync(absolute)) return [];
      if (/\.(ts|tsx)$/.test(candidate)) return [absolute];
      return readCandidateSourceFiles(absolute);
    });

    const servicesPath = resolve(repoRoot(), 'src/services');
    if (existsSync(servicesPath)) {
      readdirSync(servicesPath, { withFileTypes: true }).forEach((entry) => {
        if (entry.isFile() && devApiClientPattern.test(entry.name)) {
          candidateFiles.push(join(servicesPath, entry.name));
        }
      });
    }

    candidateFiles.forEach((file) => {
      const source = readFileSync(file, 'utf8');
      expect(source, `${relativePath(file)} should not wire App runtime to dev API`).not.toMatch(devApiWiringPattern);
    });
  });

  it('does not introduce feature-flag runtime wiring in production src', () => {
    const blockedRuntimeWiringTokens = [
      'DEV_API_READONLY',
      'READONLY_APP_INTEGRATION',
      'APP_API_BASE_URL',
      'DUAL_READ',
      'dualReadComparison',
      'readOnlyApiComparison',
      'api:dev',
      'localhost:8787',
    ];

    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, blockedRuntimeWiringTokens));
  });

  it('keeps localStorageAdapter browser-storage backed instead of API-backed', () => {
    const adapter = readSource('src/storage/localStorageAdapter.ts');

    expect(adapter).not.toContain('fetch(');
    expect(adapter).not.toContain('/app-data/summary');
    expect(adapter).not.toContain('/sessions/summary');
    expect(adapter).not.toContain('httpRuntimeAdapter');
    expect(adapter).not.toContain('serverAdapter');
    expect(adapter).not.toContain('sqliteRepository');
  });

  it('does not add package scripts for migration, integration, production, auth, or sync', () => {
    const packageJson = JSON.parse(readSource('package.json')) as { scripts: Record<string, string> };

    const unexpectedScripts = Object.entries(packageJson.scripts).filter(([name, command]) => {
      if (allowedScriptNames.has(name)) return false;
      return /migration|integration|frontend.*api|api.*client|production|prod|auth|sync/i.test(`${name} ${command}`);
    });

    expect(packageJson.scripts['api:dev:build']).toContain('.ironpath/dev-api-runner');
    expect(packageJson.scripts['api:dev']).toContain('.ironpath/dev-api-runner/devApiRunner.js');
    expect(unexpectedScripts).toEqual([]);
  });
});
