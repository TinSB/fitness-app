import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('equipment-aware load model boundary still blocked', () => {
  const doc = () => readSource('docs/EQUIPMENT_AWARE_LOAD_MODEL_ENTRY_GATE.md');

  it('does not claim Task 17A performed blocked implementation work', () => {
    const content = doc();

    for (const forbidden of [
      'equipment-aware load model is implemented in Task 17A',
      'Task 17A implemented the equipment-aware load model',
      'training algorithms changed',
      'warmup algorithm changed',
      'recommendation engine changed',
      'source-of-truth changed',
      'routes were added',
      'history was migrated',
      'cloud sync is enabled',
      'default cloud sync is enabled',
      'background sync is enabled',
      'production deployment is live',
      'external monitoring upload is active',
      'SaaS is started',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('explicitly keeps Task 17A as a docs/static entry gate', () => {
    const content = doc();

    for (const expected of [
      'Docs/static tests only.',
      'Task 17A is an entry gate only and does not build the model.',
      'Task 17B must not:',
      'Change source-of-truth behavior.',
      'Mutate historical data.',
      'Alter training algorithm outputs beyond feasible load presentation layer.',
      'Add cloud sync.',
      'Add routes.',
      'Task 17A does not start Task 17B.',
      'Task 17A is an entry gate only.',
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

  it('keeps blocked HTTP route families documented as blocked', () => {
    const content = doc();

    for (const expected of [
      '`POST /data-health/repair/apply` remains blocked.',
      'backup/import/export over HTTP remains blocked.',
      'reset/recovery over HTTP remains blocked.',
      'No eighth browser mutation route was added.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps package scripts and dependency surface locked', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.dependencies['@supabase/supabase-js']).toBeDefined();
    for (const forbidden of ['@sentry', 'sentry', 'analytics', 'telemetry', 'stripe', 'clerk', 'next-auth', 'workbox']) {
      expect(JSON.stringify(packageJson.dependencies)).not.toContain(forbidden);
      expect(JSON.stringify(packageJson.devDependencies)).not.toContain(forbidden);
    }
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('billing:start');
  });
});
