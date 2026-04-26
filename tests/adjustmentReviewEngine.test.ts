import { describe, expect, it } from 'vitest';
import { reviewAdjustmentEffect } from '../src/engines/adjustmentReviewEngine';
import type { ProgramAdjustmentHistoryItem } from '../src/models/training-model';
import { makeSession } from './fixtures';

const historyItem: ProgramAdjustmentHistoryItem = {
  id: 'history-1',
  appliedAt: '2026-04-20',
  sourceProgramTemplateId: 'push-a',
  experimentalProgramTemplateId: 'push-a-experiment',
  selectedRecommendationIds: ['rec-1'],
  changes: [],
  rollbackAvailable: true,
};

describe('adjustmentReviewEngine', () => {
  it('returns too early when no after data exists', () => {
    const review = reviewAdjustmentEffect(historyItem, [], []);
    expect(review.status).toBe('too_early');
    expect(review.recommendation).toBe('collect_more_data');
  });

  it('returns improved when effective volume increases and adherence stays stable', () => {
    const before = [
      makeSession({ id: 'before-1', date: '2026-04-10', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 60, reps: 6, rir: 2 }] }),
      makeSession({ id: 'before-2', date: '2026-04-12', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 60, reps: 6, rir: 2 }] }),
    ];
    const after = [
      makeSession({ id: 'after-1', date: '2026-04-20', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 62.5, reps: 8, rir: 2 }, { weight: 57.5, reps: 8, rir: 2 }] }),
      makeSession({ id: 'after-2', date: '2026-04-22', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 62.5, reps: 8, rir: 2 }, { weight: 57.5, reps: 8, rir: 2 }] }),
    ];

    const review = reviewAdjustmentEffect(historyItem, before, after);
    expect(review.status).toBe('improved');
    expect(review.recommendation).toBe('keep');
    expect(review.metrics.effectiveVolumeChange).toBeGreaterThan(0);
  });

  it('asks for manual review when pain signals rise', () => {
    const before = [
      makeSession({ id: 'before-1', date: '2026-04-10', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 60, reps: 8, rir: 2 }] }),
      makeSession({ id: 'before-2', date: '2026-04-12', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 60, reps: 8, rir: 2 }] }),
    ];
    const after = [
      makeSession({ id: 'after-1', date: '2026-04-20', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 62.5, reps: 8, rir: 2, painFlag: true, painArea: '肩', painSeverity: 4 }] }),
      makeSession({ id: 'after-2', date: '2026-04-22', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 62.5, reps: 8, rir: 2, painFlag: true, painArea: '肩', painSeverity: 4 }] }),
    ];

    const review = reviewAdjustmentEffect(historyItem, before, after);
    expect(review.status).toBe('worse');
    expect(review.recommendation).toBe('review_manually');
  });

  it('returns insufficient data when only one after session exists', () => {
    const after = [
      makeSession({ id: 'after-1', date: '2026-04-20', templateId: 'push-a', exerciseId: 'bench-press', setSpecs: [{ weight: 62.5, reps: 8, rir: 2 }] }),
    ];

    const review = reviewAdjustmentEffect(historyItem, [], after);
    expect(review.status).toBe('insufficient_data');
  });
});
