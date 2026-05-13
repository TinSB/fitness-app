import { describe, expect, it } from 'vitest';
import {
  assignOwnerScopeToAppData,
  checkOwnerScope,
  createAnonymousLocalOwner,
  createBackendPrimaryCandidateOwner,
  createCloudAccountCandidateOwner,
  createDeviceLocalOwner,
  createOwnerPreservingEmergencyBackup,
  validateAccountScopedOwner,
} from '../src/cloudProduction/accountScopedAppData';
import type { AppData } from '../src/models/training-model';
import { readSource } from './runtimeBoundaryTestHelpers';

const syntheticAppData = () => ({
  schemaVersion: 1,
  programs: [],
  history: [],
  activeSession: null,
}) as unknown as AppData;

describe('account-scoped AppData boundary', () => {
  it('creates supported owner scopes without real accounts', () => {
    expect(createAnonymousLocalOwner('local-owner-1', 'device-a')).toEqual({
      scope: 'anonymous-local',
      ownerId: 'local-owner-1',
      deviceId: 'device-a',
    });
    expect(createDeviceLocalOwner('local-owner-1', 'device-a')).toEqual({
      scope: 'device-local',
      ownerId: 'local-owner-1',
      deviceId: 'device-a',
    });
    expect(createBackendPrimaryCandidateOwner('local-owner-1', 'device-a')).toEqual({
      scope: 'backend-primary-candidate',
      ownerId: 'local-owner-1',
      deviceId: 'device-a',
    });
    expect(createCloudAccountCandidateOwner('cloud-account-1', 'device-a')).toEqual({
      scope: 'cloud-account-candidate',
      ownerId: 'cloud-account-1',
      accountId: 'cloud-account-1',
      deviceId: 'device-a',
    });
  });

  it('assigns owner scope without mutating AppData or changing source-of-truth', () => {
    const data = syntheticAppData();
    const before = JSON.stringify(data);
    const owner = createAnonymousLocalOwner('local-owner-1');
    const result = assignOwnerScopeToAppData(data, owner);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected owner scope assignment to succeed');
    expect(result.scoped.appData).toBe(data);
    expect(JSON.stringify(data)).toBe(before);
    expect(result.scoped).toMatchObject({
      owner,
      localStorageEmergencyBackupOwner: owner,
      sourceOfTruthChanged: false,
    });
    expect(result.scoped.owner).not.toBe(owner);
  });

  it('fails closed on owner mismatch and invalid cloud account candidate owner', () => {
    const data = syntheticAppData();
    const result = assignOwnerScopeToAppData(data, createBackendPrimaryCandidateOwner('local-owner-1'));
    if (!result.ok) throw new Error('expected owner scope assignment to succeed');

    expect(checkOwnerScope(result.scoped, createBackendPrimaryCandidateOwner('other-owner'))).toEqual({
      ok: false,
      errorCode: 'owner_mismatch',
      message: 'AppData owner scope does not match expected owner.',
    });
    expect(validateAccountScopedOwner({
      scope: 'cloud-account-candidate',
      ownerId: 'cloud-account-1',
    })).toEqual({
      ok: false,
      errorCode: 'account_id_required',
      message: 'Cloud account candidate owner requires account id.',
    });
  });

  it('preserves owner context for emergency backup wrappers', () => {
    const data = syntheticAppData();
    const owner = createCloudAccountCandidateOwner('cloud-account-1', 'device-a');
    const result = assignOwnerScopeToAppData(data, owner);
    if (!result.ok) throw new Error('expected owner scope assignment to succeed');

    const backup = createOwnerPreservingEmergencyBackup(result.scoped);

    expect(backup.appData).toBe(data);
    expect(backup.sourceOfTruthChanged).toBe(false);
    expect(backup.owner).toEqual(owner);
    expect(backup.localStorageEmergencyBackupOwner).toEqual(owner);
    expect(backup.owner).not.toBe(result.scoped.owner);
  });

  it('does not import auth providers, Node-only modules, or storage writers', () => {
    const source = readSource('src/cloudProduction/accountScopedAppData.ts');

    for (const forbidden of [
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
      'fetch(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents the account-scoped AppData boundary and next task', () => {
    const doc = readSource('docs/ACCOUNT_SCOPED_APPDATA_BOUNDARY.md');

    for (const expected of [
      'Task 10.5 Account-Scoped AppData Boundary V1',
      '`anonymous-local`',
      '`device-local`',
      '`backend-primary-candidate`',
      '`cloud-account-candidate`',
      'Owner mismatch must fail closed.',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Recommended next task: Task 10.6 Cloud Sync Strategy & Conflict Policy V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
