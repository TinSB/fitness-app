import { describe, expect, it } from 'vitest';
import {
  buildBackupRecoveryCopyView,
  getBackupRecoveryActionCopy,
  getBackupRecoveryStatusCopy,
} from '../src/personalProduction/backupRecoveryCopy';
import {
  evaluateBackupRecoveryReadiness,
  type BackupRecoveryAction,
  type BackupRecoveryStatus,
} from '../src/personalProduction/backupRecoveryReadiness';

const statuses: BackupRecoveryStatus[] = [
  'ready',
  'backup_recommended',
  'backup_stale',
  'backup_missing',
  'backup_unverified',
  'restore_rehearsal_needed',
  'emergency_local_ready',
  'emergency_local_unavailable',
  'cloud_candidate_paused',
  'recovery_blocked',
  'source_of_truth_unclear',
  'owner_review_required',
  'schema_review_required',
  'local_first_safe_mode',
];

const actions: BackupRecoveryAction[] = [
  'continue_localStorage_primary',
  'create_manual_backup',
  'verify_latest_backup',
  'rehearse_restore',
  'rehearse_emergency_local_restore',
  'pause_cloud_candidate',
  'do_not_cloud_pull',
  'do_not_cloud_push',
  'inspect_owner_scope',
  'inspect_schema_validation',
  'use_emergency_local_mode',
  'record_incident_note',
  'escalate_to_task16d',
  'no_action_needed',
];

describe('backup recovery copy helper', () => {
  it('provides Chinese-first copy for every required status and action', () => {
    for (const status of statuses) {
      const copy = getBackupRecoveryStatusCopy(status);
      expect(copy.label).toMatch(/[\u4e00-\u9fff]/);
      expect(copy.summary).toMatch(/[\u4e00-\u9fff]/);
      expect(copy.safety).toMatch(/[\u4e00-\u9fff]/);
    }

    for (const action of actions) {
      const copy = getBackupRecoveryActionCopy(action);
      expect(copy.label).toMatch(/[\u4e00-\u9fff]/);
      expect(copy.summary).toMatch(/[\u4e00-\u9fff]/);
      expect(copy.safety).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('warns that missing backup blocks cloud candidate operations', () => {
    const copy = getBackupRecoveryStatusCopy('backup_missing');

    expect(`${copy.label} ${copy.summary} ${copy.safety}`).toContain('不要进行云端候选操作');
  });

  it('keeps cloud candidate paused copy manual and local-first', () => {
    const copy = getBackupRecoveryStatusCopy('cloud_candidate_paused');

    expect(`${copy.label} ${copy.summary} ${copy.safety}`).toContain('云端候选已暂停');
    expect(`${copy.label} ${copy.summary} ${copy.safety}`).toContain('本地记录仍可继续');
  });

  it('states emergency local preserves local data', () => {
    const copy = getBackupRecoveryStatusCopy('emergency_local_ready');

    expect(`${copy.label} ${copy.summary} ${copy.safety}`).toContain('本地数据会被保留');
  });

  it('routes unclear source of truth to localStorage or emergency local', () => {
    const copy = getBackupRecoveryStatusCopy('source_of_truth_unclear');

    expect(`${copy.label} ${copy.summary} ${copy.safety}`).toContain('回到 localStorage 或紧急本地模式');
  });

  it('builds an owner-facing copy view from a readiness result', () => {
    const result = evaluateBackupRecoveryReadiness({ sourceOfTruthClear: false });
    const view = buildBackupRecoveryCopyView(result);

    expect(view.title).toBe('个人使用备份 / 恢复状态');
    expect(view.status.label).toContain('当前数据来源不清楚');
    expect(view.primaryAction.label).toContain('暂停云端候选');
    expect(view.notice).toContain('个人本地优先恢复建议');
  });

  it('does not claim unsafe automation SaaS or unconfirmed cloud behavior', () => {
    const allCopy = [
      ...statuses.flatMap((status) => {
        const copy = getBackupRecoveryStatusCopy(status);
        return [copy.label, copy.summary, copy.safety];
      }),
      ...actions.flatMap((action) => {
        const copy = getBackupRecoveryActionCopy(action);
        return [copy.label, copy.summary, copy.safety];
      }),
    ].join('\n');

    for (const forbidden of [
      'automatic sync',
      'cloud pull auto-applies',
      'cloud push can run without manual confirmation',
      'automatic restore',
      'public SaaS',
      '默认云同步',
      '后台同步',
      '自动上传',
      '自动恢复',
      '自动覆盖',
    ]) {
      expect(allCopy).not.toContain(forbidden);
    }
  });
});
