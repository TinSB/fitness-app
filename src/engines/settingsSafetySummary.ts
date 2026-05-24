import type { DataHealthOverallState } from './dataHealthClaritySummary';
import type { ThemePreferenceMode } from './themePreferenceModel';
import type { WeightUnit } from '../models/training-model';

export type SettingsSafetyOverallState = 'safe' | 'review_recommended' | 'caution' | 'stop' | 'emergency' | 'incomplete';
export type SettingsSafetySectionId =
  | 'overview'
  | 'app_preferences'
  | 'backup_recovery'
  | 'emergency_local'
  | 'equipment_profiles'
  | 'cloud_candidate'
  | 'diagnostics_data_health'
  | 'about_data_safety';

export type SettingsSafetySection = {
  id: SettingsSafetySectionId;
  title: string;
  state: SettingsSafetyOverallState;
  copy: string;
};

export type SettingsSafetySummaryInput = {
  backupStatus?: 'ready' | 'stale' | 'missing' | 'unverified' | 'unknown';
  emergencyLocalAvailable?: boolean;
  cloudCandidateEnabled?: boolean;
  sourceOfTruthClear?: boolean;
  dataHealthOverallState?: DataHealthOverallState;
  diagnosticsAvailable?: boolean;
  equipmentProfileCoverage?: 'complete' | 'partial' | 'incomplete' | 'unknown';
  acceptedMutationRouteCount?: number;
  hasBlockedRoutes?: boolean;
  themeMode?: ThemePreferenceMode;
  unitsMode?: WeightUnit;
  personalOnlyMode?: boolean;
  cloudSyncEnabled?: boolean;
  automaticWorkerEnabled?: boolean;
};

export type SettingsSafetySummaryResult = {
  overallSafetyState: SettingsSafetyOverallState;
  summaryTitle: string;
  summaryExplanation: string;
  sections: SettingsSafetySection[];
  highRiskWarnings: string[];
  safeNextActions: string[];
  cloudCandidateCopy: string;
  backupRecoveryCopy: string;
  emergencyLocalCopy: string;
  diagnosticsCopy: string;
  equipmentProfileCopy: string;
  sourceOfTruthChanged: false;
  trainingAlgorithmChanged: false;
  routeSurfaceChanged: false;
  cloudSyncChanged: false;
};

const cloneInput = (input: SettingsSafetySummaryInput): SettingsSafetySummaryInput => ({ ...input });

const stateRank: Record<SettingsSafetyOverallState, number> = {
  safe: 0,
  review_recommended: 1,
  incomplete: 2,
  caution: 3,
  stop: 4,
  emergency: 5,
};

const highestState = (states: SettingsSafetyOverallState[]) =>
  states.reduce<SettingsSafetyOverallState>((current, state) => (stateRank[state] > stateRank[current] ? state : current), 'safe');

export const buildSettingsSafetySummary = (input: SettingsSafetySummaryInput = {}): SettingsSafetySummaryResult => {
  const source = cloneInput(input);
  const highRiskWarnings: string[] = [];
  const safeNextActions: string[] = ['继续使用本地数据', '保持手动备份', '高风险操作前先确认'];

  const cloudBoundaryViolation = source.cloudSyncEnabled === true || source.automaticWorkerEnabled === true;
  if (cloudBoundaryViolation) {
    highRiskWarnings.push('检测到 cloud sync 或 background sync 标记；R6 必须视为边界违规。');
    safeNextActions.unshift('关闭云同步候选并回到本地模式');
  }

  if (source.sourceOfTruthClear === false) {
    highRiskWarnings.push('当前数据来源不清楚。');
    safeNextActions.unshift('回到本地模式');
  }

  const backupState: SettingsSafetyOverallState =
    source.backupStatus === 'missing' || source.backupStatus === 'stale' || source.backupStatus === 'unverified'
      ? 'review_recommended'
      : source.backupStatus === 'unknown'
        ? 'incomplete'
        : 'safe';

  const equipmentState: SettingsSafetyOverallState =
    source.equipmentProfileCoverage === 'incomplete' || source.equipmentProfileCoverage === 'unknown'
      ? 'review_recommended'
      : source.equipmentProfileCoverage === 'partial'
        ? 'review_recommended'
        : 'safe';

  const dataHealthState: SettingsSafetyOverallState =
    source.dataHealthOverallState === 'emergency'
      ? 'emergency'
      : source.dataHealthOverallState === 'stop'
        ? 'stop'
        : source.dataHealthOverallState === 'caution'
          ? 'caution'
          : source.dataHealthOverallState === 'review_recommended' || source.dataHealthOverallState === 'data_insufficient'
            ? 'review_recommended'
            : 'safe';

  const routeState: SettingsSafetyOverallState =
    source.acceptedMutationRouteCount !== undefined && source.acceptedMutationRouteCount !== 7
      ? 'stop'
      : source.hasBlockedRoutes === false
        ? 'stop'
        : 'safe';

  const emergencyState: SettingsSafetyOverallState = source.emergencyLocalAvailable === false ? 'emergency' : 'safe';
  const cloudState: SettingsSafetyOverallState =
    cloudBoundaryViolation ? 'emergency' : source.cloudCandidateEnabled ? 'review_recommended' : 'safe';
  const sourceState: SettingsSafetyOverallState = source.sourceOfTruthClear === false ? 'stop' : 'safe';
  const personalState: SettingsSafetyOverallState = source.personalOnlyMode === false ? 'stop' : 'safe';

  if (backupState !== 'safe') safeNextActions.push('建议先做一次手动备份');
  if (equipmentState !== 'safe') safeNextActions.push('建议完善器械档案');
  if (source.cloudCandidateEnabled) safeNextActions.push('云端候选保持手动确认');

  const overallSafetyState = highestState([
    backupState,
    equipmentState,
    dataHealthState,
    routeState,
    emergencyState,
    cloudState,
    sourceState,
    personalState,
  ]);

  const summaryTitle =
    overallSafetyState === 'safe'
      ? '本地优先正常'
      : overallSafetyState === 'review_recommended'
        ? '建议复查设置'
        : overallSafetyState === 'caution'
          ? '设置需要谨慎处理'
          : overallSafetyState === 'stop'
            ? '先回到本地模式'
            : overallSafetyState === 'emergency'
              ? '先使用紧急本地边界'
              : '设置仍需补全';

  const summaryExplanation =
    overallSafetyState === 'safe'
      ? '本地数据是默认来源，紧急本地模式可用。'
      : '设置中心集中处理备份、云端候选、诊断和器械档案；训练流程不承担高风险操作。';

  return {
    overallSafetyState,
    summaryTitle,
    summaryExplanation,
    sections: [
      {
        id: 'overview',
        title: '设置安全总览',
        state: overallSafetyState,
        copy: '当前使用本地数据；本地训练记录仍可继续。',
      },
      {
        id: 'app_preferences',
        title: '应用偏好',
        state: 'safe',
        copy: `主题 ${source.themeMode || 'system'}；单位 ${source.unitsMode || 'kg'}。主题只影响界面显示。`,
      },
      {
        id: 'backup_recovery',
        title: '备份与恢复',
        state: backupState,
        copy: '先导出备份，再进行恢复；导入前会先校验，确认后才替换当前浏览器数据。',
      },
      {
        id: 'emergency_local',
        title: '紧急本地模式',
        state: emergencyState,
        copy: '紧急本地模式可用，本地训练记录仍可继续。',
      },
      {
        id: 'equipment_profiles',
        title: '器械档案',
        state: equipmentState,
        copy: '器械档案只影响显示和推荐解释，不会自动改写历史记录。',
      },
      {
        id: 'cloud_candidate',
        title: '云端候选',
        state: cloudState,
        copy: '云端候选需要手动确认，不改变本地数据。',
      },
      {
        id: 'diagnostics_data_health',
        title: '诊断与数据安全',
        state: dataHealthState,
        copy: '诊断摘要不会上传完整训练数据；只显示脱敏摘要。',
      },
      {
        id: 'about_data_safety',
        title: '关于与数据安全',
        state: highestState([routeState, personalState]),
        copy: '个人训练工具方向保持；写入边界已锁定。',
      },
    ],
    highRiskWarnings,
    safeNextActions: [...new Set(safeNextActions)],
    cloudCandidateCopy:
      '云端候选需要手动确认；上传候选也需要再次确认。',
    backupRecoveryCopy:
      '先导出备份，再进行恢复。恢复会覆盖当前浏览器里的 IronPath 数据，请先确认备份。',
    emergencyLocalCopy: '紧急本地模式可用，本地训练记录仍可继续。',
    diagnosticsCopy: '诊断摘要不会上传完整训练数据；只显示脱敏摘要；不会外传诊断。',
    equipmentProfileCopy:
      '器械档案只影响推荐显示，不会自动改写历史记录。',
    sourceOfTruthChanged: false,
    trainingAlgorithmChanged: false,
    routeSurfaceChanged: false,
    cloudSyncChanged: false,
  };
};
