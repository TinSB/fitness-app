import { describe, expect, it } from 'vitest';
import { buildWorkoutCycleState } from '../src/engines/workoutCycleScheduler';
import type { SessionDataFlag, TrainingSession } from '../src/models/training-model';
import { makeSession } from './fixtures';

const orderedTemplateIds = ['push-a', 'pull-a', 'legs-a'];

const exerciseForTemplate: Record<string, string> = {
  'push-a': 'bench-press',
  'pull-a': 'lat-pulldown',
  'legs-a': 'squat',
};

const completedSession = (templateId: string, date: string, dataFlag: SessionDataFlag = 'normal'): TrainingSession => ({
  ...makeSession({
    id: `${templateId}-${date}`,
    date,
    templateId,
    exerciseId: exerciseForTemplate[templateId],
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  dataFlag,
  completed: true,
  finishedAt: `${date}T10:00:00-04:00`,
});

const build = (history: TrainingSession[]) =>
  buildWorkoutCycleState({
    history,
    orderedTemplateIds,
    currentDate: '2026-04-30',
  });

describe('workout cycle scheduler', () => {
  it('starts from the first template when history is empty', () => {
    const state = build([]);

    expect(state.isCycleComplete).toBe(false);
    expect(state.nextTemplateId).toBe('push-a');
    expect(state.completedInCurrentCycle).toEqual([]);
    expect(state.missingInCurrentCycle).toEqual(['push-a', 'pull-a', 'legs-a']);
  });

  it('recommends Pull A after only Push A is completed', () => {
    const state = build([completedSession('push-a', '2026-04-27')]);

    expect(state.lastCompletedTemplateId).toBe('push-a');
    expect(state.completedInCurrentCycle).toEqual(['push-a']);
    expect(state.missingInCurrentCycle).toEqual(['pull-a', 'legs-a']);
    expect(state.nextTemplateId).toBe('pull-a');
  });

  it('recommends Legs A after Push A and Pull A are completed', () => {
    const state = build([completedSession('push-a', '2026-04-27'), completedSession('pull-a', '2026-04-28')]);

    expect(state.completedInCurrentCycle).toEqual(['push-a', 'pull-a']);
    expect(state.missingInCurrentCycle).toEqual(['legs-a']);
    expect(state.nextTemplateId).toBe('legs-a');
  });

  it('starts a new cycle after Push A, Pull A, and Legs A are completed', () => {
    const state = build([
      completedSession('push-a', '2026-04-27'),
      completedSession('pull-a', '2026-04-28'),
      completedSession('legs-a', '2026-04-29'),
    ]);

    expect(state.isCycleComplete).toBe(true);
    expect(state.completedInCurrentCycle).toEqual(['push-a', 'pull-a', 'legs-a']);
    expect(state.missingInCurrentCycle).toEqual([]);
    expect(state.nextTemplateId).toBe('push-a');
  });

  it('starts a new cycle after Push A, Legs A, and Pull A are completed out of order', () => {
    const state = build([
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
    ]);

    expect(state.lastCompletedTemplateId).toBe('pull-a');
    expect(state.isCycleComplete).toBe(true);
    expect(state.completedInCurrentCycle).toEqual(['push-a', 'pull-a', 'legs-a']);
    expect(state.nextTemplateId).toBe('push-a');
  });

  it('recommends the first missing template after out-of-order Push A and Legs A', () => {
    const state = build([completedSession('push-a', '2026-04-27'), completedSession('legs-a', '2026-04-28')]);

    expect(state.isCycleComplete).toBe(false);
    expect(state.completedInCurrentCycle).toEqual(['push-a', 'legs-a']);
    expect(state.missingInCurrentCycle).toEqual(['pull-a']);
    expect(state.nextTemplateId).toBe('pull-a');
  });

  it('ignores test and excluded sessions', () => {
    const state = build([
      completedSession('push-a', '2026-04-27'),
      completedSession('pull-a', '2026-04-28', 'test'),
      completedSession('legs-a', '2026-04-29', 'excluded'),
    ]);

    expect(state.completedInCurrentCycle).toEqual(['push-a']);
    expect(state.missingInCurrentCycle).toEqual(['pull-a', 'legs-a']);
    expect(state.nextTemplateId).toBe('pull-a');
  });

  it('uses Chinese reason text without raw ids or empty values', () => {
    const state = build([
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
    ]);

    expect(state.reason).toContain('最近一轮');
    expect(state.reason).toContain('推 A');
    expect(state.reason).not.toMatch(/push-a|pull-a|legs-a|undefined|null/);
  });
});
