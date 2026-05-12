import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES,
  createApiStorageAdapter,
  resolveApiStorageAdapterConfig,
} from '../src/storage/apiStorageAdapter';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('API storage adapter boundary', () => {
  it('adds only the default-off adapter and does not wire App.tsx or runtime selector', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiStorageAdapter.ts'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceSelector.ts'))).toBe(false);
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceConfig.ts'))).toBe(false);

    const app = readSource('src/App.tsx');
    const persistence = readSource('src/storage/persistence.ts');
    expect(app).not.toMatch(/apiStorageAdapter|createApiStorageAdapter|VITE_IRONPATH_RUNTIME_SOURCE|api-primary-dev/);
    expect(persistence).not.toMatch(/apiStorageAdapter|createApiStorageAdapter|api-primary-dev/);
  });

  it('exposes route-specific facade methods instead of a broad mutation client', () => {
    const disabled = resolveApiStorageAdapterConfig({ DEV: true });
    const adapter = createApiStorageAdapter(disabled);

    expect(Object.keys(adapter)).toEqual([
      'config',
      'readAppDataSummary',
      'writeDataHealthDismiss',
      'writeHistoryDataFlag',
      'writeHistorySetEdit',
      'writeSessionStart',
      'writeSessionPatch',
      'writeSessionComplete',
      'writeSessionDiscard',
    ]);
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

  it('keeps the adapter browser-safe, localStorage-free, and production-free', () => {
    const source = readSource('src/storage/apiStorageAdapter.ts');

    expect(source).not.toMatch(/from ['"`]node:|node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/authToken|oauth|cloud|production source|deployHook/i);
    expect(source).not.toMatch(/\/data-health\/repair\/apply|\/backup\/import|\/backup\/export|\/reset\/|\/recovery\//);
    expect(source).not.toMatch(/export const writeAcceptedMutation|export function writeAcceptedMutation/);
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
  });

  it('does not add package dependency, script, or lockfile drift', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allowedScripts = new Set([
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
    expect(Object.keys(packageJson.scripts || {}).filter((script) => !allowedScripts.has(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) =>
      /api-storage|runtime-source|auth|sync|cloud|playwright|cypress/i.test(name),
    )).toEqual([]);
  });
});
