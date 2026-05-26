import { describe, expect, it } from 'vitest';
import { buildLapseBanner } from '../src/engines/trainingLapseBannerEngine';
import type { TrainingSession } from '../src/models/training-model';

const makeSession = (date: string): TrainingSession =>
  ({
    id: `s-${date}`,
    date,
    templateId: 'push-a',
    templateName: 'Push A',
    trainingMode: 'hybrid',
    focus: 'push',
    completed: true,
    finishedAt: `${date}T10:00:00.000Z`,
    exercises: [],
  } as unknown as TrainingSession);

describe('trainingLapseBannerEngine', () => {
  it('returns invisible banner for empty history', () => {
    const banner = buildLapseBanner([]);
    expect(banner.visible).toBe(false);
    expect(banner.hasHistory).toBe(false);
  });

  it('hides banner during fresh and normal cadence', () => {
    expect(buildLapseBanner([makeSession('2026-05-25')], '2026-05-27T10:00:00.000Z').visible).toBe(false);
    expect(buildLapseBanner([makeSession('2026-05-20')], '2026-05-27T10:00:00.000Z').visible).toBe(false);
  });

  it('shows soft tone banner for lapsed stage', () => {
    const banner = buildLapseBanner([makeSession('2026-05-10')], '2026-05-27T10:00:00.000Z');
    expect(banner.visible).toBe(true);
    expect(banner.tone).toBe('soft');
    expect(banner.title).toContain('未训练');
    expect(banner.actionLabel).toBeDefined();
  });

  it('shows warning tone banner for long_lapsed stage', () => {
    const banner = buildLapseBanner([makeSession('2026-05-01')], '2026-05-27T10:00:00.000Z');
    expect(banner.visible).toBe(true);
    expect(banner.tone).toBe('warning');
    expect(banner.title).toContain('新基线');
    expect(banner.actionLabel).toContain('推 A');
  });

  it('shows warning tone banner for dormant stage', () => {
    const banner = buildLapseBanner([makeSession('2026-03-01')], '2026-05-27T10:00:00.000Z');
    expect(banner.visible).toBe(true);
    expect(banner.tone).toBe('warning');
    expect(banner.title).toContain('重新开始');
  });
});
