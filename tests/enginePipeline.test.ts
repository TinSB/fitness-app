import { describe, expect, it } from 'vitest';
import { dismissCoachActionToday } from '../src/engines/coachActionDismissEngine';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { createSession } from '../src/engines/sessionBuilder';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const makeAction = (id: string): CoachAction => ({
  id,
  title: '查看训练建议',
  description: '系统发现一条需要复查的训练建议。',
  source: 'volumeAdaptation',
  actionType: 'review_volume',
  priority: 'medium',
  status: 'pending',
  requiresConfirmation: false,
  reversible: false,
  createdAt: '2026-04-30T12:00:00.000Z',
  targetId: 'back',
  targetType: 'muscle',
  reason: '背部训练量需要复查。',
});

describe('enginePipeline', () => {
  it('builds shared context, today state, next workout and visible coach actions', () => {
    const action = makeAction('review-volume-back');
    const dismissed = dismissCoachActionToday(action.id, '2026-04-30T13:00:00.000Z');
    const data = makeAppData({ dismissedCoachActions: [dismissed] });
    const before = JSON.stringify(data);

    const pipeline = buildEnginePipeline(data, '2026-04-30', { coachActions: [action] });

    expect(pipeline.context.currentDateLocalKey).toBe('2026-04-30');
    expect(pipeline.todayState.status).toBe('not_started');
    expect(pipeline.nextWorkout.templateName).toBeTruthy();
    expect(pipeline.coachActions).toHaveLength(1);
    expect(pipeline.visibleCoachActions).toHaveLength(0);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('suppresses daily adjustment while an active session is in progress', () => {
    const activeSession = createSession(
      getTemplate('push-a'),
      makeAppData().todayStatus,
      [],
      'hybrid',
      null,
      null,
      makeAppData().screeningProfile,
      makeAppData().mesocyclePlan,
    );
    const pipeline = buildEnginePipeline(makeAppData({ activeSession }), '2026-04-30');

    expect(pipeline.todayState.status).toBe('in_progress');
    expect(pipeline.todayAdjustment).toBeUndefined();
  });

  it('keeps completed state independent from selectedTemplate', () => {
    const completedPull = {
      ...makeSession({
        id: 'pull-today',
        date: '2026-04-30',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 70, reps: 8 }],
      }),
      finishedAt: '2026-04-30T10:00:00-04:00',
    };
    const pipeline = buildEnginePipeline(
      makeAppData({ history: [completedPull], selectedTemplateId: 'push-a' }),
      '2026-04-30',
    );

    expect(pipeline.todayState.status).toBe('completed');
    expect(pipeline.nextWorkout.templateId).toBe('legs-a');
  });
});
