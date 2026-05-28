import type { AppData, ExercisePrescription, TrainingSession } from '../../models/training-model';
import type {
  RepairApplyOptions,
  RepairApplyResult,
  RepairDefinition,
  RepairDetectResult,
  RepairDryRunResult,
} from '../appDataRepairTypes';
import { buildReceipt, hashIdempotencyKey, sampleBeforeAfter } from './repairHelpers';

const REPAIR_ID = 'replacementEquivalenceAuditV1';

const VERTICAL_PULL_IDS = new Set(['assisted-pull-up', 'pull-up', 'chin-up']);
const VERTICAL_PUSH_IDS = new Set(['assisted-dip', 'dip', 'bench-dip']);

const isHorizontalPullChain = (chainId: unknown): boolean =>
  typeof chainId === 'string' && chainId.includes('horizontal-pull');
const isFlyChain = (chainId: unknown): boolean =>
  typeof chainId === 'string' && chainId === 'fly';

const readChainId = (
  exercise: ExercisePrescription,
): string | undefined => {
  const equivalence = (exercise as ExercisePrescription & {
    equivalence?: { chainId?: string; id?: string };
  }).equivalence;
  if (!equivalence) return undefined;
  if (typeof equivalence.chainId === 'string') return equivalence.chainId;
  if (typeof equivalence.id === 'string') return equivalence.id;
  return undefined;
};

type Finding = {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  baseId?: string;
  actualExerciseId?: string;
  originalExerciseId?: string;
  reason: string;
};

const collect = (history: TrainingSession[]): Finding[] => {
  const findings: Finding[] = [];
  history.forEach((session) => {
    (session.exercises || []).forEach((exercise: ExercisePrescription) => {
      const chainId = readChainId(exercise);
      const actual = exercise.actualExerciseId;
      const reasons: string[] = [];
      if (actual && VERTICAL_PULL_IDS.has(String(actual)) && isHorizontalPullChain(chainId)) {
        reasons.push(`垂直拉动作匹配到水平拉链：chainId=${chainId}`);
      }
      if (actual && VERTICAL_PUSH_IDS.has(String(actual)) && isFlyChain(chainId)) {
        reasons.push(`垂直推动作匹配到飞鸟链：chainId=${chainId}`);
      }
      if (reasons.length > 0) {
        findings.push({
          sessionId: session.id,
          exerciseId: exercise.id,
          exerciseName: exercise.name || exercise.id,
          baseId: exercise.baseId,
          actualExerciseId: actual,
          originalExerciseId: exercise.originalExerciseId,
          reason: reasons.join('; '),
        });
      }
    });
  });
  return findings;
};

const detect = (appData: AppData): RepairDetectResult => {
  const findings = collect(appData.history || []);
  const detected = findings.length > 0;
  return {
    repairId: REPAIR_ID,
    detected,
    occurrences: findings.length,
    affectedIds: findings.map((entry) => `${entry.sessionId}/${entry.exerciseId}`),
    severity: detected ? 'warning' : 'info',
    userMessage: detected
      ? `${findings.length} 个动作的 replacement/equivalence 链与实际语义不一致；需要人工策划替换链表`
      : 'replacement/equivalence 元数据一致',
  };
};

const dryRun = (appData: AppData): RepairDryRunResult => {
  const detectResult = detect(appData);
  const findings = collect(appData.history || []);
  const sample = sampleBeforeAfter(
    findings.map((entry) => ({
      id: `${entry.sessionId}/${entry.exerciseId}`,
      before: `${entry.exerciseName} (actual=${entry.actualExerciseId}, base=${entry.baseId}): ${entry.reason}`,
      after: '审计：保留 PR/总量；不自动改写 chainId/baseId；需要人工策划',
    })),
  );
  return {
    ...detectResult,
    changeSummary:
      '审计模式：列出 replacement / equivalence 链与动作语义不一致的记录。V1 不自动重映射，避免污染 PR / 总量。',
    changedPaths: [],
    beforeAfterSample: sample,
    idempotencyKey: hashIdempotencyKey(REPAIR_ID, detectResult.affectedIds),
  };
};

const apply = (appData: AppData, options: RepairApplyOptions = {}): RepairApplyResult => {
  const findings = collect(appData.history || []);
  return {
    repairId: REPAIR_ID,
    status: 'skipped',
    repairedData: appData,
    receipt: buildReceipt({
      repairId: REPAIR_ID,
      category: 'identity_audit',
      action: 'replacement / equivalence 链审计',
      affectedIds: findings.map((entry) => `${entry.sessionId}/${entry.exerciseId}`),
      beforeSummary:
        findings.length > 0
          ? `${findings.length} 个动作 chainId/baseId 与语义不一致（仅审计）`
          : 'replacement 元数据一致',
      afterSummary: '未修改 AppData；等待人工策划替换链',
      repairedAt: options.repairedAt,
    }),
    warnings: ['audit-only: identity rewrite requires curated mapping'],
  };
};

export const replacementEquivalenceAuditV1: RepairDefinition = {
  repairId: REPAIR_ID,
  version: 1,
  layer: 'audit_only',
  category: 'identity_audit',
  description: 'replacement / equivalence 链审计',
  affectedAppDataPaths: [],
  detect,
  dryRun,
  apply,
};
