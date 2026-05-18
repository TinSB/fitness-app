import { describe, expect, it } from 'vitest';
import {
  buildProductionCandidateControlView,
  getCloudOperationCopy,
  getCloudPullCopy,
  getCloudPushCopy,
  getDataSourceCopy,
  getRecoveryStateCopy,
  type CloudPullState,
  type CloudPushState,
  type ProductionDataSourceState,
  type ProductionRecoveryState,
} from '../src/cloudProduction/productionCandidateControlCopy';

const dataSourceStates: ProductionDataSourceState[] = [
  'localStorage-primary',
  'backend-read-candidate',
  'backend-primary-candidate',
  'cloud-candidate',
  'fallback-localStorage',
  'emergency-local',
  'disabled',
  'unknown',
];

const cloudPullStates: CloudPullState[] = [
  'cloud-pull-disabled',
  'cloud-pull-dry-run',
  'cloud-pull-needs-confirmation',
  'cloud-pull-blocked',
];

const cloudPushStates: CloudPushState[] = [
  'cloud-push-disabled',
  'cloud-push-dry-run',
  'cloud-push-needs-confirmation',
  'cloud-push-blocked',
];

const recoveryStates: ProductionRecoveryState[] = [
  'normal',
  'caution',
  'stop',
  'emergency',
  'rollback-available',
  'rollback-needed',
  'kill-switch-available',
  'owner-mismatch',
  'schema-validation-failed',
  'diagnostics-insufficient',
];

const joinedViewText = () => JSON.stringify(buildProductionCandidateControlView({
  dataSourceState: 'localStorage-primary',
  cloudPullState: 'cloud-pull-dry-run',
  cloudPushState: 'cloud-push-dry-run',
  recoveryState: 'owner-mismatch',
  ownerStatus: 'owner-mismatch',
  schemaStatus: 'schema-validation-failed',
  rollbackAvailable: true,
  emergencyLocalAvailable: true,
}));

describe('production candidate control copy', () => {
  it('maps every required data source state to Chinese-first copy', () => {
    for (const state of dataSourceStates) {
      const copy = getDataSourceCopy(state);
      expect(copy.label).toMatch(/[\u4e00-\u9fa5]/);
      expect(copy.summary).toMatch(/[\u4e00-\u9fa5]/);
    }
  });

  it('maps every required cloud operation and recovery state', () => {
    for (const state of cloudPullStates) expect(getCloudOperationCopy(state).label).toMatch(/[\u4e00-\u9fa5]/);
    for (const state of cloudPushStates) expect(getCloudOperationCopy(state).label).toMatch(/[\u4e00-\u9fa5]/);
    for (const state of recoveryStates) expect(getRecoveryStateCopy(state).label).toMatch(/[\u4e00-\u9fa5]/);
  });

  it('labels localStorage-primary as the safest local default', () => {
    const copy = getDataSourceCopy('localStorage-primary');

    expect(copy.label).toContain('本地数据模式');
    expect(copy.summary).toContain('当前使用本机数据');
    expect(copy.summary).toContain('最安全默认模式');
  });

  it('labels cloud candidate as manual and not automatically synced', () => {
    const copy = getDataSourceCopy('cloud-candidate');

    expect(copy.label).toContain('云端候选模式');
    expect(copy.summary).toContain('需要手动确认');
    expect(copy.summary).toContain('不会自动同步');
  });

  it('makes cloud pull dry run clearly non-applying', () => {
    const copy = getCloudPullCopy('cloud-pull-dry-run');

    expect(copy.label).toContain('从云端读取候选数据');
    expect(copy.summary).toContain('不会自动覆盖本地数据');
    expect(copy.safety).toContain('手动确认');
  });

  it('makes cloud push require dry run owner backup and confirmation without fake success', () => {
    const copy = getCloudPushCopy('cloud-push-dry-run');

    expect(copy.label).toContain('准备上传候选数据');
    expect(copy.summary).toContain('dry run');
    expect(copy.summary).toContain('owner check');
    expect(copy.summary).toContain('backup check');
    expect(copy.summary).toContain('手动确认');
    expect(copy.safety).toContain('不允许假成功');
  });

  it('uses human-readable conservative copy for dangerous states', () => {
    expect(getRecoveryStateCopy('owner-mismatch')).toMatchObject({
      label: '数据归属不一致',
      summary: '先不要上传或应用云端数据。',
    });
    expect(getRecoveryStateCopy('schema-validation-failed')).toMatchObject({
      label: '数据结构验证失败',
      summary: '先不要上传或应用云端数据。',
    });
    expect(getDataSourceCopy('emergency-local').summary).toContain('停止云端操作');
    expect(getRecoveryStateCopy('rollback-available').summary).toContain('关闭 cloud pull / cloud push / Supabase candidate');
    expect(getDataSourceCopy('unknown').summary).toContain('回到本地数据模式或紧急本地模式');
  });

  it('does not overclaim SaaS automatic cloud behavior or push success', () => {
    const text = joinedViewText();

    expect(text).not.toContain('public SaaS launch');
    expect(text).not.toContain('multi-user runtime');
    expect(text).not.toContain('automatic sync');
    expect(text).not.toContain('cloud push success');
    expect(text).not.toContain('上传成功');
    expect(text).toContain('不是 public SaaS');
    expect(text).toContain('不会自动同步');
  });
});
