import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_PRIVACY_DATA_SAFETY_MANUAL_ACCEPTANCE.md';

describe('production privacy data safety manual acceptance', () => {
  it('exists as a checkbox runbook with scope and non-goals', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 10.12 Production Privacy / Data Safety Manual Acceptance V1');
    expect(doc).toContain('- [ ]');
    for (const expected of [
      'does not implement real auth',
      'cloud sync',
      'deployment runtime',
      'monitoring upload',
      'SaaS/multi-user runtime',
      'source-of-truth switch',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers identity, ownership, unauthenticated local mode, and account lifecycle expectations', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'User Identity And Data Ownership',
      'Local Data Vs Cloud Account Data',
      'Unauthenticated Local Mode',
      'Login / Linking Expectations',
      'Logout Expectations',
      'Account Deletion Expectations',
      'Data Export Expectations',
      'owner mismatch fails closed',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers emergency restore, conflict handling, disabled skeletons, and secrets boundary', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Emergency Restore',
      'Conflict Handling',
      'Disabled Skeletons',
      'Secrets And Browser Bundle',
      'cloud sync is disabled by default',
      'auth skeleton is disabled by default',
      'deployment runtime skeleton is disabled by default',
      'monitoring external upload is absent',
      'secrets are not in browser-safe config',
      'secrets are not in the browser bundle',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents route lock, blocked routes, no real data, and no destructive migration', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'accepted browser mutation routes remain exactly seven',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'no eighth browser mutation route',
      'real personal training data remains excluded',
      'normalized tables remain absent',
      'destructive migration remains absent',
      'package dependency, package script, and lockfile changes remain absent',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('includes pass/fail template and recommends Task 10.13 only', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'PASS: All checks above are verified with synthetic/non-personal data only.',
      'FAIL: Any check above fails',
      'Recommended next task: Task 10.13 Cloud Production Regression Lock V1.',
      'Task 10.13 is not part of Task 10.12.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
