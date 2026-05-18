import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 16 personal-only roadmap archive', () => {
  const doc = () => readSource('docs/PHASE16_PERSONAL_ONLY_ROADMAP_ARCHIVE.md');

  it('records Task 16G identity and Phase 16 baseline', () => {
    const content = doc();

    for (const expected of [
      'Task 16G',
      'Phase 16 Personal-Only Roadmap Archive V1',
      'Docs/static tests only',
      'Phase 15 was complete before Phase 16 started.',
      'Task 16A chose the personal-only path now and deferred SaaS.',
      'Task 16G archives Phase 16 and does not start Phase 17.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records Task 16A through Task 16C evidence and deliverables', () => {
    const content = doc();

    for (const expected of [
      'Task 16A — Personal-Only vs SaaS Product Decision',
      'PR #256',
      '9dc07d9e804e8d32f41e5cb410cffe273e6ffddd',
      '1058 files / 4256 tests',
      'Decision: personal-only chosen.',
      'SaaS deferred.',
      'Task 16B — Personal-Only Polish / Backup / Reliability Roadmap V1',
      'PR #257',
      '367420b14382d61aae8a10a3f4be10775fb74f7f',
      '1060 files / 4267 tests',
      'Personal-only roadmap created.',
      'Task 16C — Personal-Only Backup & Recovery Implementation Pack V1',
      'PR #258',
      '99343a165e21ca12512664eb71161adfcd38f338',
      '1064 files / 4300 tests',
      'Backup/recovery helper and copy helper added.',
      'src/personalProduction/backupRecoveryReadiness.ts',
      'src/personalProduction/backupRecoveryCopy.ts',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records Task 16D through Task 16F evidence and deliverables', () => {
    const content = doc();

    for (const expected of [
      'Task 16D — Daily Training UX Polish Pack V1',
      'PR #259',
      '681d9b57aff08619f5c0d523fb85fa8279015027',
      '1068 files / 4316 tests',
      'Daily training UX polish added.',
      'src/personalProduction/dailyTrainingUxCopy.ts',
      'src/personalProduction/DailyTrainingStatusPanel.tsx',
      'Task 16E — Data Health & Diagnostics Clarity Pack V1',
      'PR #260',
      'dd3da4fe0db698c7b003e63b005b85cee82749f4',
      '1072 files / 4333 tests',
      'Data health / diagnostics clarity added.',
      'src/personalProduction/dataHealthDiagnosticsClarity.ts',
      'src/personalProduction/DataHealthDiagnosticsSummaryPanel.tsx',
      'Task 16F — Mobile / PWA Personal Use Polish Pack V1',
      'PR #261',
      '24c023ab3c21405c4f96f9370417e3661b2ca6ac',
      '1076 files / 4349 tests',
      'Mobile/PWA personal use polish added.',
      'src/personalProduction/mobilePwaPersonalUseCopy.ts',
      'src/personalProduction/MobilePwaPersonalUsePanel.tsx',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms Phase 16 completion and personal-only results', () => {
    const content = doc();

    for (const expected of [
      'Phase 16 completes the personal-only roadmap direction after Task 16G merge.',
      'Personal-only remains the active direction.',
      'SaaS remains deferred.',
      'Backup/recovery reliability helpers exist.',
      'Daily training UX polish exists.',
      'Data health/diagnostics clarity exists.',
      'Mobile/PWA personal use polish exists.',
      'Owner-only daily use is clearer, safer, and more recovery-aware.',
      'Phase 16 completion does not start Phase 17.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves local-first and cloud candidate boundaries', () => {
    const content = doc();

    for (const expected of [
      'localStorage remains default / fallback / migration / emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'conflict resolution remains manual.',
      'rollback / kill switch remains available.',
      'emergency local mode remains available.',
      'api-primary-dev remains dev/local only and not production-ready.',
      'devApiRunner is not production backend.',
      'service role key must never enter browser.',
      'accepted browser mutation routes remain exactly seven.',
      'no default cloud sync.',
      'no background sync.',
      'no automatic worker/timer/polling sync.',
      'no service-worker sync.',
      'no production deployment auto-start.',
      'no external monitoring upload.',
      'no SaaS/multi-user runtime.',
      'no normalized training tables.',
      'no destructive migration.',
      'no real personal training data in automated tests.',
      'no new package/dependency/script/lockfile drift beyond Phase 12 authorized `@supabase/supabase-js`.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents accepted browser mutation routes and blocked route families', () => {
    const content = doc();

    for (const expected of [
      '1. `POST /data-health/issues/:issueId/dismiss`',
      '2. `POST /history/:id/data-flag`',
      '3. `POST /history/:id/edit`',
      '4. `POST /sessions/start`',
      '5. `POST /sessions/active/patches`',
      '6. `POST /sessions/active/complete`',
      '7. `POST /sessions/active/discard`',
      'No eighth browser mutation route was added.',
      '`POST /data-health/repair/apply` remains blocked.',
      'backup/import/export over HTTP remains blocked.',
      'reset/recovery over HTTP remains blocked.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records remaining risks and recommends Phase 17 without starting it', () => {
    const content = doc();

    for (const expected of [
      'Real Supabase project behavior is still outside automated test coverage.',
      'Real auth callback behavior is still outside automated test coverage.',
      'Real personal training data is not used in automated tests.',
      'Cloud pull/push remain manual candidate flows.',
      'Recommended next phase: Phase 17 — Personal Production Real-Use Iteration.',
      'Recommended next task: Task 17A — Real-Use Feedback Intake & Prioritization V1.',
      'Task 17A is recommended only.',
      'Phase 17 is not started.',
      'Phase 16 archive does not authorize SaaS.',
      'Phase 16 archive does not authorize default cloud sync.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
