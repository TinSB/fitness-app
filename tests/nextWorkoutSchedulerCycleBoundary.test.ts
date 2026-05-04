import { describe, expect, it } from 'vitest';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import type { PainPattern, SessionDataFlag, TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const exerciseForTemplate: Record<string, string> = {
  'push-a': 'bench-press',
  'pull-a': 'lat-pulldown',
  'legs-a': 'squat',
};

const completedSession = (templateId: string, date: string, dataFlag: SessionDataFlag = 'normal'): TrainingSession => ({
  ...makeSession({
    id: `${templateId}-${date}-${dataFlag}`,
    date,
    templateId,
    exerciseId: exerciseForTemplate[templateId],
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  completed: true,
  dataFlag,
  finishedAt: `${date}T10:00:00-04:00`,
});

const recommend = (
  history: TrainingSession[],
  options: Partial<Parameters<typeof buildNextWorkoutRecommendation>[0]> = {},
) => {
  const data = makeAppData({ history, selectedTemplateId: 'push-a' });
  return buildNextWorkoutRecommendation({
    history,
    templates: data.templates,
    programTemplate: data.programTemplate,
    todayState: { status: 'not_started', date: '2026-05-04', plannedTemplateId: data.selectedTemplateId },
    ...options,
  });
};

describe('next workout scheduler cycle boundary', () => {
  it('recommends legs for the real May 4 cycle boundary case', () => {
    const recommendation = recommend([
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
      completedSession('push-a', '2026-05-02'),
      completedSession('pull-a', '2026-05-03'),
    ]);

    expect(recommendation.plannedTemplateId).toBe('legs-a');
    expect(recommendation.templateId).toBe('legs-a');
    expect(recommendation.templateName).toBe('腿 A');
    expect(recommendation.reason).toContain('当前这一轮已完成推 A、拉 A');
    expect(recommendation.reason).toContain('还缺腿 A');
  });

  it('keeps single-session default rotation while using cycle missing after two templates', () => {
    const afterPullOnly = recommend([completedSession('pull-a', '2026-05-03')]);
    const afterPushPull = recommend([completedSession('push-a', '2026-05-02'), completedSession('pull-a', '2026-05-03')]);

    expect(afterPullOnly.plannedTemplateId).toBe('legs-a');
    expect(afterPullOnly.templateId).toBe('legs-a');
    expect(afterPushPull.plannedTemplateId).toBe('legs-a');
    expect(afterPushPull.templateId).toBe('legs-a');
  });

  it('does not let selectedTemplate override scheduler output', () => {
    const data = makeAppData({
      selectedTemplateId: 'push-a',
      activeProgramTemplateId: 'push-a',
      history: [completedSession('push-a', '2026-05-02'), completedSession('pull-a', '2026-05-03')],
    });
    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      todayState: { status: 'not_started', date: '2026-05-04', plannedTemplateId: data.selectedTemplateId },
    });

    expect(data.selectedTemplateId).toBe('push-a');
    expect(recommendation.plannedTemplateId).toBe('legs-a');
    expect(recommendation.templateId).toBe('legs-a');
  });

  it('keeps recovery override explicit when it overrides the cycle plan', () => {
    const legPain: PainPattern = {
      area: 'leg',
      frequency: 3,
      severityAvg: 3,
      lastOccurredAt: '2026-05-03',
      suggestedAction: 'substitute',
    };
    const recommendation = recommend([completedSession('push-a', '2026-05-02'), completedSession('pull-a', '2026-05-03')], {
      painPatterns: [legPain],
      painAreas: ['leg'],
    });

    expect(recommendation.plannedTemplateId).toBe('legs-a');
    if (recommendation.kind !== 'train' || recommendation.templateId !== 'legs-a') {
      expect(recommendation.overrideReason).toBeTruthy();
      expect(recommendation.reason).toContain('原计划');
    }
  });

  it('does not expose raw ids or empty values in recommendation reason', () => {
    const recommendation = recommend([completedSession('push-a', '2026-05-02'), completedSession('pull-a', '2026-05-03')]);

    expect(recommendation.reason).toMatch(/[一-龥]/);
    expect(recommendation.reason).not.toMatch(/push-a|pull-a|legs-a|undefined|null/);
  });
});
