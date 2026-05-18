import type {
  PersonalProductionRecoveryRecommendation,
  RecoverySeverity,
} from './realWorldFailureRecoveryHardening';

export type ProductionDataSourceState =
  | 'localStorage-primary'
  | 'backend-read-candidate'
  | 'backend-primary-candidate'
  | 'cloud-candidate'
  | 'fallback-localStorage'
  | 'emergency-local'
  | 'disabled'
  | 'unknown';

export type CloudPullState =
  | 'cloud-pull-disabled'
  | 'cloud-pull-dry-run'
  | 'cloud-pull-needs-confirmation'
  | 'cloud-pull-blocked';

export type CloudPushState =
  | 'cloud-push-disabled'
  | 'cloud-push-dry-run'
  | 'cloud-push-needs-confirmation'
  | 'cloud-push-blocked';

export type ProductionRecoveryState =
  | 'normal'
  | 'caution'
  | 'stop'
  | 'emergency'
  | 'rollback-available'
  | 'rollback-needed'
  | 'kill-switch-available'
  | 'owner-mismatch'
  | 'schema-validation-failed'
  | 'diagnostics-insufficient';

export type OwnerStatus = 'owner-ok' | 'owner-mismatch' | 'owner-unknown';
export type SchemaStatus = 'schema-ok' | 'schema-validation-failed' | 'schema-unknown';

export type ProductionCandidateCopy = {
  label: string;
  summary: string;
  safety: string;
  severity: RecoverySeverity;
};

export type ProductionCandidateControlViewInput = {
  dataSourceState: ProductionDataSourceState;
  cloudPullState: CloudPullState;
  cloudPushState: CloudPushState;
  recoveryState: ProductionRecoveryState;
  ownerStatus?: OwnerStatus;
  schemaStatus?: SchemaStatus;
  rollbackAvailable?: boolean;
  emergencyLocalAvailable?: boolean;
  lastRecommendation?: Pick<
    PersonalProductionRecoveryRecommendation,
    'recommendedAction' | 'severity' | 'requiresManualReview'
  > | string | null;
};

export type ProductionCandidateControlView = {
  title: string;
  dataSource: ProductionCandidateCopy;
  cloudPull: ProductionCandidateCopy;
  cloudPush: ProductionCandidateCopy;
  recovery: ProductionCandidateCopy;
  owner: ProductionCandidateCopy;
  schema: ProductionCandidateCopy;
  rollbackLabel: string;
  emergencyLocalLabel: string;
  recommendation: string;
  personalCandidateNotice: string;
};

const DATA_SOURCE_COPY: Record<ProductionDataSourceState, ProductionCandidateCopy> = {
  'localStorage-primary': {
    label: '本地数据模式',
    summary: '当前使用本机数据，这是最安全默认模式。',
    safety: '本地数据仍是默认、回退、迁移来源和 emergency backup。',
    severity: 'info',
  },
  'backend-read-candidate': {
    label: '后端只读候选',
    summary: '可以查看候选后端读取状态，但不会替换本地数据。',
    safety: '本地数据仍是当前工作副本。',
    severity: 'caution',
  },
  'backend-primary-candidate': {
    label: '后端主候选模式',
    summary: '这是手动候选状态，不会自动切换数据来源。',
    safety: '需要明确确认和可回滚边界。',
    severity: 'caution',
  },
  'cloud-candidate': {
    label: '云端候选模式',
    summary: '需要手动确认，不会自动同步。',
    safety: '不要把云端当作唯一副本。',
    severity: 'caution',
  },
  'fallback-localStorage': {
    label: '已回退到本地数据',
    summary: '云端候选不可用时仍可继续训练记录。',
    safety: '继续使用本机数据，先不要上传或应用云端数据。',
    severity: 'caution',
  },
  'emergency-local': {
    label: '紧急本地模式',
    summary: '停止云端操作，保留本地数据和 emergency backup。',
    safety: '先确认本地训练记录完整，再处理恢复事项。',
    severity: 'emergency',
  },
  disabled: {
    label: '候选控制已关闭',
    summary: '云端和后端候选控制当前不可用。',
    safety: '本地数据模式仍可继续使用。',
    severity: 'info',
  },
  unknown: {
    label: '当前数据来源不清楚',
    summary: '停止云端操作，回到本地数据模式或紧急本地模式。',
    safety: '先确认 source of truth，再继续任何候选操作。',
    severity: 'emergency',
  },
};

const CLOUD_PULL_COPY: Record<CloudPullState, ProductionCandidateCopy> = {
  'cloud-pull-disabled': {
    label: '云端读取已关闭',
    summary: '不会读取候选云端数据。',
    safety: '本地数据继续作为安全默认。',
    severity: 'info',
  },
  'cloud-pull-dry-run': {
    label: '从云端读取候选数据',
    summary: '只做 dry run，不会自动覆盖本地数据。',
    safety: '需要 owner check、schema validation 和手动确认后才可能应用。',
    severity: 'caution',
  },
  'cloud-pull-needs-confirmation': {
    label: '云端读取需要手动确认',
    summary: '候选数据不能自动应用。',
    safety: '确认前本地数据必须保持不变。',
    severity: 'stop',
  },
  'cloud-pull-blocked': {
    label: '云端读取已阻止',
    summary: '当前不允许应用云端数据。',
    safety: '先检查 owner scope、schema validation 和回滚状态。',
    severity: 'stop',
  },
};

const CLOUD_PUSH_COPY: Record<CloudPushState, ProductionCandidateCopy> = {
  'cloud-push-disabled': {
    label: '云端上传已关闭',
    summary: '不会上传训练数据。',
    safety: '本地记录不受影响。',
    severity: 'info',
  },
  'cloud-push-dry-run': {
    label: '准备上传候选数据',
    summary: '需要 dry run / owner check / backup check / 手动确认。',
    safety: '不允许假成功，确认前不能上传真实训练数据。',
    severity: 'caution',
  },
  'cloud-push-needs-confirmation': {
    label: '云端上传需要手动确认',
    summary: '没有手动确认就不能执行上传。',
    safety: '确认前必须保留本地数据和备份。',
    severity: 'stop',
  },
  'cloud-push-blocked': {
    label: '云端上传已阻止',
    summary: '先不要上传候选数据。',
    safety: '需要检查账号、owner scope、backup 和数据格式。',
    severity: 'stop',
  },
};

const RECOVERY_COPY: Record<ProductionRecoveryState, ProductionCandidateCopy> = {
  normal: {
    label: '状态正常',
    summary: '继续使用本地数据安全默认。',
    safety: '候选控制仍然需要手动确认。',
    severity: 'info',
  },
  caution: {
    label: '需要注意',
    summary: '先阅读提示，再决定是否继续候选操作。',
    safety: '不清楚时回到本地数据模式。',
    severity: 'caution',
  },
  stop: {
    label: '停止候选操作',
    summary: '先不要上传或应用云端数据。',
    safety: '保留本地数据，检查恢复建议。',
    severity: 'stop',
  },
  emergency: {
    label: '紧急恢复',
    summary: '停止云端操作并使用紧急本地模式。',
    safety: '保留本地数据和 emergency backup。',
    severity: 'emergency',
  },
  'rollback-available': {
    label: '回滚 / 关闭云端候选可用',
    summary: '可以关闭 cloud pull / cloud push / Supabase candidate。',
    safety: '回到本地数据模式，不删除本地数据。',
    severity: 'info',
  },
  'rollback-needed': {
    label: '需要回滚',
    summary: '先关闭云端候选，再回到本地数据模式。',
    safety: '回滚前不要上传或应用云端数据。',
    severity: 'stop',
  },
  'kill-switch-available': {
    label: 'Kill switch 可用',
    summary: '可以关闭 cloud pull / cloud push / Supabase candidate。',
    safety: '用于快速回到本地数据模式。',
    severity: 'info',
  },
  'owner-mismatch': {
    label: '数据归属不一致',
    summary: '先不要上传或应用云端数据。',
    safety: '需要检查账号 / owner scope。',
    severity: 'stop',
  },
  'schema-validation-failed': {
    label: '数据结构验证失败',
    summary: '先不要上传或应用云端数据。',
    safety: '需要检查数据格式。',
    severity: 'stop',
  },
  'diagnostics-insufficient': {
    label: '诊断信息不够清楚',
    summary: '记录发生了什么，用更简单的恢复提示处理。',
    safety: '如果看不懂状态，回到本地数据模式。',
    severity: 'caution',
  },
};

const OWNER_COPY: Record<OwnerStatus, ProductionCandidateCopy> = {
  'owner-ok': {
    label: '账号归属已确认',
    summary: 'owner scope 当前没有发现问题。',
    safety: '候选操作仍需手动确认。',
    severity: 'info',
  },
  'owner-mismatch': RECOVERY_COPY['owner-mismatch'],
  'owner-unknown': {
    label: '账号归属未确认',
    summary: '先不要上传或应用云端数据。',
    safety: '需要检查账号 / owner scope。',
    severity: 'caution',
  },
};

const SCHEMA_COPY: Record<SchemaStatus, ProductionCandidateCopy> = {
  'schema-ok': {
    label: '数据结构已确认',
    summary: 'schema validation 当前没有发现问题。',
    safety: '候选操作仍需手动确认。',
    severity: 'info',
  },
  'schema-validation-failed': RECOVERY_COPY['schema-validation-failed'],
  'schema-unknown': {
    label: '数据结构未确认',
    summary: '先不要上传或应用云端数据。',
    safety: '需要检查数据格式。',
    severity: 'caution',
  },
};

export const getDataSourceCopy = (state: ProductionDataSourceState): ProductionCandidateCopy =>
  DATA_SOURCE_COPY[state] ?? DATA_SOURCE_COPY.unknown;

export const getCloudPullCopy = (state: CloudPullState): ProductionCandidateCopy => CLOUD_PULL_COPY[state];

export const getCloudPushCopy = (state: CloudPushState): ProductionCandidateCopy => CLOUD_PUSH_COPY[state];

export const getCloudOperationCopy = (
  state: CloudPullState | CloudPushState,
): ProductionCandidateCopy =>
  state.startsWith('cloud-pull-')
    ? getCloudPullCopy(state as CloudPullState)
    : getCloudPushCopy(state as CloudPushState);

export const getRecoveryStateCopy = (state: ProductionRecoveryState): ProductionCandidateCopy =>
  RECOVERY_COPY[state];

export const getOwnerStatusCopy = (status: OwnerStatus = 'owner-unknown'): ProductionCandidateCopy =>
  OWNER_COPY[status];

export const getSchemaStatusCopy = (status: SchemaStatus = 'schema-unknown'): ProductionCandidateCopy =>
  SCHEMA_COPY[status];

const recommendationText = (
  recommendation: ProductionCandidateControlViewInput['lastRecommendation'],
): string => {
  if (!recommendation) return '暂无恢复建议；不清楚时继续本地数据模式。';
  if (typeof recommendation === 'string') return recommendation;

  return `建议：${recommendation.recommendedAction}；严重度：${recommendation.severity}；${
    recommendation.requiresManualReview ? '需要人工检查。' : '无需额外人工检查。'
  }`;
};

export const buildProductionCandidateControlView = (
  input: ProductionCandidateControlViewInput,
): ProductionCandidateControlView => ({
  title: '个人生产候选控制面板',
  dataSource: getDataSourceCopy(input.dataSourceState),
  cloudPull: getCloudPullCopy(input.cloudPullState),
  cloudPush: getCloudPushCopy(input.cloudPushState),
  recovery: getRecoveryStateCopy(input.recoveryState),
  owner: getOwnerStatusCopy(input.ownerStatus),
  schema: getSchemaStatusCopy(input.schemaStatus),
  rollbackLabel: input.rollbackAvailable
    ? '回滚 / 关闭云端候选可用'
    : '回滚状态未确认；先不要继续云端候选操作',
  emergencyLocalLabel: input.emergencyLocalAvailable
    ? '紧急本地模式可用'
    : '紧急本地模式未确认；停止云端操作',
  recommendation: recommendationText(input.lastRecommendation),
  personalCandidateNotice: '个人生产候选用途：不是 public SaaS，不是多设备同步，不会自动同步。',
});
