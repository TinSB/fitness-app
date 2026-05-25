import type {
  BackupRecoveryAction,
  BackupRecoveryReadinessResult,
  BackupRecoverySeverity,
  BackupRecoveryStatus,
} from './backupRecoveryReadiness';

export type BackupRecoveryCopy = {
  label: string;
  summary: string;
  safety: string;
  severity: BackupRecoverySeverity;
};

export type BackupRecoveryCopyView = {
  title: string;
  status: BackupRecoveryCopy;
  primaryAction: BackupRecoveryCopy;
  checklist: BackupRecoveryCopy[];
  notice: string;
};

const STATUS_COPY: Record<BackupRecoveryStatus, BackupRecoveryCopy> = {
  ready: {
    label: '备份状态正常',
    summary: '可以继续使用本地数据记录训练。',
    safety: '继续保留本地数据和手动备份。',
    severity: 'ready',
  },
  backup_recommended: {
    label: '建议先做一次手动备份',
    summary: '备份后再继续高风险操作。',
    safety: '不要把云端候选当作唯一副本。',
    severity: 'info',
  },
  backup_stale: {
    label: '备份可能已经过旧',
    summary: '先更新备份，再做 cloud pull / cloud push rehearsal。',
    safety: '更新前不要应用或上传云端候选数据。',
    severity: 'caution',
  },
  backup_missing: {
    label: '没有可确认的备份',
    summary: '不要进行云端候选操作。',
    safety: '先做手动备份，再考虑任何候选操作。',
    severity: 'stop',
  },
  backup_unverified: {
    label: '备份还没有验证过',
    summary: '建议先做 restore rehearsal。',
    safety: '确认真的能恢复后再继续。',
    severity: 'caution',
  },
  restore_rehearsal_needed: {
    label: '需要先演练恢复流程',
    summary: '确认真的能恢复后再继续。',
    safety: '恢复演练前不要扩大候选操作范围。',
    severity: 'caution',
  },
  emergency_local_ready: {
    label: '紧急本地模式可用',
    summary: '云端候选失败时可以回到本地数据。',
    safety: '本地数据会被保留，不要删除 emergency backup。',
    severity: 'info',
  },
  emergency_local_unavailable: {
    label: '紧急本地模式不可确认',
    summary: '停止云端操作并检查恢复路径。',
    safety: '先确认本地恢复方式，再继续训练外的高风险操作。',
    severity: 'emergency',
  },
  cloud_candidate_paused: {
    label: '云端候选已暂停',
    summary: '本地记录仍可继续。',
    safety: '候选云端操作保持手动和可回滚。',
    severity: 'caution',
  },
  recovery_blocked: {
    label: '恢复流程被阻止',
    summary: '先处理冲突或恢复阻塞，再继续候选操作。',
    safety: '保留本地数据和备份。',
    severity: 'stop',
  },
  source_of_truth_unclear: {
    label: '当前数据来源不清楚',
    summary: '停止云端操作，回到 localStorage 或紧急本地模式。',
    safety: '先确认 source of truth，再继续任何候选操作。',
    severity: 'emergency',
  },
  owner_review_required: {
    label: '需要检查数据归属',
    summary: '先检查账号 / owner scope。',
    safety: '检查前不要上传或应用云端候选数据。',
    severity: 'stop',
  },
  schema_review_required: {
    label: '需要检查数据结构',
    summary: '先检查 schema validation。',
    safety: '检查前不要上传或应用云端候选数据。',
    severity: 'stop',
  },
  local_first_safe_mode: {
    label: '本地优先安全模式',
    summary: '可以继续用本地数据记录训练。',
    safety: '云端候选仍然需要手动检查和确认。',
    severity: 'ready',
  },
};

const ACTION_COPY: Record<BackupRecoveryAction, BackupRecoveryCopy> = {
  continue_localStorage_primary: {
    label: '继续本地数据模式',
    summary: '继续使用本机数据记录训练。',
    safety: '本地数据仍是默认、回退、迁移和紧急恢复基础。',
    severity: 'ready',
  },
  create_manual_backup: {
    label: '创建手动备份',
    summary: '先导出或保存一份可确认的备份。',
    safety: '备份完成前不要进行云端候选操作。',
    severity: 'caution',
  },
  verify_latest_backup: {
    label: '验证最新备份',
    summary: '确认备份包含最近训练记录。',
    safety: '验证前不要把候选数据当作可靠恢复点。',
    severity: 'caution',
  },
  rehearse_restore: {
    label: '演练恢复流程',
    summary: '确认备份真的可以恢复。',
    safety: '演练必须保持本地数据不被覆盖。',
    severity: 'caution',
  },
  rehearse_emergency_local_restore: {
    label: '演练紧急本地恢复',
    summary: '确认紧急本地模式可用。',
    safety: '保留本地数据和 emergency backup。',
    severity: 'caution',
  },
  pause_cloud_candidate: {
    label: '暂停云端候选',
    summary: '先不进行 cloud pull / cloud push rehearsal。',
    safety: '本地记录仍可继续。',
    severity: 'stop',
  },
  do_not_cloud_pull: {
    label: '不要读取云端候选',
    summary: '先完成备份、归属和结构检查。',
    safety: '云端数据不能覆盖本地数据。',
    severity: 'stop',
  },
  do_not_cloud_push: {
    label: '不要上传云端候选',
    summary: '没有 dry run / owner check / backup check / 手动确认就不要上传。',
    safety: '不允许假成功。',
    severity: 'stop',
  },
  inspect_owner_scope: {
    label: '检查 owner scope',
    summary: '确认数据属于正确账号。',
    safety: '归属不清楚时不要上传或应用云端候选数据。',
    severity: 'stop',
  },
  inspect_schema_validation: {
    label: '检查 schema validation',
    summary: '确认数据结构可以安全理解。',
    safety: '结构不清楚时不要上传或应用云端候选数据。',
    severity: 'stop',
  },
  use_emergency_local_mode: {
    label: '使用紧急本地模式',
    summary: '回到本地数据，停止云端操作。',
    safety: '保留本地数据，不要删除备份。',
    severity: 'emergency',
  },
  record_incident_note: {
    label: '记录事件说明',
    summary: '记录日期、状态、操作和下一步。',
    safety: '不要记录敏感凭证或完整 AppData。',
    severity: 'info',
  },
  escalate_to_task16d: {
    label: '升级到 Task 16D',
    summary: '把训练 UX 或恢复提示不清楚的问题交给下一包处理。',
    safety: 'Task 16C 不启动 Task 16D。',
    severity: 'caution',
  },
  no_action_needed: {
    label: '暂不需要额外操作',
    summary: '继续本地优先使用。',
    safety: '保持手动备份习惯。',
    severity: 'ready',
  },
};

export const getBackupRecoveryStatusCopy = (status: BackupRecoveryStatus): BackupRecoveryCopy => STATUS_COPY[status];

export const getBackupRecoveryActionCopy = (action: BackupRecoveryAction): BackupRecoveryCopy => ACTION_COPY[action];

export const buildBackupRecoveryCopyView = (result: BackupRecoveryReadinessResult): BackupRecoveryCopyView => ({
  title: '个人使用备份 / 恢复状态',
  status: getBackupRecoveryStatusCopy(result.status),
  primaryAction: getBackupRecoveryActionCopy(result.recommendedActions[0] ?? 'no_action_needed'),
  checklist: result.checklist.map(getBackupRecoveryActionCopy),
  notice: '此面板只提供个人本地优先恢复建议，不代表公开 SaaS 发布，也不会执行云端操作。',
});
