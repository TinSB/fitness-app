// trainingDecisionCleanInput — the locked input boundary for TrainingDecision.
//
// V1 of TrainingDecision Clean Input Contract Lock. Every UI / feature / cloud
// surface that wants to call into TrainingDecision must go through this module.
//
// Background
// ----------
// V1 (Real Data Health Repair) and V2 (Cloud Restore Linkage) already wire the
// CleanAppDataView through every ingress and through the engine pipeline. What
// they do NOT enforce is the *function-signature* level: `buildTrainingDecision`
// and `buildTrainingDecisionContext` still accept raw AppData-shaped inputs, and
// a handful of feature surfaces (PlanView, RecordView, App.tsx finishSession)
// extract fields straight out of raw `data` and pass them in.
//
// This module closes that gap with:
//   1. A branded `CleanTrainingDecisionInput` type that raw TrainingDecisionInput
//      cannot structurally satisfy.
//   2. A branded `CleanTrainingDecisionContextSource` for buildTrainingDecisionContext.
//   3. Factories that accept only `CleanAppDataView` and stamp the brand.
//   4. Wrappers `buildTrainingDecisionFromCleanInput` and
//      `buildTrainingDecisionContextFromCleanInput` that accept only the branded
//      types and runtime-assert the brand.
//
// See docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md.

import type { CleanAppDataView } from '../dataHealth/cleanAppDataView';
import type {
  AdaptiveCalibrationState,
  AppData,
  TrainingMode,
  TrainingTemplate,
} from '../models/training-model';
import type { HealthSummary } from './healthSummaryEngine';
import {
  buildTrainingDecisionContext,
  type TrainingDecisionContext,
} from './trainingDecisionContext';
import {
  buildTrainingDecision,
  type TrainingDecisionSurfaceInputs,
} from './trainingDecisionEngine';
import type {
  TrainingDecision,
  TrainingDecisionInput,
} from './trainingDecisionTypes';

// ---------------------------------------------------------------------------
//   Brand symbols
// ---------------------------------------------------------------------------
//
// `Symbol.for(...)` so the brand is the same across bundles / module copies.
// The brand is added via `Object.defineProperty(..., { enumerable: false })` so
// it survives reference-equality checks but is dropped by JSON.stringify and
// `{ ...spread }`. That is intentional: any caller that clones / mutates the
// branded input must re-stamp via the factory, otherwise the runtime check
// fires.

export const CLEAN_TRAINING_DECISION_INPUT_BRAND = Symbol.for(
  'ironpath.trainingDecision.cleanInput.v1',
);

export const CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND = Symbol.for(
  'ironpath.trainingDecision.cleanContextSource.v1',
);

// ---------------------------------------------------------------------------
//   Branded types
// ---------------------------------------------------------------------------

export type CleanTrainingDecisionInput = TrainingDecisionInput & {
  readonly [CLEAN_TRAINING_DECISION_INPUT_BRAND]: true;
};

export type CleanTrainingDecisionContextSource = Partial<AppData> & {
  readonly [CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND]: true;
};

// ---------------------------------------------------------------------------
//   Factory inputs
// ---------------------------------------------------------------------------

export interface CleanTrainingDecisionInputMetadata {
  template: TrainingTemplate;
  trainingMode?: TrainingMode | string;
  nowIso?: string;
  acutePainReported?: boolean;
  injuryFlag?: boolean;
  illnessFlag?: boolean;
  explicitDeloadAssigned?: boolean;
  useHealthDataForReadiness?: boolean;
  healthSummary?: HealthSummary;
  adaptiveCalibration?: AdaptiveCalibrationState;
}

// ---------------------------------------------------------------------------
//   Brand helpers
// ---------------------------------------------------------------------------

const stampBrand = <T extends object>(value: T, brand: symbol): T => {
  Object.defineProperty(value, brand, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return value;
};

const hasBrand = (value: unknown, brand: symbol): boolean =>
  Boolean(value && typeof value === 'object' && (value as Record<symbol, unknown>)[brand] === true);

export const isCleanTrainingDecisionInput = (
  value: unknown,
): value is CleanTrainingDecisionInput => hasBrand(value, CLEAN_TRAINING_DECISION_INPUT_BRAND);

export const isCleanTrainingDecisionContextSource = (
  value: unknown,
): value is CleanTrainingDecisionContextSource =>
  hasBrand(value, CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND);

export function assertCleanTrainingDecisionInput(
  input: TrainingDecisionInput | CleanTrainingDecisionInput,
): asserts input is CleanTrainingDecisionInput {
  if (!isCleanTrainingDecisionInput(input)) {
    throw new TypeError(
      '[trainingDecisionCleanInput] buildTrainingDecisionFromCleanInput requires a CleanTrainingDecisionInput created by createCleanTrainingDecisionInput(). ' +
        'Raw or spread inputs are rejected because they bypass the CleanAppDataView guard.',
    );
  }
}

export function assertCleanTrainingDecisionContextSource(
  source: Partial<AppData> | CleanTrainingDecisionContextSource,
): asserts source is CleanTrainingDecisionContextSource {
  if (!isCleanTrainingDecisionContextSource(source)) {
    throw new TypeError(
      '[trainingDecisionCleanInput] buildTrainingDecisionContextFromCleanInput requires a CleanTrainingDecisionContextSource created by createCleanTrainingDecisionContextSource(). ' +
        'Raw AppData references are rejected because they bypass the CleanAppDataView guard.',
    );
  }
}

// ---------------------------------------------------------------------------
//   Factories
// ---------------------------------------------------------------------------

const resolveUseHealthDataForReadiness = (
  cleanView: CleanAppDataView,
  override: boolean | undefined,
): boolean | undefined => {
  if (typeof override === 'boolean') return override;
  if (cleanView.healthData.staleForReadiness) return false;
  const setting = cleanView.appData.settings?.healthIntegrationSettings?.useHealthDataForReadiness;
  if (typeof setting === 'boolean') return setting;
  return undefined;
};

export const createCleanTrainingDecisionInput = (
  cleanView: CleanAppDataView,
  metadata: CleanTrainingDecisionInputMetadata,
): CleanTrainingDecisionInput => {
  const cleaned = cleanView.appData;
  const input: TrainingDecisionInput = {
    template: metadata.template,
    todayStatus: cleaned.todayStatus,
    history: cleaned.history,
    mesocyclePlan: cleaned.mesocyclePlan ?? null,
    screening: cleaned.screeningProfile,
    healthSummary: metadata.healthSummary,
    useHealthDataForReadiness: resolveUseHealthDataForReadiness(
      cleanView,
      metadata.useHealthDataForReadiness,
    ),
    adaptiveCalibration: metadata.adaptiveCalibration ?? cleaned.adaptiveCalibration,
    trainingMode: metadata.trainingMode ?? cleaned.trainingMode,
    nowIso: metadata.nowIso,
    acutePainReported: metadata.acutePainReported,
    injuryFlag: metadata.injuryFlag,
    illnessFlag: metadata.illnessFlag,
    explicitDeloadAssigned: metadata.explicitDeloadAssigned,
  };
  return stampBrand(input, CLEAN_TRAINING_DECISION_INPUT_BRAND) as CleanTrainingDecisionInput;
};

export const createCleanTrainingDecisionContextSource = (
  cleanView: CleanAppDataView,
): CleanTrainingDecisionContextSource => {
  // We pass the cleaned `appData` reference as-is. The brand is stamped via
  // Object.defineProperty so it does not alter the cleaned data shape and does
  // not appear in JSON.stringify / spread / structural equality checks.
  return stampBrand(
    cleanView.appData as Partial<AppData>,
    CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND,
  ) as CleanTrainingDecisionContextSource;
};

/**
 * Re-stamp helper for legitimate metadata overrides on an already-clean input.
 * Use this when you must derive a new clean input from an existing one (e.g.,
 * switching template at session-finish time). The input must already be
 * branded; the helper preserves the brand.
 */
export const withCleanTrainingDecisionInputOverride = (
  input: CleanTrainingDecisionInput,
  overrides: Partial<CleanTrainingDecisionInputMetadata> & Partial<TrainingDecisionInput>,
): CleanTrainingDecisionInput => {
  assertCleanTrainingDecisionInput(input);
  const next: TrainingDecisionInput = {
    template: overrides.template ?? input.template,
    todayStatus: overrides.todayStatus ?? input.todayStatus,
    history: overrides.history ?? input.history,
    mesocyclePlan: overrides.mesocyclePlan ?? input.mesocyclePlan,
    screening: overrides.screening ?? input.screening,
    healthSummary: overrides.healthSummary ?? input.healthSummary,
    useHealthDataForReadiness:
      overrides.useHealthDataForReadiness ?? input.useHealthDataForReadiness,
    adaptiveCalibration: overrides.adaptiveCalibration ?? input.adaptiveCalibration,
    trainingMode: overrides.trainingMode ?? input.trainingMode,
    nowIso: overrides.nowIso ?? input.nowIso,
    acutePainReported: overrides.acutePainReported ?? input.acutePainReported,
    injuryFlag: overrides.injuryFlag ?? input.injuryFlag,
    illnessFlag: overrides.illnessFlag ?? input.illnessFlag,
    explicitDeloadAssigned: overrides.explicitDeloadAssigned ?? input.explicitDeloadAssigned,
  };
  return stampBrand(next, CLEAN_TRAINING_DECISION_INPUT_BRAND) as CleanTrainingDecisionInput;
};

// ---------------------------------------------------------------------------
//   Wrappers
// ---------------------------------------------------------------------------

export const buildTrainingDecisionFromCleanInput = (
  input: CleanTrainingDecisionInput,
  surfaces?: TrainingDecisionSurfaceInputs,
): TrainingDecision => {
  assertCleanTrainingDecisionInput(input);
  return buildTrainingDecision(input, surfaces);
};

export const buildTrainingDecisionContextFromCleanInput = (
  source: CleanTrainingDecisionContextSource,
  currentDateOrOverrides?: string | Parameters<typeof buildTrainingDecisionContext>[1],
  maybeOverrides?: Parameters<typeof buildTrainingDecisionContext>[2],
): TrainingDecisionContext => {
  assertCleanTrainingDecisionContextSource(source);
  return buildTrainingDecisionContext(source, currentDateOrOverrides, maybeOverrides);
};

// Re-export TrainingDecisionSurfaceInputs so feature files can import everything
// they need from this module without ever touching trainingDecisionEngine
// directly.
export type { TrainingDecisionSurfaceInputs } from './trainingDecisionEngine';
