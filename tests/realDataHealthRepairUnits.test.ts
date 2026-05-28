import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppData } from '../src/models/training-model';
import {
  sessionLifecycleResidueV1,
  impossibleDurationV1,
  staleTodayStatusV1,
  staleHealthReadinessGuardV1,
  screeningIssueScoreRuntimeGuardV1,
  screeningIssueScoreRepairV1,
  legacyFinalAdviceIsolationGuardV1,
  setIndexRenumberV1,
  replacementEquivalenceAuditV1,
} from '../src/dataHealth/appDataRepairRegistry';
import { runRepair, buildRegistry } from '../src/dataHealth/appDataRepairEngine';
import {
  DATA_HEALTH_FALLBACK_DURATION_MIN,
  DATA_HEALTH_IMPOSSIBLE_DURATION_MIN,
  DATA_HEALTH_ISSUE_SCORE_HARD_CAP,
  DATA_HEALTH_ISSUE_SCORE_SOFT_CAP,
} from '../src/dataHealth/appDataRepairTypes';

const FIXTURE_PATH = resolve(__dirname, './fixtures/data-health/ironpath-2026-05-27-redacted.json');

const loadFixture = (): AppData => JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

const stubDateNow = (iso: string) => {
  const original = Date.now;
  Date.now = () => new Date(iso).getTime();
  return () => {
    Date.now = original;
  };
};

describe('realDataHealthRepairUnits — per-repair detection and apply', () => {
  it('realDataHealthRepairLifecycleResidueDetectionReturnsAllCompletedSessions', () => {
    const data = loadFixture();
    const result = sessionLifecycleResidueV1.detect(data);
    expect(result.detected).toBe(true);
    expect(result.occurrences).toBeGreaterThanOrEqual(10);
    expect(result.severity).toBe('warning');
  });

  it('realDataHealthRepairLifecycleResidueApplyClearsResidueAndIsIdempotent', () => {
    const data = loadFixture();
    const apply1 = sessionLifecycleResidueV1.apply!(data);
    expect(apply1.status).toBe('applied');
    apply1.repairedData.history.forEach((session) => {
      if (!session.completed) return;
      expect(session.restTimerState?.isRunning ?? false).toBe(false);
      expect(session.currentExerciseId).toBe('');
      expect(session.focusActualSetDrafts ?? []).toEqual([]);
    });
    const detectAgain = sessionLifecycleResidueV1.detect(apply1.repairedData);
    expect(detectAgain.detected).toBe(false);
  });

  it('realDataHealthRepairLifecyclePreservesCompletedSetData', () => {
    const data = loadFixture();
    const sessionWithSets = data.history.find((s) =>
      (s.exercises || []).some((ex) => Array.isArray(ex.sets) && ex.sets.length > 0),
    );
    const beforeSetCounts = (sessionWithSets?.exercises || []).map((ex) =>
      Array.isArray(ex.sets) ? ex.sets.length : 0,
    );
    const apply = sessionLifecycleResidueV1.apply!(data);
    const after = apply.repairedData.history.find((s) => s.id === sessionWithSets?.id);
    const afterSetCounts = (after?.exercises || []).map((ex) =>
      Array.isArray(ex.sets) ? ex.sets.length : 0,
    );
    expect(afterSetCounts).toEqual(beforeSetCounts);
  });

  it('realDataHealthRepairImpossibleDurationDetectionFinds4204MinuteSession', () => {
    const data = loadFixture();
    const result = impossibleDurationV1.detect(data);
    expect(result.detected).toBe(true);
    expect(result.occurrences).toBeGreaterThanOrEqual(1);
    const offender = data.history.find((s) => s.id === 'session-1777936222822');
    expect(offender?.durationMin).toBeGreaterThan(DATA_HEALTH_IMPOSSIBLE_DURATION_MIN);
  });

  it('realDataHealthRepairImpossibleDurationApplyUsesFallback', () => {
    const data = loadFixture();
    const apply = impossibleDurationV1.apply!(data);
    expect(apply.status).toBe('applied');
    const repaired = apply.repairedData.history.find((s) => s.id === 'session-1777936222822');
    expect(repaired?.durationMin).toBeLessThanOrEqual(DATA_HEALTH_IMPOSSIBLE_DURATION_MIN);
    expect((repaired as { durationInvalid?: boolean })?.durationInvalid).toBe(true);
    expect(repaired?.durationMin).toBe(DATA_HEALTH_FALLBACK_DURATION_MIN);
  });

  it('realDataHealthRepairImpossibleDurationDoesNotDeleteSession', () => {
    const data = loadFixture();
    const apply = impossibleDurationV1.apply!(data);
    expect(apply.repairedData.history.length).toBe(data.history.length);
  });

  it('realDataHealthRepairStaleTodayStatusDetection', () => {
    const restore = stubDateNow('2026-05-27T00:00:00.000Z');
    try {
      const data = loadFixture();
      const result = staleTodayStatusV1.detect(data);
      expect(result.detected).toBe(true);
      expect(result.occurrences).toBe(1);
    } finally {
      restore();
    }
  });

  it('realDataHealthRepairStaleTodayStatusApplyMarksFlagAndPreservesSubjectiveFields', () => {
    const restore = stubDateNow('2026-05-27T00:00:00.000Z');
    try {
      const data = loadFixture();
      const originalSleep = data.todayStatus.sleep;
      const apply = staleTodayStatusV1.apply!(data);
      expect(apply.status).toBe('applied');
      const settings = apply.repairedData.settings as Record<string, unknown>;
      const flags = settings.dataHealthRuntimeFlags as { todayStatusIgnoredAt?: string };
      expect(flags.todayStatusIgnoredAt).toBeTruthy();
      expect(apply.repairedData.todayStatus.sleep).toBe(originalSleep);
      expect(apply.repairedData.todayStatus.date).toBe(data.todayStatus.date);
    } finally {
      restore();
    }
  });

  it('realDataHealthRepairStaleHealthDataDetectionUsesFreshnessThreshold', () => {
    const restore = stubDateNow('2026-05-27T00:00:00.000Z');
    try {
      const data = loadFixture();
      const result = staleHealthReadinessGuardV1.detect(data);
      expect(result.detected).toBe(true);
    } finally {
      restore();
    }
  });

  it('realDataHealthRepairStaleHealthDataApplyPreservesUserPreference', () => {
    const restore = stubDateNow('2026-05-27T00:00:00.000Z');
    try {
      const data = loadFixture();
      const apply = staleHealthReadinessGuardV1.apply!(data);
      expect(apply.status).toBe('applied');
      const integrationSettings = apply.repairedData.settings?.healthIntegrationSettings;
      expect(integrationSettings?.useHealthDataForReadiness).toBe(true);
      const flags = (apply.repairedData.settings as Record<string, unknown>).dataHealthRuntimeFlags as {
        healthDataStaleSince?: string;
      };
      expect(flags.healthDataStaleSince).toBeTruthy();
    } finally {
      restore();
    }
  });

  it('realDataHealthRepairScreeningIssueScoreRuntimeGuardDetection', () => {
    const data = loadFixture();
    const result = screeningIssueScoreRuntimeGuardV1.detect(data);
    expect(result.detected).toBe(true);
    expect(result.affectedIds).toEqual(
      expect.arrayContaining(['scapular_control', 'upper_crossed', 'breathing_ribcage', 'thoracic_rotation']),
    );
    expect(result.severity).toBe('error');
  });

  it('realDataHealthRepairScreeningIssueScoreRuntimeGuardNeverMutates', () => {
    const data = loadFixture();
    const apply = screeningIssueScoreRuntimeGuardV1.apply!(data);
    expect(apply.status).toBe('skipped');
    expect(apply.repairedData.screeningProfile.adaptiveState?.issueScores).toEqual(
      data.screeningProfile.adaptiveState?.issueScores,
    );
  });

  it('realDataHealthRepairScreeningIssueScoreRepairAppliesUnderSafeConditions', () => {
    const data = loadFixture();
    const result = screeningIssueScoreRepairV1.detect(data);
    expect(result.detected).toBe(true);
    const apply = screeningIssueScoreRepairV1.apply!(data);
    expect(apply.status).toBe('applied');
    const scores = apply.repairedData.screeningProfile.adaptiveState?.issueScores || {};
    Object.values(scores).forEach((value) => {
      if (typeof value === 'number') {
        expect(value).toBeLessThanOrEqual(DATA_HEALTH_ISSUE_SCORE_HARD_CAP);
      }
    });
    const flaggedKey = 'scapular_control';
    if (typeof scores[flaggedKey] === 'number') {
      expect(scores[flaggedKey]).toBeLessThanOrEqual(DATA_HEALTH_ISSUE_SCORE_SOFT_CAP);
    }
  });

  it('realDataHealthRepairLegacyAdviceCoverageDetection', () => {
    const data = loadFixture();
    const result = legacyFinalAdviceIsolationGuardV1.detect(data);
    expect(result.detected).toBe(true);
    expect(result.occurrences).toBeGreaterThanOrEqual(10);
  });

  it('realDataHealthRepairLegacyAdviceGuardNeverMutates', () => {
    const data = loadFixture();
    const apply = legacyFinalAdviceIsolationGuardV1.apply!(data);
    expect(apply.status).toBe('skipped');
    expect(apply.repairedData).toBe(data);
  });

  it('realDataHealthRepairSetIndexDetectionAndRenumber', () => {
    const data = loadFixture();
    const detect = setIndexRenumberV1.detect(data);
    expect(detect.detected).toBe(true);
    expect(detect.occurrences).toBeGreaterThanOrEqual(40);
    const apply = setIndexRenumberV1.apply!(data);
    expect(apply.status).toBe('applied');
    apply.repairedData.history.forEach((session) => {
      (session.exercises || []).forEach((exercise) => {
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        sets.forEach((set, index) => {
          expect(set.setIndex).toBe(index);
        });
      });
    });
  });

  it('realDataHealthRepairReplacementEquivalenceAudit', () => {
    const data = loadFixture();
    const result = replacementEquivalenceAuditV1.detect(data);
    expect(result.detected).toBe(true);
    expect(result.occurrences).toBeGreaterThanOrEqual(2);
    const apply = replacementEquivalenceAuditV1.apply!(data);
    expect(apply.status).toBe('skipped');
    expect(apply.repairedData).toBe(data);
  });

  it('realDataHealthRepairDryRunIsPureAndIdempotent', () => {
    const data = loadFixture();
    const registry = buildRegistry([
      sessionLifecycleResidueV1,
      impossibleDurationV1,
      staleTodayStatusV1,
      staleHealthReadinessGuardV1,
      screeningIssueScoreRuntimeGuardV1,
      screeningIssueScoreRepairV1,
      legacyFinalAdviceIsolationGuardV1,
      setIndexRenumberV1,
      replacementEquivalenceAuditV1,
    ]);
    registry.list().forEach((definition) => {
      const first = definition.dryRun(data);
      const second = definition.dryRun(data);
      expect(second.idempotencyKey).toBe(first.idempotencyKey);
    });
  });

  it('realDataHealthRepairApplyProducesReceipt', () => {
    const data = loadFixture();
    const registry = buildRegistry([sessionLifecycleResidueV1]);
    const repaired = runRepair(registry, data, 'sessionLifecycleResidueV1', { triggeredBy: 'manual' });
    expect(repaired.status).toBe('applied');
    expect(repaired.receipt.repairId).toBe('sessionLifecycleResidueV1');
    expect(repaired.receipt.category).toBe('session_lifecycle');
    const logs = repaired.repairedData.settings?.dataRepairLogs || [];
    expect(logs.some((entry) => entry.repairId === 'sessionLifecycleResidueV1')).toBe(true);
  });
});
