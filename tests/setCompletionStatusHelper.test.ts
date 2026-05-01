import { describe, expect, it } from 'vitest';
import {
  completedSets,
  isCompletedSet,
  isIncompleteSet,
  isLegacyCompletedSet,
  sessionCompletedSets,
  sessionVolume,
} from '../src/engines/engineUtils';
import type { TrainingSession, TrainingSetLog } from '../src/models/training-model';

const makeSet = (overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id: overrides.id || 'set-1',
  type: 'straight',
  weight: 50,
  reps: 8,
  rir: 2,
  ...overrides,
});

const makeSession = (sets: TrainingSetLog[]): TrainingSession => ({
  id: 'session-set-status',
  date: '2026-04-30',
  templateId: 'pull-a',
  templateName: '拉 A',
  trainingMode: 'hybrid',
  completed: true,
  exercises: [
    {
      id: 'lat-pulldown',
      name: '高位下拉',
      muscle: '背',
      kind: 'machine',
      repMin: 8,
      repMax: 10,
      rest: 90,
      startWeight: 40,
      sets,
    },
  ],
});

describe('set completion status helpers', () => {
  it('classifies explicit completed, explicit incomplete, legacy completed, and draft sets', () => {
    const completed = makeSet({ done: true });
    const incomplete = makeSet({ done: false });
    const legacyCompleted = makeSet({ done: undefined, completedAt: '2026-04-30T10:00:00-04:00' });
    const draft = makeSet({ done: undefined, completedAt: undefined });

    expect(isCompletedSet(completed)).toBe(true);
    expect(isIncompleteSet(completed)).toBe(false);

    expect(isCompletedSet(incomplete)).toBe(false);
    expect(isIncompleteSet(incomplete)).toBe(true);

    expect(isLegacyCompletedSet(legacyCompleted)).toBe(true);
    expect(isCompletedSet(legacyCompleted)).toBe(true);
    expect(isIncompleteSet(legacyCompleted)).toBe(false);

    expect(isCompletedSet(draft)).toBe(false);
    expect(isIncompleteSet(draft)).toBe(true);
  });

  it('excludes incomplete and uncategorized draft sets from completed set and volume helpers', () => {
    const session = makeSession([
      makeSet({ id: 'done', weight: 50, reps: 8, done: true }),
      makeSet({ id: 'legacy', weight: 45, reps: 8, done: undefined, completedAt: '2026-04-30T10:05:00-04:00' }),
      makeSet({ id: 'incomplete', weight: 120, reps: 8, done: false }),
      makeSet({ id: 'draft', weight: 100, reps: 10, done: undefined, completedAt: undefined }),
    ]);

    expect(completedSets(session.exercises[0]).map((set) => set.id)).toEqual(['done', 'legacy']);
    expect(sessionCompletedSets(session)).toBe(2);
    expect(sessionVolume(session)).toBe(50 * 8 + 45 * 8);
  });
});
