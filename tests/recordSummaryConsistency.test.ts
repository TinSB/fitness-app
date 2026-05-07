import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { DEFAULT_UNIT_SETTINGS } from '../src/engines/unitConversionEngine';
import { RecordView } from '../src/features/RecordView';
import type { TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const noop = () => undefined;

const visibleText = (element: React.ReactElement) =>
  renderToStaticMarkup(element)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const mixedRecordSession = (): TrainingSession & { completedSets?: number; effectiveSets?: number; totalVolumeKg?: number } => {
  const session = makeSession({
    id: 'record-summary-consistency',
    date: '2026-05-04',
    templateId: 'pull-a',
    exerciseId: 'lat-pulldown',
    setSpecs: [
      { weight: 70, reps: 10, rir: 2, techniqueQuality: 'good' },
      { weight: 70, reps: 10, rir: 6, techniqueQuality: 'good' },
    ],
  }) as TrainingSession & { completedSets?: number; effectiveSets?: number; totalVolumeKg?: number };
  session.exercises[0].sets.push({
    id: 'lat-pulldown-unfinished',
    type: 'straight',
    weight: 90,
    actualWeightKg: 90,
    reps: 10,
    rir: 2,
    done: false,
  });
  session.focusWarmupSetLogs = [
    { id: 'main:lat-pulldown:warmup:0', exerciseId: 'lat-pulldown', type: 'warmup', weight: 30, actualWeightKg: 30, reps: 8, rir: '', done: true },
  ];
  session.completedSets = 88;
  session.effectiveSets = 88;
  session.totalVolumeKg = 88888;
  return session;
};

describe('record summary consistency', () => {
  it('keeps calendar and detail summary aligned with real set logs instead of stale cached session fields', () => {
    const session = mixedRecordSession();
    const summary = buildSessionDetailSummary(session);
    const day = buildTrainingCalendar([session], '2026-05').days.find((item) => item.date === '2026-05-04');
    const row = day?.sessions[0];

    expect(summary).toMatchObject({
      plannedWorkingSets: 3,
      completedWorkingSets: 2,
      incompleteSets: 1,
      warmupSets: 1,
      workingVolume: 70 * 10 * 2,
      workingVolumeKg: 70 * 10 * 2,
      warmupVolumeKg: 30 * 8,
    });
    expect(summary.effectiveSets).toBeLessThan(summary.completedWorkingSets);
    expect(summary.effectiveSetGapReasons.length).toBeGreaterThan(0);
    expect(row).toMatchObject({
      completedSets: summary.completedWorkingSets,
      effectiveSets: summary.effectiveSets,
      totalVolumeKg: summary.workingVolume,
    });
    expect(row?.completedSets).not.toBe(session.completedSets);
    expect(row?.totalVolumeKg).not.toBe(session.totalVolumeKg);
    expect(buildEffectiveVolumeSummary([session]).completedSets).toBe(summary.completedWorkingSets);
  });

  it('renders RecordView from trusted summary fields and exposes the effective-set reason affordance', () => {
    const session = mixedRecordSession();
    session.exercises[0] = {
      ...session.exercises[0],
      originalExerciseId: 'lat-pulldown',
      actualExerciseId: 'assisted-pull-up',
      replacementExerciseId: 'assisted-pull-up',
    };
    const data = makeAppData({ history: [session] });
    const operationResult = { ok: true, changed: false, session, message: '' };
    const text = visibleText(
      React.createElement(RecordView, {
        data,
        unitSettings: DEFAULT_UNIT_SETTINGS,
        weeklyPrescription: buildWeeklyPrescription(data),
        bodyWeightInput: '',
        setBodyWeightInput: noop as React.Dispatch<React.SetStateAction<string>>,
        onSaveBodyWeight: noop,
        onDeleteSession: () => operationResult,
        onMarkSessionDataFlag: () => operationResult,
        onEditSession: () => operationResult,
        onUpdateUnitSettings: noop,
        onRestoreData: noop,
        selectedSessionId: session.id,
      }),
    );

    expect(text).toContain('完成正式组');
    expect(text).toContain('2/3');
    expect(text).toContain('有效组');
    expect(text).toContain('未完成组');
    expect(text).toContain('热身组');
    expect(text).toContain('热身量');
    expect(text).toContain('有效组为什么？');
    expect(text).toContain('原计划：高位下拉 / 实际执行：辅助引体向上');
    expect(text).not.toMatch(/\b(undefined|null|warmup|working|support)\b|lat-pulldown|assisted-pull-up|__auto_alt|__alt_/);
  });
});
