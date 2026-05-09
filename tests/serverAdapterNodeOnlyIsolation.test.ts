import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const expectNoNodeAdapterImport = (file: string) => {
  const source = readFileSync(file, 'utf8');
  expect(source).not.toContain('serverAdapter');
  expect(source).not.toContain('sqliteRepository');
  expect(source).not.toContain('node:sqlite');
};

describe('server adapter Node-only isolation', () => {
  it('keeps browser runtime and pure API boundaries free of server adapter and SQLite imports', () => {
    const root = process.cwd();
    [
      'apps/api/src/index.ts',
      'apps/api/src/readMirror.ts',
      'apps/api/src/sessionMutation.ts',
      'apps/api/src/recordDataHealthMutation.ts',
      'src/App.tsx',
    ].forEach((file) => expectNoNodeAdapterImport(resolve(root, file)));
    collectSourceFiles(resolve(root, 'src')).forEach(expectNoNodeAdapterImport);

    const nodeIndex = readFileSync(resolve(root, 'apps/api/src/node/index.ts'), 'utf8');
    expect(nodeIndex).toContain('./serverAdapter');
    expect(nodeIndex).toContain('../sqliteRepository');
  });
});
