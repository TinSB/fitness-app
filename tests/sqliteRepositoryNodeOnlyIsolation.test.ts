import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const collectFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const expectNoSqliteImport = (file: string) => {
  const source = readFileSync(file, 'utf8');
  expect(source).not.toContain('sqliteRepository');
  expect(source).not.toContain('node:sqlite');
};

describe('SQLite repository Node-only isolation', () => {
  it('keeps browser runtime and shared API boundaries free of SQLite imports', () => {
    const root = process.cwd();
    const explicitFiles = [
      'apps/api/src/index.ts',
      'apps/api/src/readMirror.ts',
      'apps/api/src/sessionMutation.ts',
      'apps/api/src/recordDataHealthMutation.ts',
      'src/App.tsx',
    ];

    explicitFiles.forEach((file) => expectNoSqliteImport(resolve(root, file)));
    collectFiles(resolve(root, 'src')).forEach(expectNoSqliteImport);

    const nodeIndex = readFileSync(resolve(root, 'apps/api/src/node/index.ts'), 'utf8');
    expect(nodeIndex).toContain("../sqliteRepository");
  });
});
