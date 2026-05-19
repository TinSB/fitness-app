import { describe, expect, it } from 'vitest';
import { buildTodayDecisionSurface } from '../src/engines/todayDecisionSurface';

describe('Today decision surface model', () => {
  it('resolves normal recommendation to train_recommended with start today action', () => {
    const result = buildTodayDecisionSurface({ recommendedFocus: '腿 A', sourceOfTruthClear: true });

    expect(result.decisionState).toBe('train_recommended');
    expect(result.primaryActionLabel).toBe('开始今天训练');
    expect(result.heroTitle).toContain('腿 A');
  });

  it('resolves conservative readiness without changing source of truth or algorithms', () => {
    const result = buildTodayDecisionSurface({ recommendedFocus: '胸', readinessState: 'conservative', fatigueState: 'high' });

    expect(result.decisionState).toBe('train_conservative');
    expect(result.heroTitle).toContain('保守训练');
    expect(result.sourceOfTruthChanged).toBe(false);
    expect(result.trainingAlgorithmChanged).toBe(false);
  });

  it('resolves recovery state to recovery_recommended', () => {
    const result = buildTodayDecisionSurface({ recommendedFocus: '恢复', readinessState: 'recovery', existingPrimaryActionLabel: '查看恢复建议' });

    expect(result.decisionState).toBe('recovery_recommended');
    expect(result.primaryActionLabel).toBe('查看恢复建议');
  });

  it('resolves unfinished session to continue_unfinished and continue training', () => {
    const result = buildTodayDecisionSurface({ recommendedFocus: '当前训练', hasUnfinishedSession: true });

    expect(result.decisionState).toBe('continue_unfinished');
    expect(result.primaryActionLabel).toBe('继续训练');
  });

  it('resolves severe data health blocker without full diagnostics', () => {
    const result = buildTodayDecisionSurface({
      recommendedFocus: '背',
      severeDataHealthBlocker: { title: '历史 Summary 与组记录不一致', message: '先复查严重记录。' },
    });

    expect(result.decisionState).toBe('blocked_by_severe_risk');
    expect(result.primaryActionLabel).toBe('查看严重问题');
    expect(result.showDataHealthSummary).toBe(true);
    expect(result.showFullDiagnostics).toBe(false);
  });

  it('resolves unclear source to local mode action', () => {
    const result = buildTodayDecisionSurface({ recommendedFocus: '腿 A', sourceOfTruthClear: false });

    expect(result.decisionState).toBe('source_unclear');
    expect(result.primaryActionLabel).toBe('回到本地模式');
    expect(result.heroExplanation).not.toContain('云端同步');
  });

  it('resolves missing plan safely', () => {
    const result = buildTodayDecisionSurface({ recommendedFocus: '', noPlanAvailable: true });

    expect(result.decisionState).toBe('no_plan_available');
    expect(result.primaryActionLabel).toBe('查看计划');
  });
});
