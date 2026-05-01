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

const realWorldOutOfOrderHistory = () => [
  completedSession('push-a', '2026-04-27'),
  completedSession('legs-a', '2026-04-28'),
  completedSession('pull-a', '2026-04-30'),
];

const recommend = (history: TrainingSession[], options: Partial<Parameters<typeof buildNextWorkoutRecommendation>[0]> = {}) => {
  const data = makeAppData({ history, selectedTemplateId: 'legs-a' });
  return buildNextWorkoutRecommendation({
    history,
    templates: data.templates,
    programTemplate: data.programTemplate,
    ...options,
  });
};

const completedTodayViewModel = (history: TrainingSession[], selectedTemplateId = 'legs-a') => {
  const data = makeAppData({ history, selectedTemplateId });
  const todayState = buildTodayTrainingState({
    activeSession: null,
    history,
    currentLocalDate: '2026-04-30',
    plannedTemplateId: data.selectedTemplateId,
    templates: data.templates,
    programTemplate: data.programTemplate,
  });
  return buildTodayViewModel({
    todayState,
    selectedTemplate: getTemplate(selectedTemplateId),
    completedTemplateName: '拉 A',
    nextSuggestion: getTemplate(selectedTemplateId),
    nextWorkout: recommend(history),
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

describe('PPL cycle real world regression', () => {
  it('starts a new cycle after Push A, Legs A, Pull A were completed out of order', () => {
    const recommendation = recommend(realWorldOutOfOrderHistory());

    expect(recommendation.templateId).toBe('push-a');
    expect(recommendation.plannedTemplateId).toBe('push-a');
    expect(recommendation.templateId).not.toBe('legs-a');
    expect(recommendation.reason).toContain('已完成 推 A、拉 A、腿 A');
    expect(recommendation.reason).toContain('新一轮');
  });

  it('shows Push A in completed Today state and ignores selectedTemplate Legs A', () => {
    const viewModel = completedTodayViewModel(realWorldOutOfOrderHistory(), 'legs-a');
    const text = visibleText(viewModel);

    expect(viewModel.state).toBe('completed');
    expect(viewModel.nextSuggestion.templateId).toBe('push-a');
    expect(viewModel.currentTrainingName).toBe('推 A');
    expect(viewModel.primaryActionLabel).toBe('查看本次训练');
    expect(text).toContain('下次建议：推 A');
    expect(text).toContain('上一轮推、拉、腿都已完成');
    expect(text).not.toContain('下次建议：腿 A');
    expect(viewModel.primaryActionLabel).not.toContain('开始训练');
  });

  it('does not count test or excluded sessions toward the current cycle', () => {
    const legsAsTest = recommend([
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28', 'test'),
      completedSession('pull-a', '2026-04-30'),
    ]);
    const pullAsExcluded = recommend([
      completedSession('push-a', '2026-04-27'),
      completedSession('legs-a', '2026-04-28'),
      completedSession('pull-a', '2026-04-30', 'excluded'),
    ]);

    expect(legsAsTest.templateId).toBe('legs-a');
    expect(legsAsTest.reason).not.toContain('上一轮推、拉、腿都已完成');
    expect(pullAsExcluded.templateId).toBe('pull-a');
    expect(pullAsExcluded.reason).not.toContain('上一轮推、拉、腿都已完成');
  });

  it('allows recovery override from planned Push A only when an override reason is present', () => {
    const shoulderPain: PainPattern = {
      area: 'shoulder',
      frequency: 3,
      severityAvg: 3,
      lastOccurredAt: '2026-04-30',
      suggestedAction: 'substitute',
    };
    const recommendation = recommend(realWorldOutOfOrderHistory(), { painPatterns: [shoulderPain] });

    expect(recommendation.plannedTemplateId).toBe('push-a');
    if (recommendation.templateId !== 'push-a') {
      expect(recommendation.overrideReason).toBeTruthy();
      expect(recommendation.reason).toContain(recommendation.overrideReason || '');
    } else {
      expect(recommendation.overrideReason).toBeUndefined();
    }
  });

  it('keeps visible Today text localized without raw ids or empty values', () => {
    const text = visibleText(completedTodayViewModel(realWorldOutOfOrderHistory(), 'legs-a'));

    expect(text).toMatch(/[一-龥]/);
    expect(text).not.toMatch(/\b(undefined|null|push-a|pull-a|legs-a|high|medium|low)\b/);
  });
});
