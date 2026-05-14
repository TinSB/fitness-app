import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('auth provider manual acceptance', () => {
  it('exists and uses checkboxes for manual acceptance', () => {
    const doc = readSource('docs/AUTH_PROVIDER_MANUAL_ACCEPTANCE.md');

    expect(doc).toContain('Task 11.10 Auth Provider Manual Acceptance V1');
    expect((doc.match(/- \[ \]/g) ?? []).length).toBeGreaterThanOrEqual(40);
  });

  it('covers required auth provider candidate sections', () => {
    const doc = readSource('docs/AUTH_PROVIDER_MANUAL_ACCEPTANCE.md');

    for (const expected of [
      'Scope / Non-Goals',
      'Prerequisites',
      'Auth Disabled Baseline',
      'Provider Decision',
      'Provider Config Missing',
      'Unsafe Callback URL',
      'Preview vs Production Env',
      'Login Candidate UI',
      'Logout Candidate UI',
      'Session Expired',
      'Session Invalid',
      'Provider Unavailable',
      'Local Account Link Dry-Run',
      'Owner Mismatch',
      'Backend-Primary Account Scope',
      'Emergency Local Mode',
      'Pass / Fail Template',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('asserts no cloud sync automatic upload source switch or real SDK claim', () => {
    const doc = readSource('docs/AUTH_PROVIDER_MANUAL_ACCEPTANCE.md');

    for (const expected of [
      'no real cloud sync is implemented',
      'no automatic upload of local training data is implemented',
      'no source-of-truth switch is performed',
      'no real provider SDK dependency is installed',
      'secret not in browser bundle',
      'dist token scan passes',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents localStorage fallback emergency and backend-primary opt-in boundaries', () => {
    const doc = readSource('docs/AUTH_PROVIDER_MANUAL_ACCEPTANCE.md');

    for (const expected of [
      '`localStorage` remains default, fallback, migration source, and emergency backup',
      'backend-primary candidate remains explicit opt-in and reversible',
      'fallback, rollback, and emergency restore remain available',
      'logout does not delete emergency backup',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents seven route lock and blocked routes', () => {
    const doc = readSource('docs/AUTH_PROVIDER_MANUAL_ACCEPTANCE.md');

    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toHaveLength(7);
    expect(doc).toContain('accepted browser mutation routes remain exactly seven');
    expect(doc).toContain('blocked repair/reset/import/export HTTP routes remain blocked');
    expect(doc).toContain('POST /data-health/repair/apply');
  });

  it('documents no real personal data warning and next task', () => {
    const doc = readSource('docs/AUTH_PROVIDER_MANUAL_ACCEPTANCE.md');

    expect(doc).toContain('Use synthetic, non-personal test data only.');
    expect(doc).toContain('Recommended next task: Task 11.11 Phase 11 Completion Archive V1.');
  });
});
