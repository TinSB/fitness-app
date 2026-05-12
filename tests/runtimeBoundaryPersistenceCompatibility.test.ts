import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  emptyData,
  loadData,
  migrateTrainingData,
  sanitizeData,
  saveData,
  validateAppDataSchema,
  validateProgramSchema,
} from '../src/storage/persistence';
import { readStoredAppDataFromLocalStorage, writeAppDataToLocalStorage } from '../src/storage/localStorageAdapter';
import { exportAppData, importAppData } from '../src/storage/backup';
import { makeAppData, makeSession } from './fixtures';
import {
  collectRuntimeSourceFiles,
  repoRoot,
} from './runtimeBoundaryTestHelpers';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const PURE_STORAGE_FILES = [
  'src/storage/appDataMigration.ts',
  'src/storage/appDataSanitize.ts',
  'src/storage/appDataValidation.ts',
  'src/storage/appDataStorageUtils.ts',
];

const directLocalStorageAccessPattern = /(?:\b(?:window|globalThis)\.localStorage\b|\blocalStorage\s*[.\[]|typeof\s+localStorage\b)/;

describe('runtime boundary persistence compatibility acceptance', () => {
  it('keeps persistence.ts as the compatibility facade for existing public exports', () => {
    expect(typeof loadData).toBe('function');
    expect(typeof saveData).toBe('function');
    expect(typeof sanitizeData).toBe('function');
    expect(typeof emptyData).toBe('function');
    expect(typeof migrateTrainingData).toBe('function');
    expect(typeof validateAppDataSchema).toBe('function');
    expect(typeof validateProgramSchema).toBe('function');
  });

  it('keeps pure storage boundaries free of browser globals and direct storage I/O', () => {
    PURE_STORAGE_FILES.forEach((file) => {
      const source = readFileSync(resolve(repoRoot(), file), 'utf8');
      expect(source).not.toMatch(/\b(?:window|document|localStorage)\s*[.\[]/);
      expect(source).not.toMatch(/typeof\s+(?:window|document|localStorage)\b/);
    });
  });

  it('keeps localStorageAdapter as the only AppData localStorage access point in storage modules', () => {
    const offenders = collectRuntimeSourceFiles(resolve(repoRoot(), 'src/storage'))
      .filter((file) => !file.endsWith('localStorageAdapter.ts'))
      .filter((file) => directLocalStorageAccessPattern.test(readFileSync(file, 'utf8')));

    expect(offenders.map((file) => file.replaceAll('\\', '/'))).toEqual([]);
  });

  it('round-trips AppData through the browser I/O adapter without changing persistence semantics', () => {
    const storage = new MemoryStorage();
    const data = sanitizeData(
      makeAppData({
        history: [
          makeSession({
            id: 'runtime-boundary-session',
            date: '2026-05-09',
            templateId: 'push-a',
            exerciseId: 'bench-press',
            setSpecs: [{ weight: 100, reps: 5, rir: 2 }],
          }),
        ],
        selectedTemplateId: 'push-a',
      }),
    );

    expect(writeAppDataToLocalStorage(data, storage)).toEqual({ ok: true });
    const stored = readStoredAppDataFromLocalStorage(storage);
    expect(stored.ok).toBe(true);
    expect(stored.found).toBe(true);
    if (!stored.ok || !stored.found) throw new Error('expected stored AppData');
    expect(sanitizeData(stored.rawData).history.map((session) => session.id)).toEqual(['runtime-boundary-session']);
  });

  it('keeps unsafe backup import rejected before any default-data sanitize fallback can replace it', () => {
    const unsafe = importAppData(JSON.stringify({ source: 'health-json', samples: [] }));
    const cleaned = importAppData(exportAppData(sanitizeData(makeAppData({ selectedTemplateId: 'legs-a' }))));

    expect(unsafe.ok).toBe(false);
    expect(unsafe.data).toBeUndefined();
    expect(cleaned.ok).toBe(true);
    expect(cleaned.data?.selectedTemplateId).toBe('legs-a');
  });
});
