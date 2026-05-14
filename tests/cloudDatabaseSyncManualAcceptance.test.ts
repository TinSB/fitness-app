import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('cloud database sync manual acceptance', () => {
  const doc = () => readSource('docs/CLOUD_DATABASE_SYNC_MANUAL_ACCEPTANCE.md');

  it('exists and uses checkbox acceptance items', () => {
    const content = doc();

    expect(content).toContain('# Cloud Database / Sync Manual Acceptance V1');
    expect((content.match(/- \[ \]/g) ?? []).length).toBeGreaterThanOrEqual(30);
  });

  it('documents disabled sync, service role, local fallback, and manual confirmation', () => {
    const content = doc();

    for (const expected of [
      'no default sync',
      'no background sync',
      'Service role not in browser',
      'localStorage fallback/emergency documented and available',
      'manual confirmation',
      'Cloud pull candidate does not auto-apply',
      'Cloud push candidate requires dry run, owner check, backup check, schema validation, and manual confirmation.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents route lock and blocked routes', () => {
    const content = doc();

    for (const expected of [
      'Seven-route lock remains exactly seven accepted browser mutation routes.',
      'POST /data-health/repair/apply',
      'backup/import/export HTTP routes remain blocked',
      'reset/recovery HTTP routes remain blocked',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents no real personal data and package authorization evidence', () => {
    const content = doc();

    expect(content).toContain('real personal training data remains excluded');
    expect(content).toContain('Task 12.7 was the only authorized dependency exception for `@supabase/supabase-js`');
  });

  it('does not claim real cloud sync or production deployment is complete', () => {
    const content = doc();

    for (const forbidden of [
      'default sync is live',
      'background sync is live',
      'production deployment runtime is complete',
      'SaaS runtime is complete',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });
});
