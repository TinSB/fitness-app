import { describe, expect, it } from 'vitest';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildLoadFeedbackSummary, getLoadFeedbackAdjustment, upsertLoadFeedback } from '../src/engines/loadFeedbackEngine';
import { makeSession } from './fixtures';

describe('loadFeedbackEngine', () => {
  it('saves one feedback per exercise in a session', () => {
    const session = makeSession({
      id: 'feedback-session',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });

    const withFeedback = upsertLoadFeedback(session, 'bench-press', 'too_heavy');
    const updated = upsertLoadFeedback(withFeedback, 'bench-press', 'good');
    expect(updated.loadFeedback).toHaveLength(1);
    expect(updated.loadFeedback?.[0].feedback).toBe('good');
  });

  it('does not directly change best e1RM', () => {
    const session = makeSession({
      id: 'heavy-feedback',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' }],
    });
    const before = buildE1RMProfile([session], 'bench-press').best?.e1rmKg;
    const after = buildE1RMProfile([upsertLoadFeedback(session, 'bench-press', 'too_heavy')], 'bench-press').best?.e1rmKg;
    expect(after).toBe(before);
  });

  it('turns repeated too-heavy feedback into conservative adjustment', () => {
    const sessions = [0, 1, 2].map((index) =>
      upsertLoadFeedback(
        makeSession({
          id: `fb-${index}`,
          date: `2026-04-2${index}`,
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
        }),
        'bench-press',
        index < 2 ? 'too_heavy' : 'good'
      )
    );

    expect(getLoadFeedbackAdjustment(sessions, 'bench-press').direction).toBe('conservative');
    expect(buildLoadFeedbackSummary(sessions, 'bench-press').counts.too_heavy).toBe(2);
  });

  it('keeps normal adjustment when feedback is good', () => {
    const session = upsertLoadFeedback(
      makeSession({
        id: 'good-feedback',
        date: '2026-04-24',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
      }),
      'bench-press',
      'good'
    );

    expect(getLoadFeedbackAdjustment([session], 'bench-press').direction).toBe('normal');
  });
});
