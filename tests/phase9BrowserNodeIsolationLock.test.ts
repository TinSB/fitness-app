import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 9 browser node isolation lock', () => {
  it('keeps Node-only backend-primary modules out of browser-facing API index', () => {
    const browserApiIndex = readSource('apps/api/src/index.ts');

    for (const forbidden of [
      'backendPrimaryRuntimeHost',
      'backendAppDataRepositoryCandidate',
    ]) {
      expect(browserApiIndex).not.toContain(forbidden);
    }
  });

  it('keeps frontend production cutover files free of Node-only imports', () => {
    const sources = [
      'src/productionCutover/cutoverMigrationDryRun.ts',
      'src/productionCutover/backendPrimaryReadCandidate.ts',
      'src/productionCutover/backendPrimaryMutationCandidate.ts',
      'src/productionCutover/sourceOfTruthRuntimeSwitchGuard.ts',
      'src/productionCutover/cutoverFallbackRollback.ts',
      'src/productionCutover/CutoverConfirmationPanel.tsx',
    ].map(readSource).join('\n');

    for (const forbidden of [
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
    ]) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it('keeps package scripts and dependencies free of backend production drift', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.scripts ?? {}).filter((script) =>
      /production:backend|backend:deploy|auth|sync|monitor/i.test(script),
    )).toEqual([]);
    expect(packageJson.dependencies ?? {}).not.toHaveProperty('fastify');
    expect(packageJson.dependencies ?? {}).not.toHaveProperty('express');
    expect(packageJson.dependencies ?? {}).not.toHaveProperty('prisma');
  });
});
