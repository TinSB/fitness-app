import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { parseAppleHealthXml } from '../src/engines/appleHealthXmlImportEngine';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { applyStatusRules } from '../src/engines/exercisePrescriptionEngine';
import { buildHealthSummary } from '../src/engines/healthSummaryEngine';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { getTemplate, makeStatus } from './fixtures';

const appleHealthXml = `<?xml version="1.0"?><HealthData>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-04-27 23:30:00 +0000" endDate="2026-04-28 03:30:00 +0000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-25 07:00:00 +0000" endDate="2026-04-25 07:00:00 +0000" value="55"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-26 07:00:00 +0000" endDate="2026-04-26 07:00:00 +0000" value="56"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-27 07:00:00 +0000" endDate="2026-04-27 07:00:00 +0000" value="55"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-04-28 07:00:00 +0000" endDate="2026-04-28 07:00:00 +0000" value="64"/>
  <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-25 07:05:00 +0000" endDate="2026-04-25 07:05:00 +0000" value="62"/>
  <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-26 07:05:00 +0000" endDate="2026-04-26 07:05:00 +0000" value="61"/>
  <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-27 07:05:00 +0000" endDate="2026-04-27 07:05:00 +0000" value="60"/>
  <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" startDate="2026-04-28 07:05:00 +0000" endDate="2026-04-28 07:05:00 +0000" value="48"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeBadminton" sourceName="Apple Watch" startDate="2026-04-27 20:00:00 +0000" endDate="2026-04-27 21:30:00 +0000" duration="90" durationUnit="min"/>
</HealthData>`;

describe('health data integration flow', () => {
  it('routes Apple Health XML through summary, readiness, session creation and calendar without polluting strength analytics', () => {
    const imported = parseAppleHealthXml(appleHealthXml, 'export.xml');
    const sleep = imported.samples.find((sample) => sample.metricType === 'sleep_duration');
    expect((sleep?.raw as { day?: string } | undefined)?.day).toBe('2026-04-28');

    const healthSummary = buildHealthSummary(imported.samples, imported.workouts, { endDate: '2026-04-28T12:00:00.000Z' });
    expect(healthSummary.latestSleepHours).toBe(4);
    expect(healthSummary.activityLoad?.previous24hHighActivity).toBe(true);

    const template = getTemplate('push-a');
    const status = makeStatus({ sleep: '好', energy: '高', soreness: ['无'], time: '90' });
    const adjustedWithHealth = applyStatusRules(template, status, 'hybrid', null, [], DEFAULT_SCREENING_PROFILE, undefined, {
      healthSummary,
      useHealthDataForReadiness: true,
    });
    const adjustedWithoutHealth = applyStatusRules(template, status, 'hybrid', null, [], DEFAULT_SCREENING_PROFILE, undefined, {
      healthSummary,
      useHealthDataForReadiness: false,
    });

    expect(adjustedWithHealth.readinessResult.score).toBeLessThan(adjustedWithoutHealth.readinessResult.score);
    expect(adjustedWithHealth.readiness.reasons.join(' ')).toContain('过去 24 小时外部活动量较高');

    const session = createSession(template, status, [], 'hybrid', null, null, DEFAULT_SCREENING_PROFILE, undefined, {
      healthSummary,
      useHealthDataForReadiness: true,
    });
    expect(session.explanations?.join(' ')).toBeTruthy();
    expect(session.deloadDecision).toBeTruthy();

    const calendar = buildTrainingCalendar([], '2026-04', {
      importedWorkouts: imported.workouts,
      includeExternalWorkouts: true,
    });
    const externalDay = calendar.days.find((day) => day.date === '2026-04-27');
    expect(externalDay?.totalSessions).toBe(0);
    expect(externalDay?.totalExternalWorkouts).toBe(1);

    expect(buildE1RMProfile([], 'bench-press').current).toBeUndefined();
    expect(buildEffectiveVolumeSummary([]).completedSets).toBe(0);
  });
});
