import { describe, expect, it } from 'vitest';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import type { TrainingSession } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const exerciseForTemplate: Record<string, string> = {
  'push-a': 'bench-press',
  'pull-a': 'lat-pulldown',
  'legs-a': 'squat',
};

const completedSession = (templateId: string, date: string): TrainingSession => ({
  ...makeSession({
    id: `${templateId}-${date}`,
    date,
    templateId,
    exerciseId: exerciseForTemplate[templateId],
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  completed: true,
  finishedAt: `${date}T10:00:00-04:00`,
});

const realHistory = () => [
  completedSession('push-a', '2026-04-27'),
  completedSession('legs-a', '2026-04-28'),
  completedSession('pull-a', '2026-04-30'),
  completedSession('push-a', '2026-05-02'),
  completedSession('pull-a', '2026-05-03'),
];

const visibleText = (viewModel: ReturnType<typeof buildTodayViewModel>) =>
  [
    viewModel.pageTitle,
    viewModel.recommendationLabel,
    viewModel.primaryActionLabel,
    ...viewModel.secondaryActionLabels,
    viewModel.statusText,
    viewModel.currentTrainingName,
    viewModel.decisionText,
    viewModel.nextSuggestion.templateName,
    viewModel.nextSuggestion.description,
    viewModel.nextSuggestion.reason,
    viewModel.nextSuggestion.plannedTemplateName,
    viewModel.nextSuggestion.recommendedTemplateName,
    viewModel.nextSuggestion.overrideReason,
  ]
    .filter(Boolean)
    .join('\n');

describe('Today next suggestion cycle boundary', () => {
  it('shows Legs A as the Today recommendation for the May 4 real-world PPL boundary', () => {
    const data = makeAppData({
      history: realHistory(),
      selectedTemplateId: 'push-a',
      activeProgramTemplateId: 'push-a',
    });
    const pipeline = buildEnginePipeline(data, '2026-05-04', { coachActions: [] });
    const viewModel = buildTodayViewModel({
      todayState: pipeline.todayState,
      selectedTemplate: getTemplate('push-a'),
      nextSuggestion: getTemplate('push-a'),
      nextWorkout: pipeline.nextWorkout,
    });
    const text = visibleText(viewModel);

    expect(pipeline.todayState.status).toBe('not_started');
    expect(pipeline.nextWorkout.plannedTemplateId).toBe('legs-a');
    expect(pipeline.nextWorkout.templateId).toBe('legs-a');
    expect(viewModel.currentTrainingName).toBe('腿 A');
    expect(viewModel.recommendedTemplateId).toBe('legs-a');
    expect(viewModel.nextSuggestion.templateId).toBe('legs-a');
    expect(text).toContain('当前这一轮已完成推 A、拉 A');
    expect(text).toContain('还缺腿 A');
    expect(text).not.toContain('下次建议：推 A');
    expect(text).not.toMatch(/push-a|pull-a|legs-a|undefined|null/);
  });
});
