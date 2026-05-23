import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyGuardedRecommendationApplySafety } from '../src/engines/guardedRecommendationContractEngine';
import type { LoadFeedbackSummary } from '../src/engines/loadFeedbackEngine';
import type { PlateauDetectionResult } from '../src/engines/plateauDetectionEngine';
import type { RecommendationConfidenceResult } from '../src/engines/recommendationConfidenceEngine';
import type { SessionQualityResult } from '../src/engines/sessionQualityEngine';
import type { TrainingIntelligenceSummary } from '../src/engines/trainingIntelligenceSummaryEngine';
import {
  buildWeeklyProgressionRecommendation,
  normalizeWeeklyProgressionRecommendationToGuardedRecommendations,
} from '../src/engines/weeklyProgressionRecommendationEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import type { AppData, PainPattern } from '../src/models/training-model';
import { makeAppData } from './fixtures';

const nowIso = '2026-05-23T12:00:00.000Z';
const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const volume = (decision: VolumeAdaptationReport['muscles'][number]['decision'], overrides: Partial<VolumeAdaptationReport['muscles'][number]> = {}): VolumeAdaptationReport => ({
  summary: '训练量建议',
  muscles: [
    {
      muscleId: 'back',
      decision,
      setsDelta: decision === 'increase' ? 1 : decision === 'decrease' ? -1 : 0,
      title: '背：训练量建议',
      reason: '本周训练量信号稳定。',
      confidence: 'high',
      suggestedActions: [],
      ...overrides,
    },
  ],
});

const plateau = (status: PlateauDetectionResult['status'], overrides: Partial<PlateauDetectionResult> = {}): PlateauDetectionResult => ({
  exerciseId: 'bench-press',
  status,
  title: '卧推：进展复查',
  summary: '卧推需要复查。',
  signals: [],
  suggestedActions: [],
  confidence: 'high',
  ...overrides,
});

const confidence = (
  level: RecommendationConfidenceResult['level'],
  overrides: Partial<RecommendationConfidenceResult & { exerciseId?: string }> = {},
): RecommendationConfidenceResult =>
  ({
    level,
    score: level === 'high' ? 88 : level === 'medium' ? 62 : 35,
    title: '可信度',
    summary: '记录可信度',
    reasons: [],
    missingData: [],
    ...overrides,
  }) as RecommendationConfidenceResult;

const quality = (level: SessionQualityResult['level']): SessionQualityResult => ({
  level,
  score: level === 'high' ? 90 : level === 'medium' ? 70 : level === 'low' ? 40 : 0,
  title: '训练质量',
  summary: '训练质量记录',
  positives: [],
  issues: [],
  nextSuggestions: [],
  confidence: level === 'insufficient_data' ? 'low' : 'high',
});

const pain = (overrides: Partial<PainPattern> = {}): PainPattern => ({
  area: 'back',
  frequency: 3,
  severityAvg: 4,
  lastOccurredAt: '2026-05-22',
  suggestedAction: 'deload',
  ...overrides,
});

const loadFeedback = (overrides: Partial<LoadFeedbackSummary> = {}): LoadFeedbackSummary => ({
  exerciseId: 'bench-press',
  total: 3,
  counts: { too_light: 0, good: 0, too_heavy: 3 },
  dominantFeedback: 'too_heavy',
  adjustment: { direction: 'conservative', dominantFeedback: 'too_heavy', reasons: ['偏重'] },
  ...overrides,
});

const visibleText = (result: ReturnType<typeof buildWeeklyProgressionRecommendation>) =>
  [
    result.title,
    result.summary,
    ...result.items.flatMap((item) => [
      item.title,
      item.summary,
      item.userMessage,
      ...item.suggestedActions,
      item.guardedRecommendation?.title,
      item.guardedRecommendation?.summary,
      item.guardedRecommendation?.userMessage,
      item.guardedRecommendation?.preview.title,
      item.guardedRecommendation?.preview.summary,
      item.guardedRecommendation?.preview.after,
    ]),
  ]
    .filter(Boolean)
    .join(' ');

describe('weeklyProgressionRecommendationEngine', () => {
  it('returns insufficient data guidance when weekly signals are absent', () => {
    const result = buildWeeklyProgressionRecommendation({ weekId: '2026-W21', nowIso });

    expect(result).toMatchObject({
      id: 'weekly-progression:2026-W21',
      scope: 'week',
      weekId: '2026-W21',
      title: '继续记录后再判断',
      summary: '继续记录后再判断。',
      confidence: 'low',
      riskLevel: 'low',
      createdAt: nowIso,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      recommendationKind: 'insufficient_data',
      actionType: 'keep_observing',
      title: '继续记录',
    });
  });

  it('creates a progress item with setsDelta for volume increases', () => {
    const result = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('increase', { setsDelta: 2 }),
    });

    const item = result.items[0];
    expect(item).toMatchObject({
      targetType: 'muscle',
      targetId: 'back',
      recommendationKind: 'progress',
      actionType: 'generate_plan_candidate',
      setsDelta: 2,
      title: '背 小幅加量',
      userMessage: '背 下周可小幅加量。',
    });
    expect(result.summary).toBe('下周可小幅推进。');
    expect(item.guardedRecommendation?.actionType).toBe('queue_plan_adjustment');
    expect(item.guardedRecommendation?.preview.summary).toBe('查看后再决定');
  });

  it('creates a conservative or deload item for volume decreases', () => {
    const result = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('decrease', { setsDelta: -2 }),
    });

    expect(result.items[0].recommendationKind).toBe('deload');
    expect(result.items[0].actionType).toBe('reduce_volume');
    expect(result.items[0].userMessage).toBe('背 下周先减少训练量。');
    expect(result.items[0].riskFlags).toContain('fatigue');
  });

  it('creates maintain and hold items from volume decisions', () => {
    const maintain = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('maintain'),
    });
    const hold = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('hold'),
    });

    expect(maintain.items[0]).toMatchObject({
      recommendationKind: 'maintain',
      actionType: 'keep_plan',
      userMessage: '背 下周维持。',
    });
    expect(hold.items[0]).toMatchObject({
      recommendationKind: 'conservative_progress',
      actionType: 'keep_observing',
      userMessage: '背 暂缓调整。',
    });
  });

  it('maps plateau and possible plateau to exercise review guidance', () => {
    const full = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      plateauResults: [plateau('plateau')],
    });
    const possible = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      plateauResults: [plateau('possible_plateau')],
    });

    expect(full.items[0]).toMatchObject({
      recommendationKind: 'review_exercise',
      actionType: 'review_exercise',
      userMessage: '卧推 近期停滞，先复查。',
    });
    expect(possible.items[0]).toMatchObject({
      recommendationKind: 'review_exercise',
      actionType: 'review_exercise',
      userMessage: '卧推 进展放缓，继续观察。',
    });
  });

  it('maps plateau limit statuses to conservative, technique, fatigue, and volume review guidance', () => {
    const cases = [
      ['load_too_aggressive', 'conservative_progress', 'review_exercise', 'load_too_aggressive', '卧推 不急于加重。'],
      ['technique_limited', 'technique_focus', 'review_technique', 'technique', '卧推 先稳住动作。'],
      ['fatigue_limited', 'conservative_progress', 'review_exercise', 'fatigue', '卧推 先控制疲劳。'],
      ['volume_limited', 'review_volume', 'review_volume', undefined, '卧推 先复查训练量。'],
    ] as const;

    for (const [status, kind, action, riskFlag, message] of cases) {
      const result = buildWeeklyProgressionRecommendation({
        weekId: '2026-W21',
        nowIso,
        plateauResults: [plateau(status)],
      });
      expect(result.items[0]).toMatchObject({
        recommendationKind: kind,
        actionType: action,
        userMessage: message,
      });
      if (riskFlag) expect(result.items[0].riskFlags).toContain(riskFlag);
    }
  });

  it('creates pain review and blocks volume increase for the same target', () => {
    const result = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('increase'),
      painPatterns: [pain({ area: 'back', suggestedAction: 'deload' })],
    });

    expect(result.items.some((item) => item.recommendationKind === 'progress')).toBe(false);
    expect(result.items[0]).toMatchObject({
      recommendationKind: 'pain_review',
      actionType: 'review_pain',
      userMessage: '有不适，先复查。',
      riskLevel: 'high',
    });
    expect(result.summary).toBe('本周先控制风险。');
  });

  it('downgrades low confidence and blocks plan candidates', () => {
    const result = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('increase'),
      recommendationConfidence: [confidence('low')],
    });

    expect(result.confidence).toBe('low');
    expect(result.blockedReasons).toContain('low_confidence');
    expect(result.items.some((item) => item.actionType === 'generate_plan_candidate')).toBe(false);
  });

  it('creates technique guidance from low session quality and blocks aggressive progression', () => {
    const result = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('increase'),
      sessionQuality: quality('low'),
    });

    expect(result.items.some((item) => item.recommendationKind === 'progress')).toBe(false);
    expect(result.items.some((item) => item.recommendationKind === 'technique_focus')).toBe(true);
    expect(result.blockedReasons).toContain('low_session_quality');
  });

  it('dedupes conflicting same-target items with conservative priority', () => {
    const result = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      plateauResults: [plateau('plateau', { exerciseId: 'bench-press' })],
      painPatterns: [pain({ area: 'shoulder', exerciseId: 'bench-press', suggestedAction: 'substitute' })],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].recommendationKind).toBe('pain_review');
  });

  it('normalizes every item to guarded recommendations with safe apply classification', () => {
    const result = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('increase'),
      plateauResults: [plateau('technique_limited')],
    });

    expect(result.items.every((item) => item.guardedRecommendation)).toBe(true);
    expect(normalizeWeeklyProgressionRecommendationToGuardedRecommendations(result)).toHaveLength(result.items.length);
    for (const contract of result.guardedRecommendations) {
      expect(contract.source).toBe('weekly_progression');
      expect(classifyGuardedRecommendationApplySafety(contract).canApplyDurably).toBe(false);
    }
  });

  it('keeps plan candidates non-durable under 18G and display-only previews non-durable', () => {
    const progress = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('increase'),
    }).items[0].guardedRecommendation!;
    const display = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('maintain'),
    }).items[0].guardedRecommendation!;

    expect(progress.actionType).toBe('queue_plan_adjustment');
    expect(progress.confirmationLevel).toBe('review_required');
    expect(progress.preview.durableEffect).toBe(true);
    expect(classifyGuardedRecommendationApplySafety(progress)).toMatchObject({
      canQueue: true,
      canApplyDurably: false,
      requiresReview: true,
    });
    expect(display.actionType).toBe('display_only');
    expect(display.preview.durableEffect).toBe(false);
    expect(classifyGuardedRecommendationApplySafety(display).canQueue).toBe(false);
  });

  it('does not create drafts, patches, or mutate AppData by behavior', () => {
    const appData: AppData = makeAppData();
    const before = JSON.stringify(appData);
    const result = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('increase'),
    });

    expect(JSON.stringify(appData)).toBe(before);
    expect(JSON.stringify(result)).not.toContain('ProgramAdjustmentDraft');
    expect(JSON.stringify(result)).not.toContain('PendingSessionPatch');
  });

  it('uses deterministic ids and createdAt when nowIso is provided', () => {
    const first = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('maintain'),
    });
    const second = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('maintain'),
    });

    expect(first.id).toBe('weekly-progression:2026-W21');
    expect(first.createdAt).toBe(nowIso);
    expect(first.items[0].id).toBe(second.items[0].id);
    expect(first.items[0].createdAt).toBe(nowIso);
  });

  it('does not mutate input objects', () => {
    const input = {
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('increase'),
      plateauResults: [plateau('plateau')],
      recommendationConfidence: [confidence('medium')],
      sessionQuality: quality('medium'),
      painPatterns: [pain({ suggestedAction: 'watch', severityAvg: 1, frequency: 1 })],
      loadFeedbackSummary: [loadFeedback({ counts: { too_light: 0, good: 3, too_heavy: 0 }, dominantFeedback: 'good', adjustment: { direction: 'normal', reasons: [] } })],
    };
    const before = JSON.stringify(input);

    buildWeeklyProgressionRecommendation(input);

    expect(JSON.stringify(input)).toBe(before);
  });

  it('uses training intelligence summary as fallback source', () => {
    const summary: TrainingIntelligenceSummary = {
      volumeAdaptation: volume('maintain'),
      plateauResults: [],
      recommendationConfidence: [],
      sessionQuality: undefined,
      keyInsights: [],
      recommendedActions: [],
    };

    const result = buildWeeklyProgressionRecommendation({ trainingIntelligenceSummary: summary, weekId: '2026-W21', nowIso });

    expect(result.items[0].recommendationKind).toBe('maintain');
  });

  it('builds concise summaries for risk, progress, maintain, and insufficient cases', () => {
    expect(
      buildWeeklyProgressionRecommendation({
        weekId: '2026-W21',
        nowIso,
        painPatterns: [pain()],
      }).summary,
    ).toBe('本周先控制风险。');
    expect(
      buildWeeklyProgressionRecommendation({
        weekId: '2026-W21',
        nowIso,
        volumeAdaptation: volume('increase'),
      }).summary,
    ).toBe('下周可小幅推进。');
    expect(
      buildWeeklyProgressionRecommendation({
        weekId: '2026-W21',
        nowIso,
        volumeAdaptation: volume('maintain'),
      }).summary,
    ).toBe('下周维持当前节奏。');
    expect(buildWeeklyProgressionRecommendation({ weekId: '2026-W21', nowIso }).summary).toBe('继续记录后再判断。');
  });

  it('keeps user-facing strings free of forbidden technical wording', () => {
    const result = buildWeeklyProgressionRecommendation({
      weekId: '2026-W21',
      nowIso,
      volumeAdaptation: volume('increase'),
      plateauResults: [plateau('technique_limited')],
      painPatterns: [pain({ area: 'shoulder', exerciseId: 'bench-press', suggestedAction: 'substitute' })],
      recommendationConfidence: [confidence('medium')],
    });
    const text = visibleText(result);

    for (const forbidden of [
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
      '智能判断',
      '系统建议',
      '算法推荐',
      '引擎判断',
      'AI 建议',
      '自动安排',
      '自动调整',
      '自动生成计划',
      '自动应用',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('keeps the pure engine isolated from UI, storage, API, and mutation helpers', () => {
    const source = read('src/engines/weeklyProgressionRecommendationEngine.ts');

    for (const forbidden of [
      'react',
      '../ui',
      '../uiOs',
      '../features',
      '../storage',
      '/storage',
      'localStorage',
      'devApi',
      'apps/api',
      'node:',
      'fetch(',
      'applySessionPatches',
      'upsertPendingSessionPatch',
      'upsertPlanAdjustmentDraftByFingerprint',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
