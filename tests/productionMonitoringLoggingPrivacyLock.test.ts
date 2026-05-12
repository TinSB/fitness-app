import { describe, expect, it } from 'vitest';
import { redactForPrivacySafeLog } from '../src/observability/redaction';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_MONITORING_LOGGING_PRIVACY_LOCK.md';

describe('production monitoring logging privacy lock', () => {
  it('documents required privacy lock sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Monitoring Logging Privacy Lock',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Sensitive Data Redaction',
      '## No Raw AppData Logging',
      '## No localStorage Dump',
      '## No Token Or Secret Logging',
      '## Privacy-safe Diagnostics',
      '## Future Observability Gates',
      '## Route and Source-of-truth Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('keeps redaction behavior active for sensitive diagnostic fields', () => {
    expect(redactForPrivacySafeLog({
      appData: { synthetic: true },
      localStorage: 'synthetic storage dump',
      token: 'synthetic-token',
      message: 'safe category',
    })).toEqual({
      value: {
        appData: '[redacted]',
        localStorage: '[redacted]',
        token: '[redacted]',
        message: 'safe category',
      },
      redactedPaths: ['appData', 'localStorage', 'token'],
    });
  });

  it('states no monitoring runtime or sensitive logging', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Raw AppData logging is blocked.',
      'localStorage dump logging is blocked.',
      'Token logging is blocked.',
      'Secret logging is blocked.',
      'Task 6.36 adds no monitoring runtime and no external provider.',
      'Task 6.37 Production Release Candidate Regression Lock V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
