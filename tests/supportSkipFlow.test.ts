import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { skipFocusSupportBlock } from '../src/engines/focusModeStateEngine';
import { buildSessionComposition } from '../src/engines/sessionCompositionEngine';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

describe('support skip flow', () => {
  it('writes skippedReason for unfinished correction steps and updates composition immediately', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 2, 2)]));
    const skipped = skipFocusSupportBlock(session, 'correction', 'time');
    const correctionLogs = skipped.supportExerciseLogs?.filter((log) => log.blockType === 'correction') || [];
    const composition = buildSessionComposition(skipped);

    expect(correctionLogs).toHaveLength(1);
    expect(correctionLogs.every((log) => log.skippedReason === 'time')).toBe(true);
    expect(composition.correctionSkippedSteps).toBe(2);
    expect(composition.mainShare).toBeGreaterThan(buildSessionComposition(session).mainShare);
  });

  it('preserves skippedReason for unfinished functional steps', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 2, 2)]));
    const skipped = skipFocusSupportBlock(session, 'functional', 'too_tired');
    const functionalLogs = skipped.supportExerciseLogs?.filter((log) => log.blockType === 'functional') || [];
    const composition = buildSessionComposition(skipped);

    expect(functionalLogs).toHaveLength(1);
    expect(functionalLogs.every((log) => log.skippedReason === 'too_tired')).toBe(true);
    expect(composition.functionalSkippedSteps).toBe(2);
  });

  it('does not let skipped support change effective sets, PR, or e1RM', () => {
    const baseline = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 2, 2)]));
    const skipped = skipFocusSupportBlock(baseline, 'correction', 'time');

    expect(buildEffectiveVolumeSummary([skipped]).effectiveSets).toBe(buildEffectiveVolumeSummary([baseline]).effectiveSets);
    expect(buildPrs([skipped])).toEqual(buildPrs([baseline]));
    expect(buildE1RMProfile([skipped], 'bench-press').best?.estimated1RM).toBe(
      buildE1RMProfile([baseline], 'bench-press').best?.estimated1RM,
    );
  });

  it('keeps the history drawer wired to composition and skipped support details', () => {
    const recordViewPath = fileURLToPath(new URL('../src/features/RecordView.tsx', import.meta.url));
    const source = readFileSync(recordViewPath, 'utf8');

    expect(source).toContain('buildSessionComposition');
    expect(source).toContain('skippedReason');
  });
});
