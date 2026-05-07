import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { DEFAULT_UNIT_SETTINGS } from '../src/engines/unitConversionEngine';
import { RecordView } from '../src/features/RecordView';
import type { TrainingSession, TrainingSetLog } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const noop = () => undefined;

const visibleText = (element: React.ReactElement) =>
  renderToStaticMarkup(element)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const workingSet = (id: string, overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id,
  type: 'straight',
  weight: 80,
  actualWeightKg: 80,
  reps: 8,
  rir: 2,
  done: true,
  techniqueQuality: 'good',
  ...overrides,
});

const recordSession = (sets: TrainingSetLog[]): TrainingSession => {
  const session = makeSession({
    id: 'record-effective-explanation',
    date: '2026-05-04',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });
  session.exercises[0].sets = sets;
  return session;
};

const renderRecordText = (session: TrainingSession) => {
  const data = makeAppData({ history: [session] });
  const operationResult = { ok: true, changed: false, session, message: '' };
  return visibleText(
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
};

describe('record effective set explanation', () => {
  it('renders the folded explanation when effective sets are fewer than completed working sets', () => {
    const text = renderRecordText(recordSession([workingSet('effective'), workingSet('too-easy', { rir: 6 })]));

    expect(text).toContain('有效组为什么？');
    expect(text).toContain('2 个已完成正式组中，1 个计入有效组。');
    expect(text).toContain('已计入');
    expect(text).toContain('未计入');
    expect(text).toContain('平板卧推 第 1 组：符合有效组条件。');
    expect(text).toContain('平板卧推 第 2 组：该组距离力竭较远，未达到有效组标准。');
    expect(text).not.toMatch(/\b(undefined|null|not_enough_effort|incomplete|warmup|identity_invalid|test_or_excluded)\b|bench-press|__auto_alt|__alt_/);
  });

  it('does not render extra explanation when all completed working sets are counted', () => {
    const text = renderRecordText(recordSession([workingSet('effective-a'), workingSet('effective-b')]));

    expect(text).not.toContain('有效组为什么？');
    expect(text).not.toContain('未计入');
    expect(text).not.toMatch(/\b(undefined|null)\b|bench-press|__auto_alt|__alt_/);
  });
});
