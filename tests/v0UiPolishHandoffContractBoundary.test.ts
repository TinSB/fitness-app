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

describe('Phase 20I v0 UI polish handoff boundary', () => {
  it('documents 20I as a passive v0 handoff contract only', () => {
    const doc = read('docs/V0_UI_POLISH_HANDOFF_CONTRACT.md');

    for (const expected of [
      '# Phase 20I - v0 UI Polish Handoff Contract V1',
      'handoff contract only',
      'buildV0UiPolishHandoffContract',
      'Phase 20H acceptance',
      'readyForV0UiPolish: true',
      'phase20SequenceComplete: true',
      'stable props',
      'stable data-testid markers',
      'auth screen polish',
      'sync status center',
      'first-sync flow',
      'conflict review UI',
      'offline/recovery states',
      'account settings polish',
      'does not start v0 UI polish',
      'does not add routes',
      'does not change AppData or TrainingSession schemas',
      'does not change persistence',
      'does not change packages or lockfiles',
      'does not upload data',
      'does not download data',
      'does not apply cloud data',
      'does not delete localStorage',
      'does not make cloud data primary',
      'Phase 20 sequence complete',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps 20I source isolated from UI runtime SDK clients env reads routes persistence and direct IO', () => {
    const source = read('src/cloudProduction/v0UiPolishHandoffContract.ts');

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
      '/auth',
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
    expect(source).toContain('Phase20hProductionAcceptanceSyntheticResult');
  });

  it('does not wire 20I into App UI storage API runtime or schemas', () => {
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
        'buildV0UiPolishHandoffContract',
        'PHASE20I_V0_UI_POLISH_HANDOFF_CONTRACT_ID',
        'readyForV0UiPolish',
        'phase20SequenceComplete',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 20I handoff expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildV0UiPolishHandoffContract');
      expect(source).not.toContain('PHASE20I_V0_UI_POLISH_HANDOFF_CONTRACT_ID');
      expect(source).not.toContain('readyForV0UiPolish');
      expect(source).not.toContain('phase20SequenceComplete');
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

  it('records 20I in root docs without claiming v0 work live sync cloud primary or default sync has started', () => {
    const docs = [
      read('docs/V0_UI_POLISH_HANDOFF_CONTRACT.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 20I - v0 UI Polish Handoff Contract V1',
      'buildV0UiPolishHandoffContract',
      'readyForV0UiPolish',
      'phase20SequenceComplete',
      'stable props',
      'stable data-testid markers',
      'login account',
      'sync status center',
      'conflict review',
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
      'Phase 20 sequence complete',
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
