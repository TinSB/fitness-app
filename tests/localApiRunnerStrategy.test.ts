import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const strategyPath = 'docs/LOCAL_API_RUNNER_STRATEGY.md';

const readStrategy = () => readSource(strategyPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Runtime Stack',
  '## Current Constraint',
  '## Runner Options Evaluated',
  '### Option A: No runner yet, keep programmatic launcher only',
  '### Option B: Compiled JS runner after build',
  '### Option C: Add tsx or similar TS runtime runner',
  '### Option D: Node native TypeScript support / loader based approach',
  '### Option E: Manual test harness only',
  '## Recommendation',
  '## Proposed Task 4.15',
  '## Safety Checklist',
  '## Decision Record',
];

const requiredBoundaryPhrases = [
  'No App.tsx integration',
  'No UI integration',
  'No localStorage replacement',
  'No production server',
  'No auth',
  'No sync',
  'No deployment',
  'No package dependency is added in Task 4.14',
  'No package script is added in Task 4.14',
  'App runtime still uses localStorage',
  'Browser-facing `apps/api/src/index.ts` does not export Node-only runtime',
  'Task 4.15 is not App runtime migration',
];

const misleadingActionInstructions = [
  /\bnpm install tsx\b/i,
  /\badd(?:ing)?\s+(?:the\s+)?tsx\s+dependency\s+now\b/i,
  /\badd(?:ing)?\s+(?:a\s+)?package script\s+now\b/i,
  /\bconnect(?:ing)?\s+App\.tsx\s+to\s+(?:the\s+)?API\b/i,
  /\breplace(?:ing)?\s+localStorage\b/i,
  /\bdeploy(?:ing)?\s+(?:a\s+)?production server\b/i,
  /\benable(?:ing)?\s+auth\b/i,
  /\benable(?:ing)?\s+sync\b/i,
];

describe('local API runner strategy documentation', () => {
  it('exists and contains the required strategy sections', () => {
    expect(existsSync(resolve(repoRoot(), strategyPath))).toBe(true);
    const strategy = readStrategy();

    requiredSections.forEach((section) => expect(strategy).toContain(section));
  });

  it('documents the required no-runtime-migration boundaries', () => {
    const strategy = readStrategy();

    requiredBoundaryPhrases.forEach((phrase) => expect(strategy).toContain(phrase));
    expect(strategy).toContain('createDevLocalApiLauncher');
    expect(strategy).toContain('-> node:http');
    expect(strategy).toContain('-> httpRuntimeAdapter');
    expect(strategy).toContain('-> serverAdapter');
    expect(strategy).toContain('-> sqliteRepository');
    expect(strategy).toContain('apps/api/src/node/index.ts');
  });

  it('evaluates all runner options and recommends only the programmatic launcher short term', () => {
    const strategy = readStrategy();

    expect(strategy).toContain('The only recommended short-term strategy is Option A');
    expect(strategy).toContain('no runner yet, keep the programmatic launcher only');
    expect(strategy).toContain('Task 4.15: Dev API Runner Prototype V1');
    expect(strategy).toContain('compiled JS runner prototype');
    expect(strategy).toContain('TypeScript runtime runner proposal with explicit dependency approval');
    expect(strategy).toContain('tsx');
  });

  it('rejects misleading action instructions while allowing tsx as an evaluated option', () => {
    const strategy = readStrategy();

    expect(strategy).toContain('tsx');
    misleadingActionInstructions.forEach((pattern) => expect(strategy).not.toMatch(pattern));
  });

  it('confirms package.json has only the approved dev-only runner scripts after Task 4.15', () => {
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts || {};
    const localApiRunnerScripts = Object.entries(scripts).filter(([name, command]) => {
      const text = `${name} ${command}`;
      return /local-api|api:dev|api-dev|api:runner|devLauncher|devLauncher\.ts|apps\/api\/src\/node/i.test(text);
    });

    expect(localApiRunnerScripts.map(([name]) => name).sort()).toEqual(['api:dev', 'api:dev:build']);
    expect(scripts['api:dev:build']).toContain('.ironpath/dev-api-runner');
    expect(scripts['api:dev']).toContain('.ironpath/dev-api-runner/devApiRunner.js');
  });

  it('keeps contract and refactor docs aligned with the strategy', () => {
    const apiContract = readSource('API_CONTRACT.md');
    const refactorPlan = readSource('FULL_STACK_REFACTOR_PLAN.md');
    const checklist = readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');

    expect(apiContract).toContain('Local API Runner Strategy');
    expect(apiContract).toContain('docs/LOCAL_API_RUNNER_STRATEGY.md');
    expect(apiContract).toContain('not a runtime feature');
    expect(apiContract).toContain('programmatic Node-only API');

    expect(refactorPlan).toContain('Task 4.14: Local API Runner Strategy V1');
    expect(refactorPlan).toContain('Completed as a runner strategy and decision record');
    expect(refactorPlan).toContain('Task 4.15 Dev API Runner Prototype V1');
    expect(refactorPlan).toContain('Do not migrate `App.tsx` to HTTP/SQLite');

    expect(checklist).toContain('Task 4.14 records local API runner strategy');
    expect(checklist).toContain('Task 4.15 adds a dev-only compiled runner prototype');
  });
});
