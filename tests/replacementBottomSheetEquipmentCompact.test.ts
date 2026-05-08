import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ReplacementEquipmentChips,
  resetReplacementPickerUiState,
  toggleReplacementPickerEquipment,
  replacementEquipmentChips,
} from '../src/features/TrainingFocusView';
import { buildSmartReplacementRecommendations } from '../src/engines/smartReplacementEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import type { ExercisePrescription } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const exercise = (id: string): ExercisePrescription =>
  ({
    id,
    baseId: id,
    canonicalExerciseId: id,
    actualExerciseId: id,
    name: id,
    muscle: '综合',
    kind: 'compound',
    sets: [{ id: `${id}-1`, type: 'working', weight: 40, reps: 10, rir: 2, done: false }],
    repMin: 8,
    repMax: 12,
    rest: 120,
    startWeight: 40,
  }) as ExercisePrescription;

describe('replacement BottomSheet compact equipment context', () => {
  it('keeps the temporary equipment chips compact, touch-sized, and localized', () => {
    const html = renderToStaticMarkup(React.createElement(ReplacementEquipmentChips, { selected: ['dumbbell', 'cable'], onToggle: () => undefined }));
    const text = visibleText(html);

    expect(replacementEquipmentChips.map((chip) => chip.label)).toEqual(['哑铃区', '绳索区', '深蹲架', '杠铃', '史密斯', '固定器械']);
    expect(text).toContain('器械被占用？');
    expect(text).toContain('只调整本次替代排序。');
    expect(html).toContain('p-2.5');
    expect(html).toContain('min-h-10');
    expect(text).not.toMatch(/\b(dumbbell|cable|rack|barbell|smith|machine|undefined|null)\b/);
  });

  it('updates and resets only local replacement picker UI state', () => {
    const initial = resetReplacementPickerUiState();
    const selected = toggleReplacementPickerEquipment(toggleReplacementPickerEquipment(initial, 'dumbbell'), 'rack');
    const reset = resetReplacementPickerUiState();

    expect(selected.selectedUnavailableEquipment).toEqual(['dumbbell', 'rack']);
    expect(selected.expandedReplacementDetailsId).toBeNull();
    expect(reset.selectedUnavailableEquipment).toEqual([]);
    expect(reset.expandedReplacementDetailsId).toBeNull();
  });

  it('lets equipment context change visible ordering without persisting equipment state', () => {
    const defaultIds = buildSmartReplacementRecommendations({
      currentExercise: exercise('incline-db-press'),
      exerciseLibrary: [],
    })
      .filter((option) => option.priority !== 'avoid')
      .map((option) => option.exerciseId);
    const crowdedIds = buildSmartReplacementRecommendations({
      currentExercise: exercise('incline-db-press'),
      exerciseLibrary: [],
      unavailableEquipment: ['dumbbell'],
    })
      .filter((option) => option.priority !== 'avoid')
      .map((option) => option.exerciseId);

    expect(crowdedIds.slice(0, 2)).toEqual(['smith-incline-press', 'machine-incline-chest-press']);
    expect(crowdedIds).not.toEqual(defaultIds);

    const session = makeFocusSession([{ ...makeExercise('incline-db-press', 1), name: '上斜哑铃卧推' }]);
    const replaced = dispatchWorkoutExecutionEvent(session, {
      type: 'APPLY_REPLACEMENT',
      exerciseIndex: 0,
      replacementId: 'smith-incline-press',
    });
    const serialized = JSON.stringify(replaced.updatedSession);

    expect(replaced.actionResult).toMatchObject({
      changed: true,
      message: '已替换为：史密斯上斜卧推。',
    });
    expect(replaced.updatedSession.exercises[0]).toMatchObject({
      originalExerciseId: 'incline-db-press',
      actualExerciseId: 'smith-incline-press',
      replacementExerciseId: 'smith-incline-press',
    });
    expect(serialized).not.toContain('unavailableEquipment');
    expect(serialized).not.toContain('selectedUnavailableEquipment');
    expect(serialized).not.toContain('器械被占用？');
  });
});
