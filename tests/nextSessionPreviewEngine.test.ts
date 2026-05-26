import { describe, expect, it } from 'vitest';
import { buildNextSessionPreview } from '../src/engines/nextSessionPreviewEngine';
import { INITIAL_TEMPLATES } from '../src/data/trainingData';
import type { TrainingTemplate } from '../src/models/training-model';
import { makeSession } from './fixtures';

const TEMPLATES: TrainingTemplate[] = INITIAL_TEMPLATES.map((template) => ({ ...template, exercises: [...template.exercises] }));

describe('nextSessionPreviewEngine', () => {
  it('falls back to push-a when there is no history', () => {
    const preview = buildNextSessionPreview([], TEMPLATES, undefined, { nowIso: '2026-05-27T10:00:00.000Z' });
    expect(preview.available).toBe(true);
    expect(preview.templateId).toBe('push-a');
    expect(preview.headline).toContain('首次训练');
    expect(preview.exercises.length).toBeGreaterThan(0);
    expect(preview.exercises[0]).toHaveProperty('exerciseId');
  });

  it('rotates push-a -> pull-a after completed push-a', () => {
    const history = [
      makeSession({
        id: 's-push',
        date: '2026-05-25',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 80, reps: 6, rir: 1 }],
      }),
    ];
    const preview = buildNextSessionPreview(history, TEMPLATES, undefined, { nowIso: '2026-05-27T10:00:00.000Z' });
    expect(preview.templateId).toBe('pull-a');
    expect(preview.daysSinceLastSession).toBe(2);
    expect(preview.headline).toContain('拉 A');
  });

  it('respects the limit option', () => {
    const preview = buildNextSessionPreview([], TEMPLATES, undefined, { nowIso: '2026-05-27T10:00:00.000Z', limit: 2 });
    expect(preview.exercises).toHaveLength(2);
  });

  it('returns not-available when no templates exist', () => {
    const preview = buildNextSessionPreview([], [], undefined);
    expect(preview.available).toBe(false);
    expect(preview.exercises).toEqual([]);
  });

  it('includes rep range and starting weight per exercise', () => {
    const preview = buildNextSessionPreview([], TEMPLATES, undefined, { nowIso: '2026-05-27T10:00:00.000Z' });
    const first = preview.exercises[0];
    expect(first.repRange[0]).toBeGreaterThan(0);
    expect(first.repRange[1]).toBeGreaterThan(first.repRange[0] - 1);
    expect(first.startWeight).toBeGreaterThanOrEqual(0);
  });
});
