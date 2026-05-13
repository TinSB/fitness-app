import { describe, expect, it } from 'vitest';
import {
  createCloudSyncConflictResult,
  createCloudSyncDisabledSkeleton,
} from '../src/cloudProduction/cloudSyncDisabledSkeleton';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('cloud sync disabled skeleton', () => {
  it('is disabled by default with no network, background, upload, or download behavior', () => {
    const sync = createCloudSyncDisabledSkeleton();

    expect(sync).toMatchObject({
      status: 'disabled',
      enabled: false,
      networkEnabled: false,
      noAutomaticWorker: true,
      uploadEnabled: false,
      downloadEnabled: false,
    });
  });

  it('supports dry-run only results without mutation or auto apply', () => {
    const result = createCloudSyncDisabledSkeleton().runDryRun();

    expect(result).toEqual({
      state: 'dry_run_only',
      ok: true,
      uploadPerformed: false,
      downloadPerformed: false,
      localStorageMutated: false,
      backendPrimaryMutated: false,
      autoApplied: false,
      conflicts: [],
      message: 'Cloud sync dry run only; no data was uploaded, downloaded, or applied.',
    });
  });

  it('returns manual confirmation conflict results without applying anything', () => {
    const result = createCloudSyncConflictResult(['owner_mismatch', 'device_clock_mismatch']);

    expect(result).toEqual({
      state: 'manual_confirmation_required',
      ok: false,
      uploadPerformed: false,
      downloadPerformed: false,
      localStorageMutated: false,
      backendPrimaryMutated: false,
      autoApplied: false,
      conflicts: ['owner_mismatch', 'device_clock_mismatch'],
      message: 'Cloud sync conflict requires manual confirmation.',
    });
  });

  it('keeps apply disabled and never mutates local or backend data', () => {
    const result = createCloudSyncDisabledSkeleton().apply();

    expect(result).toMatchObject({
      state: 'disabled',
      ok: false,
      uploadPerformed: false,
      downloadPerformed: false,
      localStorageMutated: false,
      backendPrimaryMutated: false,
      autoApplied: false,
    });
  });

  it('does not contain network calls, provider SDKs, Node-only imports, or storage writers', () => {
    const source = readSource('src/cloudProduction/cloudSyncDisabledSkeleton.ts');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      '@clerk',
      'next-auth',
      '@supabase',
      'firebase',
      'auth0',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
      'writeAppDataToLocalStorage',
      'localStorage.setItem',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents disabled skeleton boundaries and next task', () => {
    const doc = readSource('docs/CLOUD_SYNC_DISABLED_SKELETON.md');

    for (const expected of [
      'Task 10.7 Cloud Sync Disabled Skeleton V1',
      'Cloud sync is disabled by default.',
      'network disabled',
      'upload disabled',
      'download disabled',
      'no localStorage mutation',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 10.8 Production Secrets & Environment Guard V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
