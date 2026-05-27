import { describe, expect, it, vi } from 'vitest';
import {
  checkSessionBackfill,
  filterSessionsForRecommendation,
} from '../src/engines/sessionBackfillToleranceEngine';
import { loadData } from '../src/storage/persistence';
import { emptyData } from '../src/storage/appDataSanitize';
import type { TrainingSession } from '../src/models/training-model';

const baseSession = (overrides: Partial<TrainingSession>): TrainingSession =>
  ({
    id: overrides.id ?? 'sess-1',
    date: overrides.date ?? '2026-04-01',
    templateId: 'template-1',
    templateName: 'template',
    trainingMode: 'standard',
    exercises: [],
    ...overrides,
  } as unknown as TrainingSession);

describe('sessionBackfillToleranceEngine (Feature #33)', () => {
  it('treats sessions logged the same day as fresh', () => {
    const session = baseSession({
      id: 'fresh',
      date: '2026-04-01',
      startedAt: '2026-04-01T09:00:00.000Z',
    });
    const out = checkSessionBackfill(session);
    expect(out.isBackfilled).toBe(false);
    expect(out.reason).toBe('within_tolerance');
  });

  it('treats a 5-day-old log as still inside the tolerance window', () => {
    const session = baseSession({
      id: 'recent',
      date: '2026-04-01',
      startedAt: '2026-04-06T20:00:00.000Z',
    });
    const out = checkSessionBackfill(session);
    expect(out.isBackfilled).toBe(false);
  });

  it('marks a log filed 10 days after the claimed date as backfilled', () => {
    const session = baseSession({
      id: 'late',
      date: '2026-04-01',
      startedAt: '2026-04-11T09:00:00.000Z',
    });
    const out = checkSessionBackfill(session);
    expect(out.isBackfilled).toBe(true);
    expect(out.reason).toBe('beyond_tolerance');
    expect(out.gapDays).toBeGreaterThanOrEqual(10);
  });

  it('filterSessionsForRecommendation drops backfilled sessions but keeps fresh ones', () => {
    const sessions: TrainingSession[] = [
      baseSession({ id: 'fresh', date: '2026-04-01', startedAt: '2026-04-01T09:00:00.000Z' }),
      baseSession({ id: 'late', date: '2026-04-01', startedAt: '2026-04-30T09:00:00.000Z' }),
    ];
    const out = filterSessionsForRecommendation(sessions);
    expect(out.map((s) => s.id)).toEqual(['fresh']);
  });
});

describe('schema upgrade silent fallback (Feature #34)', () => {
  it('loadData() returns emptyData() when the persistence layer reports a hard read failure', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const realLocalStorage = globalThis.localStorage;
    // Replace localStorage with one that throws on every read. loadData is
    // expected to swallow the throw, log to console, and hand the caller a
    // fresh empty AppData instead of bubbling the error up to the app shell.
    const throwingStorage = {
      getItem: () => {
        throw new Error('synthetic storage failure');
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => throwingStorage,
    });

    try {
      const out = loadData();
      const expected = emptyData();
      expect(out.history).toEqual(expected.history);
      expect(out.templates).toEqual(expected.templates);
      expect(out.userProfile).toEqual(expected.userProfile);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get: () => realLocalStorage,
      });
      errorSpy.mockRestore();
    }
  });
});
