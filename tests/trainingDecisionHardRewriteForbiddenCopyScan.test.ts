// Static source scan: forbid legacy contradictory copy patterns in any UI
// or feature file. The triplet co-occurrence (`力量有进步` AND
// `恢复压力偏高` AND `下次建议保持重量`) is explicitly forbidden in the same file.
// See docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md §11.

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

const collect = (relPaths: string[]) =>
  relPaths.flatMap((rel) => walk(path.join(ROOT, rel)));

const FORBIDDEN_PHRASES = [
  '原计划 vs 当前建议',
  '原计划阶段 vs 当前建议',
  '系统判断',
  'AI 教练',
];

describe('trainingDecisionHardRewriteForbiddenCopyScan', () => {
  it('uiOs + features must not contain wall / system-judgment / AI-coach phrases', () => {
    const files = collect(['src/uiOs', 'src/features']);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf-8');
      for (const phrase of FORBIDDEN_PHRASES) {
        if (src.includes(phrase)) {
          offenders.push(`${path.relative(ROOT, file)}: contains "${phrase}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('legacy contradictory triplet must not co-occur in any single uiOs/feature file', () => {
    const files = collect(['src/uiOs', 'src/features']);
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
