export type DataHealthClaritySeverity = 'info' | 'review' | 'caution' | 'stop' | 'emergency';
export type DataHealthOverallState = 'healthy' | 'review_recommended' | 'caution' | 'stop' | 'emergency' | 'data_insufficient';
export type DataHealthSafeNextAction =
  | 'continue_local_training'
  | 'review_record'
  | 'check_backup'
  | 'pause_cloud_candidate'
  | 'use_emergency_local'
  | 'inspect_owner_scope'
  | 'inspect_schema_validation'
  | 'open_settings_data_health'
  | 'no_action_needed';

export type DataHealthClarityIssueInput = {
  id: string;
  title: string;
  userMessage: string;
  severityLabel?: string;
  technicalDetails?: string;
};

export type DataHealthClarityIssueCard = {
  issueId: string;
  title: string;
  explanation: string;
  whyItMatters: string;
  safeNextAction: DataHealthSafeNextAction;
  safeNextActionLabel: string;
  severity: DataHealthClaritySeverity;
  localTrainingCopy: string;
  cloudCandidateCopy: string;
  repairCopy: string;
};

export type DataHealthClaritySummaryInput = {
  issues?: DataHealthClarityIssueInput[];
  dismissedIssueCount?: number;
  severityCounts?: Partial<Record<DataHealthClaritySeverity, number>>;
  sourceOfTruthClear?: boolean;
  backupStatus?: 'ok' | 'recommended' | 'missing' | 'unknown';
  cloudCandidateEnabled?: boolean;
  ownerScopeClear?: boolean;
  schemaValidationClear?: boolean;
};

export type DataHealthClaritySummaryResult = {
  overallState: DataHealthOverallState;
  summaryTitle: string;
  summaryExplanation: string;
  issueCards: DataHealthClarityIssueCard[];
  safeNextAction: DataHealthSafeNextAction;
  canContinueLocalTraining: boolean;
  shouldPauseCloudCandidate: boolean;
  shouldUseEmergencyLocal: boolean;
  repairActionAllowed: false;
  destructiveActionAllowed: false;
  externalUploadAllowed: false;
  sourceOfTruthChanged: false;
};

const normalize = (value?: string) => String(value || '').toLowerCase();
const includesAny = (value: string, patterns: string[]) => patterns.some((pattern) => value.includes(pattern));

const severityRank: Record<DataHealthClaritySeverity, number> = {
  info: 0,
  review: 1,
  caution: 2,
  stop: 3,
  emergency: 4,
};

const issueSeverity = (issue: DataHealthClarityIssueInput): DataHealthClaritySeverity => {
  const source = `${normalize(issue.id)} ${normalize(issue.title)} ${normalize(issue.userMessage)} ${normalize(issue.severityLabel)} ${normalize(issue.technicalDetails)}`;
  if (includesAny(source, ['emergency', 'source unclear', '来源待确认', '紧急'])) return 'emergency';
  if (includesAny(source, ['owner', '归属', 'scope', 'schema', 'validation', '结构验证', '需要处理', 'error'])) return 'stop';
  if (includesAny(source, ['backup', '备份', '重复', '不一致', 'warning', '复查'])) return 'caution';
  if (includesAny(source, ['dismiss', '暂不处理', '提示', 'info'])) return 'info';
  return 'review';
};

const safeNextActionCopy: Record<DataHealthSafeNextAction, string> = {
  continue_local_training: '继续本地训练',
  review_record: '复查相关记录',
  check_backup: '先做手动备份',
  pause_cloud_candidate: '暂停云端候选',
  use_emergency_local: '使用紧急本地模式',
  inspect_owner_scope: '检查账号 / owner scope',
  inspect_schema_validation: '检查数据结构',
  open_settings_data_health: '到设置里查看 Data Health',
  no_action_needed: '无需处理',
};

const clarityForIssue = (issue: DataHealthClarityIssueInput): DataHealthClarityIssueCard => {
  const source = `${normalize(issue.id)} ${normalize(issue.title)} ${normalize(issue.userMessage)} ${normalize(issue.technicalDetails)}`;
  const severity = issueSeverity(issue);

  if (includesAny(source, ['schema', 'validation', '结构验证'])) {
    return {
      issueId: issue.id,
      title: '数据结构验证失败',
      explanation: '数据结构验证失败。先不要上传或应用云端数据，建议检查数据格式。',
      whyItMatters: '结构不清楚时，训练统计、历史回看和云端候选都可能引用错误字段。',
      safeNextAction: 'inspect_schema_validation',
      safeNextActionLabel: safeNextActionCopy.inspect_schema_validation,
      severity: severity === 'info' ? 'stop' : severity,
      localTrainingCopy: '本地训练记录可以先保持只读复查；训练前优先确认数据来源。',
      cloudCandidateCopy: '云端候选应暂停，不能自动拉取、推送或应用。',
      repairCopy: '不提供自动修复；需要人工确认。',
    };
  }

  if (includesAny(source, ['owner', 'scope', '归属', '账号'])) {
    return {
      issueId: issue.id,
      title: '数据归属不一致',
      explanation: '数据归属不一致。先暂停云端候选，检查账号 / owner scope。',
      whyItMatters: '归属不清楚时，任何同步或恢复都可能混入不属于当前 owner 的记录。',
      safeNextAction: 'inspect_owner_scope',
      safeNextActionLabel: safeNextActionCopy.inspect_owner_scope,
      severity: severity === 'info' ? 'stop' : severity,
      localTrainingCopy: '先回到本地数据边界内查看记录。',
      cloudCandidateCopy: '云端候选暂停，不能自动应用。',
      repairCopy: '不提供自动修复；需要人工确认 owner scope。',
    };
  }

  if (includesAny(source, ['backup', '备份'])) {
    return {
      issueId: issue.id,
      title: '备份需要确认',
      explanation: '没有可确认的备份。先做手动备份，再进行高风险操作。',
      whyItMatters: '备份缺失会降低恢复能力，尤其是在修正历史记录或恢复数据前。',
      safeNextAction: 'check_backup',
      safeNextActionLabel: safeNextActionCopy.check_backup,
      severity: severity === 'stop' || severity === 'emergency' ? severity : 'caution',
      localTrainingCopy: '非严重问题下，本地训练记录可以继续。',
      cloudCandidateCopy: '云端候选仍需手动确认，不会自动同步。',
      repairCopy: '不提供自动修复；先手动备份。',
    };
  }

  if (severity === 'emergency') {
    return {
      issueId: issue.id,
      title: issue.title || '数据来源待确认',
      explanation: '数据来源待确认。优先使用紧急本地模式，避免任何自动同步或上传。',
      whyItMatters: '来源不清楚时，继续执行高风险操作可能污染本地训练历史。',
      safeNextAction: 'use_emergency_local',
      safeNextActionLabel: safeNextActionCopy.use_emergency_local,
      severity,
      localTrainingCopy: '先切回紧急本地模式，再决定是否继续训练。',
      cloudCandidateCopy: '云端候选暂停。',
      repairCopy: '不提供自动修复；不执行破坏性操作。',
    };
  }

  if (severity === 'stop') {
    return {
      issueId: issue.id,
      title: issue.title || '记录需要先处理',
      explanation: issue.userMessage || '这条问题可能影响训练记录解释，需要先复查。',
      whyItMatters: '它可能影响 PR、e1RM、有效组或训练历史的可信度。',
      safeNextAction: 'pause_cloud_candidate',
      safeNextActionLabel: safeNextActionCopy.pause_cloud_candidate,
      severity,
      localTrainingCopy: '先不要把这条记录用于高风险决策。',
      cloudCandidateCopy: '云端候选暂停，不能自动同步。',
      repairCopy: '不提供自动修复；只允许人工确认后的安全操作。',
    };
  }

  if (severity === 'info') {
    return {
      issueId: issue.id,
      title: issue.title || '低风险提示',
      explanation: issue.userMessage || '这条问题暂时不影响本地训练记录。',
      whyItMatters: '作为记录回看提示保留，不需要打断训练。',
      safeNextAction: 'continue_local_training',
      safeNextActionLabel: safeNextActionCopy.continue_local_training,
      severity,
      localTrainingCopy: '这条问题暂时不影响本地训练记录。',
      cloudCandidateCopy: '云端候选仍需手动确认。',
      repairCopy: '不提供自动修复。',
    };
  }

  return {
    issueId: issue.id,
    title: issue.title || '记录建议复查',
    explanation: issue.userMessage || '发现一条建议复查的数据问题。',
    whyItMatters: '复查后可以让历史记录、PR、e1RM 和有效组解释更可信。',
    safeNextAction: severity === 'caution' ? 'review_record' : 'open_settings_data_health',
    safeNextActionLabel: severity === 'caution' ? safeNextActionCopy.review_record : safeNextActionCopy.open_settings_data_health,
    severity,
    localTrainingCopy: '非严重问题下，本地训练记录可以继续。',
    cloudCandidateCopy: '云端候选不会自动同步。',
    repairCopy: '不提供自动修复；不会删除或上传数据。',
  };
};

const overallFromIssues = (issueCards: DataHealthClarityIssueCard[], input: DataHealthClaritySummaryInput): DataHealthOverallState => {
  if (input.sourceOfTruthClear === false) return 'emergency';
  if (input.ownerScopeClear === false || input.schemaValidationClear === false) return 'stop';
  if (!issueCards.length) return 'healthy';
  const highest = issueCards.reduce<DataHealthClaritySeverity>(
    (current, issue) => (severityRank[issue.severity] > severityRank[current] ? issue.severity : current),
    'info',
  );
  if (highest === 'emergency') return 'emergency';
  if (highest === 'stop') return 'stop';
  if (highest === 'caution') return 'caution';
  return 'review_recommended';
};

export const buildDataHealthClaritySummary = (input: DataHealthClaritySummaryInput = {}): DataHealthClaritySummaryResult => {
  const issueCards = (input.issues || []).map(clarityForIssue);
  const overallState = overallFromIssues(issueCards, input);
  const shouldPauseCloudCandidate =
    overallState === 'stop' ||
    overallState === 'emergency' ||
    issueCards.some((issue) => issue.safeNextAction === 'pause_cloud_candidate' || issue.safeNextAction === 'inspect_owner_scope' || issue.safeNextAction === 'inspect_schema_validation');
  const shouldUseEmergencyLocal = overallState === 'emergency' || input.sourceOfTruthClear === false;
  const canContinueLocalTraining = overallState !== 'stop' && overallState !== 'emergency';

  const summaryTitle =
    overallState === 'healthy'
      ? '数据健康正常'
      : overallState === 'emergency'
        ? '先回到紧急本地模式'
        : overallState === 'stop'
          ? '先暂停高风险操作'
          : overallState === 'caution'
            ? '有记录建议谨慎复查'
            : '有记录建议检查';

  const summaryExplanation =
    overallState === 'healthy'
      ? '没有发现明显异常。本地训练记录可以继续。'
      : shouldPauseCloudCandidate
        ? `发现 ${issueCards.length} 条需要检查的问题。先暂停云端候选，训练记录保持本地优先。`
        : `发现 ${issueCards.length} 条建议检查的问题。本地训练记录可以继续，完整复查放在 Data Health。`;

  return {
    overallState,
    summaryTitle,
    summaryExplanation,
    issueCards,
    safeNextAction: shouldUseEmergencyLocal
      ? 'use_emergency_local'
      : shouldPauseCloudCandidate
        ? 'pause_cloud_candidate'
        : issueCards[0]?.safeNextAction || 'no_action_needed',
    canContinueLocalTraining,
    shouldPauseCloudCandidate,
    shouldUseEmergencyLocal,
    repairActionAllowed: false,
    destructiveActionAllowed: false,
    externalUploadAllowed: false,
    sourceOfTruthChanged: false,
  };
};
