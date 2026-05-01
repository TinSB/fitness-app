import { describe, expect, it } from 'vitest';
import { buildNextWorkoutRecommendation, getOrderedTrainingTemplates } from '../src/engines/nextWorkoutScheduler';
import type { ProgramTemplate, TrainingSession, TrainingTemplate } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const completedSession = (id: string, date: string, templateId: string, exerciseId = 'bench-press'): TrainingSession => ({
  ...makeSession({
    id,
    date,
    templateId,
    exerciseId,
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  finishedAt: `${date}T10:00:00-04:00`,
  completed: true,
});

const emptyTemplate = (id: string): TrainingTemplate => ({
  id,
  name: id,
  focus: id,
  duration: 50,
  note: '',
  exercises: [],
});

const programWithDays = (ids: string[]): ProgramTemplate => ({
  ...makeAppData().programTemplate,
  dayTemplates: ids.map((id, index) => ({
    id,
    name: id,
    focusMuscles: [],
    correctionBlockIds: [],
    mainExerciseIds: [],
    functionalBlockIds: [],
    estimatedDurationMin: 50,
    order: index + 1,
  })) as ProgramTemplate['dayTemplates'],
});

describe('next workout scheduler order', () => {
  it('keeps default PPL order as Push A to Pull A to Legs A', () => {
    const data = makeAppData();
    const orderedIds = getOrderedTrainingTemplates(data.templates, data.programTemplate).templates.map((template) => template.id);

    expect(orderedIds.slice(0, 3)).toEqual(['push-a', 'pull-a', 'legs-a']);
  });

  it('uses explicit program day order before fallback rules', () => {
    const templates = [emptyTemplate('push-a'), emptyTemplate('pull-a'), emptyTemplate('legs-a')];
    const program = {
      ...programWithDays(['legs-a', 'push-a', 'pull-a']),
      dayTemplates: [
        { ...programWithDays(['legs-a']).dayTemplates[0], order: 3 },
        { ...programWithDays(['push-a']).dayTemplates[0], order: 1 },
        { ...programWithDays(['pull-a']).dayTemplates[0], order: 2 },
      ],
    } as ProgramTemplate;

    expect(getOrderedTrainingTemplates(templates, program).templates.map((template) => template.id)).toEqual(['push-a', 'pull-a', 'legs-a']);
  });

  it('does not let weekly volume deficits skip Pull A after Push A', () => {
    const data = makeAppData({
      history: [completedSession('push-done', '2026-04-28', 'push-a', 'bench-press')],
    });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      weeklyVolumeSummary: {
        byMuscle: {
          legs: { targetSets: 18, completedSets: 0, remainingSets: 18 },
          back: { targetSets: 12, completedSets: 11, remainingSets: 1 },
        },
      },
    });

    expect(recommendation.plannedTemplateId).toBe('pull-a');
    expect(recommendation.templateId).toBe('pull-a');
    expect(recommendation.overrideReason).toBeUndefined();
  });

  it('ignores test and excluded sessions when selecting the rotation anchor', () => {
    const data = makeAppData({
      history: [
        { ...completedSession('excluded-legs', '2026-04-29', 'legs-a', 'squat'), dataFlag: 'excluded' },
        { ...completedSession('test-pull', '2026-04-28', 'pull-a', 'lat-pulldown'), dataFlag: 'test' },
        completedSession('normal-push', '2026-04-27', 'push-a', 'bench-press'),
      ],
    });

    const recommendation = buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
    });

    expect(recommendation.templateId).toBe('pull-a');
  });
});
