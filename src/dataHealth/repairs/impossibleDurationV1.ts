import type { AppData, TrainingSession } from '../../models/training-model';
import {
  DATA_HEALTH_FALLBACK_DURATION_MIN,
  DATA_HEALTH_IMPOSSIBLE_DURATION_MIN,
  type RepairApplyOptions,
  type RepairApplyResult,
  type RepairDefinition,
  type RepairDetectResult,
  type RepairDryRunResult,
} from '../appDataRepairTypes';
import { applyDurationGuard } from '../dataHealthRuntimeGuard';
import { buildReceipt, cloneAppData, hashIdempotencyKey, sampleBeforeAfter } from './repairHelpers';

const REPAIR_ID = 'impossibleDurationV1';

type DurationFinding = {
  sessionId: string;
  date?: string;
  templateName?: string;
  rawDurationMin?: number;
  rawSpanMin?: number;
  derivedDurationMin?: number;
  durationInvalid: boolean;
};

const collectFindings = (history: TrainingSession[]): DurationFinding[] => {
  const findings: DurationFinding[] = [];
  history.forEach((session) => {
    const alreadyMarked = (session as TrainingSession & { durationInvalid?: boolean }).durationInvalid === true;
    if (alreadyMarked) return;
    const outcome = applyDurationGuard(session);
    const hasIssue =
      (outcome.rawDurationMin !== undefined &&
        outcome.rawDurationMin > DATA_HEALTH_IMPOSSIBLE_DURATION_MIN) ||
      (outcome.rawSpanMin !== undefined && outcome.rawSpanMin > DATA_HEALTH_IMPOSSIBLE_DURATION_MIN * 1.5);
    if (!hasIssue) return;
    findings.push({
      sessionId: session.id,
      date: session.date,
      templateName: session.templateName,
      rawDurationMin: outcome.rawDurationMin,
      rawSpanMin: outcome.rawSpanMin,
      derivedDurationMin: outcome.derivedDurationMin,
      durationInvalid: outcome.durationInvalid,
    });
  });
  return findings;
};

const detect = (appData: AppData): RepairDetectResult => {
  const findings = collectFindings(appData.history || []);
  const detected = findings.length > 0;
  return {
    repairId: REPAIR_ID,
    detected,
    occurrences: findings.length,
    affectedIds: findings.map((entry) => entry.sessionId),
    severity: detected ? 'warning' : 'info',
    userMessage: detected
      ? `${findings.length} 个会话训练时长不合理（>${DATA_HEALTH_IMPOSSIBLE_DURATION_MIN} 分钟）`
      : '所有会话训练时长在合理范围',
  };
};

const dryRun = (appData: AppData): RepairDryRunResult => {
  const detectResult = detect(appData);
  const findings = collectFindings(appData.history || []);
  const sample = sampleBeforeAfter(
    findings.map((entry) => ({
      id: entry.sessionId,
      before: `${entry.date || ''} ${entry.templateName || ''}: durationMin=${entry.rawDurationMin ?? '?'}, span=${entry.rawSpanMin?.toFixed(0) ?? '?'} 分钟`,
      after: entry.durationInvalid
        ? '标记 durationInvalid=true，疲劳/恢复运算不再使用此时长'
        : `修正为 ${entry.derivedDurationMin} 分钟（按合理跨度截取）`,
    })),
  );
  return {
    ...detectResult,
    changeSummary:
      `把训练时长 >${DATA_HEALTH_IMPOSSIBLE_DURATION_MIN} 分钟的会话修正为合理跨度；若跨度本身也异常，则标记 durationInvalid=true 并使用 ${DATA_HEALTH_FALLBACK_DURATION_MIN} 分钟 fallback 显示。原始 startedAt/finishedAt/sets 保留。`,
    changedPaths: ['history[].durationMin', 'history[].durationInvalid'],
    beforeAfterSample: sample,
    idempotencyKey: hashIdempotencyKey(REPAIR_ID, detectResult.affectedIds),
  };
};

const apply = (appData: AppData, options: RepairApplyOptions = {}): RepairApplyResult => {
  const findings = collectFindings(appData.history || []);
  const draft = cloneAppData(appData);
  draft.history = (draft.history || []).map((session) => {
    const finding = findings.find((entry) => entry.sessionId === session.id);
    if (!finding) return session;
    const next: TrainingSession & { durationInvalid?: boolean } = { ...session };
    if (finding.derivedDurationMin !== undefined && !finding.durationInvalid) {
      next.durationMin = finding.derivedDurationMin;
      next.durationInvalid = false;
    } else {
      next.durationMin = DATA_HEALTH_FALLBACK_DURATION_MIN;
      next.durationInvalid = true;
    }
    return next;
  });
  const receipt = buildReceipt({
    repairId: REPAIR_ID,
    category: 'duration_sanity',
    action: '修正不合理的训练时长（保留时间戳与训练记录）',
    affectedIds: findings.map((entry) => entry.sessionId),
    beforeSummary: `${findings.length} 个会话时长 >${DATA_HEALTH_IMPOSSIBLE_DURATION_MIN} 分钟`,
    afterSummary: '已用合理跨度替换或标记为 durationInvalid',
    repairedAt: options.repairedAt,
    before: findings,
  });
  return {
    repairId: REPAIR_ID,
    status: 'applied',
    repairedData: draft,
    receipt,
    warnings: [],
  };
};

export const impossibleDurationV1: RepairDefinition = {
  repairId: REPAIR_ID,
  version: 1,
  layer: 'safe_auto',
  category: 'duration_sanity',
  description: '修正不合理的训练时长',
  affectedAppDataPaths: ['history[].durationMin', 'history[].durationInvalid'],
  detect,
  dryRun,
  apply,
};
