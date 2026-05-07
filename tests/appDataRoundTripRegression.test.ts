import { afterEach, describe, expect, it, vi } from 'vitest';
import assistedPullupFixture from './fixtures/realDataRegression/legacy-assisted-pullup-session.json';
import draftSetFixture from './fixtures/realDataRegression/incomplete-draft-sets-session.json';
import planDraftFixture from './fixtures/realDataRegression/duplicate-plan-draft.json';
import { STORAGE_VERSION } from '../src/data/trainingData';
import { getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { sessionCompletedSets } from '../src/engines/engineUtils';
import {
  buildPendingSessionPatch,
  findActivePendingSessionPatch,
  markPendingSessionPatchConsumed,
  type SessionPatch,
} from '../src/engines/sessionPatchEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import type { AppData } from '../src/models/training-model';
import { loadData, sanitizeData, saveData } from '../src/storage/persistence';
import { getTemplate, makeAppData } from './fixtures';

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const pendingPatch: SessionPatch = {
  id: 'round-trip-session-patch',
  type: 'main_only',
  title: '只做主训练',
  description: '本次训练只保留主训练。',
  reason: '今天时间有限。',
  reversible: true,
};

const makeRoundTripData = () => {
  const assistedData = assistedPullupFixture.data as Partial<AppData>;
  const draftData = draftSetFixture.data as Partial<AppData>;
  const planData = planDraftFixture.data as Partial<AppData>;
  const base = sanitizeData(makeAppData({ selectedTemplateId: 'pull-a', activeProgramTemplateId: 'pull-a' }));
  const activeSession = createSession(
    getTemplate('pull-a'),
    base.todayStatus,
    base.history,
    base.trainingMode,
    buildWeeklyPrescription(base),
    undefined,
    base.screeningProfile,
    base.mesocyclePlan,
  );
  const pending = buildPendingSessionPatch({
    patches: [pendingPatch],
    createdAt: '2026-05-04',
    sourceFingerprint: 'round-trip:pull-a:main-only',
    targetTemplateId: 'pull-a',
  });
  const consumedPending = markPendingSessionPatchConsumed([pending], pending.id, '2026-05-04T08:00:00.000Z');

  return sanitizeData({
    ...base,
    history: [...(assistedData.history || []), ...(draftData.history || [])],
    activeSession,
    selectedTemplateId: 'pull-a',
    activeProgramTemplateId: 'pull-a',
    unitSettings: {
      weightUnit: 'lb',
      defaultIncrementKg: 2.5,
      defaultIncrementLb: 5,
      customIncrementsKg: [1.25, 2.5, 5],
      customIncrementsLb: [2.5, 5, 10],
    },
    pendingSessionPatches: consumedPending,
    dismissedCoachActions: [{ actionId: 'coach-action-dismissed', dismissedAt: '2026-05-04T08:10:00.000Z', scope: 'today' }],
    dismissedDataHealthIssues: [{ issueId: 'data-health-dismissed', dismissedAt: '2026-05-04T08:11:00.000Z', scope: 'today' }],
    programAdjustmentDrafts: planData.programAdjustmentDrafts,
    programAdjustmentHistory: planData.programAdjustmentHistory,
    settings: {
      pendingSessionPatches: consumedPending,
      dismissedCoachActions: [{ actionId: 'coach-action-dismissed', dismissedAt: '2026-05-04T08:10:00.000Z', scope: 'today' }],
      dismissedDataHealthIssues: [{ issueId: 'data-health-dismissed', dismissedAt: '2026-05-04T08:11:00.000Z', scope: 'today' }],
      dataRepairLogs: [
        {
          id: 'repair-summary-1',
          createdAt: '2026-05-04T08:12:00.000Z',
          sourceFileName: 'anonymous-minimal.json',
          category: 'replacement',
          action: '保留旧动作身份并标记复核',
          affectedIds: ['fixture-assisted-legacy-invalid'],
          before: { actualExerciseId: 'legacy-assisted-pullup' },
          after: { legacyActualExerciseId: 'legacy-assisted-pullup', identityInvalid: true },
        },
      ],
    },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppData round-trip regression', () => {
  it('saves and loads core AppData fields without dropping state', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const data = makeRoundTripData();

    saveData(data);
    const loaded = loadData();

    expect(loaded.schemaVersion).toBe(STORAGE_VERSION);
    expect(loaded.history.map((session) => session.id)).toEqual([
      'fixture-assisted-valid',
      'fixture-assisted-legacy-invalid',
      'fixture-incomplete-draft',
    ]);
    expect(loaded.activeSession?.id).toBe(data.activeSession?.id);
    expect(loaded.templates.map((template) => template.id)).toContain('pull-a');
    expect(loaded.programTemplate).toMatchObject({ id: data.programTemplate.id });
    expect(loaded.selectedTemplateId).toBe('pull-a');
    expect(loaded.activeProgramTemplateId).toBe('pull-a');
    expect(loaded.unitSettings).toMatchObject({ weightUnit: 'lb', defaultIncrementLb: 5 });
    expect(loaded.pendingSessionPatches?.[0]).toMatchObject({ status: 'consumed', consumedAt: '2026-05-04T08:00:00.000Z' });
    expect(loaded.dismissedCoachActions).toEqual(data.dismissedCoachActions);
    expect(loaded.dismissedDataHealthIssues).toEqual(data.dismissedDataHealthIssues);
    expect(loaded.settings.dataRepairLogs?.[0]).toMatchObject({ category: 'replacement', affectedIds: ['fixture-assisted-legacy-invalid'] });
  });

  it('does not let invalid legacy identity or consumed pending patches revive after save/load', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const data = makeRoundTripData();

    saveData(data);
    const loaded = loadData();
    const invalidExercise = loaded.history.find((session) => session.id === 'fixture-assisted-legacy-invalid')?.exercises[0];
    const draftSession = loaded.history.find((session) => session.id === 'fixture-incomplete-draft');
    const draftSet = draftSession?.exercises.find((exercise) => exercise.id === 'incline-db-press')?.sets[0];
    const appliedDraft = loaded.programAdjustmentDrafts?.find((draft) => draft.id === 'applied-chest-random');
    const rolledDraft = loaded.programAdjustmentDrafts?.find((draft) => draft.id === 'rolled-legs-random');

    expect(invalidExercise).toMatchObject({
      identityInvalid: true,
      legacyActualExerciseId: 'legacy-assisted-pullup',
      legacyReplacementExerciseId: '__auto_alt_assisted_pullup',
    });
    expect(invalidExercise?.actualExerciseId).toBeUndefined();
    expect(getExerciseRecordPoolId(invalidExercise)).toBe('');
    expect(draftSet).toMatchObject({ done: false, weight: 28, actualWeightKg: 28, reps: 10 });
    expect(sessionCompletedSets(draftSession)).toBe(1);
    expect(findActivePendingSessionPatch(loaded.pendingSessionPatches, '2026-05-04', 'pull-a')).toBeUndefined();
    expect(appliedDraft).toMatchObject({ status: 'applied', experimentalProgramTemplateId: 'push-a-experimental' });
    expect(rolledDraft).toMatchObject({ status: 'rolled_back', rolledBackAt: '2026-05-03T10:00:00.000Z' });
  });
});
