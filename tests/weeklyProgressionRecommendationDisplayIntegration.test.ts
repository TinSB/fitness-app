import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { buildWeeklyProgressionRecommendation } from '../src/engines/weeklyProgressionRecommendationEngine';
import type { TrainingIntelligenceSummary } from '../src/engines/trainingIntelligenceSummaryEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { PlanView } from '../src/features/PlanView';
import { RecordView } from '../src/features/RecordView';
import { WeeklyProgressionRecommendationCard } from '../src/uiOs/progress/WeeklyProgressionRecommendationCard';
import type { SessionEditResult } from '../src/engines/sessionEditEngine';
import { makeAppData, makeSession } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const volumeReport = (): VolumeAdaptationReport => ({
  summary: '训练量建议',
  muscles: [
    {
      muscleId: 'back',
      decision: 'increase',
      setsDelta: 1,
      title: '背：训练量建议',
      reason: '背部本周训练量偏低。',
      confidence: 'high',
      suggestedActions: [],
    },
    {
      muscleId: 'chest',
      decision: 'maintain',
      setsDelta: 0,
      title: '胸：训练量建议',
      reason: '胸部本周训练量稳定。',
      confidence: 'high',
      suggestedActions: [],
    },
    {
      muscleId: 'legs',
      decision: 'decrease',
      setsDelta: -1,
      title: '腿：训练量建议',
      reason: '腿部本周压力偏高。',
      confidence: 'medium',
      suggestedActions: [],
    },
    {
      muscleId: 'shoulders',
      decision: 'hold',
      setsDelta: 0,
      title: '肩：训练量建议',
      reason: '肩部继续观察。',
      confidence: 'low',
      suggestedActions: [],
    },
  ],
});

const trainingIntelligenceSummary = (volumeAdaptation: VolumeAdaptationReport = volumeReport()): TrainingIntelligenceSummary => ({
  volumeAdaptation,
  plateauResults: [
    {
      exerciseId: 'bench-press',
      status: 'plateau',
      title: '卧推：进展复查',
      summary: '卧推近期停滞。',
      signals: [],
      suggestedActions: [],
      confidence: 'high',
    },
  ],
  recommendationConfidence: [],
  keyInsights: [],
  recommendedActions: [],
});

const progressData = () =>
  makeAppData({
    history: [
      makeSession({
        id: 'progress-session-1',
        date: '2026-05-18',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 50, reps: 10, rir: 2, techniqueQuality: 'good' }],
      }),
    ],
  });

const renderRecord = (surfaceMode: 'history' | 'progress') => {
  const data = progressData();
  const editResult: SessionEditResult = { ok: true, changed: false, message: '' };
  return html(
    React.createElement(RecordView, {
      data,
      unitSettings: data.unitSettings,
      trainingIntelligenceSummary: trainingIntelligenceSummary(),
      weeklyPrescription: buildWeeklyPrescription(data),
      bodyWeightInput: '',
      setBodyWeightInput: noop as React.Dispatch<React.SetStateAction<string>>,
      onSaveBodyWeight: noop,
      onDeleteSession: () => editResult,
      onMarkSessionDataFlag: () => editResult,
      onEditSession: () => editResult,
      onUpdateUnitSettings: noop,
      onRestoreData: noop,
      initialSection: 'stats',
      surfaceMode,
    }),
  );
};

const renderPlanText = () => {
  const data = progressData();
  return visibleText(
    React.createElement(PlanView, {
      data,
      weeklyPrescription: buildWeeklyPrescription(data),
      trainingIntelligenceSummary: trainingIntelligenceSummary(),
      coachActions: [],
      selectedTemplateId: data.selectedTemplateId,
      onSelectTemplate: noop,
      onStartTemplate: noop,
      onUpdateExercise: noop,
      onResetTemplates: noop,
      onApplyProgramAdjustmentDraft: noop,
      onDismissProgramAdjustmentDraft: noop,
      onDeleteProgramAdjustmentDraft: noop,
      onRegenerateProgramAdjustmentDraft: noop,
    }),
  );
};

describe('weekly progression recommendation display integration', () => {
  it('renders concise passive weekly progression copy from the 18F result', () => {
    const recommendation = buildWeeklyProgressionRecommendation({
      trainingIntelligenceSummary: trainingIntelligenceSummary(),
      weekId: '2026-05-23',
      nowIso: '2026-05-23T12:00:00.000Z',
    });
    const text = visibleText(React.createElement(WeeklyProgressionRecommendationCard, { recommendation }));

    expect(text).toContain('下周建议');
    expect(text).toContain('下周可小幅推进。');
    expect(text).toContain('小幅推进');
    expect(text).toContain('维持');
    expect(text).toContain('减少');
    expect(text).toContain('暂缓');
    expect(text).toContain('复查动作');
    expect(text).toContain('查看后再决定');
    expect(text).toContain('不改变计划');
  });

  it('renders the weekly card on the Progress metrics surface only', () => {
    expect(renderRecord('progress')).toContain('data-weekly-progression-recommendation="display"');
    expect(renderRecord('history')).not.toContain('data-weekly-progression-recommendation="display"');
  });

  it('renders the weekly card on Plan from training intelligence summary signals', () => {
    const text = renderPlanText();

    expect(text).toContain('下周建议');
    expect(text).toContain('下周可小幅推进。');
    expect(text).toContain('背 小幅加量');
  });

  it('keeps weekly display copy passive and free of forbidden technical wording', () => {
    const recommendation = buildWeeklyProgressionRecommendation({
      volumeAdaptation: volumeReport(),
      weekId: '2026-05-23',
      nowIso: '2026-05-23T12:00:00.000Z',
    });
    const text = visibleText(React.createElement(WeeklyProgressionRecommendationCard, { recommendation }));
    const forbidden = [
      '引擎',
      '算法',
      '自动化',
      '模型',
      'AI 教练',
      '系统判断',
      '智能推荐',
      '决策系统',
      'engine',
      'algorithm',
      'automation',
      'model',
      'AI coach',
      'intelligent recommendation',
      'decision system',
      '应用到计划',
      '生成计划',
      '生成草案',
      '应用为实验模板',
      '保存建议',
      '同步建议',
      '自动调整',
      '自动应用',
    ];

    for (const token of forbidden) {
      expect(text).not.toContain(token);
    }
  });
});
