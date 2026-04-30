import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Training Intelligence UI wiring', () => {
  const appSource = read('src/App.tsx');
  const todaySource = read('src/features/TodayView.tsx');
  const recordSource = read('src/features/RecordView.tsx');
  const planSource = read('src/features/PlanView.tsx');
  const trainingSource = read('src/features/TrainingView.tsx');

  it('passes the shared training intelligence summary to lightweight surfaces', () => {
    expect(appSource).toContain('buildTrainingIntelligenceSummary');
    expect(appSource).toContain('trainingIntelligenceSummary={trainingIntelligenceSummary}');
    expect(todaySource).toContain('trainingIntelligenceSummary?: TrainingIntelligenceSummary');
    expect(planSource).toContain('trainingIntelligenceSummary?: TrainingIntelligenceSummary');
    expect(recordSource).toContain('trainingIntelligenceSummary?: TrainingIntelligenceSummary');
  });

  it('shows session quality in completion summary and history detail', () => {
    expect(trainingSource).toContain('buildSessionQualityResult');
    expect(trainingSource).toContain('完成总结');
    expect(trainingSource).toContain('下次建议');
    expect(recordSource).toContain('buildSessionQualityResult');
    expect(recordSource).toContain('训练质量');
    expect(recordSource).toContain('已修正');
  });

  it('shows concise recommendation confidence on Today without taking over the first screen', () => {
    expect(todaySource).toContain('推荐置信度');
    expect(todaySource).toContain('推荐可信度偏低');
    expect(todaySource).toContain('建议保守参考');
    expect(todaySource).toContain("recommendationConfidence?.level === 'low'");
  });

  it('shows plateau hints in Record detail without changing training records', () => {
    expect(recordSource).toContain('detectExercisePlateau');
    expect(recordSource).toContain('平台期提示');
    expect(recordSource).toContain('primaryPlateau.summary');
    expect(recordSource).not.toContain('onEditSession?.(primaryPlateau');
    expect(recordSource).not.toContain('markSessionEdited(primaryPlateau');
  });

  it('shows volume adaptation as a plan suggestion instead of automatic plan mutation', () => {
    expect(planSource).toContain('volumeAdaptation: trainingIntelligenceSummary?.volumeAdaptation');
    expect(planSource).toContain('待处理建议');
    expect(planSource).toContain('同类建议已合并显示');
    expect(planSource).toContain('生成草案前不会修改当前计划');
    expect(planSource).not.toContain('volumeAdaptationItems');
    expect(planSource).not.toContain('applyAdjustmentDraft(');
  });

  it('keeps added visible copy Chinese and avoids raw enum words', () => {
    const visibleCopy = [
      '推荐置信度',
      '推荐可信度偏低',
      '建议保守参考，继续记录后会更稳定。',
      '完成总结',
      '保存前先看本次训练质量；这里不会自动改计划。',
      '训练质量',
      '平台期提示',
      '待处理建议',
      '同类建议已合并显示，生成草案前不会修改当前计划。',
      '查看肌群详情',
      '查看全部建议',
    ].join('\n');

    expect(visibleCopy).not.toMatch(/\b(undefined|null|low|medium|high|increase|maintain|decrease|hold|plateau|raw enum)\b/i);
    expect(visibleCopy).toMatch(/[推荐训练质量调整记录]/);
  });
});
