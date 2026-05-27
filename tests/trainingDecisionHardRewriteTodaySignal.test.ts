// Signal-only contract for todayTrainingReadinessDecisionEngine.
// The only remaining exports must be enums + numerics; no title / summary /
// userMessage / suggestedActions text fields.
// See docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md §2.2.

import { describe, expect, it } from 'vitest';
import { buildTodayTrainingReadinessDecision } from '../src/engines/todayTrainingReadinessDecisionEngine';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import type { ReadinessResult } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const NOW_ISO = '2026-05-27T12:00:00.000Z';

const normalReadiness: ReadinessResult = {
  score: 82,
  level: 'high',
  trainingAdjustment: 'normal',
  reasons: [],
};

const baseContext = () =>
  buildTrainingDecisionContext(makeAppData(), '2026-05-27', {
    readinessResult: normalReadiness,
    currentTrainingTemplate: getTemplate('push-a'),
    activeTemplate: getTemplate('push-a'),
  });

describe('trainingDecisionHardRewriteTodaySignal', () => {
  it('decision shape contains only signal/enum/numeric/code fields', () => {
    const decision = buildTodayTrainingReadinessDecision({ context: baseContext(), nowIso: NOW_ISO });
    expect(decision).not.toHaveProperty('title');
    expect(decision).not.toHaveProperty('summary');
    expect(decision).not.toHaveProperty('userMessage');
    expect(decision).not.toHaveProperty('suggestedActions');
  });

  it('exports decisionKind / action / riskLevel as well-typed enums', () => {
    const decision = buildTodayTrainingReadinessDecision({ context: baseContext(), nowIso: NOW_ISO });
    expect(['normal', 'conservative', 'technique', 'deload', 'postpone']).toContain(decision.decisionKind);
    expect(['low', 'medium', 'high']).toContain(decision.riskLevel);
    expect(typeof decision.action).toBe('string');
  });
});
