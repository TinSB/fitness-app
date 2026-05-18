import {
  buildDataHealthDiagnosticsClarity,
  buildDiagnosticRedactionReminder,
  type DataHealthDiagnosticsCategory,
} from './dataHealthDiagnosticsClarity';

export type DataHealthDiagnosticsSummaryPanelProps = {
  visible?: boolean;
  category?: DataHealthDiagnosticsCategory;
  issueCount?: number;
  ownerScopeClear?: boolean;
  schemaValidationClear?: boolean;
  backupRecoveryClear?: boolean;
  diagnosticsClear?: boolean;
  cloudCandidateEnabled?: boolean;
  emergencyLocalAvailable?: boolean;
};

export const DataHealthDiagnosticsSummaryPanel = ({
  visible = true,
  category,
  issueCount = 0,
  ownerScopeClear = true,
  schemaValidationClear = true,
  backupRecoveryClear = true,
  diagnosticsClear = true,
  cloudCandidateEnabled = false,
  emergencyLocalAvailable = true,
}: DataHealthDiagnosticsSummaryPanelProps) => {
  if (!visible) return null;

  const result = buildDataHealthDiagnosticsClarity({
    category,
    issueCount,
    ownerScopeClear,
    schemaValidationClear,
    backupRecoveryClear,
    diagnosticsClear,
    cloudCandidateEnabled,
    emergencyLocalAvailable,
  });

  return (
    <section aria-label="Data health diagnostics clarity panel" data-data-health-diagnostics-panel="presentational">
      <h2>数据健康 / 诊断摘要</h2>
      <p>{result.statusLabel}</p>
      <p>{result.explanation}</p>
      <p>安全下一步：{result.safeNextAction}</p>
      <p>本地继续可用：{result.canContinueLocal ? '是' : '否'}</p>
      <p>修复操作允许：{result.repairActionAllowed ? '是' : '否'}</p>
      <p>{buildDiagnosticRedactionReminder()}</p>
      <ul>
        {result.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button type="button" disabled aria-disabled="true">
        自动修复保持关闭
      </button>
    </section>
  );
};
