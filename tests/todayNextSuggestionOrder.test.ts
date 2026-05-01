import { describe, expect, it } from 'vitest';
import { pickSuggestedTemplate } from '../src/engines/sessionBuilder';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import type { TrainingSession } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const completedPush = (): TrainingSession => ({
  ...makeSession({
    id: 'completed-push-a',
    date: '2026-04-28',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
  }),
  finishedAt: '2026-04-28T10:00:00-04:00',
  completed: true,
});

describe('Today next suggestion order', () => {
  it('uses scheduler rotation after completed Push A instead of selectedTemplate', () => {
    const session = completedPush();
    const data = makeAppData({
      selectedTemplateId: 'legs-a',
      history: [session],
    });
    const todayState = buildTodayTrainingState({
      activeSession: data.activeSession,
      history: data.history,
      currentLocalDate: '2026-04-28',
      plannedTemplateId: data.selectedTemplateId,
    });
    const nextTemplateId = pickSuggestedTemplate(data);

    const viewModel = buildTodayViewModel({
      todayState,
      selectedTemplate: getTemplate('legs-a'),
      completedTemplateName: session.templateName,
      nextSuggestion: getTemplate(nextTemplateId),
    });

    expect(todayState.status).toBe('completed');
    expect(nextTemplateId).toBe('pull-a');
    expect(viewModel.primaryActionLabel).not.toContain('开始训练');
    expect(viewModel.nextSuggestion.templateId).toBe('pull-a');
    expect(viewModel.currentTrainingName).toContain('A');
  });
});
