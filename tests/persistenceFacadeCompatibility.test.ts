import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../src/data/trainingData';
import {
  emptyData,
  loadData,
  migrateTrainingData,
  sanitizeData,
  saveData,
  validateAppDataSchema,
  validateProgramSchema,
} from '../src/storage/persistence';
import { buildPendingSessionPatch, markPendingSessionPatchConsumed, type SessionPatch } from '../src/engines/sessionPatchEngine';
import { makeAppData, makeSession } from './fixtures';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('persistence facade compatibility', () => {
  it('keeps the old public persistence API available from one facade', () => {
    expect(typeof loadData).toBe('function');
    expect(typeof saveData).toBe('function');
    expect(typeof sanitizeData).toBe('function');
    expect(typeof emptyData).toBe('function');
    expect(typeof migrateTrainingData).toBe('function');
    expect(typeof validateAppDataSchema).toBe('function');
    expect(typeof validateProgramSchema).toBe('function');
  });

  it('keeps saveData/loadData round-trip behavior through the persistence facade', () => {
    const storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);

    const patch: SessionPatch = {
      id: 'facade-patch',
      type: 'reduce_intensity',
      title: '降低强度',
      description: '本次训练保守推进。',
      reason: '状态一般。',
      reversible: true,
    };
    const pending = buildPendingSessionPatch({
      patches: [patch],
      createdAt: '2026-05-07',
      sourceFingerprint: 'facade:persistence',
      targetTemplateId: 'push-a',
    });
    const pendingSessionPatches = markPendingSessionPatchConsumed([pending], pending.id, '2026-05-07T10:00:00.000Z');
    const data = sanitizeData(
      makeAppData({
        selectedTemplateId: 'pull-a',
        activeProgramTemplateId: 'pull-a',
        history: [
          makeSession({
            id: 'facade-session',
            date: '2026-05-07',
            templateId: 'pull-a',
            exerciseId: 'lat-pulldown',
            setSpecs: [{ weight: 70, reps: 8, rir: 2 }],
          }),
        ],
        pendingSessionPatches,
        dismissedCoachActions: [{ actionId: 'coach-facade', dismissedAt: '2026-05-07T10:01:00.000Z', scope: 'today' }],
        dismissedDataHealthIssues: [{ issueId: 'health-facade', dismissedAt: '2026-05-07T10:02:00.000Z', scope: 'today' }],
        settings: {
          pendingSessionPatches,
          dismissedCoachActions: [{ actionId: 'coach-facade', dismissedAt: '2026-05-07T10:01:00.000Z', scope: 'today' }],
          dismissedDataHealthIssues: [{ issueId: 'health-facade', dismissedAt: '2026-05-07T10:02:00.000Z', scope: 'today' }],
          dataRepairLogs: [
            {
              id: 'facade-repair',
              createdAt: '2026-05-07T10:03:00.000Z',
              repairId: 'facade-repair',
              repairedAt: '2026-05-07T10:03:00.000Z',
              category: 'unit',
              action: '显示重量修复',
              affectedIds: ['facade-session'],
              beforeSummary: '1 条旧显示字段',
              afterSummary: '已清理',
            },
          ],
        },
      }),
    );

    saveData(data);
    const loaded = loadData();

    expect(storage.getItem(STORAGE_KEYS.templates)).toBeTruthy();
    expect(loaded.history.map((session) => session.id)).toEqual(['facade-session']);
    expect(loaded.selectedTemplateId).toBe('pull-a');
    expect(loaded.activeProgramTemplateId).toBe('pull-a');
    expect(loaded.pendingSessionPatches?.[0]?.status).toBe('consumed');
    expect(loaded.dismissedCoachActions).toEqual(data.dismissedCoachActions);
    expect(loaded.dismissedDataHealthIssues).toEqual(data.dismissedDataHealthIssues);
    expect(loaded.settings.dataRepairLogs?.[0]).toMatchObject({ category: 'unit', affectedIds: ['facade-session'] });
  });
});
