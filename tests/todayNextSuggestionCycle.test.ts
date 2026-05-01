import { describe, expect, it } from 'vitest';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import type { PainPattern, SessionDataFlag, TrainingSession } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession } from './fixtures';

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
  completed: true,
  dataFlag,
  finishedAt: `${date}T10:00:00-04:00`,
});

const completedTodayState = (history: TrainingSession[], selectedTemplateId = 'legs-a') => {
  const data = makeAppData({ history, selectedTemplateId });
  return buildTodayTrainingState({
    activeSession: null,
    history,
    currentLocalDate: '2026-04-30',
    plannedTemplateId: data.selectedTemplateId,
    templates: data.templates,
    programTemplate: data.programTemplate,
  });
};

const nextWorkout = (history: TrainingSession[], options: Partial<Parameters<typeof buildNextWorkoutRecommendation>[0]> = {}) => {
  const data = makeAppData({ history });
  return buildNextWorkoutRecommendation({
    history,
    templates: data.templates,
    programTemplate: data.programTemplate,
    ...options,
  });
};

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

describe('Today cycle-aware next suggestion', () => {
  it('shows Push A after out-of-order Push A, Legs A, Pull A completed cycle', () => {
    const history = [
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
    ];
    const recommendation = nextWorkout(history);
    const viewModel = buildTodayViewModel({
      todayState: completedTodayState(history, 'legs-a'),
      selectedTemplate: getTemplate('legs-a'),
      completedTemplateName: '拉 A',
      nextSuggestion: getTemplate('legs-a'),
      nextWorkout: recommendation,
    });

    expect(viewModel.state).toBe('completed');
    expect(viewModel.nextSuggestion.templateId).toBe('push-a');
    expect(viewModel.currentTrainingName).toBe('推 A');
    expect(viewModel.nextSuggestion.description).toContain('上一轮推、拉、腿都已完成');
    expect(viewModel.primaryActionLabel).toBe('查看本次训练');
    expect(viewModel.primaryActionLabel).not.toContain('开始训练');
  });

  it('does not let selectedTemplate override completed scheduler output', () => {
    const history = [
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
    ];
    const viewModel = buildTodayViewModel({
      todayState: completedTodayState(history, 'legs-a'),
      selectedTemplate: getTemplate('legs-a'),
      completedTemplateName: '拉 A',
      nextSuggestion: getTemplate('legs-a'),
      nextWorkout: nextWorkout(history),
    });

    expect(viewModel.nextSuggestion.templateId).toBe('push-a');
    expect(viewModel.nextSuggestion.description).toContain('推 A');
    expect(viewModel.nextSuggestion.description).not.toContain('下次建议：腿 A');
  });

  it('shows planned template, current recommendation, and reason when recovery overrides order', () => {
    const history = [completedSession('push-a', '2026-04-27')];
    const backPain: PainPattern = {
      area: 'back',
      frequency: 3,
      severityAvg: 3,
      lastOccurredAt: '2026-04-28',
      suggestedAction: 'substitute',
    };
    const recommendation = nextWorkout(history, { painPatterns: [backPain] });
    const viewModel = buildTodayViewModel({
      todayState: {
        status: 'completed',
        date: '2026-04-27',
        completedSessionIds: ['push-a-2026-04-27'],
        lastCompletedSessionId: 'push-a-2026-04-27',
        primaryAction: 'view_summary',
      },
      selectedTemplate: getTemplate('pull-a'),
      completedTemplateName: '推 A',
      nextSuggestion: getTemplate('pull-a'),
      nextWorkout: recommendation,
    });

    expect(recommendation.plannedTemplateId).toBe('pull-a');
    expect(recommendation.overrideReason).toBeTruthy();
    expect(viewModel.nextSuggestion.description).toContain('原计划：拉 A');
    expect(viewModel.nextSuggestion.description).toContain('当前建议：');
    expect(viewModel.nextSuggestion.description).toContain('原因：');
    expect(viewModel.nextSuggestion.description).toContain(recommendation.overrideReason || '');
  });

  it('keeps completed state copy localized and free of raw values', () => {
    const history = [
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30'),
    ];
    const viewModel = buildTodayViewModel({
      todayState: completedTodayState(history, 'legs-a'),
      selectedTemplate: getTemplate('legs-a'),
      completedTemplateName: '拉 A',
      nextSuggestion: getTemplate('legs-a'),
      nextWorkout: nextWorkout(history),
    });

    const text = visibleText(viewModel);
    expect(text).toMatch(/[一-龥]/);
    expect(text).not.toMatch(/\b(undefined|null|push-a|pull-a|legs-a|high|medium|low)\b/);
  });
});
