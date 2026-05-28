import type { AppData } from '../models/training-model';
import type { AppDataRepairRegistry } from './appDataRepairEngine';
import { getAppDataRepairRegistry } from './appDataRepairRegistry';
import type {
  DataHealthAutoRepairSummary,
  RepairTrigger,
} from './appDataRepairTypes';
import {
  type AutoRepairOrchestratorResult,
  readAutoRepairSummary,
  runAutoRepairOrchestrator,
} from './autoRepairOrchestrator';
import type { AutoRepairBackupAdapter } from './autoRepairBackupAdapter';
import { buildCleanAppDataView, type CleanAppDataView } from './cleanAppDataView';
import {
  evaluateCloudUploadEligibility,
  type CloudUploadEligibility,
} from './uploadEligibility';
import { computeAppDataHash } from './repairs/repairHelpers';

export type AppDataIngressSource =
  | 'boot'
  | 'localStorage-load'
  | 'import-restore'
  | 'backup-restore'
  | 'cloud-restore'
  | 'cloud-pull'
  | 'read-mirror'
  | 'cloud-parity'
  | 'account-switch'
  | 'post-session-complete'
  | 'pre-training-decision'
  | 'pre-cloud-upload'
  | 'export';

export type UploadEligibilityMode = 'check' | 'enforce' | 'ignore';

export type PassiveStatusTone = 'ok' | 'auto-repaired' | 'audit-pending' | 'backup-failed' | 'busy';

export interface AppDataIngressInput {
  source: AppDataIngressSource;
  appData: AppData;
  accountId?: string;
  allowMutation?: boolean;
  allowAutoRepair?: boolean;
  requireBackup?: boolean;
  uploadEligibilityMode?: UploadEligibilityMode;
  registry?: AppDataRepairRegistry;
  backupAdapter?: AutoRepairBackupAdapter;
  now?: () => Date;
  operationId?: string;
}

export interface AppDataIngressResult {
  source: AppDataIngressSource;
  operationId: string;
  cleanView: CleanAppDataView;
  repairedAppData?: AppData;
  repairSummary?: DataHealthAutoRepairSummary;
  orchestratorResult?: AutoRepairOrchestratorResult;
  shouldPersist: boolean;
  shouldBlockCloudUpload: boolean;
  uploadEligibility: CloudUploadEligibility;
  passiveStatus: { line: string; tone: PassiveStatusTone };
  warnings: string[];
  triggeredOrchestrator: boolean;
  appDataHashBefore: string;
  appDataHashAfter: string;
}

interface SourceDefaults {
  allowMutation: boolean;
  allowAutoRepair: boolean;
  requireBackup: boolean;
  uploadEligibilityMode: UploadEligibilityMode;
  repairTrigger: RepairTrigger;
}

const SOURCE_DEFAULTS: Record<AppDataIngressSource, SourceDefaults> = {
  'boot':                   { allowMutation: true,  allowAutoRepair: true,  requireBackup: true,  uploadEligibilityMode: 'check',   repairTrigger: 'boot' },
  'localStorage-load':      { allowMutation: true,  allowAutoRepair: true,  requireBackup: true,  uploadEligibilityMode: 'check',   repairTrigger: 'boot' },
  'import-restore':         { allowMutation: true,  allowAutoRepair: true,  requireBackup: true,  uploadEligibilityMode: 'check',   repairTrigger: 'import' },
  'backup-restore':         { allowMutation: true,  allowAutoRepair: true,  requireBackup: true,  uploadEligibilityMode: 'check',   repairTrigger: 'import' },
  'cloud-restore':          { allowMutation: true,  allowAutoRepair: true,  requireBackup: true,  uploadEligibilityMode: 'enforce', repairTrigger: 'cloud_restore' },
  'cloud-pull':             { allowMutation: false, allowAutoRepair: false, requireBackup: false, uploadEligibilityMode: 'check',   repairTrigger: 'cloud_restore' },
  'read-mirror':            { allowMutation: false, allowAutoRepair: false, requireBackup: false, uploadEligibilityMode: 'check',   repairTrigger: 'audit' },
  'cloud-parity':           { allowMutation: false, allowAutoRepair: false, requireBackup: false, uploadEligibilityMode: 'check',   repairTrigger: 'audit' },
  'account-switch':         { allowMutation: true,  allowAutoRepair: true,  requireBackup: true,  uploadEligibilityMode: 'enforce', repairTrigger: 'boot' },
  'post-session-complete':  { allowMutation: true,  allowAutoRepair: true,  requireBackup: true,  uploadEligibilityMode: 'check',   repairTrigger: 'post_session' },
  'pre-training-decision':  { allowMutation: false, allowAutoRepair: false, requireBackup: false, uploadEligibilityMode: 'ignore',  repairTrigger: 'audit' },
  'pre-cloud-upload':       { allowMutation: false, allowAutoRepair: false, requireBackup: false, uploadEligibilityMode: 'enforce', repairTrigger: 'audit' },
  'export':                 { allowMutation: false, allowAutoRepair: false, requireBackup: false, uploadEligibilityMode: 'ignore',  repairTrigger: 'manual' },
};

const FORBIDDEN_AUTO_REPAIR_WITHOUT_MUTATION: AppDataIngressSource[] = [
  'cloud-pull',
  'read-mirror',
  'cloud-parity',
  'pre-training-decision',
  'pre-cloud-upload',
  'export',
];

const composePassiveStatus = (params: {
  source: AppDataIngressSource;
  appliedCount: number;
  pendingRepairs: number;
  auditOnly: number;
  backupFailed: boolean;
}): { line: string; tone: PassiveStatusTone } => {
  if (params.backupFailed) {
    return { line: '数据正在自动整理，稍后同步', tone: 'backup-failed' };
  }
  if (params.appliedCount > 0) {
    return { line: `已自动修复 ${params.appliedCount} 个旧版本问题`, tone: 'auto-repaired' };
  }
  if (params.pendingRepairs > 0) {
    return { line: `${params.pendingRepairs} 个待自动修复`, tone: 'busy' };
  }
  if (params.auditOnly > 0) {
    return { line: `${params.auditOnly} 个已隔离，不影响训练建议`, tone: 'audit-pending' };
  }
  return { line: '数据已自动检查', tone: 'ok' };
};

const generateOperationId = (source: AppDataIngressSource, accountId: string | undefined, hash: string): string => {
  const scope = accountId ?? 'unscoped';
  const random = Math.floor(Math.random() * 1_000_000).toString(36);
  return `ingress_${source}_${scope}_${hash.slice(-8)}_${Date.now().toString(36)}_${random}`;
};

export const processIncomingAppData = async (
  input: AppDataIngressInput,
): Promise<AppDataIngressResult> => {
  const defaults = SOURCE_DEFAULTS[input.source];
  if (!defaults) {
    throw new Error(`[dataHealth] unknown ingress source: ${input.source}`);
  }
  const allowMutation = input.allowMutation ?? defaults.allowMutation;
  const allowAutoRepair = input.allowAutoRepair ?? defaults.allowAutoRepair;
  const requireBackup = input.requireBackup ?? defaults.requireBackup;
  const uploadEligibilityMode = input.uploadEligibilityMode ?? defaults.uploadEligibilityMode;

  if (allowAutoRepair && FORBIDDEN_AUTO_REPAIR_WITHOUT_MUTATION.includes(input.source) && !input.allowMutation) {
    throw new Error(`[dataHealth] ingress source ${input.source} cannot allowAutoRepair without explicit allowMutation=true`);
  }

  const now = input.now || (() => new Date());
  const registry = input.registry || getAppDataRepairRegistry();
  const appDataHashBefore = computeAppDataHash(input.appData);
  const operationId = input.operationId || generateOperationId(input.source, input.accountId, appDataHashBefore);

  const cleanView = buildCleanAppDataView(input.appData, { now });

  let orchestratorResult: AutoRepairOrchestratorResult | undefined;
  let repairedAppData: AppData | undefined;
  let workingAppData: AppData = input.appData;
  let triggeredOrchestrator = false;
  const warnings: string[] = [];

  if (allowMutation && allowAutoRepair) {
    try {
      orchestratorResult = await runAutoRepairOrchestrator({
        appData: input.appData,
        triggeredBy: defaults.repairTrigger,
        registry,
        backupAdapter: input.backupAdapter,
        now,
      });
      triggeredOrchestrator = true;
      if (orchestratorResult.changed) {
        repairedAppData = orchestratorResult.appData;
        workingAppData = orchestratorResult.appData;
      } else {
        workingAppData = orchestratorResult.appData;
      }
      orchestratorResult.warnings.forEach((warning) => warnings.push(warning));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`orchestrator_error: ${message}`);
    }
  }

  const uploadEligibility = evaluateCloudUploadEligibility(workingAppData, { registry, now });

  let shouldBlockCloudUpload = false;
  if (uploadEligibilityMode === 'enforce') {
    shouldBlockCloudUpload = !uploadEligibility.eligible;
  } else if (uploadEligibilityMode === 'check') {
    shouldBlockCloudUpload = !uploadEligibility.eligible;
  } else {
    shouldBlockCloudUpload = false;
  }

  const auditFindingsCount = orchestratorResult?.auditFindings.length ?? uploadEligibility.auditOnly;
  const appliedCount = orchestratorResult?.results.filter((entry) => entry.status === 'applied').length ?? 0;

  const passiveStatus = composePassiveStatus({
    source: input.source,
    appliedCount,
    pendingRepairs: uploadEligibility.pendingRepairs,
    auditOnly: auditFindingsCount,
    backupFailed: uploadEligibility.backupFailed,
  });

  const shouldPersist = Boolean(allowMutation && repairedAppData);

  if (requireBackup && allowMutation && allowAutoRepair && orchestratorResult && !orchestratorResult.backup && orchestratorResult.changed === false && uploadEligibility.backupFailed) {
    warnings.push('backup_failed: ingress kept runtime guard active without mutation');
  }

  const summary = readAutoRepairSummary(workingAppData);

  return {
    source: input.source,
    operationId,
    cleanView,
    repairedAppData,
    repairSummary: summary,
    orchestratorResult,
    shouldPersist,
    shouldBlockCloudUpload,
    uploadEligibility,
    passiveStatus,
    warnings,
    triggeredOrchestrator,
    appDataHashBefore,
    appDataHashAfter: computeAppDataHash(workingAppData),
  };
};

export const ingressSourceDefaults = (source: AppDataIngressSource): SourceDefaults => SOURCE_DEFAULTS[source];
