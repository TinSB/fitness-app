import { describe, expect, it } from 'vitest';
import { parseAppleHealthXml } from '../src/engines/appleHealthXmlImportEngine';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import type { ImportedWorkoutSample, TrainingSession } from '../src/models/training-model';

const strengthSession: TrainingSession = {
  id: 'session-1',
  date: '2026-04-21',
  templateId: 'push-a',
  templateName: 'Push A',
  trainingMode: 'hybrid',
  exercises: [],
  dataFlag: 'normal',
};

const importedWorkout: ImportedWorkoutSample = {
  id: 'watch-1',
  source: 'apple_watch_workout',
  workoutType: '羽毛球',
  startDate: '2026-04-21T20:00:00.000Z',
  endDate: '2026-04-21T21:30:00.000Z',
  durationMin: 90,
  activeEnergyKcal: 500,
  importedAt: '2026-04-22T00:00:00.000Z',
  dataFlag: 'normal',
};

describe('calendar external activity', () => {
  it('shows imported workouts as external activity without counting them as strength sessions', () => {
    const calendar = buildTrainingCalendar([strengthSession], '2026-04', {
      importedWorkouts: [importedWorkout],
      includeExternalWorkouts: true,
    });
    const day = calendar.days.find((item) => item.date === '2026-04-21');

    expect(day?.totalSessions).toBe(1);
    expect(day?.totalExternalWorkouts).toBe(1);
    expect(day?.externalWorkouts[0]?.workoutType).toBe('羽毛球');
  });

  it('does not show external activity when toggle is off', () => {
    const calendar = buildTrainingCalendar([], '2026-04', {
      importedWorkouts: [importedWorkout],
      includeExternalWorkouts: false,
    });
    const day = calendar.days.find((item) => item.date === '2026-04-21');

    expect(day?.totalSessions).toBe(0);
    expect(day?.totalExternalWorkouts).toBe(0);
  });

  it('ignores excluded imported workouts by default', () => {
    const calendar = buildTrainingCalendar([], '2026-04', {
      importedWorkouts: [{ ...importedWorkout, dataFlag: 'excluded' }],
      includeExternalWorkouts: true,
    });
    const day = calendar.days.find((item) => item.date === '2026-04-21');

    expect(day?.totalExternalWorkouts).toBe(0);
  });

  it('shows XML-imported Workout as external activity only', () => {
    const imported = parseAppleHealthXml(
      `<?xml version="1.0"?><HealthData>
        <Workout workoutActivityType="HKWorkoutActivityTypeBadminton" sourceName="Apple Watch" startDate="2026-04-21 20:00:00 +0000" endDate="2026-04-21 21:30:00 +0000" duration="90" durationUnit="min"/>
      </HealthData>`,
      'export.xml'
    );
    const calendar = buildTrainingCalendar([], '2026-04', {
      importedWorkouts: imported.workouts,
      includeExternalWorkouts: true,
    });
    const day = calendar.days.find((item) => item.date === '2026-04-21');

    expect(day?.totalSessions).toBe(0);
    expect(day?.totalExternalWorkouts).toBe(1);
    expect(day?.externalWorkouts[0]?.workoutType).toBe('羽毛球');
  });
});
