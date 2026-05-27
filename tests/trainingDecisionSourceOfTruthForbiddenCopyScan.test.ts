// Static source scan: forbid the legacy contradictory copy patterns from re-appearing in
// any uiOs / feature component as a literal that would render in the normal UI.
// See docs/TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_REWRITE_PLAN_V1.md §11.3, §12.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

const walk = (dir: string, files: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
};

const collectFiles = (relPaths: string[]) =>
  relPaths.flatMap((rel) => walk(path.join(ROOT, rel)));

const FORBIDDEN_WALL_PHRASES = [
  '原计划 vs 当前建议',
  '原计划阶段 vs 当前建议',
  '系统判断',
];

describe('trainingDecisionSourceOfTruthForbiddenCopyScan', () => {
  it('uiOs + features must not contain forbidden wall / system-judgment phrases', () => {
    const files = collectFiles(['src/uiOs', 'src/features']);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf-8');
      for (const phrase of FORBIDDEN_WALL_PHRASES) {
        if (src.includes(phrase)) {
          offenders.push(`${path.relative(ROOT, file)}: contains "${phrase}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('legacy contradictory triplet must not co-occur in any single uiOs component', () => {
    const files = collectFiles(['src/uiOs', 'src/features']);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf-8');
      const hasA = src.includes('力量有进步');
      const hasB = src.includes('恢复压力偏高');
      const hasC = src.includes('下次建议保持重量');
      if (hasA && hasB && hasC) {
        offenders.push(`${path.relative(ROOT, file)}: contains the contradictory triplet`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
