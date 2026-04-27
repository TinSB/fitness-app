import { describe, expect, it } from 'vitest';
import { buildTrainingLevelExplanation } from '../../src/engines/explainability';
import type { TrainingLevelAssessment } from '../../src/engines/trainingLevelEngine';
import { expectCleanExplanation } from './testUtils';

const baseAssessment: TrainingLevelAssessment = {
  level: 'unknown',
  confidence: 'low',
  readinessForAdvancedFeatures: {
    topBackoff: false,
    higherVolume: false,
    advancedExerciseSelection: false,
    aggressiveProgression: false,
  },
  signals: [],
  limitations: [],
  nextDataNeeded: [],
};

describe('training level explainability', () => {
  it('explains baseline building when data is insufficient', () => {
    const text = buildTrainingLevelExplanation(baseAssessment);

    expect(text).toContain('训练基线');
    expect(text).toContain('2–3 次训练');
    expectCleanExplanation(text);
  });

  it('explains conservative behavior when strength is high but technique or pain limits recommendations', () => {
    const text = buildTrainingLevelExplanation({
      ...baseAssessment,
      level: 'intermediate',
      confidence: 'medium',
      limitations: ['动作质量或不适信号限制高级推荐'],
    });

    expect(text).toContain('保守');
    expect(text).toContain('不因单次大重量直接升级');
    expectCleanExplanation(text);
  });

  it('explains when stable records unlock more complete prescription', () => {
    const text = buildTrainingLevelExplanation({
      ...baseAssessment,
      level: 'intermediate',
      confidence: 'medium',
      readinessForAdvancedFeatures: {
        ...baseAssessment.readinessForAdvancedFeatures,
        topBackoff: true,
        higherVolume: true,
      },
    });

    expect(text).toContain('记录较稳定');
    expectCleanExplanation(text);
  });
});
