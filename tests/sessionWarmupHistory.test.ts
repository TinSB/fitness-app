import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import { completeFocusSet, updateFocusActualDraft } from '../src/engines/focusModeStateEngine';
import { completeTrainingSessionIntoHistory, finalizeTrainingSession } from '../src/engines/trainingCompletionEngine';
import { buildSessionDetailSummary, getSessionWarmupSets } from '../src/engines/sessionDetailSummaryEngine';
import { sanitizeSessionLog } from '../src/storage/persistence';
import { RecordView } from '../src/features/RecordView';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const noop = (..._args: unknown[]) => undefined;

const completeFirstWarmup = (session: TrainingSession, weightKg = 20, reps = 8) => {
  const stepId = session.currentFocusStepId;
  const drafted = updateFocusActualDraft(session, 0, { actualWeightKg: weightKg, actualReps: reps, actualRir: undefined });
  const result = completeFocusSet(drafted, 0, '2026-04-28T10:00:00.000Z', 1_776_000_000_000, stepId, 'kg');
  if (!result) throw new Error('Failed to complete warmup');
  return result.session;
};

describe('session warmup history', () => {
  it('preserves completed warmup sets from activeSession into history and persistence', () => {
    const activeSession = completeFirstWarmup(makeFocusSession([makeExercise('squat', 3, 0, 2)]), 20, 8);

    expect(activeSession.focusWarmupSetLogs?.[0]).toMatchObject({ type: 'warmup', weight: 20, reps: 8, done: true });

    const finished = completeTrainingSessionIntoHistory(makeAppData({ activeSession }), '2026-04-28T10:30:00.000Z').session;
    expect(finished?.focusWarmupSetLogs?.[0]).toMatchObject({ type: 'warmup', weight: 20, reps: 8, done: true });

    const sanitized = sanitizeSessionLog(JSON.parse(JSON.stringify(finished)));
    expect(sanitized?.focusWarmupSetLogs?.[0]).toMatchObject({ type: 'warmup', weight: 20, reps: 8, done: true });
    expect(getSessionWarmupSets(sanitized as TrainingSession)).toHaveLength(1);
  });

  it('renders warmup and working sections in RecordView history detail', () => {
    const session = finalizeTrainingSession({
      ...completeFirstWarmup(makeFocusSession([makeExercise('squat', 2, 2, 1)]), 20, 8),
      id: 'warmup-detail',
      date: '2026-04-28',
      completed: true,
    });
    const data = makeAppData({ history: [session], unitSettings });
    const text = renderToStaticMarkup(
      React.createElement(RecordView, {
        data,
        unitSettings,
        weeklyPrescription: { weekStart: '2026-04-27', muscles: [] },
        bodyWeightInput: '',
        setBodyWeightInput: noop as React.Dispatch<React.SetStateAction<string>>,
        onSaveBodyWeight: noop,
        onDeleteSession: noop,
        onMarkSessionDataFlag: noop,
        onEditSession: noop,
        onUpdateUnitSettings: noop,
        onRestoreData: noop,
        initialSection: 'list',
        selectedSessionId: session.id,
      }),
    ).replace(/<[^>]+>/g, ' ');

    expect(text).toContain('热身组');
    expect(text).toContain('正式组');
    expect(text).toContain('20kg × 8');
    expect(text).not.toContain('warmup');
    expect(text).not.toContain('working');
  });

  it('keeps replacement warmup sets visible with original and actual exercise identity', () => {
    const source = makeFocusSession([makeExercise('bench-press', 2, 0, 1)]);
    const replaced = applyExerciseReplacement(source, 0, 'db-bench-press');
    const completed = completeFirstWarmup(replaced, 24, 8);
    const summary = buildSessionDetailSummary(finalizeTrainingSession(completed), unitSettings);

    expect(completed.exercises[0].originalExerciseId).toBe('bench-press');
    expect(completed.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(summary.warmupSetCount).toBe(1);
    expect(summary.groupedSets.exerciseGroups[0].warmupSets[0].exercise.actualExerciseId).toBe('db-bench-press');
  });
});
