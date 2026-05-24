import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectNoTrackedEnvironmentFiles, readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readSource(path);

const collectFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(ts|tsx|json|md)$/.test(entry.name) ? [path] : [];
  });
};

describe('Phase 20H production acceptance synthetic data boundary', () => {
  it('documents 20H as production acceptance with synthetic data only', () => {
    const doc = read('docs/PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA.md');

    for (const expected of [
      '# Phase 20H - Production Acceptance With Synthetic Data V1',
      'production acceptance with synthetic data',
      'buildProductionAcceptanceSyntheticData',
      'does not launch production',
      'does not apply cloud data',
      'does not upload data',
      'does not download data',
      'does not write localStorage',
      'does not delete localStorage',
      'does not make cloud data primary',
      'does not enable default sync',
      'does not start background sync',
      'does not change source of truth',
      'Phase 20G readiness',
      'synthetic data only',
      'Real personal training data must not be used.',
      'readyFor20I: true',
      'validationAccepted: true',
      'syntheticEvidenceAccepted: true',
      'privacyAccepted: true',
      'fallbackAccepted: true',
      'routeBoundaryAccepted: true',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'autoApplied: false',
      'liveCloudSyncActivated: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      'productionLaunchPerformed: false',
      '20I - v0 UI Polish Handoff Contract V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps 20H source isolated from SDK clients env reads routes timers persistence and direct IO', () => {
    const source = read('src/cloudProduction/productionAcceptanceSyntheticData.ts');

    for (const forbidden of [
      '@supabase/supabase-js',
      'createClient(',
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'localStorage.setItem',
      'localStorage.removeItem',
      'writeAppDataToLocalStorage',
      'readStoredAppDataFromLocalStorage',
      'saveData(',
      'loadData(',
      '../storage/persistence',
      'apps/api/src',
      'node:http',
      'node:sqlite',
      'process.env',
      'import.meta.env',
      '.env',
      'document.cookie',
      '/login',
      '/signup',
      '/sync',
      '/cloud',
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
      'upsert',
      'insert(',
      'update(',
      'delete(',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).toContain('buildPhase19ProductionManualAcceptance');
  });

  it('does not wire 20H into App UI storage API runtime or schemas', () => {
    const runtimeSources = [
      'src/App.tsx',
      'src/features/ProfileView.tsx',
      'src/storage/persistence.ts',
      'src/storage/localStorageAdapter.ts',
      'apps/api/src/index.ts',
      'src/models/training-model.ts',
      'src/models/training-data.schema.json',
    ].map(read);

    for (const source of runtimeSources) {
      for (const forbidden of [
        'buildProductionAcceptanceSyntheticData',
        'PHASE20H_PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA_ID',
        'readyFor20I',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 20H runtime expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildProductionAcceptanceSyntheticData');
      expect(source).not.toContain('PHASE20H_PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA_ID');
      expect(source).not.toContain('readyFor20I');
    }
  });

  it('keeps env package lockfile route and schema boundaries unchanged', () => {
    expectNoTrackedEnvironmentFiles();
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml')), 'pnpm-lock.yaml should not exist').toBe(false);

    const packageJson = JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(Object.keys(packageJson.dependencies)).toEqual(['@supabase/supabase-js', 'ajv', 'lucide-react', 'react', 'react-dom']);
    expect(Object.keys(packageJson.devDependencies)).toEqual([
      '@tailwindcss/vite',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@vitejs/plugin-react',
      'tailwindcss',
      'typescript',
      'vite',
      'vitest',
    ]);
    expect(Object.keys(packageJson.scripts)).toEqual([
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
  });

  it('records 20H in root docs without claiming live sync production launch cloud primary or default sync is live', () => {
    const docs = [
      read('docs/PRODUCTION_ACCEPTANCE_SYNTHETIC_DATA.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 20H - Production Acceptance With Synthetic Data V1',
      'buildProductionAcceptanceSyntheticData',
      'readyFor20I',
      'synthetic data only',
      'validationAccepted',
      'syntheticEvidenceAccepted',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'autoApplied: false',
      'liveCloudSyncActivated: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      'productionLaunchPerformed: false',
      '20I - v0 UI Polish Handoff Contract V1',
    ]) {
      expect(docs).toContain(expected);
    }

    for (const forbidden of [
      'live sync is active',
      'production is launched',
      'default cloud sync is enabled',
      'background sync is enabled',
      'cloud primary is now default',
      'automatic multi-device sync is enabled',
      'localStorage is replaced',
      'v0 polish has started',
    ]) {
      expect(docs).not.toContain(forbidden);
    }
  });
});
