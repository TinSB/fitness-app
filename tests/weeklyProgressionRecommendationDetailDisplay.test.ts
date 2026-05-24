import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlateauDetectionResult } from '../src/engines/plateauDetectionEngine';
import type { RecommendationConfidenceResult } from '../src/engines/recommendationConfidenceEngine';
import type { WeeklyProgressionRecommendation } from '../src/engines/weeklyProgressionRecommendationEngine';
import { buildWeeklyProgressionRecommendation } from '../src/engines/weeklyProgressionRecommendationEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import type { PainPattern } from '../src/models/training-model';
import { WeeklyProgressionRecommendationCard } from '../src/uiOs/progress/WeeklyProgressionRecommendationCard';

const nowIso = '2026-05-23T12:00:00.000Z';

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderWeeklyText = (recommendation: WeeklyProgressionRecommendation) =>
  visibleText(React.createElement(WeeklyProgressionRecommendationCard, { recommendation }));

const volumeReport = (
  decision: VolumeAdaptationReport['muscles'][number]['decision'],
  overrides: Partial<VolumeAdaptationReport['muscles'][number]> = {},
): VolumeAdaptationReport => ({
  summary: '训练量建议',
  muscles: [
    {
      muscleId: 'back',
      decision,
      setsDelta: decision === 'increase' ? 1 : decision === 'decrease' ? -1 : 0,
      title: '背：训练量建议',
      reason: '近期训练量信号稳定。',
      confidence: 'high',
      suggestedActions: [],
      ...overrides,
    },
  ],
});

const plateau = (
  status: PlateauDetectionResult['status'],
  overrides: Partial<PlateauDetectionResult> = {},
): PlateauDetectionResult => ({
  exerciseId: 'bench-press',
  status,
  title: '卧推：进展复查',
  summary: '卧推需要复查。',
  signals: [],
  suggestedActions: [],
  confidence: 'high',
  ...overrides,
});

const confidence = (level: RecommendationConfidenceResult['level']): RecommendationConfidenceResult => ({
  level,
  score: level === 'high' ? 88 : level === 'medium' ? 62 : 35,
  title: '可信度',
  summary: '记录可信度',
  reasons: [],
  missingData: [],
});

const painPattern = (overrides: Partial<PainPattern> = {}): PainPattern => ({
  area: 'back',
  frequency: 3,
  severityAvg: 4,
  lastOccurredAt: '2026-05-22',
  suggestedAction: 'deload',
  ...overrides,
});

describe('weekly recommendation explanation display', () => {
  it('renders compact passive detail labels for each weekly item', () => {
    const recommendation = buildWeeklyProgressionRecommendation({
      volumeAdaptation: volumeReport('increase'),
      weekId: '2026-W21',
      nowIso,
    });
    const text = renderWeeklyText(recommendation);

    expect(text).toContain('查看原因');
    expect(text).toContain('依据');
    expect(text).toContain('注意');
    expect(text).toContain('下一步');
    expect(text).toContain('置信度高');
    expect(text).toContain('风险较低');
  });

  it('maps weekly reason signals to clean product copy', () => {
    expect(
      renderWeeklyText(
        buildWeeklyProgressionRecommendation({
          volumeAdaptation: volumeReport('increase'),
          weekId: '2026-W21',
          nowIso,
        }),
      ),
    ).toContain('近期完成度支持小幅推进。');

    expect(
      renderWeeklyText(
        buildWeeklyProgressionRecommendation({
          volumeAdaptation: volumeReport('decrease'),
          weekId: '2026-W21',
          nowIso,
        }),
      ),
    ).toContain('近期压力偏高，先控制训练量。');

    expect(
      renderWeeklyText(
        buildWeeklyProgressionRecommendation({
          plateauResults: [plateau('plateau')],
          weekId: '2026-W21',
          nowIso,
        }),
      ),
    ).toContain('近期进展停滞，先复查动作历史。');

    expect(
      renderWeeklyText(
        buildWeeklyProgressionRecommendation({
          recommendationConfidence: [confidence('low')],
          weekId: '2026-W21',
          nowIso,
        }),
      ),
    ).toContain('可用记录还不够稳定。');
  });

  it('maps technique and pain risks without exposing raw risk flags', () => {
    const techniqueText = renderWeeklyText(
      buildWeeklyProgressionRecommendation({
        plateauResults: [plateau('technique_limited')],
        weekId: '2026-W21',
        nowIso,
      }),
    );
    const painText = renderWeeklyText(
      buildWeeklyProgressionRecommendation({
        painPatterns: [painPattern()],
        weekId: '2026-W21',
        nowIso,
      }),
    );

    expect(techniqueText).toContain('动作质量需要优先稳定。');
    expect(painText).toContain('有不适记录，暂不建议直接推进。');
  });

  it('uses clean suggested actions before passive fallback next-step copy', () => {
    const withSuggestedActions = buildWeeklyProgressionRecommendation({
      volumeAdaptation: volumeReport('increase'),
      weekId: '2026-W21',
      nowIso,
    });
    expect(renderWeeklyText(withSuggestedActions)).toContain('只生成候选，不改变计划。');

    const withoutSuggestedActions: WeeklyProgressionRecommendation = {
      ...withSuggestedActions,
      items: withSuggestedActions.items.map((item) => ({
        ...item,
        suggestedActions: [],
        guardedRecommendation: item.guardedRecommendation
          ? {
              ...item.guardedRecommendation,
              preview: {
                ...item.guardedRecommendation.preview,
                summary: '',
                after: '',
              },
            }
          : item.guardedRecommendation,
      })),
    };

    expect(renderWeeklyText(withoutSuggestedActions)).toContain('查看后再决定。');
  });

  it('does not expose raw signals, enum values, internal ids, or durable action wording', () => {
    const recommendation = buildWeeklyProgressionRecommendation({
      volumeAdaptation: volumeReport('increase'),
      plateauResults: [plateau('technique_limited')],
      painPatterns: [painPattern({ exerciseId: 'bench-press' })],
      recommendationConfidence: [confidence('low')],
      weekId: '2026-W21',
      nowIso,
    });
    const text = renderWeeklyText(recommendation);
    const forbidden = [
      'volume_increase',
      'volume_decrease',
      'pain_risk',
      'pain_pattern',
      'riskFlags',
      'reasonCodes',
      'blockedReasons',
      'progress',
      'maintain',
      'conservative_progress',
      'queue_plan_adjustment',
      'review_exercise',
      'weekly-progression',
      'sourceEngineIds',
      'sourceFingerprint',
      'durableEffect',
      '应用到计划',
      '生成计划',
      '生成草案',
      '应用为实验模板',
      '保存建议',
      '同步建议',
      '自动调整',
      '自动应用',
      '自动生成计划',
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
});
