import { describe, expect, it } from 'vitest';
import {
  buildDailyTrainingUxView,
  getDailyTrainingActionCopy,
  getDailyTrainingUxCopy,
  type DailyTrainingUxAction,
  type DailyTrainingUxState,
} from '../src/personalProduction/dailyTrainingUxCopy';

const states: DailyTrainingUxState[] = [
  'local_first_ready',
  'no_active_session',
  'active_session_in_progress',
  'session_ready_to_complete',
  'session_completed',
  'session_discarded',
  'interrupted_unfinished_session',
  'recent_history_available',
  'empty_history',
  'local_data_unavailable',
  'backup_recommended_before_risky_action',
  'emergency_local_available',
  'cloud_candidate_paused',
  'source_of_truth_unclear',
  'owner_action_required',
  'recovery_action_recommended',
];

const actions: DailyTrainingUxAction[] = [
  'continue_local_training',
  'start_local_session',
  'continue_active_session',
  'review_before_complete',
  'review_local_history',
  'record_manual_note',
  'create_manual_backup',
  'pause_cloud_candidate',
  'use_emergency_local_mode',
  'inspect_source_of_truth',
  'follow_recovery_recommendation',
  'no_action_needed',
];

describe('daily training UX copy', () => {
  it('provides Chinese-first copy for all daily training states and actions', () => {
    for (const state of states) {
      const copy = getDailyTrainingUxCopy(state);
      expect(copy.label).toMatch(/[\u4e00-\u9fff]/);
      expect(copy.summary).toMatch(/[\u4e00-\u9fff]/);
      expect(copy.safety).toBeTruthy();
      expect(actions).toContain(copy.suggestedAction);
    }

    for (const action of actions) {
      expect(getDailyTrainingActionCopy(action)).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('keeps local-first and manual recovery language visible', () => {
    expect(getDailyTrainingUxCopy('local_first_ready').summary).toContain('本机数据');
    expect(getDailyTrainingUxCopy('session_ready_to_complete').safety).toContain('手动确认');
    expect(getDailyTrainingUxCopy('recovery_action_recommended').safety).toContain('不会自动修改数据');
  });

  it('warns on empty history local data unavailable and source-of-truth unclear states', () => {
    expect(getDailyTrainingUxCopy('empty_history').safety).toContain('不要上传或应用云端候选数据');
    expect(getDailyTrainingUxCopy('local_data_unavailable').summary).toContain('停止训练外的高风险操作');
    expect(getDailyTrainingUxCopy('source_of_truth_unclear').summary).toContain('回到本地数据模式或紧急本地模式');
  });

  it('builds a combined owner-facing view with supporting warnings', () => {
    const view = buildDailyTrainingUxView({
      state: 'session_completed',
      backupRecommended: true,
      emergencyLocalAvailable: true,
      cloudCandidatePaused: true,
      sourceOfTruthClear: false,
      ownerActionRequired: true,
      recoveryActionRecommended: true,
    });

    expect(view.title).toBe('个人训练日常状态');
    expect(view.safeNextAction).toBe('查看本地历史');
    expect(view.supporting.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        '建议先做手动备份',
        '紧急本地模式可用',
        '云端候选已暂停',
        '当前数据来源不清楚',
        '需要 owner 手动处理',
        '建议执行恢复检查',
      ]),
    );
  });

  it('does not claim SaaS automatic sync cloud upload or source-of-truth changes', () => {
    const allCopy = [
      ...states.flatMap((state) => {
        const copy = getDailyTrainingUxCopy(state);
        return [copy.label, copy.summary, copy.safety];
      }),
      ...actions.map(getDailyTrainingActionCopy),
    ].join('\n');

    for (const forbidden of [
      'public SaaS',
      'SaaS 已启动',
      'automatic sync',
      'default cloud sync is enabled',
      'background sync is enabled',
      '自动上传',
      '自动切换',
      '自动覆盖',
      'source-of-truth changed',
    ]) {
      expect(allCopy).not.toContain(forbidden);
    }
  });
});
