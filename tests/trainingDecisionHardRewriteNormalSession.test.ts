// RGR-4: a normal 4-day/week routine should never be permanently labelled
// 保守 unless the signal actually warrants it; never emits 控制风险.
// See docs/IRONPATH_iOS_SYSTEM_LOGIC.md.

import { describe, expect, it } from 'vitest';
import { buildTrainingDecision } from '../src/engines/trainingDecisionEngine';
import { getTemplate, makeStatus, makeSession } from './fixtures';

const REFERENCE_DATE = '2026-05-27T12:00:00.000Z';

const fourPerWeek = () =>
  [...Array(4).keys()].map((i) =>
    makeSession({
      id: `n-${i}`,
      date: `2026-05-${String(20 + i).padStart(2, '0')}`,
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [
        { weight: 80, reps: 8, rir: 2 },
        { weight: 80, reps: 8, rir: 2 },
        { weight: 80, reps: 8, rir: 2 },
      ],
    }),
  );

describe('trainingDecisionHardRewriteNormalSession', () => {
  it('keeps a normal 4-day/week routine free of "本周先控制风险"', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: fourPerWeek(),
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });
    const combined = Object.values(decision.userFacing)
      .map((s) => (s?.headline ?? '') + ' ' + (s?.oneLineAdvice ?? ''))
      .join(' ');
    expect(combined).not.toContain('控制风险');
  });

  it('does not blanket-label normal session as 保守 in today.headline', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: fourPerWeek(),
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });
    if (decision.sessionIntent === 'normal-session') {
      expect(decision.userFacing.today?.heroTitle).not.toContain('保守');
    }
  });
});
