import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('dev API runner strategy audit', () => {
  it('documents the Task 4.15 build audit and Result A decision', () => {
    const strategy = readSource('docs/LOCAL_API_RUNNER_STRATEGY.md');

    expect(strategy).toContain('## Task 4.15 Prototype Result');
    expect(strategy).toContain('Result A: Compiled JS runner prototype is implemented');
    expect(strategy).toContain('Existing `npm run build` is browser-only');
    expect(strategy).toContain('Existing `tsconfig.json` is no-emit');
    expect(strategy).toContain('Direct `tsc` CommonJS is blocked by `import.meta`');
    expect(strategy).toContain('NodeNext ESM is blocked by extensionless relative imports');
    expect(strategy).toContain('Vite SSR build can compile the Node-only runner without new dependencies');
  });

  it('keeps no-runtime-migration and no-production boundaries documented', () => {
    const strategy = readSource('docs/LOCAL_API_RUNNER_STRATEGY.md');

    [
      'No App.tsx integration',
      'No UI integration',
      'No localStorage replacement',
      'No production server',
      'No auth / sync / deployment',
      'No normalized tables',
      'No backup import/export HTTP endpoint',
    ].forEach((phrase) => expect(strategy).toContain(phrase));

    expect(strategy).toContain('Task 4.15 is still not App runtime migration');
  });

  it('keeps API contract and full-stack plan aligned with Result A', () => {
    const apiContract = readSource('API_CONTRACT.md');
    const refactorPlan = readSource('FULL_STACK_REFACTOR_PLAN.md');

    expect(apiContract).toContain('Dev API Runner Prototype');
    expect(apiContract).toContain('Result A');
    expect(apiContract).toContain('dev-only compiled JavaScript runner');
    expect(refactorPlan).toContain('Task 4.15: Dev API Runner Prototype V1');
    expect(refactorPlan).toContain('Result A');
    expect(refactorPlan).toContain('Task 4.16 Dev API Runner Manual Acceptance V1');
  });
});
