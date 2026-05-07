import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const fixtureDir = path.join(process.cwd(), 'tests', 'fixtures', 'realDataRegression');
const jsonFiles = fs.readdirSync(fixtureDir).filter((file) => file.endsWith('.json'));

const countSessions = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countSessions(item), 0);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const ownHistory = Array.isArray(record.history) ? record.history.length : 0;
    return ownHistory + Object.values(record).reduce((total, item) => total + countSessions(item), 0);
  }
  return 0;
};

const maxExercisesPerSession = (value: unknown): number => {
  if (Array.isArray(value)) return Math.max(0, ...value.map(maxExercisesPerSession));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const own = Array.isArray(record.exercises) ? record.exercises.length : 0;
    return Math.max(own, ...Object.values(record).map(maxExercisesPerSession));
  }
  return 0;
};

const maxSetsPerExercise = (value: unknown): number => {
  if (Array.isArray(value)) return Math.max(0, ...value.map(maxSetsPerExercise));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const own = Array.isArray(record.sets) ? record.sets.length : 0;
    return Math.max(own, ...Object.values(record).map(maxSetsPerExercise));
  }
  return 0;
};

describe('real data fixture privacy guard', () => {
  it('documents that real data fixtures are anonymous minimal reconstructions', () => {
    const readme = fs.readFileSync(path.join(fixtureDir, 'README.md'), 'utf8');

    expect(readme).toContain('anonymized');
    expect(readme).toContain('minimized reconstructions');
    expect(readme).toContain('not full IronPath exports');
    expect(readme).toContain('personal details');
    expect(readme).toContain('regression');
  });

  it('keeps each JSON fixture small, scoped, and wrapped with fixture metadata', () => {
    expect(jsonFiles.sort()).toEqual([
      'duplicate-plan-draft.json',
      'incomplete-draft-sets-session.json',
      'legacy-assisted-pullup-session.json',
      'legacy-unit-display.json',
      'ppl-cycle-boundary-history.json',
      'stale-today-soreness.json',
    ]);

    jsonFiles.forEach((file) => {
      const filePath = path.join(fixtureDir, file);
      const text = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(text) as Record<string, unknown>;

      expect(Buffer.byteLength(text, 'utf8')).toBeLessThan(40_000);
      expect(parsed.fixtureMeta).toMatchObject({ privacy: 'anonymous minimal reconstruction' });
      expect(parsed.data).toBeDefined();
      expect(countSessions(parsed.data)).toBeLessThanOrEqual(6);
      expect(maxExercisesPerSession(parsed.data)).toBeLessThanOrEqual(3);
      expect(maxSetsPerExercise(parsed.data)).toBeLessThanOrEqual(3);
    });
  });

  it('does not include obvious personal information or full export-only sections', () => {
    const forbiddenPatterns = [
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /\b1[3-9]\d{9}\b/,
      /\b\d{17}[\dXx]\b/,
      /"(?:email|phone|address|wechat|qq|idCard|displayName|fullName|userName)"\s*:/i,
      /Apple Health Export/i,
      /<HealthData/i,
      /HKQuantityTypeIdentifier/i,
      /"localStorageDump"\s*:/i,
      /"rawExport"\s*:/i,
    ];

    jsonFiles.forEach((file) => {
      const text = fs.readFileSync(path.join(fixtureDir, file), 'utf8');

      forbiddenPatterns.forEach((pattern) => {
        expect(text).not.toMatch(pattern);
      });
    });
  });
});
