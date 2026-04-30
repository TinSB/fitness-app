import { describe, expect, it } from 'vitest';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import { buildRecordViewModel } from '../src/presenters/recordPresenter';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
import { buildProfileViewModel } from '../src/presenters/profilePresenter';
import { buildTodayTrainingState } from '../src/engines/todayStateEngine';
import { getTemplate, makeAppData } from './fixtures';

describe('page presenters', () => {
  it('builds concise Today states for not started and completed flows', () => {
    const template = getTemplate('push-a');
    const notStarted = buildTodayViewModel({
      todayState: buildTodayTrainingState({ history: [], currentLocalDate: '2026-04-27', plannedTemplateId: 'push-a' }),
      selectedTemplate: template,
    });
    const completed = buildTodayViewModel({
      todayState: {
        status: 'completed',
        date: '2026-04-27',
        completedSessionIds: ['s1'],
        lastCompletedSessionId: 's1',
        primaryAction: 'view_summary',
      },
      selectedTemplate: template,
      completedTemplateName: 'Push A',
    });

    expect(notStarted.primaryActionLabel).toBe('开始训练');
    expect(completed.pageTitle).toBe('今日训练已完成');
    expect(completed.recommendationLabel).toBe('下次建议');
  });

  it('keeps Record default tab on calendar and exposes secondary sections', () => {
    const vm = buildRecordViewModel(makeAppData());
    expect(vm.defaultTab).toBe('calendar');
    expect(vm.tabs).toEqual(['calendar', 'list', 'pr', 'stats', 'data']);
    expect(vm.emptyTitle).toBe('暂无训练记录');
  });

  it('summarizes Plan and Profile page entry points without changing data', () => {
    const data = makeAppData();
    expect(buildPlanViewModel(data).sections).toEqual(['当前计划', '本周安排', '待处理建议', '调整草案']);
    expect(buildProfileViewModel(data).sections).toContain('健康数据导入');
    expect(buildProfileViewModel(data).unitLabel).toBe('kg');
  });
});
