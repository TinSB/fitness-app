import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal-only polish backup reliability roadmap', () => {
  const doc = () => readSource('docs/PERSONAL_ONLY_POLISH_BACKUP_RELIABILITY_ROADMAP.md');

  it('records Task 16B identity and Task 16A baseline evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 16B',
      'Personal-Only Polish / Backup / Reliability Roadmap',
      'Task 16A complete',
      'PR #256',
      '9dc07d9e804e8d32f41e5cb410cffe273e6ffddd',
      '1058 files / 4256 tests',
      'dist token scan clean',
      'Personal-only path now',
      'SaaS deferred',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records current product status and personal-only product principle', () => {
    const content = doc();

    for (const expected of [
      'IronPath has a personal production candidate path.',
      'Phase 14 created personal production candidate release path.',
      'Phase 15 stabilized first-week usage, recovery hardening, and UX control clarity.',
      'Task 16A chose personal-only over SaaS.',
      'IronPath is now an owner-only personal training system.',
      'The next work should improve real daily use, not expand SaaS scope.',
      'Reliability beats new features.',
      'Backup/restore confidence beats automation.',
      'Local-first safety beats cloud-first convenience.',
      'Cloud candidate remains optional/manual.',
      'SaaS remains deferred.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('prioritizes P0 through P6 personal-only roadmap areas', () => {
    const content = doc();

    for (const expected of [
      'P0',
      'Backup / restore reliability',
      'Make the owner confident that training data can be backed up, restored, and recovered.',
      'P1',
      'Daily training logging polish',
      'Make everyday workout logging smoother and less error-prone.',
      'P2',
      'Data health clarity',
      'Make data-health issues understandable and actionable.',
      'P3',
      'Personal production controls polish',
      'Make cloud candidate, rollback, emergency local, and data source status easy to understand.',
      'P4',
      'Mobile / PWA usability',
      'Make the app reliable and comfortable for real phone usage during training.',
      'P5',
      'Optional cloud candidate verification',
      'Keep Supabase/cloud candidate useful but manual and reversible.',
      'P6',
      'Owner-only diagnostics',
      'Help the owner understand incidents without exposing full AppData or secrets.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends a personal-only implementation sequence without starting Task 16C', () => {
    const content = doc();

    for (const expected of [
      'Task 16C — Personal-Only Backup & Recovery Implementation Pack V1',
      'Task 16D — Daily Training UX Polish Pack V1',
      'Task 16E — Data Health & Diagnostics Clarity Pack V1',
      'Task 16F — Mobile / PWA Personal Use Polish Pack V1',
      'Task 16G — Phase 16 Personal-Only Roadmap Archive V1',
      'Task 16C is recommended next.',
      'Task 16C is not started by Task 16B.',
      'Later tasks may be implemented as task packs, not many tiny tasks.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps SaaS and unsafe automation deferred', () => {
    const content = doc();

    for (const expected of [
      'Public SaaS launch remains deferred.',
      'Billing/subscription remains deferred.',
      'Public onboarding remains deferred.',
      'Multi-user admin remains deferred.',
      'Customer support workflow remains deferred.',
      'Production deployment for public users remains deferred.',
      'External monitoring upload remains deferred.',
      'Default cloud sync remains deferred.',
      'Background sync remains deferred.',
      'Automatic multi-device sync remains deferred.',
      'Normalized training tables remain deferred.',
      'Destructive migration remains deferred.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves safety boundaries and route locks', () => {
    const content = doc();

    for (const expected of [
      'localStorage remains default/fallback/migration/emergency.',
      'localStorage remains default / fallback / migration / emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'conflict resolution remains manual.',
      'rollback / kill switch remains available.',
      'emergency local mode remains available.',
      'api-primary-dev remains dev/local only and not production-ready.',
      'accepted browser mutation routes remain exactly seven.',
      'No eighth browser mutation route was added.',
      '`POST /data-health/repair/apply` remains blocked.',
      'backup/import/export over HTTP remains blocked.',
      'reset/recovery over HTTP remains blocked.',
      'no default cloud sync.',
      'no background sync.',
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

  it('previews Task 16C backup recovery scope while keeping boundaries', () => {
    const content = doc();

    for (const expected of [
      'Improve backup status readability.',
      'Add pure backup/restore readiness helper if useful.',
      'Add recovery rehearsal clarity.',
      'Improve emergency local restore guidance.',
      'Add tests.',
      'Add HTTP backup/import/export routes.',
      'Add destructive migration.',
      'Change source-of-truth behavior.',
      'Add default cloud sync.',
      'Add package dependencies.',
      'Task 16B does not start Task 16C.',
      'Phase 17 is not started.',
      'This roadmap supports personal-only production use.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
