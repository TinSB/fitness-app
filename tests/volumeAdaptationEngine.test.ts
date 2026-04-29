import { describe, expect, it } from 'vitest';
import { buildVolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import type { AdherenceReport, MuscleVolumeDashboardRow, PainPattern } from '../src/models/training-model';
import type { SessionQualityResult } from '../src/engines/sessionQualityEngine';

const row = (overrides: Partial<MuscleVolumeDashboardRow> & { muscleId: string }): MuscleVolumeDashboardRow => ({
  muscleId: overrides.muscleId,
  muscleName: overrides.muscleName || overrides.muscleId,
  targetSets: overrides.targetSets ?? 10,
  completedSets: overrides.completedSets ?? 9,
  effectiveSets: overrides.effectiveSets ?? 8,
  highConfidenceEffectiveSets: overrides.highConfidenceEffectiveSets ?? 7,
  weightedEffectiveSets: overrides.weightedEffectiveSets ?? 8,
  remainingSets: overrides.remainingSets ?? Math.max(0, (overrides.targetSets ?? 10) - (overrides.weightedEffectiveSets ?? 8)),
  status: overrides.status || 'near_target',
  notes: overrides.notes || [],
});

const adherence = (overrides: Partial<AdherenceReport> = {}): AdherenceReport => ({
  recentSessionCount: 5,
  plannedSets: 40,
  actualSets: 36,
  overallRate: 90,
  mainlineRate: 92,
  recentSessions: [],
  skippedExercises: [],
  skippedSupportExercises: [],
  suggestions: [],
  confidence: 'high',
  ...overrides,
});

const quality = (level: SessionQualityResult['level'] = 'high'): SessionQualityResult => ({
  level,
  score: level === 'high' ? 88 : level === 'medium' ? 70 : 45,
  title: '本次训练质量',
  summary: '训练质量稳定',
  positives: [],
  issues: [],
  nextSuggestions: [],
  confidence: 'high',
});

const visibleText = (report: ReturnType<typeof buildVolumeAdaptationReport>) =>
  [
    report.summary,
    ...report.muscles.flatMap((item) => [item.title, item.reason, ...item.suggestedActions]),
  ].join('\n');

describe('volumeAdaptationEngine', () => {
  it('increases back volume when it is below target and completion is good', () => {
    const report = buildVolumeAdaptationReport({
      weeklyVolumeSummary: [
        row({
          muscleId: '背',
          muscleName: '背部',
          targetSets: 12,
          completedSets: 10,
          effectiveSets: 8,
          highConfidenceEffectiveSets: 7,
          weightedEffectiveSets: 6,
          remainingSets: 6,
          status: 'low',
        }),
      ],
      adherenceReport: adherence(),
      sessionQualityResults: [quality('high'), quality('medium')],
      trainingLevel: 'intermediate',
    });

    expect(report.muscles[0].decision).toBe('increase');
    expect(report.muscles[0].setsDelta).toBeGreaterThan(0);
    expect(report.muscles[0].setsDelta).toBeLessThanOrEqual(2);
    expect(report.muscles[0].reason).toContain('小幅加量');
  });

  it('maintains chest volume when effective sets are near target', () => {
    const report = buildVolumeAdaptationReport({
      weeklyVolumeSummary: [
        row({
          muscleId: '胸',
          muscleName: '胸部',
          targetSets: 10,
          weightedEffectiveSets: 10,
          status: 'on_target',
        }),
      ],
      adherenceReport: adherence(),
      sessionQualityResults: [quality('high')],
      trainingLevel: 'intermediate',
    });

    expect(report.muscles[0].decision).toBe('maintain');
    expect(report.muscles[0].setsDelta).toBe(0);
    expect(report.muscles[0].title).toContain('维持');
  });

  it('decreases leg volume when pain or low completion appears', () => {
    const painPattern: PainPattern = {
      area: '腿部',
      frequency: 3,
      severityAvg: 4,
      lastOccurredAt: '2026-04-28',
      suggestedAction: 'deload',
    };

    const report = buildVolumeAdaptationReport({
      weeklyVolumeSummary: [
        row({
          muscleId: '腿',
          muscleName: '腿部',
          targetSets: 12,
          completedSets: 7,
          weightedEffectiveSets: 9,
          status: 'near_target',
        }),
      ],
      adherenceReport: adherence({ overallRate: 58, mainlineRate: 60 }),
      painPatterns: [painPattern],
      sessionQualityResults: [quality('medium')],
      trainingLevel: 'intermediate',
    });

    expect(report.muscles[0].decision).toBe('decrease');
    expect(report.muscles[0].setsDelta).toBeLessThan(0);
    expect(report.muscles[0].setsDelta).toBeGreaterThanOrEqual(-2);
    expect(visibleText(report)).toContain('不适');
  });

  it('returns insufficient_data when a muscle has no usable volume evidence', () => {
    const report = buildVolumeAdaptationReport({
      weeklyVolumeSummary: [
        row({
          muscleId: '肩',
          muscleName: '肩部',
          targetSets: 0,
          completedSets: 0,
          effectiveSets: 0,
          highConfidenceEffectiveSets: 0,
          weightedEffectiveSets: 0,
          remainingSets: 0,
          status: 'low',
        }),
      ],
      adherenceReport: adherence({ recentSessionCount: 0, actualSets: 0, overallRate: 0, mainlineRate: 0 }),
      trainingLevel: 'intermediate',
    });

    expect(report.muscles[0].decision).toBe('insufficient_data');
    expect(report.muscles[0].confidence).toBe('low');
    expect(report.muscles[0].reason).toContain('记录还不够');
  });

  it('holds changes when training level is unknown', () => {
    const report = buildVolumeAdaptationReport({
      weeklyVolumeSummary: [
        row({
          muscleId: '背',
          muscleName: '背部',
          targetSets: 12,
          completedSets: 10,
          weightedEffectiveSets: 6,
          remainingSets: 6,
          status: 'low',
        }),
      ],
      adherenceReport: adherence(),
      sessionQualityResults: [quality('high')],
      trainingLevel: 'unknown',
    });

    expect(report.muscles[0].decision).toBe('hold');
    expect(report.muscles[0].setsDelta).toBe(0);
    expect(report.muscles[0].reason).toContain('训练基线');
  });

  it('keeps setsDelta within the conservative safety range', () => {
    const report = buildVolumeAdaptationReport({
      weeklyVolumeSummary: [
        row({
          muscleId: '背',
          muscleName: '背部',
          targetSets: 18,
          weightedEffectiveSets: 2,
          remainingSets: 16,
          status: 'low',
        }),
        row({
          muscleId: '胸',
          muscleName: '胸部',
          targetSets: 8,
          weightedEffectiveSets: 14,
          remainingSets: 0,
          status: 'high',
        }),
      ],
      adherenceReport: adherence(),
      sessionQualityResults: [quality('high')],
      trainingLevel: 'intermediate',
    });

    const deltas = report.muscles.map((item) => item.setsDelta).filter((value): value is number => typeof value === 'number');

    expect(deltas.every((delta) => Math.abs(delta) <= 2)).toBe(true);
    expect(report.muscles.find((item) => item.muscleId === '背')?.setsDelta).toBe(2);
    expect(report.muscles.find((item) => item.muscleId === '胸')?.setsDelta).toBeGreaterThanOrEqual(-2);
  });

  it('uses effectiveSetSummary by muscle without changing effective set principles', () => {
    const report = buildVolumeAdaptationReport({
      weeklyVolumeSummary: [
        row({
          muscleId: '背',
          muscleName: '背部',
          targetSets: 12,
          completedSets: 0,
          effectiveSets: 0,
          highConfidenceEffectiveSets: 0,
          weightedEffectiveSets: 0,
          remainingSets: 12,
          status: 'low',
        }),
      ],
      effectiveSetSummary: {
        completedSets: 10,
        effectiveSets: 8,
        highConfidenceEffectiveSets: 7,
        byMuscle: {
          背: {
            completedSets: 10,
            effectiveSets: 8,
            highConfidenceEffectiveSets: 7,
            mediumConfidenceEffectiveSets: 1,
            lowConfidenceEffectiveSets: 0,
            effectiveScore: 80,
            weightedEffectiveSets: 8,
            highConfidenceWeightedSets: 7,
          },
        },
      },
      adherenceReport: adherence(),
      sessionQualityResults: [quality('high')],
      trainingLevel: 'intermediate',
    });

    expect(report.muscles[0].decision).toBe('increase');
    expect(report.muscles[0].reason).toContain('8/12');
  });

  it('keeps visible output Chinese and avoids raw enum leakage', () => {
    const report = buildVolumeAdaptationReport({
      weeklyVolumeSummary: [
        row({
          muscleId: '背',
          muscleName: '背部',
          targetSets: 12,
          weightedEffectiveSets: 6,
          remainingSets: 6,
          status: 'low',
        }),
      ],
      adherenceReport: adherence(),
      loadFeedback: {
        total: 2,
        counts: { too_light: 0, good: 2, too_heavy: 0 },
        dominantFeedback: 'good',
        adjustment: { direction: 'normal', dominantFeedback: 'good', reasons: ['测试'] },
      },
      sessionQualityResults: [quality('high')],
      trainingLevel: 'intermediate',
    });
    const text = visibleText(report);

    expect(text).not.toMatch(/\b(increase|maintain|decrease|hold|insufficient_data|low|medium|high|too_heavy|too_light|good|undefined|null)\b/i);
    expect(text).toMatch(/[训练量建议增加维持减少]/);
  });
});
