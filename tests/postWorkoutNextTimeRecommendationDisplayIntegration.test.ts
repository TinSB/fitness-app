import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import type { PostWorkoutNextTimeRecommendation } from '../src/engines/postWorkoutNextTimeRecommendationEngine';
import {
  PostWorkoutNextTimeRecommendationCard,
  formatPostWorkoutNextTimePrescription,
  shouldShowPostWorkoutNextTimeRecommendation,
} from '../src/uiOs/records/PostWorkoutNextTimeRecommendationCard';
import { RecordView } from '../src/features/RecordView';
import type { SessionEditResult } from '../src/engines/sessionEditEngine';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

const lbToKg = (lb: number) => lb * 0.45359237;
const noop = (..._args: unknown[]) => undefined;

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const visibleText = (element: React.ReactElement) =>
  renderToStaticMarkup(element)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeHistorySession = (id = 'post-workout-session'): TrainingSession =>
  makeSession({
    id,
    date: '2026-05-20',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: lbToKg(135), reps: 10, rir: 2, techniqueQuality: 'good' }],
  });

const makeRecommendation = (sessionId = 'post-workout-session'): PostWorkoutNextTimeRecommendation => ({
  id: `post-workout-next-time:${sessionId}`,
  scope: 'session',
  sourceSessionId: sessionId,
  recommendations: [
    {
      id: `post-workout-next-time:${sessionId}:bench-press`,
      scope: 'exercise',
      exerciseId: 'bench-press',
      exerciseName: '卧推',
      recommendationKind: 'increase_load',
      actionableLoadKg: lbToKg(140),
      plannedReps: 8,
      confidence: 'high',
      reasonCodes: ['strong_completion'],
      riskFlags: ['debug_risk_should_stay_hidden'],
      blockedReasons: [],
      userMessage: '完成稳定，下次小幅加重。',
      sourceSessionId: sessionId,
      createdAt: '2026-05-20T12:00:00.000Z',
    },
  ],
  summary: '下次建议：小幅推进。',
  confidence: 'high',
  blockedReasons: [],
  sourceEngineIds: ['post-workout-next-time-recommendation-v1'],
  createdAt: '2026-05-20T12:00:00.000Z',
});

const renderRecordText = ({
  history,
  selectedSessionId,
  recommendation,
}: {
  history: TrainingSession[];
  selectedSessionId: string;
  recommendation: PostWorkoutNextTimeRecommendation | null;
}) => {
  const data = makeAppData({ history, unitSettings });
  const operationResult: SessionEditResult = { ok: true, changed: false, session: history[0], message: '' };
  return visibleText(
    React.createElement(RecordView, {
      data,
      unitSettings,
      weeklyPrescription: buildWeeklyPrescription(data),
      bodyWeightInput: '',
      setBodyWeightInput: noop as React.Dispatch<React.SetStateAction<string>>,
      onSaveBodyWeight: noop,
      onDeleteSession: () => operationResult,
      onMarkSessionDataFlag: () => operationResult,
      onEditSession: () => operationResult,
      onUpdateUnitSettings: noop,
      onRestoreData: noop,
      selectedSessionId,
      postWorkoutNextTimeRecommendation: recommendation,
    }),
  );
};

describe('post-workout next-time recommendation display integration', () => {
  it('renders compact next-time advice for the matching selected history session', () => {
    const session = makeHistorySession();
    const text = renderRecordText({
      history: [session],
      selectedSessionId: session.id,
      recommendation: makeRecommendation(session.id),
    });

    expect(text).toContain('下次建议');
    expect(text).toContain('下次建议：小幅推进。');
    expect(text).toContain('卧推');
    expect(text).toContain('完成稳定，下次小幅加重。');
    expect(text).toContain('140 lb × 8');
  });

  it('hides stale and edit-mode recommendations', () => {
    const selected = makeHistorySession('selected-session');
    const stale = makeRecommendation('other-session');

    expect(
      renderRecordText({
        history: [selected, makeHistorySession('other-session')],
        selectedSessionId: selected.id,
        recommendation: stale,
      }),
    ).not.toContain('下次建议：小幅推进。');
    expect(shouldShowPostWorkoutNextTimeRecommendation(selected, stale, false)).toBe(false);
    expect(shouldShowPostWorkoutNextTimeRecommendation(selected, makeRecommendation(selected.id), true)).toBe(false);
  });

  it('keeps internals and durable actions out of visible copy', () => {
    const text = visibleText(
      React.createElement(PostWorkoutNextTimeRecommendationCard, {
        recommendation: makeRecommendation(),
        unitSettings,
      }),
    );
    const forbidden = [
      'strong_completion',
      'debug_risk_should_stay_hidden',
      'increase_load',
      'sourceEngineIds',
      '应用到计划',
      '生成计划',
      '自动套用',
      '修改下次训练',
      '保存建议',
      '同步建议',
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
    ];

    for (const token of forbidden) {
      expect(text).not.toContain(token);
    }
  });

  it('formats prescription load and reps using current unit settings', () => {
    expect(formatPostWorkoutNextTimePrescription(makeRecommendation().recommendations[0], unitSettings)).toBe('140 lb × 8');
    expect(
      formatPostWorkoutNextTimePrescription(makeRecommendation().recommendations[0], {
        ...unitSettings,
        weightUnit: 'kg',
      }),
    ).toBe('63.5 kg × 8');
  });

  it('keeps visible history frequency helper copy away from forbidden technical wording', () => {
    const source = readFileSync('src/uiOs/history/HistoryFrequencySummary.tsx', 'utf8');

    expect(source).toContain('用于观察节奏，不改变训练安排');
    expect(source).not.toContain('用于观察节奏，不参与算法');
  });
});
