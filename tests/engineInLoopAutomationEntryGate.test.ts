import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const docPath = resolve(root, 'docs/ENGINE_IN_THE_LOOP_AUTOMATION_V1.md');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const requiredRoutes = [
  '/data-health/issues/:issueId/dismiss',
  '/history/:id/data-flag',
  '/history/:id/edit',
  '/sessions/start',
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
];

describe('Phase 18A engine-in-the-loop automation entry gate', () => {
  it('documents the product thesis lifecycle contract and automation levels', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'Phase 18A',
      'IronPath is not just a logging app',
      'local deterministic training decision system',
      'Level 0 - Display only',
      'Level 1 - Suggest',
      'Level 2 - Prefill',
      'Level 3 - Guarded apply',
      'Level 4 - Auto queued recommendation',
      'Level 5 - Fully automatic plan mutation',
      'Level 5 is blocked',
      'Before workout / Today',
      'During workout / Focus',
      'After workout',
      'Weekly / mesocycle',
      'EngineTrainingDecision',
      'recommendationKind',
      'requiresConfirmation',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('locks safety boundaries and the first implementation candidate', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'localStorage remains default/fallback/migration/emergency source',
      'accepted browser mutation routes remain exactly seven',
      'no default cloud sync',
      'no background sync',
      'no SaaS',
      'no AppData schema change',
      'no package or lockfile drift',
      'actionableLoad remains main UI/apply/validation baseline',
      'rawTheoreticalLoad remains internal/detail-only',
      'user confirmation required before durable plan mutation',
      'First implementation candidate: Focus Next Set Recommendation Engine V1',
      '18B - Focus Next Set Recommendation Engine V1',
      '18C - Focus Next Set UI Integration V1',
      '18D - Post-Workout Next-Time Recommendation V1',
      '18E - Today Training Readiness Decision V1',
      '18F - Weekly Progression Recommendation V1',
      '18G - Guarded Apply / Pending Recommendation Contract V1',
    ]) {
      expect(doc).toContain(required);
    }

    expect((doc.match(/First implementation candidate:/g) || [])).toHaveLength(1);
    expect(doc).toContain('Do not start with weekly AI coach');
    expect(doc).toContain('Do not start with broad plan auto-rewrite');
    expect(doc).toContain('Do not start with cloud sync');
    expect(doc).toContain('Do not start with visual dashboard');
    expect(doc).toContain('Do not start with chat assistant');
    expect(doc).toContain('Do not start with large UI redesign');
  });

  it('does not imply unsafe automation is enabled by this entry task', () => {
    const doc = readFileSync(docPath, 'utf8');
    const forbiddenEnabledNow = [
      'Level 5 is enabled',
      'fully automatic plan mutation is enabled',
      'automatic cloud pull/apply is enabled',
      'default cloud sync is enabled',
      'background sync is enabled',
      'Phase 18A enables fully automatic plan mutation',
      'Phase 18A implements runtime automation',
    ];

    for (const forbidden of forbiddenEnabledNow) {
      expect(doc).not.toContain(forbidden);
    }
  });

  it('keeps route package and source-of-truth boundaries unchanged', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual(requiredRoutes);
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).not.toContain('/data-health/repair/apply');
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);

    const packageJson = read('package.json');
    expect(packageJson).not.toContain('cloud:sync');
    expect(packageJson).not.toContain('phase18:auto');

    const storageSource = read('src/storage/persistence.ts') + read('src/storage/localStorageAdapter.ts');
    expect(storageSource).toContain('readStoredAppDataFromLocalStorage');
    expect(storageSource).toContain('writeAppDataToLocalStorage');
  });
});
