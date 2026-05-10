import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectSrcRuntimeFiles,
  expectSourceNotToContain,
  readSource,
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

const frontendApiClientCandidates = [
  'src/apiClient.ts',
  'src/apiClient.tsx',
  'src/api/client.ts',
  'src/api/client.tsx',
  'src/services/apiClient.ts',
  'src/services/apiClient.tsx',
  'src/hooks/useApiData.ts',
  'src/hooks/useApiData.tsx',
  'src/hooks/useReadMirror.ts',
  'src/hooks/useReadMirror.tsx',
  'src/api/readMirrorClient.ts',
  'src/api/readMirrorClient.tsx',
];

describe('app runtime migration remains blocked', () => {
  it('keeps App.tsx free of Node-only API integration', () => {
    expectSourceNotToContain(resolve(repoRoot(), 'src/App.tsx'), nodeOnlyRuntimeTokens);
  });

  it('keeps browser runtime source free of Node built-ins', () => {
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, ['node:http', 'node:sqlite']));
  });

  it('keeps browser-facing API index from exporting Node-only runtime', () => {
    const sharedIndexPath = resolve(repoRoot(), 'apps/api/src/index.ts');

    expectSourceNotToContain(sharedIndexPath, nodeOnlyRuntimeTokens);
    expectSourceNotToContain(sharedIndexPath, ['./node', './node/', 'node/index']);
  });

  it('does not introduce frontend API client runtime wiring in candidate paths', () => {
    frontendApiClientCandidates.forEach((path) => {
      const absolute = resolve(repoRoot(), path);
      if (!existsSync(absolute)) return;

      const source = readFileSync(absolute, 'utf8');
      expect(source, `${path} should not wire App runtime to dev API`).not.toMatch(
        /createDevLocalApiLauncher|devApiRunner|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devDbRecovery|localhost:8787|\/app-data\/summary|\/sessions\/summary|\/data-health\/summary/i,
      );
    });
  });

  it('does not introduce feature flag or dual-read runtime wiring in src', () => {
    const blockedRuntimeWiringTokens = [
      'APP_RUNTIME_MIGRATION',
      'DEV_API_BASE_URL',
      'READ_ONLY_API',
      'DUAL_READ',
      'dualReadComparison',
      'appRuntimeMigration',
      'api:dev',
      'localhost:8787',
    ];

    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, blockedRuntimeWiringTokens));
  });

  it('keeps localStorageAdapter browser-storage backed instead of API-backed', () => {
    const adapter = readSource('src/storage/localStorageAdapter.ts');

    expect(adapter).not.toContain('fetch(');
    expect(adapter).not.toContain('/app-data/summary');
    expect(adapter).not.toContain('httpRuntimeAdapter');
    expect(adapter).not.toContain('serverAdapter');
    expect(adapter).not.toContain('sqliteRepository');
  });

  it('keeps package scripts limited to existing non-migration scripts', () => {
    const packageJson = JSON.parse(readSource('package.json')) as { scripts: Record<string, string> };
    const scriptNames = Object.keys(packageJson.scripts);

    expect(scriptNames.sort()).toEqual([...allowedScriptNames].sort());

    const unexpectedScripts = Object.entries(packageJson.scripts).filter(([name, command]) => {
      if (allowedScriptNames.has(name)) return false;
      return /migration|integration|frontend.*api|api.*client|production|prod|auth|sync/i.test(`${name} ${command}`);
    });
    expect(unexpectedScripts).toEqual([]);
  });
});
