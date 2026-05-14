import { describe, expect, it } from 'vitest';
import {
  collectDroppedDiagnosticFields,
  createProductionDiagnosticsIncidentSnapshot,
} from '../src/cloudProduction/productionDiagnosticsIncidentSnapshot';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production diagnostics incident snapshot', () => {
  it('creates redacted production-candidate snapshot with allowed fields only', () => {
    expect(createProductionDiagnosticsIncidentSnapshot({
      environment: 'production-candidate',
      releaseChannel: 'production-candidate',
      runtimeSourceState: 'localStorage-primary',
      backendPrimaryCandidateStatus: 'candidate',
      supabaseAdapterStatus: 'disabled',
      lastCloudPullStatus: 'unavailable',
      lastCloudPushStatus: 'unavailable',
      lastConflictStatus: 'manual_required',
      rollbackAvailable: true,
      emergencyLocalModeAvailable: true,
      errorCodes: ['owner_scope_mismatch', 'unsafe callback!!'],
      buildMetadata: {
        version: '13.11-candidate',
        commit: 'synthetic-commit',
        builtAt: '2026-05-14T00:00:00.000Z',
      },
    })).toEqual({
      kind: 'production-diagnostics-incident-snapshot',
      environment: 'production-candidate',
      releaseChannel: 'production-candidate',
      runtimeSourceState: 'localStorage-primary',
      backendPrimaryCandidateStatus: 'candidate',
      supabaseAdapterStatus: 'disabled',
      lastCloudPullStatus: 'unavailable',
      lastCloudPushStatus: 'unavailable',
      lastConflictStatus: 'manual_required',
      rollbackAvailable: true,
      emergencyLocalModeAvailable: true,
      redactedErrorCodes: ['owner_scope_mismatch', 'unsafecallback'],
      buildMetadata: {
        version: '13.11-candidate',
        commit: 'synthetic-commit',
        builtAt: '2026-05-14T00:00:00.000Z',
      },
      droppedUnsafeFields: [],
      redacted: true,
      noExternalUpload: true,
      fullUserDataIncluded: false,
      secretsIncluded: false,
    });
  });

  it('drops unsafe diagnostic fields and never includes their values', () => {
    const snapshot = createProductionDiagnosticsIncidentSnapshot({
      environment: 'production-candidate',
      releaseChannel: 'production-candidate',
      runtimeSourceState: 'cloud-candidate',
      unsafeDetails: {
        fullAppData: { synthetic: 'training' },
        fullLocalStorage: 'synthetic-local-storage',
        serviceRoleValue: 'synthetic-service-role',
        tokenValue: 'synthetic-token',
        personalNotes: 'synthetic notes',
        rawRequestPayload: { synthetic: true },
      },
    });

    expect(snapshot.droppedUnsafeFields).toEqual([
      'fullAppData',
      'fullLocalStorage',
      'personalNotes',
      'rawRequestPayload',
      'serviceRoleValue',
      'tokenValue',
    ]);
    expect(snapshot).toMatchObject({
      redacted: true,
      noExternalUpload: true,
      fullUserDataIncluded: false,
      secretsIncluded: false,
    });
    expect(JSON.stringify(snapshot)).not.toContain('synthetic-local-storage');
    expect(JSON.stringify(snapshot)).not.toContain('synthetic-service-role');
    expect(JSON.stringify(snapshot)).not.toContain('synthetic-token');
  });

  it('uses safe defaults when candidate statuses are missing', () => {
    expect(createProductionDiagnosticsIncidentSnapshot({
      environment: 'emergency-local',
      releaseChannel: 'emergency-local',
      runtimeSourceState: 'emergency-local',
    })).toMatchObject({
      backendPrimaryCandidateStatus: 'unknown',
      supabaseAdapterStatus: 'unknown',
      lastCloudPullStatus: 'unknown',
      lastCloudPushStatus: 'unknown',
      lastConflictStatus: 'unknown',
      rollbackAvailable: false,
      emergencyLocalModeAvailable: true,
      redactedErrorCodes: [],
      noExternalUpload: true,
    });
  });

  it('collects only unsafe field names for redaction evidence', () => {
    expect(collectDroppedDiagnosticFields({
      safeStatus: 'candidate',
      appDataDocument: {},
      localStorageDump: 'blocked',
      trainingLogRows: [],
      secretKey: 'blocked',
      requestBody: {},
    })).toEqual([
      'appDataDocument',
      'localStorageDump',
      'requestBody',
      'secretKey',
      'trainingLogRows',
    ]);
  });

  it('does not upload snapshots or read secrets', () => {
    const source = readSource('src/cloudProduction/productionDiagnosticsIncidentSnapshot.ts');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'process.env',
      '@sentry',
      'telemetryUpload',
      'analyticsUpload',
      'fullAppDataSnapshotUpload',
      'localStorage.setItem',
      'node:http',
      'node:sqlite',
      'backgroundSync',
      'serviceWorker',
      'syncQueue',
      'polling',
      'timer',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents diagnostic snapshot boundaries and next task', () => {
    const doc = readSource('docs/PRODUCTION_DIAGNOSTICS_INCIDENT_SNAPSHOT.md');

    for (const expected of [
      'Task 13.11 Production Diagnostics & Incident Snapshot V1',
      'environment',
      'release channel',
      'runtime source state',
      'backend-primary candidate status',
      'Supabase adapter status',
      'last cloud pull status',
      'last cloud push status',
      'rollback availability',
      'emergency local mode availability',
      'redacted error codes',
      'No external upload.',
      'No full AppData.',
      'No full localStorage.',
      'Recommended next task: Task 13.12 Release Rollback / Kill Switch V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
