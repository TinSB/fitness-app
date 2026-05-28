// Behavioral tests for the CleanTrainingDecisionInput factory + wrapper.
// See docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCleanAppDataView,
  type CleanAppDataView,
} from '../src/dataHealth/cleanAppDataView';
import {
  CLEAN_TRAINING_DECISION_INPUT_BRAND,
  CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND,
  assertCleanTrainingDecisionInput,
  assertCleanTrainingDecisionContextSource,
  buildTrainingDecisionContextFromCleanInput,
  buildTrainingDecisionFromCleanInput,
  createCleanTrainingDecisionContextSource,
  createCleanTrainingDecisionInput,
  isCleanTrainingDecisionContextSource,
  isCleanTrainingDecisionInput,
  withCleanTrainingDecisionInputOverride,
} from '../src/engines/trainingDecisionCleanInput';
import type { AppData, TrainingTemplate } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const FIXTURE_PATH = resolve(
  __dirname,
  './fixtures/data-health/ironpath-2026-05-27-redacted.json',
);

const loadDirtyFixture = (): AppData => JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

const fixedClock = (iso: string) => ({ now: () => new Date(iso) });

const cleanView = (appData: AppData, iso = '2026-05-27T00:00:00Z'): CleanAppDataView =>
  buildCleanAppDataView(appData, fixedClock(iso));

const PUSH_A = getTemplate('push-a');

describe('trainingDecisionCleanInputContractFactory', () => {
  it('trainingDecisionCleanInputContractFactoryReturnsBrandedInput', () => {
    const view = cleanView(makeAppData());
    const input = createCleanTrainingDecisionInput(view, { template: PUSH_A });
    expect(isCleanTrainingDecisionInput(input)).toBe(true);
    expect((input as unknown as Record<symbol, unknown>)[CLEAN_TRAINING_DECISION_INPUT_BRAND]).toBe(true);
  });

  it('trainingDecisionCleanInputContractFactoryReturnsBrandedContextSource', () => {
    const view = cleanView(makeAppData());
    const source = createCleanTrainingDecisionContextSource(view);
    expect(isCleanTrainingDecisionContextSource(source)).toBe(true);
    expect((source as unknown as Record<symbol, unknown>)[CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND]).toBe(true);
  });

  it('trainingDecisionCleanInputContractFactoryStripsLegacyAdviceFromHistory', () => {
    const view = cleanView(loadDirtyFixture());
    const input = createCleanTrainingDecisionInput(view, { template: PUSH_A });
    // Real export fixture sessions all carry legacy suggestion / adjustment /
    // warning per exercise. CleanAppDataView strips truthy strings; the clean
    // input must not surface any non-empty advice text to TrainingDecision.
    for (const session of input.history || []) {
      for (const exercise of session.exercises || []) {
        expect(exercise.suggestion || '').toBe('');
        expect(exercise.adjustment || '').toBe('');
        expect(exercise.warning || '').toBe('');
      }
      // explanations is snapshot-only on session — CleanAppDataView strips it
      // when stripLegacyAdvice runs. Verify it's been blanked.
      const explanationsField = (session as { explanations?: unknown }).explanations;
      if (Array.isArray(explanationsField)) {
        expect(explanationsField.length).toBe(0);
      }
    }
  });

  it('trainingDecisionCleanInputContractFactoryClearsLifecycleResidueOnCompletedSessions', () => {
    const view = cleanView(loadDirtyFixture());
    const input = createCleanTrainingDecisionInput(view, { template: PUSH_A });
    for (const session of input.history || []) {
      if (session.completed === false) continue;
      expect(session.restTimerState?.isRunning).not.toBe(true);
      // V1 sentinel: currentExerciseId is blanked, currentFocusStepId is set to
      // the literal 'completed' marker. Real focus-step strings like
      // `main:bench-press:warmup:0` are residue and forbidden here.
      expect(session.currentExerciseId || '').toBe('');
      expect(
        !session.currentFocusStepId || session.currentFocusStepId === 'completed',
      ).toBe(true);
    }
  });

  it('trainingDecisionCleanInputContractFactoryDropsStaleHealthForReadiness', () => {
    const view = cleanView(loadDirtyFixture());
    // The V1 fixture's Apple Health is 29 days old vs 2026-05-27.
    expect(view.healthData.staleForReadiness).toBe(true);
    const input = createCleanTrainingDecisionInput(view, { template: PUSH_A });
    expect(input.useHealthDataForReadiness).toBe(false);
  });

  it('trainingDecisionCleanInputContractFactoryHonorsExplicitMetadataOverrides', () => {
    const view = cleanView(loadDirtyFixture());
    const input = createCleanTrainingDecisionInput(view, {
      template: PUSH_A,
      trainingMode: 'powerlifting',
      nowIso: '2026-05-27T12:00:00.000Z',
      acutePainReported: true,
    });
    expect(input.trainingMode).toBe('powerlifting');
    expect(input.nowIso).toBe('2026-05-27T12:00:00.000Z');
    expect(input.acutePainReported).toBe(true);
  });

  it('trainingDecisionCleanInputContractAssertCleanInputAcceptsBrandedInput', () => {
    const view = cleanView(makeAppData());
    const input = createCleanTrainingDecisionInput(view, { template: PUSH_A });
    expect(() => assertCleanTrainingDecisionInput(input)).not.toThrow();
  });

  it('trainingDecisionCleanInputContractAssertCleanInputRejectsRawInput', () => {
    const rawInput = {
      template: PUSH_A as TrainingTemplate,
      todayStatus: makeAppData().todayStatus,
      history: [],
    };
    expect(() => assertCleanTrainingDecisionInput(rawInput as never)).toThrow(TypeError);
  });

  it('trainingDecisionCleanInputContractAssertCleanInputRejectsSpreadInput', () => {
    const view = cleanView(makeAppData());
    const input = createCleanTrainingDecisionInput(view, { template: PUSH_A });
    // Spread drops the non-enumerable brand symbol.
    const spread = { ...input };
    expect(isCleanTrainingDecisionInput(spread)).toBe(false);
    expect(() => assertCleanTrainingDecisionInput(spread as never)).toThrow(TypeError);
  });

  it('trainingDecisionCleanInputContractAssertCleanContextSourceRejectsRaw', () => {
    const raw = { history: [], todayStatus: makeAppData().todayStatus };
    expect(() => assertCleanTrainingDecisionContextSource(raw as never)).toThrow(TypeError);
  });

  it('trainingDecisionCleanInputContractWithOverridePreservesBrand', () => {
    const view = cleanView(makeAppData());
    const input = createCleanTrainingDecisionInput(view, { template: PUSH_A });
    const replaced = withCleanTrainingDecisionInputOverride(input, { trainingMode: 'powerlifting' });
    expect(isCleanTrainingDecisionInput(replaced)).toBe(true);
    expect(replaced.trainingMode).toBe('powerlifting');
    // Original unchanged.
    expect(input.trainingMode).not.toBe('powerlifting');
  });

  it('trainingDecisionCleanInputContractWithOverrideRejectsUnbrandedInput', () => {
    const raw = { template: PUSH_A, todayStatus: makeAppData().todayStatus } as never;
    expect(() => withCleanTrainingDecisionInputOverride(raw, { trainingMode: 'powerlifting' })).toThrow(TypeError);
  });

  it('trainingDecisionCleanInputContractBuildTrainingDecisionFromCleanInputProducesDecision', () => {
    const view = cleanView(makeAppData({ history: [] }));
    const input = createCleanTrainingDecisionInput(view, {
      template: PUSH_A,
      nowIso: '2026-05-27T12:00:00.000Z',
    });
    const decision = buildTrainingDecisionFromCleanInput(input);
    expect(decision.decisionVersion).toBe('v2');
    expect(decision.userFacing).toBeTruthy();
    expect(decision.computedAtIso).toBe('2026-05-27T12:00:00.000Z');
  });

  it('trainingDecisionCleanInputContractBuildTrainingDecisionRejectsSpreadInput', () => {
    const view = cleanView(makeAppData());
    const input = createCleanTrainingDecisionInput(view, { template: PUSH_A });
    const spread = { ...input };
    expect(() => buildTrainingDecisionFromCleanInput(spread as never)).toThrow(TypeError);
  });

  it('trainingDecisionCleanInputContractBuildTrainingDecisionContextFromCleanInputWorks', () => {
    const view = cleanView(makeAppData());
    const source = createCleanTrainingDecisionContextSource(view);
    const context = buildTrainingDecisionContextFromCleanInput(source, '2026-05-27');
    expect(context.currentDateLocalKey).toBe('2026-05-27');
    expect(Array.isArray(context.history)).toBe(true);
  });

  it('trainingDecisionCleanInputContractBuildTrainingDecisionContextRejectsRawSource', () => {
    const raw = { history: [] } as never;
    expect(() => buildTrainingDecisionContextFromCleanInput(raw, '2026-05-27')).toThrow(TypeError);
  });
});
