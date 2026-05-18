export type DailyTrainingUxState =
  | 'local_first_ready'
  | 'no_active_session'
  | 'active_session_in_progress'
  | 'session_ready_to_complete'
  | 'session_completed'
  | 'session_discarded'
  | 'interrupted_unfinished_session'
  | 'recent_history_available'
  | 'empty_history'
  | 'local_data_unavailable'
  | 'backup_recommended_before_risky_action'
  | 'emergency_local_available'
  | 'cloud_candidate_paused'
  | 'source_of_truth_unclear'
  | 'owner_action_required'
  | 'recovery_action_recommended';

export type DailyTrainingUxAction =
  | 'continue_local_training'
  | 'start_local_session'
  | 'continue_active_session'
  | 'review_before_complete'
  | 'review_local_history'
  | 'record_manual_note'
  | 'create_manual_backup'
  | 'pause_cloud_candidate'
  | 'use_emergency_local_mode'
  | 'inspect_source_of_truth'
  | 'follow_recovery_recommendation'
  | 'no_action_needed';

export type DailyTrainingUxSeverity = 'ready' | 'info' | 'caution' | 'stop' | 'emergency';

export type DailyTrainingUxCopy = {
  label: string;
  summary: string;
  safety: string;
  severity: DailyTrainingUxSeverity;
  suggestedAction: DailyTrainingUxAction;
};

export type DailyTrainingUxViewInput = {
  state: DailyTrainingUxState;
  backupRecommended?: boolean;
  emergencyLocalAvailable?: boolean;
  cloudCandidatePaused?: boolean;
  sourceOfTruthClear?: boolean;
  ownerActionRequired?: boolean;
  recoveryActionRecommended?: boolean;
};

export type DailyTrainingUxView = {
  title: string;
  primary: DailyTrainingUxCopy;
  supporting: DailyTrainingUxCopy[];
  localFirstNotice: string;
  safeNextAction: string;
};

const STATE_COPY: Record<DailyTrainingUxState, DailyTrainingUxCopy> = {
  local_first_ready: {
    label: '本地优先训练状态正常',
    summary: '可以继续用本机数据记录训练。',
    safety: 'localStorage 仍是默认、回退、迁移和紧急恢复基础。',
    severity: 'ready',
    suggestedAction: 'continue_local_training',
  },
  no_active_session: {
    label: '当前没有进行中的训练',
    summary: '可以从本地数据开始新的训练记录。',
    safety: '开始训练不会启用云端候选或 SaaS 功能。',
    severity: 'info',
    suggestedAction: 'start_local_session',
  },
  active_session_in_progress: {
    label: '训练正在进行',
    summary: '继续记录当前训练，先不要切换数据来源。',
    safety: '训练中保持本地优先，避免高风险候选操作。',
    severity: 'info',
    suggestedAction: 'continue_active_session',
  },
  session_ready_to_complete: {
    label: '训练可以准备完成',
    summary: '完成前先快速检查组数、重量和备注。',
    safety: '完成动作仍是手动确认，不会上传云端。',
    severity: 'caution',
    suggestedAction: 'review_before_complete',
  },
  session_completed: {
    label: '训练已完成',
    summary: '检查本地历史中是否出现最新训练。',
    safety: '如要做高风险操作，先确认备份状态。',
    severity: 'ready',
    suggestedAction: 'review_local_history',
  },
  session_discarded: {
    label: '训练已丢弃',
    summary: '确认这是有意操作，并检查本地历史。',
    safety: '丢弃状态不代表云端同步或远程删除。',
    severity: 'caution',
    suggestedAction: 'record_manual_note',
  },
  interrupted_unfinished_session: {
    label: '训练中断或未完成',
    summary: '先恢复或记录发生了什么，再决定继续或丢弃。',
    safety: '不要因为中断而切换 source of truth。',
    severity: 'caution',
    suggestedAction: 'continue_active_session',
  },
  recent_history_available: {
    label: '最近训练历史可查看',
    summary: '可以用本地历史确认训练是否保存成功。',
    safety: '历史检查不需要云端候选。',
    severity: 'info',
    suggestedAction: 'review_local_history',
  },
  empty_history: {
    label: '本地历史为空',
    summary: '先确认这是新安装、新数据，还是数据不可用。',
    safety: '历史为空时不要上传或应用云端候选数据。',
    severity: 'caution',
    suggestedAction: 'inspect_source_of_truth',
  },
  local_data_unavailable: {
    label: '本地数据不可用',
    summary: '停止训练外的高风险操作，先检查本地恢复路径。',
    safety: '不要进行云端候选读取或上传。',
    severity: 'emergency',
    suggestedAction: 'use_emergency_local_mode',
  },
  backup_recommended_before_risky_action: {
    label: '建议先做手动备份',
    summary: '完成备份后再考虑 cloud pull / cloud push rehearsal。',
    safety: '备份前不要进行候选云端操作。',
    severity: 'caution',
    suggestedAction: 'create_manual_backup',
  },
  emergency_local_available: {
    label: '紧急本地模式可用',
    summary: '云端候选或恢复流程不清楚时，可以回到本地数据。',
    safety: '保留本地训练记录和 emergency backup。',
    severity: 'info',
    suggestedAction: 'continue_local_training',
  },
  cloud_candidate_paused: {
    label: '云端候选已暂停',
    summary: '本地训练记录仍可继续。',
    safety: '候选云端操作保持手动、可回滚，不会自动同步。',
    severity: 'caution',
    suggestedAction: 'pause_cloud_candidate',
  },
  source_of_truth_unclear: {
    label: '当前数据来源不清楚',
    summary: '停止云端操作，回到本地数据模式或紧急本地模式。',
    safety: '先确认 source of truth，再继续训练外操作。',
    severity: 'emergency',
    suggestedAction: 'inspect_source_of_truth',
  },
  owner_action_required: {
    label: '需要 owner 手动处理',
    summary: '当前状态需要你确认账号、备份或恢复建议。',
    safety: '没有确认前不要上传或应用云端候选数据。',
    severity: 'stop',
    suggestedAction: 'record_manual_note',
  },
  recovery_action_recommended: {
    label: '建议执行恢复检查',
    summary: '按备份 / 恢复建议检查本地数据和应急路径。',
    safety: '恢复建议只指导人工操作，不会自动修改数据。',
    severity: 'caution',
    suggestedAction: 'follow_recovery_recommendation',
  },
};

export const getDailyTrainingUxCopy = (state: DailyTrainingUxState): DailyTrainingUxCopy => STATE_COPY[state];

export const getDailyTrainingActionCopy = (action: DailyTrainingUxAction): string => {
  const labels: Record<DailyTrainingUxAction, string> = {
    continue_local_training: '继续本地训练记录',
    start_local_session: '开始本地训练',
    continue_active_session: '继续当前训练',
    review_before_complete: '完成前检查',
    review_local_history: '查看本地历史',
    record_manual_note: '记录手动说明',
    create_manual_backup: '创建手动备份',
    pause_cloud_candidate: '暂停云端候选',
    use_emergency_local_mode: '使用紧急本地模式',
    inspect_source_of_truth: '检查当前数据来源',
    follow_recovery_recommendation: '按恢复建议处理',
    no_action_needed: '暂不需要额外操作',
  };
  return labels[action];
};

export const buildDailyTrainingUxView = (input: DailyTrainingUxViewInput): DailyTrainingUxView => {
  const supportingStates: DailyTrainingUxState[] = [
    ...(input.backupRecommended === true ? ['backup_recommended_before_risky_action'] as DailyTrainingUxState[] : []),
    ...(input.emergencyLocalAvailable === true ? ['emergency_local_available'] as DailyTrainingUxState[] : []),
    ...(input.cloudCandidatePaused === true ? ['cloud_candidate_paused'] as DailyTrainingUxState[] : []),
    ...(input.sourceOfTruthClear === false ? ['source_of_truth_unclear'] as DailyTrainingUxState[] : []),
    ...(input.ownerActionRequired === true ? ['owner_action_required'] as DailyTrainingUxState[] : []),
    ...(input.recoveryActionRecommended === true ? ['recovery_action_recommended'] as DailyTrainingUxState[] : []),
  ];
  const primary = getDailyTrainingUxCopy(input.state);

  return {
    title: '个人训练日常状态',
    primary,
    supporting: supportingStates.map(getDailyTrainingUxCopy),
    localFirstNotice: '个人使用保持本地优先；云端候选只作为手动、可回滚的候选流程。',
    safeNextAction: getDailyTrainingActionCopy(primary.suggestedAction),
  };
};
