// Static source scan: deleted-legacy modules cannot be re-imported by any UI
// or feature file. The list grows as more legacy modules are deleted in
// subsequent commits — these three are the ones removed in V2.
// See docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md §11.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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
  relPaths.flatMap((rel) => (existsSync(path.join(ROOT, rel)) ? walk(path.join(ROOT, rel)) : []));

const DELETED_LEGACY_MODULES = [
  // Phase 1
  'coachAutomationEngine',
  'deloadSignalEngine',
  'recommendationReasonSelector',
  // Phase 2
  'weeklyProgressionRecommendationEngine',
  'progressClaritySummary',
  'postWorkoutNextTimeRecommendationEngine',
  'todayDecisionSurface',
  'recommendationTraceEngine',
  'recommendationExplanationPresenter',
];

describe('trainingDecisionHardRewriteLegacyImportBoundary', () => {
  it('the legacy module source files are gone', () => {
    for (const name of DELETED_LEGACY_MODULES) {
      const file = path.join(ROOT, 'src', 'engines', `${name}.ts`);
      expect(existsSync(file), `legacy module ${name} should be deleted`).toBe(false);
    }
  });

  it('no src/features/** or src/uiOs/** imports a deleted legacy module', () => {
    const files = collect(['src/features', 'src/uiOs']);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf-8');
      for (const name of DELETED_LEGACY_MODULES) {
        const importPattern = new RegExp(`from\\s+['"][^'"]*${name}['"]`);
        if (importPattern.test(src)) {
          offenders.push(`${path.relative(ROOT, file)}: imports ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no src/presenters/** imports a deleted legacy module', () => {
    const files = collect(['src/presenters']);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf-8');
      for (const name of DELETED_LEGACY_MODULES) {
        const importPattern = new RegExp(`from\\s+['"][^'"]*${name}['"]`);
        if (importPattern.test(src)) {
          offenders.push(`${path.relative(ROOT, file)}: imports ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
