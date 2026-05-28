import type { DataHealthAutoRepairSummary } from '../../dataHealth/appDataRepairTypes';

type DataHealthAutoRepairStatusProps = {
  summary?: DataHealthAutoRepairSummary;
};

const formatLastRunAt = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
};

export function DataHealthAutoRepairStatus({ summary }: DataHealthAutoRepairStatusProps) {
  if (!summary) {
    return (
      <p className="text-xs leading-5 text-white/45" aria-label="Data Health automatic repair status">
        数据已自动检查
      </p>
    );
  }

  const fragments: string[] = ['数据已自动检查'];
  if (summary.appliedCount > 0) {
    fragments.push(`已自动修复 ${summary.appliedCount} 个旧版本问题`);
  }
  if (summary.pendingHighRiskCount > 0) {
    fragments.push(`${summary.pendingHighRiskCount} 个已隔离，不影响训练建议`);
  }
  if (summary.lastFailureCount > 0) {
    fragments.push(`${summary.lastFailureCount} 个待重试`);
  }
  const lastRun = formatLastRunAt(summary.lastRunAt);

  return (
    <p
      className="text-xs leading-5 text-white/55"
      aria-label="Data Health automatic repair status"
      data-data-health-auto-repair-status="true"
    >
      {fragments.join(' · ')}
      {lastRun ? <span className="ml-2 text-white/35">（{lastRun} 检查）</span> : null}
    </p>
  );
}
