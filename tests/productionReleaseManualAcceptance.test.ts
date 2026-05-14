import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production release manual acceptance', () => {
  const doc = () => readSource('docs/PRODUCTION_RELEASE_MANUAL_ACCEPTANCE.md');

  it('exists as a checkbox runbook', () => {
    const content = doc();

    expect(content).toContain('Task 13.14 is a manual acceptance runbook');
    expect(content.match(/- \[ \]/g)?.length ?? 0).toBeGreaterThan(30);
  });

  it('covers required acceptance sections', () => {
    const content = doc();

    for (const expected of [
      'Scope / Non-Goals',
      'LocalStorage Baseline',
      'Environment Matrix',
      'Supabase Readiness',
      'Deployment Boundaries',
      'Cloud Candidate Boundaries',
      'Rollback / Emergency Local Mode',
      'Diagnostics And Monitoring',
      'Privacy / Export / Delete Readiness',
      'Dist And Route Lock',
      'Pass / Fail Template',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('locks no default sync background sync auto launch and external upload', () => {
    const content = doc();

    for (const expected of [
      'Confirm no production auto-launch is performed.',
      'Confirm no default cloud sync is enabled.',
      'Confirm no background sync is enabled.',
      'Confirm no automatic worker is enabled.',
      'Confirm no external monitoring upload is enabled.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents localStorage emergency mode rollback and diagnostic redaction', () => {
    const content = doc();

    for (const expected of [
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'emergency local mode remains documented and available',
      'rollback does not delete local data',
      'rollback does not overwrite cloud data',
      'diagnostic snapshot excludes full AppData',
      'diagnostic snapshot excludes full localStorage',
      'secrets, tokens, service role, personal notes, raw request payloads, and full training logs',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents route lock package drift and blocked routes', () => {
    const content = doc();

    for (const expected of [
      'Confirm no package/script/lockfile drift occurred.',
      'accepted browser mutation routes remain exactly seven',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('does not claim production launch or runtime enablement', () => {
    const content = doc();

    for (const forbidden of [
      'production launch complete',
      'default cloud sync enabled',
      'background sync enabled',
      'external monitoring upload enabled',
      'new package dependency',
      'new route added',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('recommends only Task 13.15', () => {
    expect(doc()).toContain('Recommended next task: Task 13.15 Production Release Regression Lock V1.');
  });
});
