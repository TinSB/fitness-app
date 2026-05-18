import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal-only vs SaaS product decision', () => {
  const doc = () => readSource('docs/PERSONAL_ONLY_VS_SAAS_PRODUCT_DECISION.md');

  it('records Task 16A identity and Phase 15 baseline evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 16A',
      'Personal-Only vs SaaS Product Decision',
      'Phase 16 start',
      'Phase 15 complete',
      'Task 15D — Phase 15 Stabilization Archive',
      'PR #255',
      '8b216f22a63acb11ef05af91c0213fd15d796680',
      '1056 files / 4244 tests',
      'dist token scan clean',
      'Phase 16 was not started before this task',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records current IronPath personal production candidate status', () => {
    const content = doc();

    for (const expected of [
      'IronPath has personal production candidate path.',
      'First-week usage runbook exists.',
      'Real-world failure / recovery hardening exists.',
      'UX cleanup for production candidate controls exists.',
      'localStorage remains default/fallback/migration/emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'conflict resolution remains manual.',
      'rollback / kill switch remains available.',
      'emergency local mode remains available.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('compares Path A and Path B with a decision table', () => {
    const content = doc();

    for (const expected of [
      'Path A',
      'Personal-only production tool',
      'Path B',
      'Commercial SaaS product',
      '| Dimension | Path A — Personal-only production tool | Path B — Commercial SaaS product |',
      '| User scope | Owner-only use | Public or semi-public multi-user use |',
      '| Engineering complexity | Lower and focused on reliability | Much higher across product, platform, ops, and support |',
      '| Data risk | Lower, owner-controlled data path | Higher commercial user-data risk |',
      '| Current readiness | Strong personal candidate readiness | Not ready for SaaS launch |',
      'The comparison clearly supports Path A for the next phase.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('makes the final decision to choose personal-only and defer SaaS', () => {
    const content = doc();

    for (const expected of [
      'Decision: Choose Path A — Personal-only production tool for the next phase.',
      'SaaS is deferred.',
      'Do not start SaaS now.',
      'Do not start billing.',
      'Do not start public onboarding.',
      'Do not start multi-user admin.',
      'Do not start legal/commercial launch work.',
      'Do not start production deployment for public users.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents why SaaS is deferred and why personal-only is next', () => {
    const content = doc();

    for (const expected of [
      'No real public deployment runtime yet.',
      'No external monitoring upload.',
      'No billing/subscription system.',
      'No customer support workflow.',
      'No privacy policy / legal package.',
      'No automated account deletion/export workflow.',
      'No abuse handling.',
      'No public onboarding.',
      'No commercial data operations.',
      'High risk of premature overengineering.',
      'Fastest path to real value.',
      'Lower data risk.',
      'Better fit for current owner-only use.',
      'Existing localStorage/fallback/rollback boundaries are strong.',
      'Existing cloud candidate remains manual and reversible.',
      'Lets the user validate real training workflow before productizing.',
      'Avoids building SaaS before proving daily usage value.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('lists personal-only roadmap themes and SaaS later prerequisites', () => {
    const content = doc();

    for (const expected of [
      'Backup reliability.',
      'Recovery UX.',
      'Training workflow polish.',
      'Data health clarity.',
      'Cloud candidate manual verification.',
      'Emergency local restore confidence.',
      'Mobile/PWA usability.',
      'Owner-only diagnostics.',
      'Reducing friction in daily logging.',
      'Improving trust in production candidate controls.',
      'Production deployment runtime.',
      'External monitoring strategy.',
      'Privacy policy.',
      'Terms of service.',
      'Account deletion/export automation.',
      'Billing/subscription system.',
      'Multi-user data isolation.',
      'Customer support workflow.',
      'Onboarding flow.',
      'Abuse prevention.',
      'Incident response.',
      'Commercial release acceptance.',
      'Legal review.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves safety boundaries and route locks', () => {
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

  it('recommends Task 16B but does not start it', () => {
    const content = doc();

    for (const expected of [
      'Recommended next task: Task 16B — Personal-Only Polish / Backup / Reliability Roadmap V1.',
      'Task 16B should define a practical roadmap',
      'Task 16A does not start Task 16B.',
      'SaaS is not started.',
      'Phase 17 is not started.',
      'Task 16A is a product decision only.',
      'IronPath remains personal-production-candidate focused.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
