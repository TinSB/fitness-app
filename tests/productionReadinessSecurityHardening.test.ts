import { describe, expect, it } from 'vitest';
import { validateEnvironmentConfig } from '../src/config/environmentValidation';
import { redactForPrivacySafeLog } from '../src/observability/redaction';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_READINESS_SECURITY_HARDENING.md';

describe('production readiness security hardening', () => {
  it('documents required security hardening sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Readiness Security Hardening',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Secret Leakage Controls',
      '## Sensitive Data Logging Controls',
      '## Route Boundary',
      '## Privacy Controls',
      '## No Auth Or Deployment Runtime',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('keeps env validation and redaction controls active', () => {
    expect(validateEnvironmentConfig({
      environmentName: 'production',
      runtimeSource: 'apiPrimaryDev',
      containsSecretValues: true,
      productionRuntimeEnabled: true,
    })).toMatchObject({
      ok: false,
      secretValuesAccepted: false,
      errors: [
        'secret values must not be supplied to browser validation',
        'production runtime is not enabled by this skeleton',
        'API primary dev mode is not a production runtime source',
      ],
    });

    expect(redactForPrivacySafeLog({
      token: 'abc',
      appData: { workout: 'synthetic' },
      message: 'safe',
    })).toEqual({
      value: {
        token: '[redacted]',
        appData: '[redacted]',
        message: 'safe',
      },
      redactedPaths: ['token', 'appData'],
    });
  });

  it('states no auth, deployment, sync runtime, routes, or secret values', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not auth runtime implementation.',
      'This is not deployment runtime implementation.',
      'This is not sync runtime implementation.',
      'No secret values may be committed',
      'Raw AppData logging is blocked.',
      'localStorage dump logging is blocked.',
      'Token/secret logging is blocked.',
      'No new browser mutation route is added.',
      'Task 6.26 Production Manual Acceptance Runbook V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
