import { describe, expect, it } from 'vitest';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import { getTemplate } from './fixtures';

describe('visual text guard', () => {
  it('presenter text does not emit undefined, null, or raw state labels', () => {
    const vm = buildTodayViewModel({
      todayState: {
        status: 'not_started',
        date: '2026-04-27',
        plannedTemplateId: 'push-a',
        primaryAction: 'start_training',
      },
      selectedTemplate: getTemplate('push-a'),
    });
    const text = [vm.pageTitle, vm.recommendationLabel, vm.primaryActionLabel, vm.statusText, ...vm.secondaryActionLabels].join(' ');

    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
    expect(text).not.toContain('not_started');
  });
});
