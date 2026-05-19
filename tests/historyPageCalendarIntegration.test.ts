import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { RecordView } from '../src/features/RecordView';
import { makeAppData, makeSession } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderRecord = (history = [
  makeSession({
    id: 'bench-history',
    date: '2026-05-04',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 100, reps: 5, rir: 1, techniqueQuality: 'good' }],
  }),
]) => {
  const data = makeAppData({ history });
  return visibleText(
    React.createElement(RecordView, {
      data,
      unitSettings: data.unitSettings,
      weeklyPrescription: buildWeeklyPrescription(data),
      bodyWeightInput: '',
      setBodyWeightInput: noop as React.Dispatch<React.SetStateAction<string>>,
      onSaveBodyWeight: noop,
      onDeleteSession: noop,
      onMarkSessionDataFlag: noop,
      onUpdateUnitSettings: noop,
      onRestoreData: noop,
      initialSection: 'calendar',
      selectedDate: '2026-05-05',
      surfaceMode: 'history',
    }),
  );
};

describe('History page calendar integration', () => {
  it('renders calendar-first hierarchy before recent sessions', () => {
    const text = renderRecord();

    expect(text).toContain('训练频率先看日历，再看 PR / e1RM');
    expect(text).toContain('本周训练');
    expect(text).toContain('训练日历');
    expect(text).toContain('选中日期');
    expect(text).toContain('这天没有训练记录');
    expect(text).toContain('休息日也属于计划的一部分');
    expect(text).toContain('PR / e1RM 快速入口');
    expect(text).toContain('近期训练');
    expect(text.indexOf('训练日历')).toBeLessThan(text.indexOf('近期训练'));
  });

  it('keeps recent sessions secondary and Data Health calm without repair action', () => {
    const text = renderRecord();

    expect(text).toContain('列表保留，但不抢占日历');
    expect(text).toContain('没有明显异常');
    expect(text).toContain('不执行修复');
    expect(text).not.toContain('一键修复显示重量');
    expect(text).not.toContain('POST /data-health/repair/apply');
  });

  it('keeps empty History friendly', () => {
    const text = renderRecord([]);

    expect(text).toContain('暂无训练记录');
    expect(text).toContain('完成一次训练后，这里会自动显示训练日历和当天详情。');
    expect(text).toContain('这天没有训练记录');
  });
});
