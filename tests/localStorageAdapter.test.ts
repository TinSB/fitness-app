import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STORAGE_KEY, STORAGE_KEYS } from '../src/data/trainingData';
import {
  readStoredAppDataFromLocalStorage,
  writeAppDataToLocalStorage,
  type AppDataStorageLike,
} from '../src/storage/localStorageAdapter';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

class MemoryStorage implements AppDataStorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class ThrowingStorage implements AppDataStorageLike {
  constructor(private readonly mode: 'get' | 'set') {}

  getItem(_key: string) {
    if (this.mode === 'get') throw new Error('read failed');
    return null;
  }

  setItem(_key: string, _value: string) {
    if (this.mode === 'set') throw new Error('write failed');
  }
}

const storageSourceFiles = () => readdirSync(join(process.cwd(), 'src', 'storage')).filter((file) => file.endsWith('.ts'));

describe('localStorage adapter boundary', () => {
  it('writes and reads the existing split-key AppData shape', () => {
    const storage = new MemoryStorage();
    const data = sanitizeData(
      makeAppData({
        history: [
          makeSession({
            id: 'adapter-session',
            date: '2026-05-07',
            templateId: 'push-a',
            exerciseId: 'bench-press',
            setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
          }),
        ],
        selectedTemplateId: 'push-a',
      }),
    );

    expect(writeAppDataToLocalStorage(data, storage)).toEqual({ ok: true });
    expect(storage.getItem(STORAGE_KEYS.templates)).toBeTruthy();
    expect(storage.getItem(STORAGE_KEYS.history)).toContain('adapter-session');
    expect(storage.getItem(STORAGE_KEYS.settings)).toContain('selectedTemplateId');

    const read = readStoredAppDataFromLocalStorage(storage);
    expect(read.ok).toBe(true);
    expect(read.found).toBe(true);
    if (!read.ok || !read.found) throw new Error('expected split data');
    expect(sanitizeData(read.rawData).history.map((session) => session.id)).toEqual(['adapter-session']);
  });

  it('reads legacy monolith storage when split keys are absent', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(makeAppData({ selectedTemplateId: 'legs-a' })));

    const read = readStoredAppDataFromLocalStorage(storage);

    expect(read.ok).toBe(true);
    expect(read.found).toBe(true);
    if (!read.ok || !read.found) throw new Error('expected monolith data');
    expect(sanitizeData(read.rawData).selectedTemplateId).toBe('legs-a');
  });

  it('does not turn malformed split JSON into a corrupted saved AppData object', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.templates, '{not json');
    storage.setItem(STORAGE_KEYS.settings, '{not json');

    const read = readStoredAppDataFromLocalStorage(storage);

    expect(read.ok).toBe(true);
    expect(read.found).toBe(true);
    if (!read.ok || !read.found) throw new Error('expected fallback raw data');
    const sanitized = sanitizeData(read.rawData);
    expect(sanitized.templates.length).toBeGreaterThan(0);
    expect(sanitized.history).toEqual([]);
  });

  it('has safe unavailable-storage and failure paths', () => {
    const data = sanitizeData(makeAppData());

    expect(readStoredAppDataFromLocalStorage(null)).toEqual({ ok: true, found: false, rawData: null });
    expect(writeAppDataToLocalStorage(data, null)).toEqual({ ok: true });
    expect(readStoredAppDataFromLocalStorage(new ThrowingStorage('get')).ok).toBe(false);
    expect(writeAppDataToLocalStorage(data, new ThrowingStorage('set')).ok).toBe(false);
  });

  it('keeps AppData localStorage access in the adapter or persistence facade only', () => {
    const offenders = storageSourceFiles().filter((file) => {
      if (file === 'localStorageAdapter.ts' || file === 'persistence.ts') return false;
      const source = readFileSync(join(process.cwd(), 'src', 'storage', file), 'utf8');
      return /\blocalStorage\b/.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
