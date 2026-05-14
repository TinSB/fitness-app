import { describe, expect, it } from 'vitest';
import {
  createAuditEvent,
  createInMemoryAuditCollector,
  redactAuditMetadata,
} from '../src/cloudProduction/monitoringAuditBoundary';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('monitoring and audit event boundary', () => {
  it('creates stable redacted audit events without external upload', () => {
    expect(createAuditEvent({
      id: 'audit-1',
      category: 'migration_dry_run',
      severity: 'info',
      message: 'Synthetic migration dry run recorded.',
      metadata: {
        syntheticCount: 3,
        secretValue: 'synthetic-secret',
        rawAppData: { history: ['synthetic'] },
      },
    })).toEqual({
      id: 'audit-1',
      category: 'migration_dry_run',
      severity: 'info',
      message: 'Synthetic migration dry run recorded.',
      metadata: {
        syntheticCount: 3,
        secretValue: '[redacted]',
        rawAppData: '[redacted]',
      },
      externalUploadPerformed: false,
    });
  });

  it('redacts secret-like and non-primitive metadata', () => {
    expect(redactAuditMetadata({
      authorizationHeader: 'Bearer synthetic',
      nested: { value: 'synthetic' },
      safeFlag: true,
      safeText: 'candidate-only',
    })).toEqual({
      authorizationHeader: '[redacted]',
      nested: '[redacted]',
      safeFlag: true,
      safeText: 'candidate-only',
    });
  });

  it('collects events in memory only', () => {
    const collector = createInMemoryAuditCollector();
    expect(collector.externalTransportEnabled).toBe(false);

    collector.record({
      id: 'audit-1',
      category: 'source_of_truth_switch_attempt',
      severity: 'blocked',
      message: 'Switch attempt blocked.',
      metadata: { reason: 'synthetic-test' },
    });

    expect(collector.list()).toEqual([{
      id: 'audit-1',
      category: 'source_of_truth_switch_attempt',
      severity: 'blocked',
      message: 'Switch attempt blocked.',
      metadata: { reason: 'synthetic-test' },
      externalUploadPerformed: false,
    }]);

    collector.clear();
    expect(collector.list()).toEqual([]);
  });

  it('supports all required future event categories', () => {
    const categories = [
      'auth_login_attempt',
      'auth_logout_attempt',
      'migration_dry_run',
      'source_of_truth_switch_attempt',
      'backend_primary_read_candidate',
      'backend_primary_write_candidate',
      'rollback',
      'emergency_restore',
      'sync_conflict',
      'sync_rejected',
      'deployment_readiness_check',
      'secret_env_guard_rejection',
    ] as const;

    for (const category of categories) {
      expect(createAuditEvent({
        id: category,
        category,
        severity: 'info',
        message: 'Synthetic event.',
      })).toMatchObject({ category, externalUploadPerformed: false });
    }
  });

  it('does not include external transport, analytics SDKs, network calls, or Node-only imports', () => {
    const source = readSource('src/cloudProduction/monitoringAuditBoundary.ts');

    for (const forbidden of [
      'fetch(',
      'sendBeacon',
      'XMLHttpRequest',
      'analytics',
      'telemetry',
      'Sentry',
      'Datadog',
      'node:http',
      'node:sqlite',
      'apps/api/src/node',
      'localStorage.setItem',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents monitoring/audit boundaries and next task', () => {
    const doc = readSource('docs/MONITORING_AUDIT_EVENT_BOUNDARY.md');

    for (const expected of [
      'Task 10.11 Monitoring & Audit Event Boundary V1',
      'The collector is in-memory only.',
      'The collector has no external transport.',
      'The collector does not upload events.',
      'Audit metadata is redacted before storage.',
      'Monitoring external upload remains unimplemented.',
      'Recommended next task: Task 10.12 Production Privacy / Data Safety Manual Acceptance V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
