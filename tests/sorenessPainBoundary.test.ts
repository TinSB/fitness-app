import { describe, expect, it } from 'vitest';
import { buildRecommendationTrace } from '../src/engines/recommendationTraceEngine';
import { buildRecommendationExplanationViewModel } from '../src/presenters/recommendationExplanationPresenter';
import { todayKey } from '../src/engines/engineUtils';
import { getTemplate, makeAppData, makeSession, makeStatus } from './fixtures';

const allFactors = (trace: ReturnType<typeof buildRecommendationTrace>) => [
  ...trace.globalFactors,
  ...trace.volumeFactors,
  ...trace.loadFeedbackFactors,
  ...Object.values(trace.exerciseFactors).flat(),
];

describe('soreness, pain pattern, and screening signal boundaries', () => {
  it('keeps Today soreness separate from historical pain patterns', () => {
    const trace = buildRecommendationTrace({
      ...makeAppData({
        todayStatus: makeStatus({ date: todayKey(), soreness: ['背'] }),
      }),
      template: getTemplate('pull-a'),
    });

    expect(allFactors(trace).some((factor) => factor.source === 'recoveryConflict' || factor.source === 'soreness')).toBe(true);
    expect(allFactors(trace).some((factor) => factor.source === 'painPattern')).toBe(false);
  });

  it('uses painPattern only for true painFlag history', () => {
    const trace = buildRecommendationTrace({
      ...makeAppData({
        todayStatus: makeStatus({ date: todayKey(), soreness: ['无'] }),
        history: [
          makeSession({
            id: 'recent-pain',
            date: todayKey(),
            templateId: 'pull-a',
            exerciseId: 'lat-pulldown',
            setSpecs: [{ weight: 60, reps: 8, painFlag: true, painArea: '背', painSeverity: 4 }],
          }),
        ],
      }),
      template: getTemplate('pull-a'),
    });

    expect(allFactors(trace).some((factor) => factor.source === 'painPattern')).toBe(true);
  });

  it('uses screeningRestriction for screening and contraindication warnings', () => {
    const data = makeAppData({
      selectedTemplateId: 'pull-a',
      todayStatus: makeStatus({ date: todayKey(), soreness: ['无'] }),
    });
    const trace = buildRecommendationTrace({
      ...data,
      screeningProfile: {
        ...data.screeningProfile,
        correctionPriority: ['scapular_control'],
        adaptiveState: {
          ...data.screeningProfile.adaptiveState,
          issueScores: { ...(data.screeningProfile.adaptiveState?.issueScores || {}), scapular_control: 4 },
        },
      },
      template: getTemplate('pull-a'),
    });
    const vm = buildRecommendationExplanationViewModel(trace);
    const text = [vm.summary, ...vm.primaryFactors.flatMap((factor) => [factor.label, factor.reason])].join(' ');

    expect(allFactors(trace).some((factor) => factor.source === 'screeningRestriction')).toBe(true);
    expect(text).toContain('限制提醒');
    expect(text).not.toContain('不适信号');
    expect(text).not.toContain('与当前限制问题冲突');
  });
});
