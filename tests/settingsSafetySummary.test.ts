import { describe, expect, it } from 'vitest';
import { buildSettingsSafetySummary, type SettingsSafetySummaryInput } from '../src/engines/settingsSafetySummary';

const safeInput: SettingsSafetySummaryInput = {
  backupStatus: 'ready',
  emergencyLocalAvailable: true,
  cloudCandidateEnabled: false,
  sourceOfTruthClear: true,
  dataHealthOverallState: 'healthy',
  diagnosticsAvailable: true,
  equipmentProfileCoverage: 'complete',
  acceptedMutationRouteCount: 7,
  hasBlockedRoutes: true,
  themeMode: 'system',
  unitsMode: 'lb',
  personalOnlyMode: true,
  cloudSyncEnabled: false,
  automaticWorkerEnabled: false,
};

describe('settings safety summary', () => {
  it('returns safe state for local-first setup', () => {
    const result = buildSettingsSafetySummary(safeInput);

    expect(result.overallSafetyState).toBe('safe');
    expect(result.summaryTitle).toContain('本地优先正常');
    expect(result.summaryExplanation).toContain('本地数据是默认来源');
    expect(result.emergencyLocalCopy).toContain('紧急本地模式可用');
  });

  it('recommends review for stale or missing backup', () => {
    expect(buildSettingsSafetySummary({ ...safeInput, backupStatus: 'stale' }).overallSafetyState).toBe('review_recommended');
    const missing = buildSettingsSafetySummary({ ...safeInput, backupStatus: 'missing' });

    expect(missing.overallSafetyState).toBe('review_recommended');
    expect(missing.safeNextActions).toContain('建议先做一次手动备份');
  });

  it('routes unclear source to stop state and local-first action', () => {
    const result = buildSettingsSafetySummary({ ...safeInput, sourceOfTruthClear: false });

    expect(result.overallSafetyState).toBe('stop');
    expect(result.safeNextActions[0]).toBe('回到本地模式');
    expect(result.highRiskWarnings).toContain('当前数据来源不清楚。');
  });

  it('keeps manual cloud candidate copy from implying positive automatic sync', () => {
    const result = buildSettingsSafetySummary({ ...safeInput, cloudCandidateEnabled: true });

    expect(result.cloudCandidateCopy).toContain('云端候选需要手动确认');
    expect(result.cloudCandidateCopy).not.toContain('自动覆盖');
    expect(result.cloudCandidateCopy).toContain('上传候选也需要再次确认');
    expect(result.cloudCandidateCopy).not.toContain('自动同步已启用');
  });

  it('recommends equipment review when profile coverage is incomplete', () => {
    const result = buildSettingsSafetySummary({ ...safeInput, equipmentProfileCoverage: 'incomplete' });

    expect(result.overallSafetyState).toBe('review_recommended');
    expect(result.safeNextActions).toContain('建议完善器械档案');
    expect(result.equipmentProfileCopy).toContain('器械档案只影响推荐显示');
    expect(result.equipmentProfileCopy).toContain('不会自动改写历史记录');
  });

  it('keeps diagnostics copy redacted and no full AppData', () => {
    const result = buildSettingsSafetySummary(safeInput);

    expect(result.diagnosticsCopy).toContain('诊断摘要不会上传完整训练数据');
    expect(result.diagnosticsCopy).toContain('脱敏摘要');
    expect(result.diagnosticsCopy).toContain('不会外传诊断');
  });

  it('keeps invariant flags false and does not mutate input', () => {
    const input = { ...safeInput, equipmentProfileCoverage: 'partial' as const };
    const before = JSON.stringify(input);
    const result = buildSettingsSafetySummary(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(result.sourceOfTruthChanged).toBe(false);
    expect(result.trainingAlgorithmChanged).toBe(false);
    expect(result.routeSurfaceChanged).toBe(false);
    expect(result.cloudSyncChanged).toBe(false);
  });

  it('treats cloud sync and background sync as boundary violations', () => {
    const result = buildSettingsSafetySummary({ ...safeInput, cloudSyncEnabled: true, automaticWorkerEnabled: true });

    expect(result.overallSafetyState).toBe('emergency');
    expect(result.highRiskWarnings.join(' ')).toContain('边界违规');
    expect(result.cloudSyncChanged).toBe(false);
  });
});
