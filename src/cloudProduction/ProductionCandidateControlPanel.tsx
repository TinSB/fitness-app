import {
  buildProductionCandidateControlView,
  type CloudPullState,
  type CloudPushState,
  type OwnerStatus,
  type ProductionDataSourceState,
  type ProductionRecoveryState,
  type SchemaStatus,
} from './productionCandidateControlCopy';
import type { PersonalProductionRecoveryRecommendation } from './realWorldFailureRecoveryHardening';

export type ProductionCandidateControlPanelProps = {
  visible?: boolean;
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
  onRequestCloudPullDryRun?: () => void;
  onRequestCloudPushDryRun?: () => void;
  onRequestRollback?: () => void;
  onRequestEmergencyLocal?: () => void;
};

const CopyBlock = ({
  title,
  label,
  summary,
  safety,
}: {
  title: string;
  label: string;
  summary: string;
  safety: string;
}) => (
  <section>
    <h3>{title}</h3>
    <p>{label}</p>
    <p>{summary}</p>
    <p>{safety}</p>
  </section>
);

export const ProductionCandidateControlPanel = ({
  visible = true,
  dataSourceState,
  cloudPullState,
  cloudPushState,
  recoveryState,
  ownerStatus = 'owner-unknown',
  schemaStatus = 'schema-unknown',
  rollbackAvailable = false,
  emergencyLocalAvailable = false,
  lastRecommendation = null,
}: ProductionCandidateControlPanelProps) => {
  if (!visible) return null;

  const view = buildProductionCandidateControlView({
    dataSourceState,
    cloudPullState,
    cloudPushState,
    recoveryState,
    ownerStatus,
    schemaStatus,
    rollbackAvailable,
    emergencyLocalAvailable,
    lastRecommendation,
  });

  return (
    <section aria-label="Production candidate control safety panel" data-production-candidate-panel="presentational">
      <h2>{view.title}</h2>
      <p>{view.personalCandidateNotice}</p>

      <CopyBlock title="当前数据来源" {...view.dataSource} />
      <CopyBlock title="Cloud pull 安全状态" {...view.cloudPull} />
      <CopyBlock title="Cloud push 安全状态" {...view.cloudPush} />
      <CopyBlock title="恢复建议" {...view.recovery} />
      <CopyBlock title="Owner scope" {...view.owner} />
      <CopyBlock title="Schema validation" {...view.schema} />

      <dl>
        <div>
          <dt>Rollback / kill switch</dt>
          <dd>{view.rollbackLabel}</dd>
        </div>
        <div>
          <dt>Emergency local mode</dt>
          <dd>{view.emergencyLocalLabel}</dd>
        </div>
        <div>
          <dt>Last recommendation</dt>
          <dd>{view.recommendation}</dd>
        </div>
      </dl>

      <div aria-label="Manual rehearsal controls">
        <button type="button" disabled aria-disabled="true">
          Cloud pull dry run 需要手动确认
        </button>
        <button type="button" disabled aria-disabled="true">
          Cloud push dry run 需要 owner / backup / 手动确认
        </button>
        <button type="button" disabled aria-disabled="true">
          回滚 / 关闭云端候选
        </button>
        <button type="button" disabled aria-disabled="true">
          进入紧急本地模式
        </button>
      </div>
    </section>
  );
};
