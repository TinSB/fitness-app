import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('weekly progression recommendation boundaries', () => {
  it('wires weekly progression only into Progress metrics and Plan passive display surfaces', () => {
    const blockedFiles = [
      'src/App.tsx',
      'src/features/ProgressView.tsx',
      'src/features/TodayView.tsx',
      'src/features/TrainingFocusView.tsx',
    ];

    for (const file of blockedFiles) {
      const source = read(file);
      expect(source).not.toContain('weeklyProgressionRecommendationEngine');
      expect(source).not.toContain('buildWeeklyProgressionRecommendation');
      expect(source).not.toContain('WeeklyProgressionRecommendation');
    }

    const recordSource = read('src/features/RecordView.tsx');
    const planSource = read('src/features/PlanView.tsx');

    expect(recordSource).toContain('buildWeeklyProgressionRecommendation');
    expect(recordSource).toContain("surfaceMode === 'progress'");
    expect(recordSource).toContain('WeeklyProgressionRecommendationCard');
    expect(planSource).toContain('buildWeeklyProgressionRecommendation');
    expect(planSource).toContain('WeeklyProgressionRecommendationCard');
  });

  it('keeps weekly progression display details free of persistence, routes, API, internals, and durable apply paths', () => {
    const source = read('src/uiOs/progress/WeeklyProgressionRecommendationCard.tsx');
    const forbidden = [
      '../storage',
      '/storage',
      'localStorage',
      'devApi',
      'apps/api',
      'node:',
      'fetch(',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      'applySessionPatches',
      'upsertPendingSessionPatch',
      'upsertPlanAdjustmentDraftByFingerprint',
      'applyAdjustmentDraft',
      'sourceEngineIds',
      'sourceFingerprint',
      'durableEffect',
      '应用到计划',
      '生成计划',
      '生成草案',
      '应用为实验模板',
      '保存建议',
      '同步建议',
      '自动调整',
      '自动应用',
      '自动生成计划',
    ];

    for (const token of forbidden) {
      expect(source).not.toContain(token);
    }
  });

  it('does not add weekly recommendations to AppData or TrainingSession schemas', () => {
    const sources = [
      read('src/models/training-model.ts'),
      read('src/models/training-data.schema.json'),
      read('src/storage/persistence.ts'),
      read('src/storage/backup.ts'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('weeklyProgressionRecommendation');
      expect(source).not.toContain('WeeklyProgressionRecommendation');
      expect(source).not.toContain('weeklyRecommendations');
      expect(source).not.toContain('pendingWeeklyRecommendation');
    }
  });

  it('does not introduce localStorage keys or change browser mutation routes', () => {
    const localStorageAdapter = read('src/storage/localStorageAdapter.ts');

    expect(localStorageAdapter).not.toContain('weeklyProgression');
    expect(localStorageAdapter).not.toContain('weeklyRecommendation');
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).not.toContain('/data-health/repair/apply');
  });

  it('keeps package and lockfile surfaces unchanged by 18F.2', () => {
    expect(read('package.json')).not.toContain('weeklyProgression');
    expect(read('package-lock.json')).not.toContain('weeklyProgression');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('documents 18F.2 as passive explanation display only and not auto-applied', () => {
    const doc = read('docs/ENGINE_IN_THE_LOOP_AUTOMATION_V1.md');

    for (const expected of [
      '18F - Weekly Progression Recommendation V1',
      'pure weekly recommendation engine only',
      'aggregates existing volume, plateau, quality, confidence, pain, and feedback signals',
      'does not persist weekly recommendations',
      'does not create ProgramAdjustmentDraft or PendingSessionPatch records',
      'guarded contracts are in-memory only',
      '18F.1 - Weekly Progression Display Integration V1',
      'display-only integration on Progress metrics and Plan',
      'does not persist weekly recommendations',
      'does not write AppData or TrainingSession',
      'does not create ProgramAdjustmentDraft or PendingSessionPatch records',
      'guarded recommendations stay in-memory passive previews',
      '18F.2 - Weekly Recommendation Detail / Explanation Display V1',
      'passive detail display',
      'explain why the weekly recommendation appears',
      'does not persist weekly recommendations',
      'does not create ProgramAdjustmentDraft or PendingSessionPatch records',
      'does not apply session patches or plan adjustments',
      '下周建议',
      '查看原因',
      '依据',
      '注意',
      '下一步',
      '查看后再决定',
      '只生成候选，不改变计划',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(doc).not.toMatch(/weekly recommendations auto-apply|Weekly recommendations auto-apply|automatic weekly plan mutation is enabled|Level 5 is enabled/i);
  });
});
