import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production candidate controls UX cleanup documentation', () => {
  const doc = () => readSource('docs/PRODUCTION_CANDIDATE_CONTROLS_UX_CLEANUP.md');

  it('records Task 15C identity and Task 15B evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 15C',
      'UX Cleanup for Production Candidate Controls',
      'Task 15B complete',
      'PR #253',
      'bdbed6b1d8f80a15e4b8e9ed4e0c3aa9b109c9cb',
      '1051 files / 4214 tests',
      'dist token scan clean',
      'Task 15C has not started before this task',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents non-goals and safety baseline', () => {
    const content = doc();

    for (const expected of [
      'change source-of-truth behavior',
      'enable default cloud sync',
      'enable background sync',
      'connect to Supabase',
      'perform cloud pull',
      'perform cloud push',
      'upload data',
      'deploy production runtime',
      'add external monitoring upload',
      'add SaaS/multi-user runtime',
      'add normalized training tables',
      'perform destructive migration',
      'use real personal training data in tests',
      'add package/dependency/script/lockfile changes',
      'localStorage default/fallback/migration/emergency',
      'backend/cloud candidate explicit opt-in and reversible',
      'cloud pull does not auto-apply',
      'cloud push requires manual confirmation',
      'conflict resolution remains manual',
      'rollback / kill switch',
      'emergency local mode',
      'accepted browser mutation routes exactly seven',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents UX problems copy policy safety rules and placement', () => {
    const content = doc();

    for (const expected of [
      'source-of-truth unclear',
      'cloud pull/push controls confusing',
      'emergency local mode hard to find',
      'rollback / kill switch wording unclear',
      'diagnostics too technical',
      'owner mismatch not human-readable',
      'schema validation failure not human-readable',
      'Chinese-first copy',
      'Simple wording',
      'No SaaS/cloud-sync overclaim',
      'No "automatic sync" language',
      'No "success" unless confirmed',
      'Dangerous operations must say manual confirmation required',
      'Cloud pull dry run before any apply',
      'Cloud pull does not auto-apply',
      'Cloud push dry run required',
      'Cloud push owner check required',
      'Cloud push backup check required',
      'Cloud push manual confirmation required',
      'Settings / Diagnostics / Cloud Production panel',
      'Not primary training flow',
      'Not blocking local workout logging',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends Task 15D but does not start it', () => {
    const content = doc();

    for (const expected of [
      'Recommended next task: Task 15D — Phase 15 Stabilization Archive.',
      'Task 15A runbook.',
      'Task 15B recovery hardening.',
      'Task 15C UX cleanup.',
      'Task 15C does not start Task 15D.',
      'Task 15C supports personal production candidate stabilization only.',
      'Task 15C does not authorize public SaaS launch.',
    ]) {
      expect(content).toContain(expected);
    }
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
  });

  it('keeps package scripts and dependency surface locked', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.dependencies['@supabase/supabase-js']).toBeDefined();
    for (const forbidden of ['@sentry', 'sentry', 'analytics', 'telemetry', 'stripe', 'clerk', 'next-auth']) {
      expect(JSON.stringify(packageJson.dependencies)).not.toContain(forbidden);
      expect(JSON.stringify(packageJson.devDependencies)).not.toContain(forbidden);
    }
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
  });
});
