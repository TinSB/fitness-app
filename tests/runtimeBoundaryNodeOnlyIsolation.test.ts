import { describe, expect, it } from 'vitest';
import {
  collectSrcRuntimeFiles,
  expectSourceNotToContain,
  readSource,
  repoRoot,
} from './runtimeBoundaryTestHelpers';
import { resolve } from 'node:path';

const NODE_ONLY_TOKENS = [
  'node:http',
  'node:sqlite',
  'sqliteRepository',
  'serverAdapter',
  'httpRuntimeAdapter',
  'apps/api/src/node',
];

const BROWSER_FACING_API_FILES = [
  'apps/api/src/index.ts',
  'apps/api/src/readMirror.ts',
  'apps/api/src/sessionMutation.ts',
  'apps/api/src/recordDataHealthMutation.ts',
];

describe('runtime boundary Node-only isolation acceptance', () => {
  it('keeps production browser runtime source free of Node-only API and runtime imports', () => {
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, NODE_ONLY_TOKENS));
    BROWSER_FACING_API_FILES.forEach((file) =>
      expectSourceNotToContain(resolve(repoRoot(), file), NODE_ONLY_TOKENS),
    );
  });

  it('keeps the shared API index browser-facing while node/index is the Node-only entry', () => {
    const sharedIndex = readSource('apps/api/src/index.ts');
    expect(sharedIndex).toContain("export * from './readMirror'");
    expect(sharedIndex).toContain("export * from './sessionMutation'");
    expect(sharedIndex).toContain("export * from './recordDataHealthMutation'");
    expect(sharedIndex).not.toContain("from './node");
    expect(sharedIndex).not.toContain("from './sqliteRepository");

    const nodeIndex = readSource('apps/api/src/node/index.ts');
    expect(nodeIndex).toContain('../sqliteRepository');
    expect(nodeIndex).toContain('./serverAdapter');
    expect(nodeIndex).toContain('./httpRuntimeAdapter');
  });
});
