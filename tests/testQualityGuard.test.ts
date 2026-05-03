import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const criticalTestFiles = [
  'tests/activeProgramTemplateSession.test.ts',
  'tests/activeProgramTemplateStartSessionState.test.ts',
  'tests/pendingSessionPatchDismiss.test.ts',
  'tests/pendingSessionPatchPersistence.test.ts',
  'tests/pendingSessionPatchPreview.test.ts',
  'tests/pendingSessionPatchStartSession.test.ts',
  'tests/pendingSessionPatchStateHarness.test.ts',
  'tests/sessionPatchStartSession.test.ts',
  'tests/temporarySessionPatchPreview.test.ts',
  'tests/planAdjustmentDraftDedup.test.ts',
  'tests/planAdjustmentStateClosure.test.ts',
  'tests/planAdjustmentStateSync.test.ts',
  'tests/planAdjustmentUpsertIdempotency.test.ts',
  'tests/coachActionDraftDedup.test.ts',
  'tests/coachActionDraftRapidClick.test.ts',
  'tests/dataHealthDismiss.test.ts',
  'tests/profileDataHealthDismiss.test.ts',
  'tests/dataHealthIdentityIssue.test.ts',
  'tests/historyExerciseIdentitySanitize.test.ts',
  'tests/realUserFlowRegression.test.ts',
].filter((file) => existsSync(resolve(process.cwd(), file)));

const readCriticalFile = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('critical test quality guard', () => {
  it('keeps key state-flow tests free of source-string wiring checks', () => {
    const offenders = criticalTestFiles.filter((file) => /readFileSync\s*\(/.test(readCriticalFile(file)));

    expect(offenders).toEqual([]);
  });

  it('does not allow focused or skipped tests in key state-flow coverage', () => {
    const offenders = criticalTestFiles.filter((file) => /\b(?:it|test|describe)\.(?:only|skip)\s*\(/.test(readCriticalFile(file)));

    expect(offenders).toEqual([]);
  });

  it('uses concrete assertions instead of broad toBeTruthy checks in key state-flow coverage', () => {
    const offenders = criticalTestFiles.filter((file) => /\.toBeTruthy\s*\(/.test(readCriticalFile(file)));

    expect(offenders).toEqual([]);
  });
});
