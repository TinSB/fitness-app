import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectSrcRuntimeFiles,
  expectSourceNotToContain,
  readSource,
  repoRoot,
} from './runtimeBoundaryTestHelpers';

const NODE_ONLY_STACK_TOKENS = [
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'node:http',
  'node:sqlite',
];

describe('dev runtime smoke browser isolation', () => {
  it('keeps browser-facing runtime source free of the dev runtime stack', () => {
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, NODE_ONLY_STACK_TOKENS));
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), NODE_ONLY_STACK_TOKENS);
  });

  it('keeps apps/api/src/node/index.ts as the Node-only export entry', () => {
    const nodeIndex = readSource('apps/api/src/node/index.ts');
    const sharedIndex = readSource('apps/api/src/index.ts');

    expect(nodeIndex).toContain('./devLauncher');
    expect(nodeIndex).toContain('./httpRuntimeAdapter');
    expect(nodeIndex).toContain('./serverAdapter');
    expect(nodeIndex).toContain('../sqliteRepository');
    expect(sharedIndex).not.toContain('./node');
    expect(sharedIndex).not.toContain('devLauncher');
  });
});
