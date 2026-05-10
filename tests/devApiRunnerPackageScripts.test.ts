import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, readSource } from './runtimeBoundaryTestHelpers';

describe('dev API runner package scripts', () => {
  it('adds only explicit dev-only runner scripts without dependency changes', () => {
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts['api:dev:build']).toContain('--ssr apps/api/src/node/devApiRunner.ts');
    expect(packageJson.scripts['api:dev:build']).toContain('--outDir .ironpath/dev-api-runner');
    expect(packageJson.scripts['api:dev']).toContain('npm run api:dev:build');
    expect(packageJson.scripts['api:dev']).toContain('node ./.ironpath/dev-api-runner/devApiRunner.js');

    expect(packageJson.scripts.dev).toBe('node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000');
    expect(packageJson.scripts.build).toBe('node ./node_modules/vite/bin/vite.js build');
    expect(packageJson.scripts.typecheck).toBe('node ./node_modules/typescript/bin/tsc --noEmit');
    expect(packageJson.scripts.test).toBe('node ./node_modules/vitest/vitest.mjs run');

    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };
    ['tsx', 'ts-node', 'fastify', 'express', 'koa', 'hono', 'trpc', 'graphql'].forEach((name) =>
      expect(deps).not.toHaveProperty(name),
    );
  });

  it('documents npm arg passthrough and avoids production runner language', () => {
    const strategy = readSource('docs/LOCAL_API_RUNNER_STRATEGY.md');
    const apiContract = readSource('API_CONTRACT.md');

    expect(strategy).toContain('npm run api:dev -- --port 0 --seed-empty --db <temp-db>');
    expect(apiContract).toContain('npm run api:dev -- <args>');
    expect(strategy).not.toMatch(/start:prod|production runner|deploy production server/i);
    expect(apiContract).not.toMatch(/start:prod|production runner|deploy production server/i);
  });
});
