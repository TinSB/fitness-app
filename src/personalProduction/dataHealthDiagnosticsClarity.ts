export type DataHealthDiagnosticsCategory =
  | 'no_issue'
  | 'informational'
  | 'review_recommended'
  | 'backup_recommended'
  | 'owner_review_required'
  | 'schema_review_required'
  | 'recovery_recommended'
  | 'emergency_local_recommended'
  | 'cloud_candidate_paused'
  | 'diagnostics_insufficient'
  | 'repair_blocked';

export type DataHealthDiagnosticsSeverity = 'ready' | 'info' | 'caution' | 'stop' | 'emergency';

export type DataHealthDiagnosticsAction =
  | 'continue_localStorage_primary'
  | 'review_issue_details'
  | 'create_manual_backup'
  | 'inspect_owner_scope'
  | 'inspect_schema_validation'
  | 'inspect_backup_recovery'
  | 'use_emergency_local_mode'
  | 'pause_cloud_candidate'
  | 'record_redacted_incident_note'
  | 'do_not_repair_apply'
  | 'no_action_needed';

export type DataHealthDiagnosticsInput = {
  category?: DataHealthDiagnosticsCategory;
  issueCount?: number;
  ownerScopeClear?: boolean;
  schemaValidationClear?: boolean;
  backupRecoveryClear?: boolean;
  diagnosticsClear?: boolean;
  cloudCandidateEnabled?: boolean;
  emergencyLocalAvailable?: boolean;
};

export type DataHealthDiagnosticsResult = {
  statusLabel: string;
  explanation: string;
  severity: DataHealthDiagnosticsSeverity;
  safeNextAction: DataHealthDiagnosticsAction;
  shouldPauseCloudCandidate: boolean;
  shouldUseEmergencyLocal: boolean;
  canContinueLocal: boolean;
  redactionRequired: true;
  repairActionAllowed: false;
  sourceOfTruthChanged: false;
  checklist: DataHealthDiagnosticsAction[];
};

const uniqueActions = (actions: DataHealthDiagnosticsAction[]): DataHealthDiagnosticsAction[] => [...new Set(actions)];

const categoryFromInput = (input: DataHealthDiagnosticsInput): DataHealthDiagnosticsCategory => {
  if (input.ownerScopeClear === false) return 'owner_review_required';
  if (input.schemaValidationClear === false) return 'schema_review_required';
  if (input.backupRecoveryClear === false) return 'backup_recommended';
  if (input.diagnosticsClear === false) return 'diagnostics_insufficient';
  return input.category ?? (input.issueCount && input.issueCount > 0 ? 'review_recommended' : 'no_issue');
};

const buildChecklist = (
  primary: DataHealthDiagnosticsAction,
  shouldPauseCloudCandidate: boolean,
  shouldUseEmergencyLocal: boolean,
): DataHealthDiagnosticsAction[] => uniqueActions([
  primary,
  ...(shouldPauseCloudCandidate ? ['pause_cloud_candidate', 'do_not_repair_apply'] as DataHealthDiagnosticsAction[] : []),
  ...(shouldUseEmergencyLocal ? ['use_emergency_local_mode'] as DataHealthDiagnosticsAction[] : []),
  'record_redacted_incident_note',
]);

export const buildDataHealthDiagnosticsClarity = (
  input: DataHealthDiagnosticsInput = {},
): DataHealthDiagnosticsResult => {
  const category = categoryFromInput(input);
  const cloudPause = input.cloudCandidateEnabled === true;

  const profiles: Record<DataHealthDiagnosticsCategory, Omit<DataHealthDiagnosticsResult, 'redactionRequired' | 'repairActionAllowed' | 'sourceOfTruthChanged' | 'checklist'>> = {
    no_issue: {
      statusLabel: '数据健康正常',
      explanation: '目前没有需要处理的数据健康问题，可以继续本地训练记录。',
      severity: 'ready',
      safeNextAction: 'continue_localStorage_primary',
      shouldPauseCloudCandidate: false,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
    informational: {
      statusLabel: '仅供参考',
      explanation: '这类提示帮助理解状态，不需要自动修复。',
      severity: 'info',
      safeNextAction: 'review_issue_details',
      shouldPauseCloudCandidate: false,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
    review_recommended: {
      statusLabel: '建议人工检查',
      explanation: '先阅读问题说明，再决定是否需要备份或恢复检查。',
      severity: 'caution',
      safeNextAction: 'review_issue_details',
      shouldPauseCloudCandidate: cloudPause,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
    backup_recommended: {
      statusLabel: '建议检查备份',
      explanation: '先确认备份和恢复路径，再继续候选操作。',
      severity: 'caution',
      safeNextAction: 'create_manual_backup',
      shouldPauseCloudCandidate: cloudPause,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
    owner_review_required: {
      statusLabel: '需要检查数据归属',
      explanation: 'owner scope 不清楚时，不要上传或应用候选数据。',
      severity: 'stop',
      safeNextAction: 'inspect_owner_scope',
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
    schema_review_required: {
      statusLabel: '需要检查数据结构',
      explanation: 'schema validation 不清楚时，不要修复、上传或应用候选数据。',
      severity: 'stop',
      safeNextAction: 'inspect_schema_validation',
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
    recovery_recommended: {
      statusLabel: '建议检查恢复路径',
      explanation: '按备份 / 恢复建议确认本地数据和应急路径。',
      severity: 'caution',
      safeNextAction: 'inspect_backup_recovery',
      shouldPauseCloudCandidate: cloudPause,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
    emergency_local_recommended: {
      statusLabel: '建议使用紧急本地模式',
      explanation: '当状态不清楚或本地数据有风险时，先回到本地恢复路径。',
      severity: 'emergency',
      safeNextAction: 'use_emergency_local_mode',
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: true,
      canContinueLocal: input.emergencyLocalAvailable !== false,
    },
    cloud_candidate_paused: {
      statusLabel: '云端候选已暂停',
      explanation: '本地记录仍可继续，候选云端流程保持手动。',
      severity: 'caution',
      safeNextAction: 'pause_cloud_candidate',
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
    diagnostics_insufficient: {
      statusLabel: '诊断信息不够清楚',
      explanation: '记录精简事件说明，不要上传完整 AppData 或敏感凭证。',
      severity: 'caution',
      safeNextAction: 'record_redacted_incident_note',
      shouldPauseCloudCandidate: cloudPause,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
    repair_blocked: {
      statusLabel: '自动修复被阻止',
      explanation: 'Data Health 修复只能保持阻止状态；不要执行破坏性修复。',
      severity: 'stop',
      safeNextAction: 'do_not_repair_apply',
      shouldPauseCloudCandidate: true,
      shouldUseEmergencyLocal: false,
      canContinueLocal: true,
    },
  };

  const profile = profiles[category];

  return {
    ...profile,
    redactionRequired: true,
    repairActionAllowed: false,
    sourceOfTruthChanged: false,
    checklist: buildChecklist(profile.safeNextAction, profile.shouldPauseCloudCandidate, profile.shouldUseEmergencyLocal),
  };
};

export const buildDiagnosticRedactionReminder = (): string =>
  '诊断摘要必须隐藏敏感凭证和完整 AppData，只保留人工恢复需要的最小信息。';
