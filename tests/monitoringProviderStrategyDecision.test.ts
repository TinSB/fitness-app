import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('monitoring provider strategy decision', () => {
  const doc = () => readSource('docs/MONITORING_PROVIDER_STRATEGY_DECISION.md');

  it('records the short-term and later monitoring decision', () => {
    const content = doc();

    for (const expected of [
      'Task 13.9 decides the monitoring direction',
      'Short term: internal audit and redacted diagnostic snapshot.',
      'Later candidate: Sentry-style error monitoring.',
      'External upload remains blocked until explicit later authorization.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('defines monitoring categories', () => {
    const content = doc();

    for (const expected of [
      'local diagnostic snapshot',
      'in-memory audit event collector',
      'redacted release health snapshot',
      'external provider candidate later',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('defines redaction rules for sensitive data', () => {
    const content = doc();

    for (const expected of [
      'full AppData',
      'full localStorage',
      'training logs',
      'secrets',
      'tokens',
      'service role',
      'personal notes',
      'raw request payloads with user data',
      'real personal training data',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks provider SDKs package drift and external upload', () => {
    const content = doc();

    for (const expected of [
      'No external monitoring upload.',
      'No analytics upload.',
      'No provider SDK.',
      'No package or lockfile change.',
      'Accepted browser mutation routes remain exactly seven.',
    ]) {
      expect(content).toContain(expected);
    }

    for (const forbidden of [
      'Sentry SDK installed',
      'analytics SDK installed',
      'external monitoring upload enabled',
      'telemetry upload enabled',
      'new monitoring dependency',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('recommends only Task 13.10', () => {
    expect(doc()).toContain('Recommended next task: Task 13.10 Monitoring / Audit Adapter Candidate V1.');
  });
});
