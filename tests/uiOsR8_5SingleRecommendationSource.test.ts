import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import { EquipmentAwareLoadCard } from '../src/uiOs/training/EquipmentAwareLoadCard';
import type { UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;
const lbToKg = (lb: number) => lb * 0.45359237;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const renderFocusHtml = () =>
  renderToStaticMarkup(
    React.createElement(TrainingFocusView, {
      session: makeFocusSession([
        {
          ...makeExercise('bench-press', 1, 0, 1),
          name: '平板卧推',
          warmupSets: [{ weight: lbToKg(45), reps: 10 }],
          sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
        },
      ]),
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

describe('UI-OS R8.5 single recommendation source', () => {
  it('renders exactly one visible primary load label in Focus', () => {
    const html = renderFocusHtml();
    const visible = text(html);

    expect((html.match(/data-focus-primary-load-label="true"/g) || [])).toHaveLength(1);
    expect(visible).toContain('本组建议');
    expect(visible).toContain('× 10');
    expect(visible).not.toContain('推荐处方');
    expect(visible).not.toContain('器械可做重量');
    expect(visible).not.toContain('实际记录通过底部动作栏填写');
  });

  it('keeps the EquipmentAwareLoadCard as the primary load owner with reps', () => {
    const plate = renderToStaticMarkup(React.createElement(EquipmentAwareLoadCard, { type: 'plate-loaded', mainDisplay: '加重 30 lb', reps: 10, subInfo: '每边 15 lb' }));
    const warmup = renderToStaticMarkup(React.createElement(EquipmentAwareLoadCard, { type: 'barbell', mainDisplay: '空杆 45 lb', reps: 10 }));
    const dumbbell = renderToStaticMarkup(React.createElement(EquipmentAwareLoadCard, { type: 'dumbbell', mainDisplay: '40 lb 每只手', reps: 10 }));

    expect(text(plate)).toContain('加重 30 lb × 10');
    expect(text(plate)).toContain('每边 15 lb');
    expect(text(warmup)).toContain('空杆 45 lb × 10');
    expect(text(dumbbell)).toContain('40 lb 每只手 × 10');
  });

  it('does not duplicate the top recommendation weight outside the equipment card', () => {
    const source = renderFocusHtml();
    const recommendation = source.slice(source.indexOf('data-focus-recommendation-density="compact-single"'));

    expect(recommendation).not.toContain('primaryRecommendationLabel');
    expect(recommendation).not.toMatch(/data-focus-primary-load-label="true"[^>]*>[^<]+<\/div>/);
    expect(recommendation).toContain('data-equipment-primary-load-label="true"');
  });
});
