import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_AUTH_USER_DATA_BOUNDARY_PLAN.md';

describe('production auth user data boundary plan', () => {
  it('documents required auth and user data sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Auth User Data Boundary Plan',
      '## Task Identity',
      '## Auth Boundary',
      '## User Account Boundary',
      '## Data Ownership Boundary',
      '## Local Data Association Model',
      '## Cloud Sync Dependency On Auth',
      '## Source-of-truth Dependency On Auth',
      '## Privacy and Sensitive Training Data Boundary',
      '## Test Data Policy',
      '## Blocked Implementation List',
      '## Decision',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks auth and source-of-truth dependencies', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Production backend cannot become source-of-truth without auth/user identity',
      'Cloud sync remains blocked without auth/user identity.',
      'Production source-of-truth switch remains blocked without auth/user identity',
      'Training data is sensitive personal data.',
      'Real personal training data must not be used.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no auth or account implementation and next task boundary', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'No auth provider is selected or implemented in this task.',
      'No production account runtime is implemented.',
      'No login/signup flow is implemented.',
      'No token/session/OAuth handling is implemented.',
      'No user table is created.',
      'Task 7.6 is not started by Task 7.5.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
