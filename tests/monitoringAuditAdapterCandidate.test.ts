import { describe, expect, it } from 'vitest';
import {
  createMonitoringAuditAdapterCandidate,
  createRedactedAuditEvent,
} from '../src/cloudProduction/monitoringAuditAdapterCandidate';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('monitoring audit adapter candidate', () => {
  it('creates disabled in-memory adapter with no external transport by default', () => {
    const adapter = createMonitoringAuditAdapterCandidate();

    expect(adapter).toMatchObject({
      kind: 'monitoring-audit-adapter-candidate',
      enabled: false,
      externalTransport: 'none',
      noExternalUpload: true,
    });
    expect(adapter.snapshot()).toEqual({
      eventCount: 0,
      events: [],
      redacted: true,
      externalTransport: 'none',
      noExternalUpload: true,
    });
  });

  it('records allowed redacted event types in memory', () => {
    const adapter = createMonitoringAuditAdapterCandidate({ enabled: true });

    for (const type of [
      'release_channel_selected',
      'deployment_config_rejected',
      'cloud_pull_candidate_checked',
      'cloud_push_candidate_checked',
      'manual_conflict_resolution_requested',
      'rollback_requested',
      'emergency_local_mode_enabled',
      'diagnostic_snapshot_created',
    ] as const) {
      adapter.record({
        type,
        releaseChannel: 'production-candidate',
        metadata: { safeCount: 1, ok: true },
      });
    }

    expect(adapter.snapshot()).toMatchObject({
      eventCount: 8,
      redacted: true,
      externalTransport: 'none',
      noExternalUpload: true,
    });
  });

  it('redacts sensitive keys and non-primitive metadata', () => {
    const event = createRedactedAuditEvent({
      type: 'deployment_config_rejected',
      severity: 'warning',
      occurredAt: '2026-05-14T00:00:00.000Z',
      releaseChannel: 'production-candidate',
      stableErrorCode: 'service_role_not_browser_safe',
      metadata: {
        safeReason: 'blocked',
        retryable: false,
        serviceRoleValue: 'synthetic-secret-value',
        tokenValue: 'synthetic-token',
        fullAppData: { training: ['synthetic'] },
        fullLocalStorage: 'synthetic-local-storage',
        personalNotes: 'synthetic note',
      },
    });

    expect(event).toEqual({
      type: 'deployment_config_rejected',
      severity: 'warning',
      occurredAt: '2026-05-14T00:00:00.000Z',
      releaseChannel: 'production-candidate',
      stableErrorCode: 'service_role_not_browser_safe',
      metadata: {
        safeReason: 'blocked',
        retryable: false,
      },
      droppedMetadataKeys: [
        'serviceRoleValue',
        'tokenValue',
        'fullAppData',
        'fullLocalStorage',
        'personalNotes',
      ],
      redacted: true,
      noExternalUpload: true,
    });
    expect(JSON.stringify(event)).not.toContain('synthetic-secret-value');
    expect(JSON.stringify(event)).not.toContain('synthetic-token');
    expect(JSON.stringify(event)).not.toContain('synthetic-local-storage');
  });

  it('clears in-memory events without deleting local app data', () => {
    const adapter = createMonitoringAuditAdapterCandidate({ enabled: true });

    adapter.record({ type: 'rollback_requested', metadata: { reason: 'manual' } });
    expect(adapter.snapshot().eventCount).toBe(1);

    adapter.clear();
    expect(adapter.snapshot()).toMatchObject({
      eventCount: 0,
      externalTransport: 'none',
      noExternalUpload: true,
    });
  });

  it('does not import SDKs call networks or include external transport hooks', () => {
    const source = readSource('src/cloudProduction/monitoringAuditAdapterCandidate.ts');

    for (const forbidden of [
      '@sentry',
      'sentry',
      'analytics',
      'telemetry',
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'process.env',
      'localStorage.setItem',
      'node:http',
      'node:sqlite',
      'telemetryUpload',
      'analyticsUpload',
      'fullAppDataSnapshotUpload',
      'backgroundSync',
      'serviceWorker',
      'syncQueue',
      'polling',
      'timer',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents monitoring adapter candidate boundaries and next task', () => {
    const doc = readSource('docs/MONITORING_AUDIT_ADAPTER_CANDIDATE.md');

    for (const expected of [
      'Task 13.10 Monitoring / Audit Adapter Candidate V1',
      'in-memory monitor adapter',
      'redacted event adapter',
      'diagnostic event collector',
      'release health snapshot',
      'No external upload.',
      'No analytics SDK.',
      'No telemetry provider.',
      'No full AppData payload.',
      'Recommended next task: Task 13.11 Production Diagnostics & Incident Snapshot V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
