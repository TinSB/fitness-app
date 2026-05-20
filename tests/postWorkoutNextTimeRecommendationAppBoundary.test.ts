import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('post-workout next-time recommendation App boundary', () => {
  it('builds post-workout advice from the finalized history session and stores it as ephemeral UI state', () => {
    const app = read('src/App.tsx');

    expect(app).toContain('buildPostWorkoutNextTimeRecommendation');
    expect(app).toContain('useState<PostWorkoutNextTimeRecommendation | null>');
    expect(app).toContain('const completed = completeTrainingSessionIntoHistory(currentData, finishedAt');
    expect(app).toContain('session: finishedSession');
    expect(app).toContain('history: currentData.history || []');
    expect(app).toContain('nowIso: finishedAt');
    expect(app).toContain('setPostWorkoutNextTimeRecommendation(');
    expect(app).toContain('postWorkoutNextTimeRecommendation={postWorkoutNextTimeRecommendation}');
  });

  it('clears ephemeral advice on start, delete, and restore boundaries', () => {
    const app = read('src/App.tsx');

    expect(app).toContain('setPostWorkoutNextTimeRecommendation(null);');
    expect(app).toContain('sourceSessionId === sessionId');
    expect(app).toContain("invalidateDerivedState('backup_restored')");
    expect(app).toContain('progressPostWorkoutNextTimeRecommendation');
  });

  it('does not add post-workout advice to durable data or storage surfaces', () => {
    const model = read('src/models/training-model.ts');
    const schema = read('src/models/training-data.schema.json');
    const persistence = read('src/storage/persistence.ts');
    const app = read('src/App.tsx');

    expect(model).not.toContain('postWorkoutNextTimeRecommendation');
    expect(schema).not.toContain('postWorkoutNextTimeRecommendation');
    expect(persistence).not.toContain('postWorkoutNextTimeRecommendation');
    expect(app).not.toContain('saveData(postWorkoutNextTimeRecommendation');
    expect(app).not.toContain('localStorage.setItem(postWorkoutNextTimeRecommendation');
    expect(app).not.toContain('ProgramAdjustmentDraft(postWorkoutNextTimeRecommendation');
    expect(app).not.toContain('PendingSessionPatch(postWorkoutNextTimeRecommendation');
  });

  it('keeps the display component free of persistence, routes, API, and plan mutation imports', () => {
    const source = read('src/uiOs/records/PostWorkoutNextTimeRecommendationCard.tsx');
    const forbidden = [
      '../storage',
      '/storage',
      'localStorage',
      'devApi',
      'apps/api',
      'node:',
      'fetch(',
      'applyAdjustmentDraft',
      'upsertPlanAdjustmentDraftByFingerprint',
      'PendingSessionPatch',
      'ProgramAdjustmentDraft',
      'sessionPatchEngine',
      '应用到计划',
      '生成计划',
      '自动套用',
      '修改下次训练',
      '保存建议',
      '同步建议',
    ];

    for (const token of forbidden) {
      expect(source).not.toContain(token);
    }
  });

  it('documents 18D.1 as display-only and keeps package files stable', () => {
    const doc = read('docs/ENGINE_IN_THE_LOOP_AUTOMATION_V1.md');

    for (const expected of [
      '18D.1 - Post-Workout Recommendation Display Integration V1',
      'display-only history detail UI',
      'ephemeral React UI state only',
      'not persisted',
      'not written to TrainingSession',
      'does not apply to the plan',
      'Guarded Apply / Pending Recommendation Contract V1',
    ]) {
      expect(doc).toContain(expected);
    }
    expect(read('package.json')).not.toContain('postWorkoutNextTimeRecommendation');
    expect(read('package-lock.json')).not.toContain('postWorkoutNextTimeRecommendation');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });
});
