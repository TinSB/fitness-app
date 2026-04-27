import { describe, expect, it } from 'vitest';
import { completeFocusSupportStep, getCurrentFocusStep, skipFocusSupportBlock } from '../src/engines/focusModeStateEngine';
import type { TrainingSession } from '../src/models/training-model';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

const completeSupportAsFullView = (session: TrainingSession, moduleId: string, exerciseId: string): TrainingSession => ({
  ...session,
  supportExerciseLogs: (session.supportExerciseLogs || []).map((log) =>
    log.moduleId === moduleId && log.exerciseId === exerciseId
      ? { ...log, completedSets: Math.min(log.plannedSets, log.completedSets + 1) }
      : log
  ),
});

describe('focus and full view consistency', () => {
  it('focus support completion is visible to the full view support log', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1)]));
    const next = completeFocusSupportStep(session)?.session as TrainingSession;
    const log = next.supportExerciseLogs?.find((item) => item.moduleId === 'corr-shoulder' && item.exerciseId === 'wall-slide');
    expect(log?.completedSets).toBe(1);
  });

  it('full view support completion is visible to focus navigation', () => {
    let session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1)]));
    session = completeSupportAsFullView(session, 'corr-shoulder', 'wall-slide');
    session = completeSupportAsFullView(session, 'corr-shoulder', 'wall-slide');
    expect(getCurrentFocusStep(session).id).toBe('main:bench:working:0');
  });

  it('switching modes does not need a second session state', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1)]));
    const currentStep = getCurrentFocusStep(session);
    const sameSessionInFullView = session;
    expect(getCurrentFocusStep(sameSessionInFullView).id).toBe(currentStep.id);
  });

  it('skipping functional block in focus is visible from the shared session logs', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1)]), [], undefined);
    const next = skipFocusSupportBlock(session, 'functional', 'time');
    expect(next.supportExerciseLogs?.filter((log) => log.blockType === 'functional').every((log) => log.skippedReason === 'time')).toBe(true);
  });
});
