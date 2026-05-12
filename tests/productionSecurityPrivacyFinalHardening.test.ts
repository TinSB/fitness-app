import { describe, expect, it } from 'vitest';
import { validateEnvironmentConfig } from '../src/config/environmentValidation';
import { redactForPrivacySafeLog } from '../src/observability/redaction';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_SECURITY_PRIVACY_FINAL_HARDENING.md';

describe('production security privacy final hardening', () => {
  it('documents final hardening sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Security Privacy Final Hardening',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Secret Leakage Final Lock',
      '## Sensitive Data Logging Final Lock',
      '## Privacy Controls Final Lock',
      '## Auth / Sync / Deployment Boundary',
      '## Route Boundary',
      '## Source-of-truth Boundary',
      '## Final Hardening Checklist',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('keeps redaction and environment validation safeguards active', () => {
    expect(validateEnvironmentConfig({
      environmentName: 'production',
      runtimeSource: 'apiPrimaryDev',
      containsSecretValues: true,
      productionRuntimeEnabled: true,
    })).toMatchObject({
      ok: false,
      secretValuesAccepted: false,
    });

    expect(redactForPrivacySafeLog({
      authorization: 'Bearer synthetic-token',
      appData: { synthetic: true },
      localStorage: 'synthetic dump',
    })).toEqual({
      value: {
        authorization: '[redacted]',
        appData: '[redacted]',
        localStorage: '[redacted]',
      },
      redactedPaths: ['authorization', 'appData', 'localStorage'],
    });
  });

  it('states final security and privacy boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Raw AppData logging is blocked.',
      'localStorage dump logging is blocked.',
      'Token and secret logging is blocked.',
      'Automated tests must use synthetic data only.',
      'Task 6.32 adds no auth provider',
      'No new browser mutation route is added.',
      'Production source-of-truth switching is not approved by Task 6.32.',
      'Task 6.33 Production Backup, Export, Delete & Recovery Acceptance V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
