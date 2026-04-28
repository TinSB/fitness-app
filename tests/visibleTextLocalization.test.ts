import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import { PlanView } from '../src/features/PlanView';
import { RecordView } from '../src/features/RecordView';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import { TrainingView } from '../src/features/TrainingView';
import { getTemplate, makeAppData, makeSession } from './fixtures';
import { makeExercise as makeFocusExercise, makeFocusSession } from './focusModeFixtures';

const rawVisibleTerms = [
  'Legs A',
  'Push A',
  'Pull A',
  'Focus Mode',
  'hypertrophy',
  'hybrid',
  'strength',
  'fat_loss',
  'high',
  'medium',
  'low',
  'warmup',
  'working',
  'support',
  'compound',
  'isolation',
  'machine',
  'undefined',
  'null',
];

const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const expectLocalized = (text: string) => {
  rawVisibleTerms.forEach((term) => {
    expect(text).not.toMatch(new RegExp(`(^|[^A-Za-z_])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z_]|$)`));
  });
};

describe('visible text localization', () => {
  it('renders Today and Plan with unified Chinese template names', () => {
    const data = makeAppData({ selectedTemplateId: 'legs-a', activeProgramTemplateId: 'legs-a' });
    const text = [
      visibleText(
        React.createElement(TodayView, {
          data,
          selectedTemplate: getTemplate('legs-a'),
          suggestedTemplate: getTemplate('push-a'),
          weeklyPrescription: buildWeeklyPrescription(data),
          trainingMode: 'hybrid',
          onModeChange: noop,
          onStatusChange: noop,
          onSorenessToggle: noop,
          onTemplateSelect: noop,
          onUseSuggestion: noop,
          onStart: noop,
          onResume: noop,
        }),
      ),
      visibleText(
        React.createElement(PlanView, {
          data,
          weeklyPrescription: buildWeeklyPrescription(data),
          selectedTemplateId: 'legs-a',
          onSelectTemplate: noop,
          onStartTemplate: noop,
          onUpdateExercise: noop,
          onResetTemplates: noop,
          onRollbackProgramAdjustment: noop,
        }),
      ),
    ].join(' ');

    expect(text).toContain('腿 A');
    expect(text).toContain('推 A');
    expectLocalized(text);
  });

  it('renders Training, Focus, and Record without raw English enums or ids', () => {
    const historySession = {
      ...makeSession({
        id: 'history-legs',
        date: '2026-04-28',
        templateId: 'legs-a',
        exerciseId: 'squat',
        setSpecs: [{ weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' }],
      }),
      templateName: 'Legs A',
    };
    const recordData = makeAppData({ history: [historySession] });
    const focusSession = makeFocusSession([makeFocusExercise('bench-press', 2)]);
    const text = [
      visibleText(
        React.createElement(TrainingView, {
          session: focusSession,
          unitSettings: { weightUnit: 'kg', defaultIncrementKg: 2.5, defaultIncrementLb: 5, customIncrementsKg: [], customIncrementsLb: [] },
          restTimer: null,
          expandedExercise: 0,
          setExpandedExercise: setStateNoop,
          onStartFromSelected: noop,
          onSetChange: noop,
          onCompleteSet: noop,
          onCopyPrevious: noop,
          onAdjustSet: noop,
          onApplySuggestion: noop,
          onUpdateActualDraft: noop,
          onSwitchExercise: noop,
          onCompleteSupportSet: noop,
          onSkipSupportExercise: noop,
          onSkipSupportBlock: noop,
          onUpdateSupportSkipReason: noop,
          onReplaceExercise: noop,
          onLoadFeedback: noop,
          onFinish: noop,
          onDelete: noop,
          onReturnFocusMode: noop,
          onExtendRestTimer: noop,
          onToggleRestTimer: noop,
          onClearRestTimer: noop,
          onGoToday: noop,
        }),
      ),
      visibleText(
        React.createElement(TrainingFocusView, {
          session: focusSession,
          unitSettings: { weightUnit: 'kg', defaultIncrementKg: 2.5, defaultIncrementLb: 5, customIncrementsKg: [], customIncrementsLb: [] },
          restTimer: null,
          expandedExercise: 0,
          setExpandedExercise: setStateNoop,
          onSetChange: noop,
          onCompleteSet: noop,
          onCopyPrevious: noop,
          onAdjustSet: noop,
          onApplySuggestion: noop,
          onUpdateActualDraft: noop,
          onSwitchExercise: noop,
          onReplaceExercise: noop,
          onLoadFeedback: noop,
          onFinish: noop,
          onCompleteSupportSet: noop,
          onSkipSupportExercise: noop,
          onSkipSupportBlock: noop,
          onUpdateSupportSkipReason: noop,
        }),
      ),
      visibleText(
        React.createElement(RecordView, {
          data: recordData,
          unitSettings: recordData.unitSettings,
          weeklyPrescription: buildWeeklyPrescription(recordData),
          bodyWeightInput: '',
          setBodyWeightInput: (() => undefined) as React.Dispatch<React.SetStateAction<string>>,
          onSaveBodyWeight: noop,
          onDeleteSession: noop,
          onMarkSessionDataFlag: noop,
          onUpdateUnitSettings: noop,
          onRestoreData: noop,
          initialSection: 'list',
        }),
      ),
    ].join(' ');

    expect(text).toContain('专注训练');
    expect(text).toContain('推 A');
    expect(text).toContain('腿 A');
    expect(text).toContain('余力（RIR）');
    expectLocalized(text);
  });
});
