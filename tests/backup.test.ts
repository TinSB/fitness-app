import { describe, expect, it } from 'vitest';
import { STORAGE_VERSION } from '../src/data/trainingData';
import { exportAppData, importAppData } from '../src/storage/backup';
import { makeAppData, makeSession } from './fixtures';

describe('backup', () => {
  it('exports AppData as valid JSON', () => {
    const data = makeAppData({
      history: [
        makeSession({
          id: 's1',
          date: '2026-04-25',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 70, reps: 8 }],
        }),
      ],
    });

    const parsed = JSON.parse(exportAppData(data));

    expect(parsed.schemaVersion).toBe(STORAGE_VERSION);
    expect(parsed.history).toHaveLength(1);
  });

  it('imports and migrates legacy data', () => {
    const result = importAppData(
      JSON.stringify({
        history: [
          {
            id: 'legacy',
            date: '2026-04-20',
            templateId: 'push-a',
            templateName: 'Push A',
            trainingMode: 'hybrid',
            exercises: [
              {
                id: 'bench-press',
                name: 'Bench Press',
                muscle: 'chest',
                kind: 'compound',
                repMin: 6,
                repMax: 8,
                rest: 120,
                startWeight: 60,
                sets: [{ weight: 60, reps: 8, done: true }],
              },
            ],
          },
        ],
      })
    );

    expect(result.ok).toBe(true);
    expect(result.data?.schemaVersion).toBe(STORAGE_VERSION);
    expect(result.data?.history[0]?.supportExerciseLogs).toEqual([]);
  });

  it('rejects invalid JSON without producing replacement data', () => {
    const result = importAppData('{not json');

    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toContain('JSON');
  });
});
