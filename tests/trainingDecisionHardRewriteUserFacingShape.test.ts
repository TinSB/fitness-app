// AR-6 (≤ 1 risk badge per surface) + AR-7 (headline ≤ 60, oneLineAdvice ≤ 80)
// + AR-9 (one headline + one oneLineAdvice per surface).
// See docs/IRONPATH_iOS_SYSTEM_LOGIC.md.

import { describe, expect, it } from 'vitest';
import { buildTrainingDecision } from '../src/engines/trainingDecisionEngine';
import { getTemplate, makeStatus } from './fixtures';

const REFERENCE_DATE = '2026-05-27T12:00:00.000Z';

const surfaces = ['today', 'plan', 'training', 'focus', 'progress', 'record', 'explanation'] as const;

describe('trainingDecisionHardRewriteUserFacingShape', () => {
  it('AR-7: every surface headline ≤ 60 chars and oneLineAdvice ≤ 80 chars', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: [],
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });
    for (const id of surfaces) {
      const surface = decision.userFacing[id];
      if (!surface) continue;
      expect(surface.headline.length).toBeLessThanOrEqual(60);
      if (surface.oneLineAdvice) {
        expect(surface.oneLineAdvice.length).toBeLessThanOrEqual(80);
      }
    }
  });

  it('AR-6: at most one risk badge per surface', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: [],
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
      acutePainReported: true,
    });
    for (const id of surfaces) {
      const surface = decision.userFacing[id];
      if (!surface) continue;
      // riskBadge is a single object (not array) — by type it cannot be >1
      if (surface.riskBadge) {
        expect(typeof surface.riskBadge.label).toBe('string');
      }
    }
  });

  it('AR-9: exactly one headline + at most one oneLineAdvice per surface', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: [],
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });
    for (const id of surfaces) {
      const surface = decision.userFacing[id];
      if (!surface) continue;
      expect(typeof surface.headline).toBe('string');
      expect(surface.headline.length).toBeGreaterThan(0);
      if (surface.oneLineAdvice !== undefined) {
        expect(typeof surface.oneLineAdvice).toBe('string');
      }
    }
  });
});
