import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE, DEFAULT_STATUS } from '../data/trainingData';
import type {
  AppData,
  HealthMetricSample,
  ImportedWorkoutSample,
  MesocyclePlan,
  ProgramTemplate,
  ScreeningProfile,
  TodayStatus,
  TrainingMode,
  TrainingSession,
} from '../models/training-model';
import { buildHealthSummary, type HealthSummary } from './healthSummaryEngine';

export type TrainingDecisionContext = {
  todayStatus: TodayStatus;
  history: TrainingSession[];
  activeSession?: TrainingSession | null;
  healthMetricSamples?: HealthMetricSample[];
  importedWorkoutSamples?: ImportedWorkoutSample[];
  healthSummary?: HealthSummary;
  useHealthDataForReadiness?: boolean;
  screeningProfile?: ScreeningProfile;
  mesocyclePlan?: MesocyclePlan;
  programTemplate?: ProgramTemplate;
  trainingMode: TrainingMode;
};

export const buildTrainingDecisionContext = (
  data: Partial<AppData>,
  overrides: Partial<TrainingDecisionContext> = {}
): TrainingDecisionContext => {
  const healthMetricSamples = overrides.healthMetricSamples ?? data.healthMetricSamples ?? [];
  const importedWorkoutSamples = overrides.importedWorkoutSamples ?? data.importedWorkoutSamples ?? [];
  const useHealthDataForReadiness =
    overrides.useHealthDataForReadiness ?? (data.settings?.healthIntegrationSettings?.useHealthDataForReadiness !== false);
  const hasImportedHealthData = Boolean(healthMetricSamples.length || importedWorkoutSamples.length);
  const healthSummary =
    useHealthDataForReadiness === false
      ? undefined
      : overrides.healthSummary ??
        (hasImportedHealthData
          ? buildHealthSummary(healthMetricSamples, importedWorkoutSamples, { endDate: new Date().toISOString() })
          : undefined);

  return {
    todayStatus: overrides.todayStatus ?? data.todayStatus ?? DEFAULT_STATUS,
    history: overrides.history ?? data.history ?? [],
    activeSession: overrides.activeSession ?? data.activeSession ?? null,
    healthMetricSamples,
    importedWorkoutSamples,
    healthSummary,
    useHealthDataForReadiness,
    screeningProfile: overrides.screeningProfile ?? data.screeningProfile ?? DEFAULT_SCREENING_PROFILE,
    mesocyclePlan: overrides.mesocyclePlan ?? data.mesocyclePlan,
    programTemplate: overrides.programTemplate ?? data.programTemplate ?? DEFAULT_PROGRAM_TEMPLATE,
    trainingMode: overrides.trainingMode ?? data.trainingMode ?? 'hybrid',
  };
};

export const toStatusRulesDecisionContext = (context: TrainingDecisionContext) => ({
  healthSummary: context.useHealthDataForReadiness === false ? undefined : context.healthSummary,
  useHealthDataForReadiness: context.useHealthDataForReadiness,
});
