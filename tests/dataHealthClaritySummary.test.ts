import { describe, expect, it } from 'vitest';
import { buildDataHealthClaritySummary } from '../src/engines/dataHealthClaritySummary';

describe('dataHealthClaritySummary', () => {
  it('returns healthy state when there are no issues', () => {
    const result = buildDataHealthClaritySummary({ issues: [], sourceOfTruthClear: true });

    expect(result.overallState).toBe('healthy');
    expect(result.summaryExplanation).toContain('没有发现明显异常');
    expect(result.canContinueLocalTraining).toBe(true);
    expect(result.safeNextAction).toBe('no_action_needed');
  });

  it('maps schema validation issues to owner-friendly pause-cloud guidance', () => {
    const result = buildDataHealthClaritySummary({
      issues: [{
        id: 'schema-validation-failed',
        title: 'Schema validation failed',
        userMessage: '数据结构验证失败。',
        severityLabel: '需要处理',
      }],
    });

    expect(result.overallState).toBe('stop');
    expect(result.shouldPauseCloudCandidate).toBe(true);
    expect(result.issueCards[0].explanation).toContain('数据结构验证失败');
    expect(result.issueCards[0].safeNextAction).toBe('inspect_schema_validation');
  });

  it('maps owner mismatch to owner-scope guidance', () => {
    const result = buildDataHealthClaritySummary({
      issues: [{
        id: 'owner-scope-mismatch',
        title: 'Owner mismatch',
        userMessage: '数据归属不一致。',
        severityLabel: '需要处理',
      }],
    });

    expect(result.overallState).toBe('stop');
    expect(result.issueCards[0].safeNextAction).toBe('inspect_owner_scope');
    expect(result.issueCards[0].cloudCandidateCopy).toContain('云端候选暂停');
  });

  it('maps missing backup to manual backup guidance', () => {
    const result = buildDataHealthClaritySummary({
      issues: [{
        id: 'backup-missing',
        title: '缺少备份',
        userMessage: '没有可确认的备份。',
        severityLabel: '建议复查',
      }],
    });

    expect(result.overallState).toBe('caution');
    expect(result.issueCards[0].safeNextAction).toBe('check_backup');
    expect(result.issueCards[0].explanation).toContain('先做手动备份');
  });

  it('recommends emergency local-first action for severe source unclear state', () => {
    const result = buildDataHealthClaritySummary({
      sourceOfTruthClear: false,
      issues: [{
        id: 'source-unclear',
        title: '数据来源待确认',
        userMessage: '来源待确认。',
        severityLabel: '紧急',
      }],
    });

    expect(result.overallState).toBe('emergency');
    expect(result.safeNextAction).toBe('use_emergency_local');
    expect(result.shouldUseEmergencyLocal).toBe(true);
    expect(result.canContinueLocalTraining).toBe(false);
  });

  it('allows local training to continue for non-severe issues', () => {
    const result = buildDataHealthClaritySummary({
      issues: [{
        id: 'dismissed-low-risk',
        title: '低风险提示',
        userMessage: '这条问题暂时不影响本地训练记录。',
        severityLabel: '提示',
      }],
    });

    expect(result.overallState).toBe('review_recommended');
    expect(result.canContinueLocalTraining).toBe(true);
    expect(result.issueCards[0].safeNextAction).toBe('continue_local_training');
  });

  it('never allows repair destructive actions external upload or source-of-truth mutation', () => {
    const result = buildDataHealthClaritySummary({
      issues: [{ id: 'summary-mismatch', title: '历史 Summary 与组记录不一致', userMessage: '建议复查。' }],
    });

    expect(result.repairActionAllowed).toBe(false);
    expect(result.destructiveActionAllowed).toBe(false);
    expect(result.externalUploadAllowed).toBe(false);
    expect(result.sourceOfTruthChanged).toBe(false);
  });
});
