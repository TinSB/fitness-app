import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const expectNoHttpRuntimeImport = (file: string) => {
  const source = readFileSync(file, 'utf8');
  expect(source).not.toContain('httpRuntimeAdapter');
  expect(source).not.toContain('serverAdapter');
  expect(source).not.toContain('sqliteRepository');
  expect(source).not.toContain('node:http');
  expect(source).not.toContain('node:sqlite');
};

describe('HTTP runtime adapter Node-only isolation', () => {
  it('keeps browser runtime and pure API boundaries free of HTTP/server/SQLite imports', () => {
    const root = process.cwd();
    [
      'apps/api/src/index.ts',
      'apps/api/src/readMirror.ts',
      'apps/api/src/sessionMutation.ts',
      'apps/api/src/recordDataHealthMutation.ts',
      'src/App.tsx',
    ].forEach((file) => expectNoHttpRuntimeImport(resolve(root, file)));
    collectSourceFiles(resolve(root, 'src')).forEach(expectNoHttpRuntimeImport);

    const nodeIndex = readFileSync(resolve(root, 'apps/api/src/node/index.ts'), 'utf8');
    expect(nodeIndex).toContain('./httpRuntimeAdapter');
    expect(nodeIndex).toContain('./serverAdapter');
    expect(nodeIndex).toContain('../sqliteRepository');
  });
});
