// RGR-3 + AR-5: strength-up + fatigue-high → controlled-reload single
// coherent direction; no triplet substring in any surface.
// See docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md §10/§15.

import { describe, expect, it } from 'vitest';
import { buildTrainingDecision } from '../src/engines/trainingDecisionEngine';
import { getTemplate, makeStatus, makeSession } from './fixtures';

const REFERENCE_DATE = '2026-05-27T12:00:00.000Z';

const fatigueHighSessions = () =>
  [0, 1, 2, 3].map((i) =>
    makeSession({
      id: `top-${i}`,
      date: `2026-05-${String(20 + i).padStart(2, '0')}`,
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [
        { weight: 100 + i * 2.5, reps: 6, rir: 0 },
        { weight: 95, reps: 6, rir: 0 },
        { weight: 90, reps: 6, rir: 0 },
      ],
    }),
  );

const concatUserFacing = (decision: ReturnType<typeof buildTrainingDecision>) =>
  Object.values(decision.userFacing)
    .flatMap((surface) => [
      surface?.headline ?? '',
      surface?.oneLineAdvice ?? '',
      ...(surface && 'heroTitle' in surface ? [(surface as { heroTitle: string }).heroTitle] : []),
      ...(surface && 'heroExplanation' in surface ? [(surface as { heroExplanation: string }).heroExplanation] : []),
      ...(surface && 'primaryRecommendation' in surface ? [(surface as { primaryRecommendation: string }).primaryRecommendation] : []),
      ...(surface && 'caution' in surface && (surface as { caution?: string }).caution
        ? [(surface as { caution?: string }).caution!]
        : []),
    ])
    .join(' ');

describe('trainingDecisionHardRewriteArbitrationCoherence', () => {
  it('suppresses the legacy triplet under non-normal intents', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60', sleep: '差', energy: '低' }),
      history: fatigueHighSessions(),
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });
    const combined = concatUserFacing(decision);
    // The legacy triplet co-occurrence must NEVER appear together
    const tripletPresent =
      combined.includes('力量有进步') && combined.includes('恢复压力偏高') && combined.includes('下次建议保持重量');
    expect(tripletPresent).toBe(false);
  });

  it('never emits "本周先控制风险" under reentry / controlled-reload / deload', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60', sleep: '差', energy: '低' }),
      history: fatigueHighSessions(),
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });
    const combined = concatUserFacing(decision);
    if (
      decision.sessionIntent === 'reentry-productive' ||
      decision.sessionIntent === 'controlled-reload' ||
      decision.sessionIntent === 'deload-week'
    ) {
      expect(combined).not.toContain('本周先控制风险');
    }
  });
});
