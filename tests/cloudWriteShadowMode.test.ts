import { describe, expect, it } from 'vitest';
import {
  buildPhase19hCloudWriteShadowMode,
  PHASE19H_CLOUD_WRITE_SHADOW_ID,
  type Phase19hCloudWriteShadowOwner,
} from '../src/cloudProduction/cloudWriteShadowMode';

type SyntheticAppData = {
  schemaVersion: string;
  sessions: string[];
};

const owner = (): Phase19hCloudWriteShadowOwner => ({
  scope: 'cloud-account-candidate',
  ownerId: 'acct-synthetic-1',
  accountId: 'acct-synthetic-1',
});

const appData = (): SyntheticAppData => ({
  schemaVersion: 'phase-19-synthetic',
  sessions: ['session-a'],
});

const baseInput = () => ({
  enabled: true,
  explicitShadowOptIn: true,
  manualConfirmation: true,
  dryRunPassed: true,
  backupAvailable: true,
  expectedOwner: owner(),
  sourceOwner: owner(),
  appData: appData(),
  schemaValidator: (value: SyntheticAppData) => value.schemaVersion === 'phase-19-synthetic',
  cloudConflictDetected: false,
  operationId: 'operation-shadow-1',
  requestFingerprint: 'request-fingerprint-1',
  sourceSnapshotHash: 'hash-local',
  targetSnapshotHash: 'hash-shadow',
  nowIso: '2026-05-24T01:00:00.000Z',
  shadowAdapter: () => ({
    ok: true,
    rollbackAvailable: true,
    message: 'Synthetic shadow write accepted.',
  }),
});

describe('Phase 19H cloud write shadow mode', () => {
  it('is disabled by default and never mutates local state', () => {
    expect(buildPhase19hCloudWriteShadowMode()).toMatchObject({
      id: PHASE19H_CLOUD_WRITE_SHADOW_ID,
      phase: '19H',
      ok: false,
      status: 'disabled',
      journalEntry: null,
      applied: false,
      localDataChanged: false,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      cloudPrimaryChanged: false,
      blockers: ['write_shadow_disabled'],
    });
  });

  it('requires opt-in confirmation dry run backup and owner match before shadow write', () => {
    expect(buildPhase19hCloudWriteShadowMode({
      ...baseInput(),
      manualConfirmation: false,
    })).toMatchObject({
      ok: false,
      status: 'manual_confirmation_missing',
      shadowWriteAttempted: false,
      blockers: ['manual_confirmation_missing'],
    });

    expect(buildPhase19hCloudWriteShadowMode({
      ...baseInput(),
      dryRunPassed: false,
    })).toMatchObject({
      ok: false,
      status: 'dry_run_missing',
      blockers: ['dry_run_missing'],
    });

    expect(buildPhase19hCloudWriteShadowMode({
      ...baseInput(),
      backupAvailable: false,
    })).toMatchObject({
      ok: false,
      status: 'backup_missing',
      blockers: ['backup_missing'],
    });

    expect(buildPhase19hCloudWriteShadowMode({
      ...baseInput(),
      sourceOwner: { ...owner(), ownerId: 'acct-other', accountId: 'acct-other' },
    })).toMatchObject({
      ok: false,
      status: 'owner_mismatch',
      blockers: ['owner_mismatch'],
    });
  });

  it('blocks schema errors conflicts and missing adapter without local mutation', () => {
    expect(buildPhase19hCloudWriteShadowMode({
      ...baseInput(),
      appData: { schemaVersion: 'wrong', sessions: [] },
    })).toMatchObject({
      ok: false,
      status: 'schema_invalid',
      shadowWriteAttempted: false,
      localDataChanged: false,
    });

    expect(buildPhase19hCloudWriteShadowMode({
      ...baseInput(),
      cloudConflictDetected: true,
    })).toMatchObject({
      ok: false,
      status: 'cloud_conflict',
      blockers: ['cloud_conflict'],
    });

    expect(buildPhase19hCloudWriteShadowMode({
      ...baseInput(),
      shadowAdapter: null,
    })).toMatchObject({
      ok: false,
      status: 'shadow_write_rejected',
      shadowWriteAttempted: false,
      blockers: ['shadow_adapter_unavailable'],
    });
  });

  it('creates an in-memory journal entry and accepts shadow write without source-of-truth change', () => {
    const result = buildPhase19hCloudWriteShadowMode(baseInput());

    expect(result).toMatchObject({
      ok: true,
      status: 'accepted_shadow',
      shadowWriteAttempted: true,
      rollbackAvailable: true,
      localDataChanged: false,
      localStorageUnchanged: true,
      sourceOfTruthChanged: false,
      cloudPrimaryChanged: false,
      journalEntry: {
        operationId: 'operation-shadow-1',
        operationType: 'manual_push_candidate',
        requestFingerprint: 'request-fingerprint-1',
        sourceSnapshotHash: 'hash-local',
        targetSnapshotHash: 'hash-shadow',
        status: 'accepted_candidate',
        createdAt: '2026-05-24T01:00:00.000Z',
        completedAt: null,
        errorCode: null,
      },
    });
    expect(result.journalEntry?.cloudIdempotencyKey).toContain('manual_push_candidate:cloud-account-candidate');
  });

  it('prevents duplicate shadow candidates before adapter execution', () => {
    const first = buildPhase19hCloudWriteShadowMode(baseInput());
    let adapterCalled = false;

    const duplicate = buildPhase19hCloudWriteShadowMode({
      ...baseInput(),
      shadowAdapter: () => {
        adapterCalled = true;
        return { ok: true };
      },
      existingJournalEntries: first.journalEntry ? [first.journalEntry] : [],
    });

    expect(duplicate).toMatchObject({
      ok: false,
      status: 'duplicate_shadow',
      shadowWriteAttempted: false,
      blockers: ['duplicate_shadow'],
      duplicateOperationId: 'operation-shadow-1',
    });
    expect(adapterCalled).toBe(false);
  });

  it('reports adapter rejection without fake success', () => {
    expect(buildPhase19hCloudWriteShadowMode({
      ...baseInput(),
      shadowAdapter: () => ({
        ok: false,
        rollbackAvailable: true,
        message: 'Synthetic shadow write rejected.',
      }),
    })).toMatchObject({
      ok: false,
      noFakeSuccess: true,
      status: 'shadow_write_rejected',
      shadowWriteAttempted: true,
      rollbackAvailable: true,
      sourceOfTruthChanged: false,
    });
  });
});
