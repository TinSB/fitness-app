import { describe, expect, it } from 'vitest';
import pplFixture from './fixtures/realDataRegression/ppl-cycle-boundary-history.json';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { buildWorkoutCycleState } from '../src/engines/workoutCycleScheduler';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import type { AppData } from '../src/models/training-model';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, getTemplate } from './fixtures';

const fixtureData = () =>
  sanitizeData({
    ...makeAppData(),
    ...(pplFixture.data as Partial<AppData>),
  });

const visibleTodayText = (data: AppData, currentDate: string) => {
  const pipeline = buildEnginePipeline(data, currentDate);
  const viewModel = buildTodayViewModel({
    todayState: pipeline.todayState,
    selectedTemplate: getTemplate(data.selectedTemplateId),
    nextSuggestion: getTemplate(pipeline.nextWorkout.templateId),
    nextWorkout: pipeline.nextWorkout,
  });
  return [
    viewModel.pageTitle,
    viewModel.statusText,
    viewModel.decisionText,
    viewModel.nextSuggestion.templateName,
    viewModel.nextSuggestion.description,
    viewModel.nextSuggestion.reason,
  ]
    .filter(Boolean)
    .join(' ');
};

describe('real data PPL cycle boundary regression', () => {
  it('recommends Legs A on 2026-05-04 without borrowing old legs work from the previous cycle', () => {
    const data = fixtureData();
    const cycle = buildWorkoutCycleState({
      history: data.history,
      orderedTemplateIds: ['push-a', 'pull-a', 'legs-a'],
      currentDate: '2026-05-04',
    });
    const pipeline = buildEnginePipeline(data, '2026-05-04');

    expect(cycle.completedInCurrentCycle).toEqual(['push-a', 'pull-a']);
    expect(cycle.missingInCurrentCycle).toEqual(['legs-a']);
    expect(cycle.nextTemplateId).toBe('legs-a');
    expect(pipeline.nextWorkout.templateId).toBe('legs-a');
    expect(pipeline.nextWorkout.plannedTemplateId).toBe('legs-a');
    expect(data.selectedTemplateId).toBe('push-a');
  });

  it('keeps scheduler reason and Today presenter text localized without internal template ids', () => {
    const data = fixtureData();
    const pipeline = buildEnginePipeline(data, '2026-05-04');
    const text = `${pipeline.nextWorkout.reason} ${visibleTodayText(data, '2026-05-04')}`;

    expect(text).toContain('腿 A');
    expect(text).not.toMatch(/\b(push-a|pull-a|legs-a|undefined|null)\b/);
  });
});
