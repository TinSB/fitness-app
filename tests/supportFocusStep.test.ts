import { describe, expect, it } from 'vitest';
import { buildFocusStepQueue, completeFocusSupportStep, getCurrentFocusStep, skipFocusSupportBlock, skipFocusSupportStep } from '../src/engines/focusModeStateEngine';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

describe('support focus steps', () => {
  it('writes correction completion into supportExerciseLogs', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1)]));
    expect(getCurrentFocusStep(session).stepType).toBe('correction');

    const result = completeFocusSupportStep(session);
    const log = result?.session.supportExerciseLogs?.find((item) => item.blockType === 'correction');
    expect(log?.completedSets).toBe(1);
    expect(result?.session.currentFocusStepId).toBe('correction:corr-shoulder:wall-slide:1');
  });

  it('writes functional completion into supportExerciseLogs', () => {
    let session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1)]), [], undefined);
    session.exercises[0].sets[0].done = true;
    session.currentFocusStepId = 'functional:func-carry:farmer-carry:0';
    session.currentFocusStepType = 'functional';

    const result = completeFocusSupportStep(session);
    const log = result?.session.supportExerciseLogs?.find((item) => item.blockType === 'functional');
    expect(log?.completedSets).toBe(1);
  });

  it('records skippedReason when skipping a support step', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1)]));
    const next = skipFocusSupportStep(session, 'time');
    const log = next.supportExerciseLogs?.find((item) => item.blockType === 'correction');
    expect(log?.skippedReason).toBe('time');
    expect(getCurrentFocusStep(next).id).toBe('main:bench:working:0');
  });

  it('skips an entire functional block for unfinished support exercises', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1)]), [], undefined);
    const next = skipFocusSupportBlock(session, 'functional', 'not_needed');
    const functionalLogs = next.supportExerciseLogs?.filter((item) => item.blockType === 'functional') || [];
    expect(functionalLogs.every((log) => log.skippedReason === 'not_needed')).toBe(true);
  });

  it('uses unique correction and functional step ids', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench', 1)]));
    expect(buildFocusStepQueue(session).map((step) => step.id)).toContain('correction:corr-shoulder:wall-slide:0');
    expect(buildFocusStepQueue(session).map((step) => step.id)).toContain('functional:func-carry:farmer-carry:0');
  });
});
