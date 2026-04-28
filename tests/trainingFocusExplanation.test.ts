import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import type { UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;

describe('Training Focus recommendation explanation', () => {
  const source = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');

  it('does not render the explanation sheet by default', () => {
    const html = renderToStaticMarkup(
      React.createElement(TrainingFocusView, {
        session: makeFocusSession([makeExercise('squat', 2)]),
        unitSettings,
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
    );

    expect(html).toContain('依据');
    expect(html).not.toContain('推荐依据');
  });

  it('opens the BottomSheet from the small basis entry', () => {
    expect(source).toContain('setShowExplanationSheet(true)');
    expect(source).toContain('BottomSheet open={showExplanationSheet}');
    expect(source).toContain('RecommendationExplanationPanel');
    expect(source).toContain('compact maxVisibleFactors={3} defaultOpen');
  });

  it('keeps the complete-set button in Focus Mode', () => {
    expect(source).toContain('completeCurrentSet');
    expect(source).toContain('aria-label="完成一组"');
  });
});
