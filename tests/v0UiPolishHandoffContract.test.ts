import { describe, expect, it } from 'vitest';
import {
  buildV0UiPolishHandoffContract,
  PHASE20I_V0_UI_POLISH_HANDOFF_CONTRACT_ID,
  type Phase20iV0UiPolishHandoffInput,
} from '../src/cloudProduction/v0UiPolishHandoffContract';
import type { Phase20hProductionAcceptanceSyntheticResult } from '../src/cloudProduction/productionAcceptanceSyntheticData';

const nowIso = '2026-05-25T01:10:00.000Z';

const productionAcceptance = (
  overrides: Partial<Phase20hProductionAcceptanceSyntheticResult> = {},
): Phase20hProductionAcceptanceSyntheticResult => ({
  id: 'phase20h-accepted-1',
  baseId: 'phase20h-production-acceptance-synthetic-data',
  phase: '20H',
  ok: true,
  status: 'accepted_for_ui_polish_handoff',
  readyFor20I: true,
  blockers: [],
  warnings: [],
  userMessage: '合成数据验收完成',
  manualAcceptance: {
    id: 'phase19l-accepted-1',
    baseId: 'phase19-production-manual-acceptance',
    phase: '19L',
    ok: true,
    status: 'manual_acceptance_passed',
    manualAcceptancePassed: true,
    readyForFutureCloudPrimaryConsideration: true,
    blockers: [],
    warnings: [],
    validationAccepted: true,
    privacyAccepted: true,
    fallbackAccepted: true,
    routeBoundaryAccepted: true,
    productionLaunchPerformed: false,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    sourceOfTruthChanged: false,
    finalPhaseComplete: true,
    createdAt: nowIso,
  },
  validationAccepted: true,
  syntheticEvidenceAccepted: true,
  privacyAccepted: true,
  fallbackAccepted: true,
  routeBoundaryAccepted: true,
  cloudWriteCandidateAccepted: true,
  syncRuntimeEnabled: true,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  uploadPerformed: false,
  downloadPerformed: false,
  autoApplied: false,
  localDataChanged: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
  localStorageFallbackPreserved: true,
  productionLaunchPerformed: false,
  nextPhase: '20I - v0 UI Polish Handoff Contract V1',
  createdAt: nowIso,
  ...overrides,
});

const handoffBoundary = () => ({
  uiPolishStarted: false,
  businessLogicInPresentationalComponents: false,
  stablePropsDocumented: true,
  stableDataTestIdsDocumented: true,
  chineseFirstCopyConfirmed: true,
  forbiddenCopyAbsent: true,
  durableApplyCopyAbsent: true,
  routeChangePresent: false,
  schemaChangePresent: false,
  persistenceChangePresent: false,
  packageLockfileChanged: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
});

const validInput = (
  overrides: Partial<Phase20iV0UiPolishHandoffInput> = {},
): Phase20iV0UiPolishHandoffInput => ({
  enabled: true,
  productionAcceptance: productionAcceptance(),
  handoffBoundary: handoffBoundary(),
  nowIso,
  handoffId: 'phase20i-handoff-1',
  ...overrides,
});

const visibleCopy = (value: unknown) => JSON.stringify(value);

describe('Phase 20I v0 UI polish handoff contract', () => {
  it('is disabled by default and does not start polish or change runtime behavior', () => {
    const result = buildV0UiPolishHandoffContract();

    expect(result).toMatchObject({
      baseId: PHASE20I_V0_UI_POLISH_HANDOFF_CONTRACT_ID,
      phase: '20I',
      ok: false,
      status: 'disabled',
      readyForV0UiPolish: false,
      phase20SequenceComplete: false,
      uiPolishStarted: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      productionLaunchPerformed: false,
      blockers: expect.arrayContaining([
        'handoff_disabled',
        'phase20h_not_ready',
      ]),
    });
  });

  it('passes with 20H acceptance and exposes stable v0 polish surfaces', () => {
    const input = validInput();
    const before = JSON.parse(JSON.stringify(input));

    const result = buildV0UiPolishHandoffContract(input);

    expect(result).toMatchObject({
      id: 'phase20i-handoff-1',
      ok: true,
      status: 'handoff_ready',
      readyForV0UiPolish: true,
      phase20SequenceComplete: true,
      productionAccepted: true,
      stablePropsReady: true,
      stableDataTestIdsReady: true,
      copyReady: true,
      userMessage: '界面打磨交接已准备',
      uiPolishStarted: false,
      liveCloudSyncActivated: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      productionLaunchPerformed: false,
      nextPhase: 'v0 UI Polish may start in a separate design task',
      createdAt: nowIso,
    });
    expect(result.surfaces.map((surface) => surface.id)).toEqual([
      'auth_screen',
      'sync_status_center',
      'first_sync_flow',
      'conflict_review',
      'offline_recovery',
      'account_settings',
    ]);
    expect(result.surfaces.flatMap((surface) => surface.stableDataTestIds)).toEqual(
      expect.arrayContaining([
        'ironpath-auth-card',
        'ironpath-sync-status-center',
        'ironpath-first-sync-flow',
        'ironpath-conflict-review',
        'ironpath-offline-recovery',
        'ironpath-account-settings',
      ]),
    );
    expect(result.copyExamples).toEqual(expect.arrayContaining([
      '登录账号',
      '开启同步',
      '本地数据仍会保留',
      '开启前先备份',
      '不会自动覆盖本地训练记录',
      '查看冲突',
      '保留本地',
      '使用云端',
      '稍后再说',
      '退出登录',
    ]));
    expect(input).toEqual(before);
  });

  it('requires 20H production acceptance readiness', () => {
    const result = buildV0UiPolishHandoffContract(validInput({
      productionAcceptance: productionAcceptance({
        ok: false,
        readyFor20I: false,
        status: 'phase20g_not_ready',
      }),
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'phase20h_not_ready',
      readyForV0UiPolish: false,
      phase20SequenceComplete: false,
      blockers: expect.arrayContaining(['phase20h_not_ready']),
    });
  });

  it('blocks handoff when 20H evidence indicates runtime mutation or source switch', () => {
    const result = buildV0UiPolishHandoffContract(validInput({
      productionAcceptance: productionAcceptance({
        uploadPerformed: true as false,
        downloadPerformed: true as false,
        autoApplied: true as false,
        sourceOfTruthChanged: true as false,
        localStorageDeleted: true as false,
        productionLaunchPerformed: true as false,
      }),
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'phase20h_not_ready',
      uploadPerformed: false,
      downloadPerformed: false,
      autoApplied: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      productionLaunchPerformed: false,
      blockers: expect.arrayContaining([
        'upload_performed',
        'download_performed',
        'auto_apply_available',
        'source_of_truth_changed',
        'localStorage_deleted',
        'production_launch_performed',
      ]),
    });
  });

  it('requires stable props test ids copy and passive boundary evidence', () => {
    const result = buildV0UiPolishHandoffContract(validInput({
      handoffBoundary: {
        ...handoffBoundary(),
        stablePropsDocumented: false,
        stableDataTestIdsDocumented: false,
        chineseFirstCopyConfirmed: false,
        forbiddenCopyAbsent: false,
        durableApplyCopyAbsent: false,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'handoff_boundary_missing',
      readyForV0UiPolish: false,
      stablePropsReady: false,
      stableDataTestIdsReady: false,
      copyReady: false,
      blockers: expect.arrayContaining([
        'stable_props_missing',
        'stable_testids_missing',
        'chinese_copy_missing',
        'forbidden_copy_present',
        'durable_apply_copy_present',
      ]),
    });
  });

  it('blocks actual polish work route changes schema changes persistence changes and package drift', () => {
    const result = buildV0UiPolishHandoffContract(validInput({
      handoffBoundary: {
        ...handoffBoundary(),
        uiPolishStarted: true,
        businessLogicInPresentationalComponents: true,
        routeChangePresent: true,
        schemaChangePresent: true,
        persistenceChangePresent: true,
        packageLockfileChanged: true,
        cloudPrimaryEnabled: true,
        defaultSyncEnabled: true,
        backgroundWorkEnabled: true,
        sourceOfTruthChanged: true,
        localStorageDeleted: true,
      },
    }));

    expect(result).toMatchObject({
      ok: false,
      status: 'scope_unsafe',
      readyForV0UiPolish: false,
      uiPolishStarted: false,
      cloudPrimaryEnabled: false,
      defaultSyncEnabled: false,
      backgroundWorkEnabled: false,
      sourceOfTruthChanged: false,
      localStorageDeleted: false,
      blockers: expect.arrayContaining([
        'ui_polish_started',
        'business_logic_in_presentational_components',
        'route_change_present',
        'schema_change_present',
        'persistence_change_present',
        'package_lockfile_drift',
        'cloud_primary_enabled',
        'default_sync_enabled',
        'background_work_enabled',
        'source_of_truth_changed',
        'localStorage_deleted',
      ]),
    });
  });

  it('keeps visible handoff copy clean and passive', () => {
    const result = buildV0UiPolishHandoffContract(validInput());
    const copy = visibleCopy({
      userMessage: result.userMessage,
      surfaces: result.surfaces,
      copyExamples: result.copyExamples,
      blockedCapabilities: result.blockedCapabilities,
    });

    for (const forbidden of [
      '引擎',
      '算法',
      '自动化',
      '模型',
      'AI 教练',
      '系统判断',
      '智能推荐',
      '决策系统',
      'engine',
      'algorithm',
      'automation',
      'model',
      'AI coach',
      'intelligent recommendation',
      'decision system',
      '应用到计划',
      '生成草案',
      '自动调整',
      '自动应用',
      '自动生成计划',
    ]) {
      expect(copy).not.toContain(forbidden);
    }
  });

  it('uses deterministic ids when nowIso is fixed and no explicit id is supplied', () => {
    const input = validInput({ handoffId: undefined });

    const first = buildV0UiPolishHandoffContract(input);
    const second = buildV0UiPolishHandoffContract(input);

    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(nowIso);
  });
});
