import { describe, expect, it } from 'vitest';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import { formatTemplateName } from '../src/i18n/formatters';
import { getTemplate, makeAppData } from './fixtures';

const rawVisibleTerms = [
  'Legs A',
  'Push A',
  'Pull A',
  'Focus Mode',
  'hypertrophy',
  'hybrid',
  'strength',
  'fat_loss',
  'high',
  'medium',
  'low',
  'warmup',
  'working',
  'support',
  'compound',
  'isolation',
  'machine',
  'undefined',
  'null',
];

const expectNoRawVisibleTerms = (text: string) => {
  rawVisibleTerms.forEach((term) => {
    expect(text).not.toMatch(new RegExp(`(^|[^A-Za-z_])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z_]|$)`));
  });
};

describe('i18n display guard', () => {
  it('normalizes template names from ids and legacy English labels', () => {
    expect(formatTemplateName('legs-a')).toBe('腿 A');
    expect(formatTemplateName('Legs A')).toBe('腿 A');
    expect(formatTemplateName('Push A')).toBe('推 A');
    expect(formatTemplateName('pullA')).toBe('拉 A');
  });

  it('keeps Today presenter output free of raw English template names', () => {
    const vm = buildTodayViewModel({
      todayState: buildTodayTrainingState({ history: [], currentLocalDate: '2026-04-28', plannedTemplateId: 'legs-a' }),
      selectedTemplate: getTemplate('legs-a'),
      completedTemplateName: 'Legs A',
    });

    expect(vm.statusText).toContain('腿 A');
    expectNoRawVisibleTerms([vm.pageTitle, vm.recommendationLabel, vm.primaryActionLabel, vm.statusText, ...vm.secondaryActionLabels].join(' '));
  });

  it('keeps Plan presenter output free of raw English template names', () => {
    const vm = buildPlanViewModel(makeAppData({ selectedTemplateId: 'legs-a', activeProgramTemplateId: 'legs-a' }));

    expect(vm.currentTemplateName).toBe('腿 A');
    expectNoRawVisibleTerms([vm.currentTemplateName, vm.templateStateLabel, ...vm.sections].join(' '));
  });
});
