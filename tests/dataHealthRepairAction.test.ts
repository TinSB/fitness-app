import { describe, expect, it } from 'vitest';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { repairLegacyDisplayWeights, type DataHealthRepairResult } from '../src/engines/dataHealthRepairEngine';
import { buildDataHealthViewModel } from '../src/presenters/dataHealthPresenter';
import type { AppData, UnitSettings } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [2.5, 5],
  customIncrementsLb: [5, 10],
};

const makeRepairableData = (): AppData => {
  const pull = getTemplate('pull-a');
  return makeAppData({
    unitSettings,
    history: [
      {
        id: 'repair-action-session',
        date: '2026-05-01',
        templateId: 'pull-a',
        templateName: pull.name,
        trainingMode: 'hybrid',
        completed: true,
        exercises: [
          {
            ...pull.exercises[0],
            sets: [
              {
                id: 'repair-action-set',
                type: 'top',
                weight: 52.6,
                actualWeightKg: 52.6,
                displayWeight: 45.1,
                displayUnit: 'lb',
                reps: 8,
                rir: 2,
                done: true,
              },
            ],
          },
        ],
      },
    ],
  });
};

const makeNeedsReviewOnlyData = (): AppData => {
  const pull = getTemplate('pull-a');
  return makeAppData({
    unitSettings,
    history: [
      {
        id: 'repair-action-review-session',
        date: '2026-05-01',
        templateId: 'pull-a',
        templateName: pull.name,
        trainingMode: 'hybrid',
        completed: true,
        exercises: [
          {
            ...pull.exercises[0],
            sets: [{ id: 'review-only-set', type: 'top', weight: 0, displayWeight: 120, displayUnit: 'lb', reps: 8, done: true }],
          },
        ],
      },
    ],
  });
};

const allIssueViews = (data: AppData) => {
  const vm = buildDataHealthViewModel(buildDataHealthReport(data));
  return [...vm.primaryIssues, ...vm.secondaryIssues];
};

const executeConfirmedRepair = (
  data: AppData,
  confirmed: boolean,
  repairFn: (input: AppData) => DataHealthRepairResult = repairLegacyDisplayWeights,
) => {
  if (!confirmed) return { data, executed: false, toast: '' };
  try {
    const result = repairFn(data);
    return {
      data: result.repairedCount > 0 ? result.repairedData : data,
      executed: true,
      toast: result.repairedCount > 0 ? '已修复历史显示重量，真实训练重量未改变。' : '没有需要自动修复的历史显示重量。',
    };
  } catch {
    return { data, executed: false, toast: '修复失败，当前数据未改变。' };
  }
};

describe('DataHealth legacy display weight repair action', () => {
  it('shows a confirmed one-click repair action for auto-fixable display weight issues', () => {
    const action = allIssueViews(makeRepairableData()).find((issue) => issue.action?.type === 'repair_legacy_display_weights')?.action;
    const visibleText = allIssueViews(makeRepairableData())
      .map((issue) => [issue.title, issue.userMessage, issue.action?.label, issue.action?.description].filter(Boolean).join(' '))
      .join('\n');

    expect(action).toEqual(expect.objectContaining({
      label: '一键修复显示重量',
      type: 'repair_legacy_display_weights',
      requiresConfirmation: true,
      description: '只修复历史显示重量，不改变真实训练重量。',
    }));
    expect(visibleText).not.toMatch(/undefined|null|raw enum|__auto_alt|__alt_/);
  });

  it('does not show one-click repair when all display weight issues need manual review', () => {
    const issues = allIssueViews(makeNeedsReviewOnlyData());

    expect(issues.some((issue) => issue.action?.type === 'repair_legacy_display_weights')).toBe(false);
    expect(issues.map((issue) => issue.userMessage).join('\n')).toContain('不会用旧显示重量替代真实计算重量');
  });

  it('does not execute repair when confirmation is cancelled', () => {
    const data = makeRepairableData();
    const result = executeConfirmedRepair(data, false);

    expect(result.executed).toBe(false);
    expect(result.data).toBe(data);
    expect(result.data.history[0].exercises[0].sets[0].displayWeight).toBe(45.1);
  });

  it('does not mutate AppData when repair execution fails', () => {
    const data = makeRepairableData();
    const before = JSON.stringify(data);
    const result = executeConfirmedRepair(data, true, () => {
      throw new Error('boom');
    });

    expect(result.executed).toBe(false);
    expect(result.toast).toBe('修复失败，当前数据未改变。');
    expect(JSON.stringify(result.data)).toBe(before);
  });

  it('recomputes DataHealth after successful repair', () => {
    const data = makeRepairableData();
    const beforeReport = buildDataHealthReport(data);
    const result = executeConfirmedRepair(data, true);
    const afterReport = buildDataHealthReport(result.data);

    expect(beforeReport.issues.some((issue) => issue.canAutoFix)).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.toast).toBe('已修复历史显示重量，真实训练重量未改变。');
    expect(afterReport.issues.some((issue) => issue.canAutoFix)).toBe(false);
  });
});
