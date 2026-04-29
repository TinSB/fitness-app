import { describe, expect, it } from 'vitest';
import { buildCoachActions } from '../src/engines/coachActionEngine';
import type { DataHealthReport } from '../src/engines/dataHealthEngine';
import type { DailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import type { NextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import type { PlateauDetectionResult } from '../src/engines/plateauDetectionEngine';
import type { RecommendationConfidenceResult } from '../src/engines/recommendationConfidenceEngine';
import type { RecoveryAwareRecommendation } from '../src/engines/recoveryAwareScheduler';
import type { SessionQualityResult } from '../src/engines/sessionQualityEngine';
import type { SetAnomaly } from '../src/engines/setAnomalyEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { makeAppData, makeSession } from './fixtures';

const now = '2026-04-29T12:00:00.000Z';

const visibleText = (actions: ReturnType<typeof buildCoachActions>) =>
  actions
    .flatMap((action) => [
      action.title,
      action.description,
      action.reason,
      action.confirmTitle || '',
      action.confirmDescription || '',
    ])
    .join('\n');

const expectNoRawVisibleText = (text: string) => {
  expect(text).not.toMatch(
    /\b(undefined|null|normal|conservative|rest_or_recovery|possible_plateau|plateau|increase|decrease|pending|applied|dismissed|expired|failed|high|medium|low|urgent)\b/,
  );
};

const dataHealthReport = (severity: 'info' | 'warning' | 'error' = 'error'): DataHealthReport => ({
  status: severity === 'error' ? 'has_errors' : 'has_warnings',
  summary: '数据健康检查发现需要复查的问题。',
  issues: [
    {
      id: 'summary-mismatch-session-1',
      severity,
      category: 'summary',
      title: '训练汇总可能过期',
      message: '某次训练的顶部汇总和组记录不一致，建议打开该记录确认。',
      affectedIds: ['session-1'],
      canAutoFix: false,
      suggestedAction: '查看训练详情',
    },
  ],
});

const dailyAdjustment: DailyTrainingAdjustment = {
  type: 'conservative',
  title: '保守训练',
  summary: '今天建议保守执行，不主动加量或冲重量。',
  reasons: ['准备度偏低，今天更适合降低训练压力。'],
  suggestedChanges: [{ type: 'reduce_volume', reason: '减少非必要辅助动作。' }],
  confidence: 'medium',
  requiresUserConfirmation: true,
};

const nextWorkout: NextWorkoutRecommendation = {
  kind: 'train',
  templateId: 'pull-a',
  templateName: '拉 A',
  confidence: 'high',
  reason: '推 A 已完成，下次按计划轮转到拉 A。',
  warnings: [],
  alternatives: [],
};

const volumeAdaptation: VolumeAdaptationReport = {
  summary: '下周训练量建议：背部可小幅增加。',
  muscles: [
    {
      muscleId: 'back',
      decision: 'increase',
      setsDelta: 1,
      title: '背部：增加训练量',
      reason: '背部有效组低于目标，但完成度和动作质量稳定。',
      confidence: 'medium',
      suggestedActions: ['下周只增加 1 组。'],
    },
  ],
};

const plateauResult: PlateauDetectionResult = {
  exerciseId: 'bench-press',
  status: 'possible_plateau',
  title: '卧推进展放缓',
  summary: '卧推近期多次训练没有明显进步，建议先查看动作历史。',
  signals: [{ id: 'flat', label: '进展放缓', reason: '近期重量和次数变化不明显。', severity: 'warning' }],
  suggestedActions: ['继续观察 1–2 次训练。'],
  confidence: 'medium',
};

const lowSessionQuality: SessionQualityResult = {
  level: 'low',
  score: 42,
  title: '本次训练质量：偏低',
  summary: '本次训练完成度偏低，建议复查关键记录。',
  positives: [],
  issues: [{ id: 'completion', label: '完成度不足', tone: 'negative', reason: '主训练完成组数偏少。' }],
  nextSuggestions: ['下次优先保证关键主训练完成。'],
  confidence: 'medium',
};

const lowConfidence: RecommendationConfidenceResult = {
  level: 'low',
  score: 36,
  title: '推荐可信度：低',
  summary: '这条推荐建议保守参考。',
  reasons: [{ id: 'history', label: '训练记录不足', effect: 'lower_confidence', reason: '同动作近期记录太少。' }],
  missingData: ['继续记录重量、次数、余力（RIR）和动作质量。'],
};

const setAnomaly: SetAnomaly = {
  id: 'weight-jump',
  severity: 'critical',
  title: '重量比近期记录高很多',
  message: '本组重量比上次同动作高出超过 50%，请确认不是输入错误。',
  suggestedAction: '确认重量和单位后再保存。',
  requiresConfirmation: true,
};

const recoveryRecommendation: RecoveryAwareRecommendation = {
  kind: 'modified_train',
  templateId: 'legs-a',
  templateName: '腿 A',
  title: '今日建议：腿 A（保守版）',
  summary: '背部酸痛与罗马尼亚硬拉冲突较高，建议腿 A 保守版。',
  conflictLevel: 'moderate',
  affectedAreas: ['背部'],
  reasons: ['背部酸痛与腿 A 中的罗马尼亚硬拉冲突较高。'],
  suggestedChanges: [{ type: 'substitute', target: 'romanian-deadlift', reason: '优先考虑低冲突替代动作。' }],
  requiresConfirmationToOverride: true,
};

describe('coachActionEngine', () => {
  it('converts data health errors into high priority actions', () => {
    const actions = buildCoachActions({
      appData: makeAppData(),
      dataHealthReport: dataHealthReport('error'),
      now,
    });

    expect(actions[0]).toMatchObject({
      source: 'dataHealth',
      actionType: 'open_data_health',
      priority: 'urgent',
      requiresConfirmation: false,
      targetId: 'session-1',
    });
    expect(actions[0].title).toContain('数据健康');
  });

  it('converts daily adjustment into a temporary session adjustment action', () => {
    const actions = buildCoachActions({
      appData: makeAppData(),
      dailyAdjustment,
      now,
    });

    expect(actions[0]).toMatchObject({
      source: 'dailyAdjustment',
      actionType: 'apply_temporary_session_adjustment',
      priority: 'medium',
      requiresConfirmation: true,
      reversible: true,
      status: 'pending',
    });
    expect(actions[0].confirmDescription).toContain('不会修改原训练模板');
  });

  it('converts volume adaptation into a plan adjustment preview action', () => {
    const actions = buildCoachActions({
      appData: makeAppData(),
      volumeAdaptation,
      now,
    });

    const preview = actions.find((action) => action.actionType === 'create_plan_adjustment_preview');
    expect(preview).toMatchObject({
      source: 'volumeAdaptation',
      priority: 'medium',
      requiresConfirmation: true,
      reversible: true,
      targetId: 'back',
      targetType: 'muscle',
    });
    expect(preview?.confirmDescription).toContain('不会自动覆盖当前训练计划');
  });

  it('converts plateau findings into review exercise actions', () => {
    const actions = buildCoachActions({
      appData: makeAppData(),
      plateauResults: [plateauResult],
      now,
    });

    expect(actions[0]).toMatchObject({
      source: 'plateau',
      actionType: 'review_exercise',
      targetId: 'bench-press',
      targetType: 'exercise',
      requiresConfirmation: false,
    });
    expect(actions[0].description).toContain('卧推');
  });

  it('keeps active sessions low-noise and avoids non-current coach actions', () => {
    const activeSession = {
      ...makeSession({
        id: 'active-push',
        date: '2026-04-29',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 80, reps: 6 }],
      }),
      completed: false,
    };
    const actions = buildCoachActions({
      appData: makeAppData({ activeSession }),
      dataHealthReport: dataHealthReport('error'),
      dailyAdjustment,
      nextWorkout,
      volumeAdaptation,
      plateauResults: [plateauResult],
      setAnomalies: [setAnomaly],
      now,
    });

    expect(actions.length).toBeLessThanOrEqual(2);
    expect(actions.map((action) => action.source)).toEqual(['dataHealth', 'setAnomaly']);
    expect(actions.some((action) => action.source === 'dailyAdjustment')).toBe(false);
    expect(actions.some((action) => action.source === 'nextWorkout')).toBe(false);
    expect(actions.some((action) => action.source === 'volumeAdaptation')).toBe(false);
  });

  it('converts next workout, session quality, set anomaly, recovery, and confidence inputs', () => {
    const actions = buildCoachActions({
      appData: makeAppData(),
      nextWorkout,
      sessionQuality: lowSessionQuality,
      setAnomalies: [setAnomaly],
      recoveryRecommendation,
      recommendationConfidence: lowConfidence,
      now,
    });

    expect(actions.some((action) => action.source === 'nextWorkout' && action.actionType === 'open_next_workout')).toBe(true);
    expect(actions.some((action) => action.source === 'sessionQuality' && action.actionType === 'review_session')).toBe(true);
    expect(actions.some((action) => action.source === 'setAnomaly' && action.requiresConfirmation)).toBe(true);
    expect(actions.some((action) => action.source === 'recovery' && action.actionType === 'apply_temporary_session_adjustment')).toBe(true);
    expect(actions.some((action) => action.source === 'recommendationConfidence' && action.actionType === 'keep_observing')).toBe(true);
  });

  it('does not mutate AppData', () => {
    const data = makeAppData({
      history: [
        makeSession({
          id: 'history-push',
          date: '2026-04-28',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 6 }],
        }),
      ],
    });
    const before = JSON.stringify(data);

    buildCoachActions({
      appData: data,
      dataHealthReport: dataHealthReport('error'),
      dailyAdjustment,
      nextWorkout,
      volumeAdaptation,
      plateauResults: [plateauResult],
      sessionQuality: lowSessionQuality,
      now,
    });

    expect(JSON.stringify(data)).toBe(before);
  });

  it('keeps action visible copy Chinese without raw enum, undefined, or null', () => {
    const actions = buildCoachActions({
      appData: makeAppData(),
      dataHealthReport: dataHealthReport('error'),
      dailyAdjustment,
      nextWorkout,
      volumeAdaptation,
      plateauResults: [plateauResult],
      sessionQuality: lowSessionQuality,
      recommendationConfidence: lowConfidence,
      setAnomalies: [setAnomaly],
      recoveryRecommendation,
      now,
    });
    const text = visibleText(actions);

    expect(text).toMatch(/[一-龥]/);
    expectNoRawVisibleText(text);
  });
});
