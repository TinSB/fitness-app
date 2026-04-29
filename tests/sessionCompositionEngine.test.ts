import { describe, expect, it } from 'vitest';
import { buildSessionComposition } from '../src/engines/sessionCompositionEngine';
import { skipFocusSupportBlock } from '../src/engines/focusModeStateEngine';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

describe('sessionCompositionEngine', () => {
  const makeSessionWithSupport = () => attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 3, 3)]));

  it('summarizes planned main, correction, and functional composition', () => {
    const composition = buildSessionComposition(makeSessionWithSupport());

    expect(composition.mainPlannedSteps).toBe(3);
    expect(composition.mainCompletedSteps).toBe(3);
    expect(composition.correctionPlannedSteps).toBe(2);
    expect(composition.functionalPlannedSteps).toBe(2);
    expect(composition.mainShare).toBe(43);
    expect(composition.correctionShare).toBe(29);
    expect(composition.functionalShare).toBe(28);
  });

  it('raises the main share after the correction block is skipped without adding main sets', () => {
    const baseline = buildSessionComposition(makeSessionWithSupport());
    const skipped = skipFocusSupportBlock(makeSessionWithSupport(), 'correction', 'time');
    const composition = buildSessionComposition(skipped);

    expect(composition.mainPlannedSteps).toBe(baseline.mainPlannedSteps);
    expect(composition.mainCompletedSteps).toBe(baseline.mainCompletedSteps);
    expect(composition.correctionSkippedSteps).toBe(2);
    expect(composition.mainShare).toBeGreaterThan(baseline.mainShare);
    expect(composition.summary).toContain('纠偏模块');
  });

  it('raises the main share after the functional block is skipped without adding main sets', () => {
    const baseline = buildSessionComposition(makeSessionWithSupport());
    const skipped = skipFocusSupportBlock(makeSessionWithSupport(), 'functional', 'time');
    const composition = buildSessionComposition(skipped);

    expect(composition.mainPlannedSteps).toBe(baseline.mainPlannedSteps);
    expect(composition.functionalSkippedSteps).toBe(2);
    expect(composition.mainShare).toBeGreaterThan(baseline.mainShare);
    expect(composition.summary).toContain('功能补丁');
  });

  it('does not treat unstarted support as skipped until skippedReason is written', () => {
    const composition = buildSessionComposition(makeSessionWithSupport());

    expect(composition.correctionSkippedSteps).toBe(0);
    expect(composition.functionalSkippedSteps).toBe(0);
  });
});
