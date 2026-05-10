import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectSrcRuntimeFiles,
  expectSourceNotToContain,
  readSource,
  repoRoot,
} from './runtimeBoundaryTestHelpers';

const NODE_ONLY_RECOVERY_TOKENS = [
  'devDbRecovery',
  'devApiRunner',
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'node:http',
  'node:sqlite',
];

describe('dev DB recovery Node-only isolation', () => {
  it('keeps browser-facing runtime source free of recovery and Node-only stack', () => {
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, NODE_ONLY_RECOVERY_TOKENS));
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), NODE_ONLY_RECOVERY_TOKENS);
  });

  it('exports recovery utilities only from the Node-only API index', () => {
    const sharedIndex = readSource('apps/api/src/index.ts');
    const nodeIndex = readSource('apps/api/src/node/index.ts');

    expect(sharedIndex).not.toContain('devDbRecovery');
    expect(sharedIndex).not.toContain('./node');
    expect(nodeIndex).toContain('./devDbRecovery');
  });
});
