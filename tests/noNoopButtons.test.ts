import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const collectSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });

const sourceFiles = () => collectSourceFiles(resolve(root, 'src'));

describe('no noop user buttons', () => {
  it('does not wire visible buttons to empty click handlers or console-only actions', () => {
    const offenders = sourceFiles()
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return (
          /onClick=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(source) ||
          /onClick=\{\s*noop\s*\}/.test(source) ||
          /onClick=\{\s*\(\s*\)\s*=>\s*undefined\s*\}/.test(source) ||
          /console\.log\s*\(/.test(source)
        );
      })
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

  it('keeps CoachActionCard from rendering disabled fake buttons for missing callbacks', () => {
    const source = readFileSync(resolve(root, 'src/ui/CoachActionCard.tsx'), 'utf8');

    expect(source).toContain('hasAnyAction');
    expect(source).toContain('当前入口暂不可用');
    expect(source).not.toContain('disabled={!onPrimary}');
    expect(source).not.toContain('disabled={!onSecondary}');
    expect(source).not.toContain('disabled={!onDetail}');
  });

  it('keeps Plan advice buttons on aggregated actions instead of raw repeated lists', () => {
    const source = readFileSync(resolve(root, 'src/features/PlanView.tsx'), 'utf8');

    expect(source).toContain('inbox.visibleItems.map');
    expect(source).toContain('inbox.hiddenItems.map');
    expect(source).not.toContain('coachActions.map');
    expect(source).not.toContain('volumeAdaptation?.muscles?.map');
  });
});
