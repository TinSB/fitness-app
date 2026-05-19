import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderTodayText = (data = makeAppData()) =>
  visibleText(
    <TodayView
      data={data}
      selectedTemplate={getTemplate(data.selectedTemplateId || 'push-a')}
      suggestedTemplate={getTemplate('pull-a')}
      weeklyPrescription={buildWeeklyPrescription(data)}
      trainingMode="hybrid"
      onModeChange={noop}
      onStatusChange={noop}
      onSorenessToggle={noop}
      onTemplateSelect={noop}
      onUseSuggestion={noop}
      onStart={noop}
      onResume={noop}
      onReviewDataHealth={noop}
    />,
  );

describe('Today decision surface integration', () => {
  it('renders the decision hero, start action, readiness summary, compact focus override, and no normal full safety strip', () => {
    const text = renderTodayText();

    expect(text).toContain('今日结论');
    expect(text).toContain('今天练什么');
    expect(text).toContain('开始今天训练');
    expect(text).toContain('恢复 / 疲劳');
    expect(text).toContain('今天想练');
    expect(text).not.toContain('选择只影响今天');
    expect(text).not.toContain('不修改长期计划');
    expect(text).not.toContain('当前使用本地数据');
    expect(text).not.toContain('云端候选不会自动同步');
    expect(text).not.toContain('本地训练记录仍可继续');
    expect(text).not.toContain('云端同步完成');
    expect(text).not.toContain('云端已成为默认');
  });

  it('shows a severe risk notice only for severe Data Health blockers', () => {
    const session = makeSession({
      id: 'bad-session',
      date: '2026-05-18',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 45, reps: 10 }],
    });
    const data = makeAppData({
      history: [
        {
          ...session,
          exercises: [{ ...session.exercises[0], id: 'unknown-exercise-id' }],
        },
      ],
    });

    const text = renderTodayText(data);

    expect(text).toContain('查看严重问题');
    expect(text).toContain('严重');
    expect(text).toContain('完整 Data Health 留在设置或二级页面');
    expect(text).not.toContain('一键修复显示重量');
    expect(text).not.toContain('/data-health/repair/apply');
  });

  it('does not render full Data Health or cloud controls as primary Today content by default', () => {
    const text = renderTodayText();

    expect(text).not.toContain('一键修复显示重量');
    expect(text).not.toContain('完整数据健康检查');
    expect(text).not.toContain('云端拉取');
    expect(text).not.toContain('云端推送');
  });
});
