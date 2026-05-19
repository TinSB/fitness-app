import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('UI-OS mobile app PRD blueprint', () => {
  const docPath = 'docs/UI_OS_MOBILE_APP_PRD_BLUEPRINT.md';
  const doc = () => readSource(docPath);

  it('exists and records task identity plus baseline evidence', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const content = doc();

    for (const expected of [
      'Task UI-OS 1',
      'IronPath Mobile App Operating System PRD & Blueprint',
      'docs/static tests only',
      'product/design planning only',
      'Phase 17 equipment-aware load model work is complete.',
      'Task 17H',
      'PR #271',
      '33c0d1256f4656f9c99af409db2dccec13652497',
      '1098 files / 4475 tests',
      'dist token scan clean',
      'Vercel npm lockfile fix complete.',
      'PR #270',
      'fc2bacb9868886950c53cc78b98487ececefe9b5',
      'pnpm-lock.yaml',
      'npm/package-lock path is the expected deploy path',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('defines product direction principles goals and main navigation', () => {
    const content = doc();

    for (const expected of [
      'personal-only, not SaaS',
      'SaaS is deferred',
      'personal professional training system',
      'mobile-first',
      'training-first',
      'local-first',
      'feasible load over theoretical load',
      'Chinese-first',
      'open app to training start in 10 seconds or less',
      'record a set in 5 seconds or less',
      'complete workout in 15 seconds or less',
      'Today / Train / History / Progress / Settings',
      'Today / 今日',
      'Train / 训练',
      'History / 历史',
      'Progress / 进步',
      'Settings / 设置',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('covers page responsibilities and training flow', () => {
    const content = doc();

    for (const expected of [
      '### Today',
      'daily recommendation',
      'active/unfinished session notice',
      'local data safety status',
      '### Train',
      'active workout / Focus Mode',
      'equipment-aware load display',
      'apply suggestion',
      '### History',
      'recent workouts',
      'anomaly/data-health hints',
      '### Progress',
      'PR / e1RM',
      'effective sets',
      'human-readable training trend summary',
      '### Settings',
      'backup / recovery',
      'emergency local',
      'equipment profiles',
      'cloud candidate',
      'Open app.',
      'Review Today.',
      'Enter Focus Mode.',
      'Complete workout.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents equipment-aware load display requirements and examples', () => {
    const content = doc();

    for (const expected of [
      'Equipment-aware load display spec',
      'Bench warmup theoretical 17 lb to empty Olympic bar 45 lb',
      'Bench `135 lb` -> `135 lb total / 每边 45 lb`',
      'Bench `115 lb` -> `每边 25 + 10`',
      'Smith machine -> `25 lb` bar default',
      'Dumbbell -> each hand / 每只手',
      'Selectorized machine -> machine stack / 插片',
      'Plate-loaded -> per-side plates + base/sled warning',
      'Unknown/custom -> safe fallback warning',
      'Primary display uses feasible load.',
      'Theoretical load can remain in details only.',
      'Apply suggestion must use feasible load.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('lists core components visual direction copy principles and v0/Codex scopes', () => {
    const content = doc();

    for (const expected of [
      'MobileAppShell',
      'BottomNav',
      'TopStatusBar',
      'PageContainer',
      'TodayRecommendationCard',
      'TrainingFocusCard',
      'SetPrescriptionCard',
      'EquipmentAwareLoadDisplay',
      'DataSourceBadge',
      'BackupReadinessBadge',
      'EmergencyLocalNotice',
      'RollbackKillSwitchPanel',
      'dark sports UI',
      'large readable typography',
      'low-friction mobile tap targets',
      'no automatic sync language',
      'no SaaS overclaim',
      'v0 should create',
      'v0 must not',
      'Codex should',
      'Codex must not',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('defines implementation phase plan success criteria and UI-OS 2 not-started state', () => {
    const content = doc();

    for (const expected of [
      'UI-OS 2 — v0 App Shell & Design System Prototype',
      'UI-OS 3 — Codex App Shell Integration',
      'UI-OS 4 — Today / Train / Focus Mode Redesign',
      'UI-OS 5 — History / Progress / Data Health Redesign',
      'UI-OS 6 — Settings / Safety / Equipment Profile Redesign',
      'UI-OS 2 is recommended next.',
      'UI-OS 2 is not started by UI-OS 1.',
      'app to training start <= 10 seconds',
      'set logging <= 5 seconds',
      'workout completion <= 15 seconds',
      'source-of-truth confusion = 0',
      'accidental cloud operation = 0',
      'data loss = 0',
      'UI-OS 1 does not start UI-OS 2.',
      'No UI runtime was implemented.',
      'No v0 code was added.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
