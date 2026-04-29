import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const collectSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });

describe('native alert guard', () => {
  it('does not use browser native alert in source files', () => {
    const offenders = collectSourceFiles(resolve(process.cwd(), 'src'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return source.includes('window.alert') || /(^|[^A-Za-z])alert\s*\(/.test(source);
      })
      .map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('keeps App feedback on Toast instead of alert', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(source).toContain('showAppToast');
    expect(source).toContain('<Toast');
    expect(source).toContain('已生成下周实验模板。');
    expect(source).toContain('计划调整功能暂时无法加载，请稍后再试。');
    expect(source).not.toContain('window.alert');
  });
});
