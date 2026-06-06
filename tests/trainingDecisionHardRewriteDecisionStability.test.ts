// Determinism + diff-signature stability across identical and minor-perturbed
// inputs. Asserts the TrainingDecision and recommendation signature contracts.
// See docs/IRONPATH_iOS_SYSTEM_LOGIC.md.

import { describe, expect, it } from 'vitest';
import { buildTrainingDecision } from '../src/engines/trainingDecisionEngine';
import { getStableRecommendationSignature } from '../src/engines/recommendationDiffEngine';
import { getTemplate, makeAppData, makeStatus } from './fixtures';

const REFERENCE_DATE = '2026-05-27T12:00:00.000Z';

const baseInput = () => ({
  template: getTemplate('push-a'),
  todayStatus: makeStatus({ time: '60' }),
  history: [],
  trainingMode: 'hybrid' as const,
  nowIso: REFERENCE_DATE,
});

describe('trainingDecisionHardRewriteDecisionStability', () => {
  it('TrainingDecision is deterministic for identical input', () => {
    const a = buildTrainingDecision(baseInput());
    const b = buildTrainingDecision(baseInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('recommendation signature is stable across identical inputs', () => {
    const context = makeAppData({ selectedTemplateId: 'push-a' });
    expect(getStableRecommendationSignature(context)).toEqual(getStableRecommendationSignature(context));
  });

  it('changing only a non-decision field (nowIso) keeps the decision payload structure equal', () => {
    const a = buildTrainingDecision({ ...baseInput(), nowIso: '2026-05-27T12:00:00.000Z' });
    const b = buildTrainingDecision({ ...baseInput(), nowIso: '2026-05-27T15:00:00.000Z' });
    // Same input day → same decisionVersion, sessionIntent, riskLevel
    expect(a.decisionVersion).toBe(b.decisionVersion);
    expect(a.sessionIntent).toBe(b.sessionIntent);
    expect(a.riskLevel).toBe(b.riskLevel);
  });
});
