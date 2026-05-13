import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/USER_IDENTITY_DATA_OWNERSHIP_CONTRACT.md';

describe('user identity and data ownership contract', () => {
  it('defines required identity terms without implementing accounts', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 10.2 User Identity & Data Ownership Contract V1',
      '`userId`',
      '`accountId`',
      '`deviceId`',
      '`localOwnerId`',
      '`anonymousLocalOwner`',
      '`cloudAccountOwner`',
      'It is not created in Phase 10.2.',
      'This task is docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks ownership relationships for local, backend candidate, cloud candidate, and emergency backup data', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Local AppData remains owned by `anonymousLocalOwner`',
      'Backend-primary candidate AppData remains candidate data.',
      'Future cloud account AppData must be explicitly linked to a `cloudAccountOwner`',
      'Device-local emergency backup must preserve the owner context',
      'Emergency backup must not be deleted',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves unauthenticated local mode and localStorage roles', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Unauthenticated local mode remains valid.',
      '`localStorage` remains the default runtime source.',
      '`localStorage` remains fallback, migration source, and emergency backup.',
      'backend-primary candidate remains explicit opt-in and reversible.',
      'no cloud account owner exists.',
      'no cloud sync is performed.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('defines future login, logout, deletion, export, restore, and linking expectations', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Future login or linked-account work requires',
      'logout must not delete localStorage emergency backup automatically',
      'Future account deletion must require explicit confirmation',
      'Future data export must be available before production cloud source-of-truth work.',
      'Future restore must validate owner scope before applying data.',
      'A future local profile may link to a cloud account only after',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents multi-device risks and blocked implementation scope', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Multi-device identity is risky without real sync and conflict handling.',
      'two devices may both edit training history offline',
      'owner mismatch may attach training data to the wrong account',
      'real auth provider integration',
      'real login/signup UI or runtime',
      'real user accounts',
      'cloud sync',
      'user table',
      'normalized tables',
      'destructive migration',
      'real personal training data',
      'Recommended next task: Task 10.3 Auth Provider Strategy Decision V1.',
      'Task 10.3 is not part of Task 10.2.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
