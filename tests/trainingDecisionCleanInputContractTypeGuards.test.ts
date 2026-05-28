// Type-level enforcement of the CleanTrainingDecisionInput contract.
//
// The `// @ts-expect-error` directives only pass the typecheck step if the
// underlying line is actually a TS error. If a future change weakens the brand,
// the `@ts-expect-error` itself becomes an error (TS2578 "Unused
// @ts-expect-error directive") and the build fails.

import { describe, expect, it } from 'vitest';
import {
  buildTrainingDecisionContextFromCleanInput,
  buildTrainingDecisionFromCleanInput,
  createCleanTrainingDecisionContextSource,
  createCleanTrainingDecisionInput,
  type CleanTrainingDecisionContextSource,
  type CleanTrainingDecisionInput,
} from '../src/engines/trainingDecisionCleanInput';
import { buildCleanAppDataView } from '../src/dataHealth/cleanAppDataView';
import { getTemplate, makeAppData } from './fixtures';
import type {
  TrainingDecisionInput,
} from '../src/engines/trainingDecisionTypes';
import type { AppData } from '../src/models/training-model';
import { DEFAULT_STATUS } from '../src/data/trainingData';

const view = buildCleanAppDataView(makeAppData(), { now: () => new Date('2026-05-27T00:00:00Z') });
const cleanInput: CleanTrainingDecisionInput = createCleanTrainingDecisionInput(view, {
  template: getTemplate('push-a'),
});
const cleanSource: CleanTrainingDecisionContextSource = createCleanTrainingDecisionContextSource(view);

describe('trainingDecisionCleanInputContractTypeGuards', () => {
  it('trainingDecisionCleanInputContractRawInputIsNotAssignableAtCompileTime', () => {
    const rawInput: TrainingDecisionInput = {
      template: getTemplate('push-a'),
      todayStatus: DEFAULT_STATUS,
      history: [],
    };
    // @ts-expect-error raw TrainingDecisionInput is missing the clean brand symbol.
    const _bad: CleanTrainingDecisionInput = rawInput;
    expect(() =>
      // @ts-expect-error raw input cannot be passed to the clean wrapper.
      buildTrainingDecisionFromCleanInput(rawInput),
    ).toThrow(TypeError);
    expect(typeof _bad).toBe('object');
  });

  it('trainingDecisionCleanInputContractRawAppDataIsNotAssignableAsContextSource', () => {
    const rawAppData: Partial<AppData> = makeAppData();
    // @ts-expect-error raw AppData is missing the clean context-source brand symbol.
    const _bad: CleanTrainingDecisionContextSource = rawAppData;
    expect(() =>
      // @ts-expect-error raw AppData cannot be passed to the clean context wrapper.
      buildTrainingDecisionContextFromCleanInput(rawAppData, '2026-05-27'),
    ).toThrow(TypeError);
    expect(typeof _bad).toBe('object');
  });

  it('trainingDecisionCleanInputContractBrandedInputIsAssignableEverywhere', () => {
    // Branded input is structurally a TrainingDecisionInput so the engine
    // accepts it. The wrapper only refuses *raw* inputs.
    const widened: TrainingDecisionInput = cleanInput;
    expect(typeof widened).toBe('object');
    const decision = buildTrainingDecisionFromCleanInput(cleanInput);
    expect(decision.decisionVersion).toBe('v2');
  });

  it('trainingDecisionCleanInputContractBrandedContextSourceIsAssignableToPartialAppData', () => {
    const widened: Partial<AppData> = cleanSource;
    expect(typeof widened).toBe('object');
    const context = buildTrainingDecisionContextFromCleanInput(cleanSource, '2026-05-27');
    expect(context.currentDateLocalKey).toBe('2026-05-27');
  });
});
