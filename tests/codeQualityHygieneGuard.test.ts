import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const SCAN_ROOTS = ['src', 'apps'];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.ironpath',
  '.vite',
  '.vitest',
  'coverage',
]);

const isSourceFile = (name: string) => /\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name);

const collectFiles = (dir: string): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...collectFiles(join(dir, entry.name)));
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
};

const allFiles = SCAN_ROOTS
  .map((root) => join(repoRoot, root))
  .filter((path) => {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  })
  .flatMap(collectFiles);

const stripCommentsAndStrings = (source: string) => {
  // Cheap but good enough: drop block comments, line comments, single/double/back-tick string contents.
  // We only need this for code-quality scans, not for parsing.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
};

const findOffenders = (pattern: RegExp): string[] =>
  allFiles
    .map((path) => ({ path, source: stripCommentsAndStrings(readFileSync(path, 'utf8')) }))
    .filter(({ source }) => pattern.test(source))
    .map(({ path }) => path.replace(`${repoRoot}/`, ''));

describe('code quality hygiene guard', () => {
  it('finds source files to scan', () => {
    expect(allFiles.length).toBeGreaterThan(100);
  });

  it('does not introduce @ts-ignore / @ts-expect-error / @ts-nocheck in src', () => {
    const offenders = findOffenders(/@ts-(ignore|expect-error|nocheck)\b/);
    expect(offenders, `Suppressing TS errors weakens type safety; remove from:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not introduce `any` type annotations or assertions in src', () => {
    const offenders = findOffenders(/(:\s*any\b(?!Of|thing|where|hour|day|one)|\bas\s+any\b|<\s*any\s*[,>])/);
    expect(offenders, `Avoid \`any\`; tighten the type or use unknown. Found in:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not leave debugger statements in src', () => {
    const offenders = findOffenders(/\bdebugger\b/);
    expect(offenders, `debugger statement left in:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not introduce eval / new Function() in src', () => {
    const offenders = findOffenders(/\b(eval\s*\(|new\s+Function\s*\()/);
    expect(offenders, `eval / Function constructor is forbidden; found in:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not introduce dangerouslySetInnerHTML in src', () => {
    const offenders = findOffenders(/dangerouslySetInnerHTML/);
    expect(offenders, `dangerouslySetInnerHTML is forbidden; found in:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not introduce console.log in production source (warn/error/info are allowed for genuine reporting)', () => {
    const offenders = findOffenders(/\bconsole\.log\b/);
    expect(offenders, `console.log left in:\n${offenders.join('\n')}`).toEqual([]);
  });
});
