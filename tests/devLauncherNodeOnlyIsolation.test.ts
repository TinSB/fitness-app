import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectSrcRuntimeFiles,
  expectSourceNotToContain,
  readSource,
  repoRoot,
} from './runtimeBoundaryTestHelpers';

const NODE_ONLY_DEV_LAUNCHER_TOKENS = [
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'node:http',
  'node:sqlite',
];

describe('dev local API launcher Node-only isolation', () => {
  it('keeps browser runtime and shared API index free of the dev launcher stack', () => {
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, NODE_ONLY_DEV_LAUNCHER_TOKENS));
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), NODE_ONLY_DEV_LAUNCHER_TOKENS);
  });

  it('exports the dev launcher only from the Node-only API index', () => {
    const nodeIndex = readSource('apps/api/src/node/index.ts');
    const sharedIndex = readSource('apps/api/src/index.ts');

    expect(nodeIndex).toContain('./devLauncher');
    expect(sharedIndex).not.toContain('devLauncher');
    expect(sharedIndex).not.toContain('./node');
  });
});
