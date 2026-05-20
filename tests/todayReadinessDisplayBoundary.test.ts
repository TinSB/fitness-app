import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('today readiness display boundaries', () => {
  it('keeps the readiness decision in TodayView and the hero presentational', () => {
    const todayView = read('src/features/TodayView.tsx');
    const hero = read('src/uiOs/today/TodayDecisionHero.tsx');
    const summary = read('src/uiOs/today/TodayReadinessDecisionSummary.tsx');

    expect(todayView).toContain('buildTodayTrainingReadinessDecision');
    expect(todayView).toContain('todayReadinessDecision');
    expect(hero).not.toContain('todayTrainingReadinessDecisionEngine');
    expect(hero).not.toContain('buildTodayTrainingReadinessDecision');
    expect(summary).not.toContain('buildTodayTrainingReadinessDecision');
  });

  it('does not add storage, route, cloud, patch-apply, or plan-draft behavior for display state', () => {
    const touchedRuntimeSources = [
      read('src/features/TodayView.tsx'),
      read('src/uiOs/today/TodayReadinessDecisionSummary.tsx'),
      read('src/uiOs/today/TodayDecisionHero.tsx'),
    ].join('\n');

    for (const forbidden of [
      'localStorage',
      '../storage',
      '/storage',
      'devApi',
      'apps/api',
      'node:',
      'fetch(',
      'applySessionPatches',
      'upsertPendingSessionPatch',
      'upsertPlanAdjustmentDraftByFingerprint',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      '应用到计划',
      '自动调整',
      '自动套用',
    ]) {
      expect(touchedRuntimeSources).not.toContain(forbidden);
    }
  });

  it('does not add persisted Today readiness fields to AppData, TrainingSession, persistence, or backup surfaces', () => {
    const persistenceSurfaces = [
      read('src/models/training-model.ts'),
      read('src/models/training-data.schema.json'),
      read('src/storage/persistence.ts'),
      read('src/storage/backup.ts'),
    ].join('\n');

    for (const forbidden of [
      'todayReadinessDecision',
      'todayTrainingReadinessDecision',
      'TodayTrainingReadinessDecision',
      'todayReadinessDisplay',
    ]) {
      expect(persistenceSurfaces).not.toContain(forbidden);
    }
  });

  it('keeps browser mutation routes and package surfaces unchanged', () => {
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
    expect(read('package.json')).not.toContain('todayReadinessDisplay');
    expect(read('package-lock.json')).not.toContain('todayReadinessDisplay');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('keeps new visible copy free of technical and durable-action wording', () => {
    const visibleCopy = [
      '状态正常',
      '建议保守',
      '动作优先',
      '建议降量',
      '建议恢复',
      '需要复查',
      '缺少安排',
      '训练进行中',
      '今日已完成',
      '只影响本次，不改变计划',
      '可切换到',
      '确认后再开始训练',
    ].join(' ');

    for (const forbidden of [
      '引擎',
      '算法',
      '自动化',
      '模型',
      'AI 教练',
      '系统判断',
      '智能推荐',
      '决策系统',
      'engine',
      'algorithm',
      'automation',
      'model',
      'AI coach',
      'intelligent recommendation',
      'decision system',
      '智能判断',
      '系统建议',
      '算法推荐',
      '引擎判断',
      'AI 建议',
      '自动安排',
      '自动调整',
      '应用到计划',
      '自动套用',
    ]) {
      expect(visibleCopy).not.toContain(forbidden);
    }
  });
});
