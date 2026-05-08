import { describe, expect, it } from 'vitest';
import * as sanitizeBoundary from '../src/storage/appDataSanitize';
import * as migrationBoundary from '../src/storage/appDataMigration';
import {
  emptyData as facadeEmptyData,
  migrateTrainingData as facadeMigrateTrainingData,
  sanitizeData as facadeSanitizeData,
} from '../src/storage/persistence';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { makeAppData, makeSession } from './fixtures';

describe('persistence boundary split', () => {
  it('keeps sanitizeData facade output identical to the pure sanitize boundary', () => {
    const raw = {
      ...makeAppData(),
      history: [
        makeSession({
          id: 'boundary-session',
          date: '2026-05-06',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
        }),
      ],
      settings: {
        dataRepairLogs: [
          {
            repairId: 'repair-boundary',
            repairedAt: '2026-05-06T10:00:00.000Z',
            category: 'unit',
            action: '显示重量修复',
            affectedIds: ['boundary-session'],
            beforeSummary: '1 条显示重量旧字段',
            afterSummary: '已清理显示字段',
          },
        ],
      },
    };

    expect(sanitizeBoundary.sanitizeData(raw)).toEqual(facadeSanitizeData(raw));
  });

  it('keeps migration behavior identical through the persistence facade', () => {
    const legacy = {
      status: { sleep: 'ok', energy: 'medium', soreness: ['none'], time: '60' },
      selectedTemplate: 'pull-a',
      mode: 'hybrid',
      history: [
        {
          id: 'legacy-boundary',
          date: '2026-04-20',
          template: { id: 'pull-a', name: 'Pull A' },
          exercises: [
            {
              id: 'lat-pulldown',
              name: 'Lat Pulldown',
              sets: [{ weight: 60, reps: 8, done: true }],
            },
          ],
        },
      ],
    };

    expect(migrationBoundary.migrateTrainingData(legacy)).toEqual(facadeMigrateTrainingData(legacy));
  });

  it('keeps default AppData creation behavior identical', () => {
    expect(sanitizeBoundary.emptyData()).toEqual(facadeEmptyData());
    expect(facadeEmptyData().schemaVersion).toBeGreaterThan(0);
    expect(facadeEmptyData().history).toEqual([]);
  });

  it('keeps real data fixtures identical through facade and pure sanitize boundary', () => {
    const data = buildAppDataFromFixture('legacy-unit-display');

    expect(sanitizeBoundary.sanitizeData(data)).toEqual(facadeSanitizeData(data));
  });
});
