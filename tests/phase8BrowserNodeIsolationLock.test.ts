import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 8 browser node isolation lock', () => {
  it('keeps production runtime Node-only modules out of browser-facing API index', () => {
    const browserApiIndex = readSource('apps/api/src/index.ts');

    for (const forbidden of [
      'productionRuntimeSkeleton',
      'productionRuntimeConfig',
      'productionRuntimeRoutes',
      'productionPersistence',
      'productionReadContract',
    ]) {
      expect(browserApiIndex).not.toContain(forbidden);
    }
  });

  it('keeps frontend production API files free of Node-only tokens', () => {
    const sources = [
      'src/productionApi/productionApiClient.ts',
      'src/productionApi/productionApiConfig.ts',
      'src/productionApi/productionDualReadComparison.ts',
      'src/productionApi/productionWriteShadowMode.ts',
    ].map(readSource).join('\n');

    for (const forbidden of [
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
      'apps/api/src/node',
    ]) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it('keeps package scripts free of production deploy/runtime commands', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.scripts ?? {}).filter((script) =>
      /production:backend|backend:deploy|auth|sync|monitor/i.test(script),
    )).toEqual([]);
    expect(packageJson.dependencies ?? {}).not.toHaveProperty('fastify');
    expect(packageJson.dependencies ?? {}).not.toHaveProperty('express');
  });
});
