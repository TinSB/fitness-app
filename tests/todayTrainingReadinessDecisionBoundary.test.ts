import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('today training readiness decision boundaries', () => {
  it('keeps 18E out of App persistence while allowing 18E.1 Today display wiring', () => {
    const app = read('src/App.tsx');
    const todayView = read('src/features/TodayView.tsx');

    expect(app).not.toContain('todayTrainingReadinessDecisionEngine');
    expect(app).not.toContain('buildTodayTrainingReadinessDecision');
    expect(todayView).toContain('todayTrainingReadinessDecisionEngine');
    expect(todayView).toContain('buildTodayTrainingReadinessDecision');
    expect(todayView).not.toContain('localStorage');
    expect(todayView).not.toContain('upsertPendingSessionPatch');
    expect(todayView).not.toContain('upsertPlanAdjustmentDraftByFingerprint');
  });

  it('keeps the new engine isolated from UI, storage, API, and mutation helpers', () => {
    const source = read('src/engines/todayTrainingReadinessDecisionEngine.ts');

    for (const forbidden of [
      'react',
      '../ui',
      '../uiOs',
      '../features',
      '../storage',
      '/storage',
      'localStorage',
      'devApi',
      'apps/api',
      'node:',
      'fetch(',
      'applySessionPatches',
      'upsertPendingSessionPatch',
      'upsertPlanAdjustmentDraftByFingerprint',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not add persisted readiness fields to AppData or TrainingSession schemas', () => {
    const model = read('src/models/training-model.ts');
    const schema = read('src/models/training-data.schema.json');
    const persistence = read('src/storage/persistence.ts');
    const backup = read('src/storage/backup.ts');

    for (const source of [model, schema, persistence, backup]) {
      expect(source).not.toContain('todayTrainingReadinessDecision');
      expect(source).not.toContain('TodayTrainingReadinessDecision');
      expect(source).not.toContain('todayReadinessDecision');
    }
  });

  it('does not introduce localStorage keys or durable apply wording for Today readiness', () => {
    const source = read('src/engines/todayTrainingReadinessDecisionEngine.ts');
    const localStorageAdapter = read('src/storage/localStorageAdapter.ts');

    expect(source).not.toContain('localStorage');
    expect(localStorageAdapter).not.toContain('todayTrainingReadiness');
    expect(source).not.toContain('应用到计划');
    expect(source).not.toContain('自动套用');
    expect(source).not.toContain('自动调整');
  });

  it('keeps accepted browser mutation routes exactly seven', () => {
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

  it('keeps package and lockfile surfaces unchanged by the Today readiness layer', () => {
    expect(read('package.json')).not.toContain('todayTrainingReadinessDecision');
    expect(read('package-lock.json')).not.toContain('todayTrainingReadinessDecision');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('documents 18E and 18E.1 without claiming auto-apply', () => {
    const doc = read('docs/ENGINE_IN_THE_LOOP_AUTOMATION_V1.md');

    expect(doc).toContain('18E - Today Training Readiness Decision V1');
    expect(doc).toContain('pure decision engine only');
    expect(doc).toContain('18E.1 - Today Readiness Display Integration V1');
    expect(doc).toContain('derived and ephemeral display integration');
    expect(doc).toContain('does not persist decisions');
    expect(doc).not.toMatch(/Today decisions auto-apply|today decisions auto-apply|automatic plan mutation is enabled|Level 5 is enabled/i);
  });
});
