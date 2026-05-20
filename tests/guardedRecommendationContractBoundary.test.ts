import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('guarded recommendation contract boundaries', () => {
  it('does not add guarded recommendation fields to AppData or TrainingSession persistence schemas', () => {
    const model = read('src/models/training-model.ts');
    const schema = read('src/models/training-data.schema.json');
    const persistence = read('src/storage/persistence.ts');
    const backup = read('src/storage/backup.ts');

    for (const source of [model, schema, persistence, backup]) {
      expect(source).not.toContain('guardedRecommendation');
      expect(source).not.toContain('GuardedRecommendationContract');
      expect(source).not.toContain('pendingRecommendation');
    }
  });

  it('does not introduce a localStorage key or durable App runtime wiring for guarded recommendations', () => {
    const app = read('src/App.tsx');
    const storage = read('src/storage/localStorageAdapter.ts');

    expect(app).not.toContain('guardedRecommendation');
    expect(app).not.toContain('GuardedRecommendationContract');
    expect(storage).not.toContain('guardedRecommendation');
    expect(storage).not.toContain('pendingRecommendation');
    expect(storage).not.toContain('guarded_recommendation');
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

  it('keeps package and lockfile surfaces unchanged by the contract layer', () => {
    expect(read('package.json')).not.toContain('guardedRecommendation');
    expect(read('package-lock.json')).not.toContain('guardedRecommendation');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('documents 18G as contract-only and does not enable automatic plan mutation', () => {
    const doc = read('docs/ENGINE_IN_THE_LOOP_AUTOMATION_V1.md');

    expect(doc).toContain('18G - Guarded Apply / Pending Recommendation Contract V1');
    expect(doc).toContain('contract-only');
    expect(doc).toContain('does not persist pending recommendations');
    expect(doc).toContain('does not create ProgramAdjustmentDraft or PendingSessionPatch records');
    expect(doc).toContain('Level 5 is blocked');
    expect(doc).not.toMatch(/fully automatic plan mutation is enabled|automatic plan mutation is enabled|Level 5 is enabled/i);
  });
});
