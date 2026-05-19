import {
  applySuggestedFocusStep,
  getCurrentFocusStep,
  updateFocusActualDraft,
} from '../src/engines/focusModeStateEngine';
import type { TrainingSession } from '../src/models/training-model';

export const applySuggestionAndPlannedReps = (session: TrainingSession, exerciseIndex: number): TrainingSession => {
  const withWeight = applySuggestedFocusStep(session, exerciseIndex);
  const step = getCurrentFocusStep(withWeight);
  return updateFocusActualDraft(withWeight, exerciseIndex, {
    actualReps: step.plannedReps,
    actualRir: step.plannedRir,
    source: 'manual',
  });
};

export const fillPlannedRepsForCurrentStep = (session: TrainingSession, exerciseIndex: number): TrainingSession => {
  const step = getCurrentFocusStep(session);
  return updateFocusActualDraft(session, exerciseIndex, {
    actualReps: step.plannedReps,
    actualRir: step.plannedRir,
    source: 'manual',
  });
};
