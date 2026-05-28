import { buildRegistry, type AppDataRepairRegistry } from './appDataRepairEngine';
import type { RepairDefinition } from './appDataRepairTypes';
import { impossibleDurationV1 } from './repairs/impossibleDurationV1';
import { legacyFinalAdviceIsolationGuardV1 } from './repairs/legacyFinalAdviceIsolationGuardV1';
import { replacementEquivalenceAuditV1 } from './repairs/replacementEquivalenceAuditV1';
import { screeningIssueScoreRepairV1 } from './repairs/screeningIssueScoreRepairV1';
import { screeningIssueScoreRuntimeGuardV1 } from './repairs/screeningIssueScoreRuntimeGuardV1';
import { sessionLifecycleResidueV1 } from './repairs/sessionLifecycleResidueV1';
import { setIndexRenumberV1 } from './repairs/setIndexRenumberV1';
import { staleHealthReadinessGuardV1 } from './repairs/staleHealthReadinessGuardV1';
import { staleTodayStatusV1 } from './repairs/staleTodayStatusV1';

export const V1_REPAIRS: readonly RepairDefinition[] = [
  sessionLifecycleResidueV1,
  impossibleDurationV1,
  staleTodayStatusV1,
  staleHealthReadinessGuardV1,
  screeningIssueScoreRuntimeGuardV1,
  screeningIssueScoreRepairV1,
  legacyFinalAdviceIsolationGuardV1,
  setIndexRenumberV1,
  replacementEquivalenceAuditV1,
];

export const V1_REPAIR_IDS: readonly string[] = V1_REPAIRS.map((definition) => definition.repairId);

let cachedRegistry: AppDataRepairRegistry | null = null;

export const getAppDataRepairRegistry = (): AppDataRepairRegistry => {
  if (!cachedRegistry) {
    cachedRegistry = buildRegistry([...V1_REPAIRS]);
  }
  return cachedRegistry;
};

export {
  sessionLifecycleResidueV1,
  impossibleDurationV1,
  staleTodayStatusV1,
  staleHealthReadinessGuardV1,
  screeningIssueScoreRuntimeGuardV1,
  screeningIssueScoreRepairV1,
  legacyFinalAdviceIsolationGuardV1,
  setIndexRenumberV1,
  replacementEquivalenceAuditV1,
};

export type { AppDataRepairRegistry } from './appDataRepairEngine';
