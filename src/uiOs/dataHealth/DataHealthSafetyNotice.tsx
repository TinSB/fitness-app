import type { DataHealthClaritySummaryResult } from '../../engines/dataHealthClaritySummary';
import { SafetyStrip } from '../surfaces/SafetyStrip';

type DataHealthSafetyNoticeProps = {
  summary: DataHealthClaritySummaryResult;
};

export function DataHealthSafetyNotice({ summary }: DataHealthSafetyNoticeProps) {
  const state = summary.shouldUseEmergencyLocal ? 'emergency-ready' : summary.shouldPauseCloudCandidate ? 'cloud-paused' : 'local-ok';

  return (
    <div className="space-y-2" aria-label="Data Health local-first safety notice">
      <SafetyStrip state={state} includeSecondaryCopy />
      <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/55">
        {summary.canContinueLocalTraining
          ? '非严重问题不会频繁打断训练。本地训练记录仍可继续，完整复查放在数据健康页。'
          : '当前问题需要先确认数据来源或归属。不要执行自动同步、上传或破坏性修复。'}
      </div>
    </div>
  );
}
