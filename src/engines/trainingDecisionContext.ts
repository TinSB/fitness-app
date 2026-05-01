import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE, DEFAULT_STATUS, DEFAULT_USER_PROFILE } from '../data/trainingData';
import type {
  AppData,
  HealthMetricSample,
  ImportedWorkoutSample,
  MesocyclePlan,
  PainPattern,
  PrimaryGoal,
  ProgramTemplate,
  ReadinessResult,
  ScreeningProfile,
  TodayStatus,
  TrainingMode,
  TrainingSession,
  TrainingTemplate,
  UnitSettings,
} from '../models/training-model';
import { buildHealthSummary, type HealthSummary } from './healthSummaryEngine';
import { buildLoadFeedbackSummary, type LoadFeedbackSummary } from './loadFeedbackEngine';
import { buildPainPatterns } from './painPatternEngine';
import { buildTodayReadiness } from './readinessEngine';
import { filterAnalyticsHistory, isAnalyticsSession } from './sessionHistoryEngine';
import { buildTrainingLevelAssessment, type AutoTrainingLevel, type TrainingLevelAssessment } from './trainingLevelEngine';
import { DEFAULT_UNIT_SETTINGS } from './unitConversionEngine';
import { normalizeSoreness } from './engineUtils';

export type TrainingDecisionContext = {
  todayStatus: TodayStatus;
  history: TrainingSession[];
  allHistory: TrainingSession[];
  normalHistory: TrainingSession[];
  testExcludedHistory: TrainingSession[];
  activeSession?: TrainingSession | null;
  templates: TrainingTemplate[];
  currentTrainingTemplate?: TrainingTemplate;
  activeTemplate?: TrainingTemplate;
  healthMetricSamples: HealthMetricSample[];
  importedWorkoutSamples: ImportedWorkoutSample[];
  healthSummary?: HealthSummary;
  useHealthDataForReadiness?: boolean;
  screeningProfile?: ScreeningProfile;
  mesocyclePlan?: MesocyclePlan;
  programTemplate?: ProgramTemplate;
  currentProgramTemplate: ProgramTemplate;
  activeProgramTemplateId?: string;
  selectedTemplateId: string;
  unitSettings: UnitSettings;
  trainingMode: TrainingMode;
  primaryGoal: PrimaryGoal;
  readinessResult: ReadinessResult;
  painPatterns: PainPattern[];
  loadFeedbackSummary: LoadFeedbackSummary[];
  trainingLevelAssessment: TrainingLevelAssessment;
  trainingLevel: AutoTrainingLevel;
  currentDateLocalKey: string;
};

type TrainingDecisionContextOverrides = Partial<
  Omit<
    TrainingDecisionContext,
    | 'history'
    | 'allHistory'
    | 'normalHistory'
    | 'testExcludedHistory'
    | 'healthMetricSamples'
    | 'importedWorkoutSamples'
    | 'templates'
    | 'currentProgramTemplate'
    | 'selectedTemplateId'
    | 'unitSettings'
    | 'primaryGoal'
    | 'readinessResult'
    | 'painPatterns'
    | 'loadFeedbackSummary'
    | 'trainingLevelAssessment'
    | 'trainingLevel'
    | 'currentDateLocalKey'
  >
> & {
  history?: TrainingSession[];
  normalHistory?: TrainingSession[];
  testExcludedHistory?: TrainingSession[];
  healthMetricSamples?: HealthMetricSample[];
  importedWorkoutSamples?: ImportedWorkoutSample[];
  templates?: TrainingTemplate[];
  currentProgramTemplate?: ProgramTemplate;
  selectedTemplateId?: string;
  unitSettings?: UnitSettings;
  primaryGoal?: PrimaryGoal;
  readinessResult?: ReadinessResult;
  painPatterns?: PainPattern[];
  loadFeedbackSummary?: LoadFeedbackSummary[];
  trainingLevelAssessment?: TrainingLevelAssessment;
  trainingLevel?: AutoTrainingLevel;
};

const toLocalDateKey = (value?: string) => {
  if (!value) {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (direct) return direct[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const resolveOptions = (
  currentDateOrOverrides?: string | TrainingDecisionContextOverrides,
  maybeOverrides?: TrainingDecisionContextOverrides,
) => {
  if (typeof currentDateOrOverrides === 'string') {
    return { currentDateLocalKey: toLocalDateKey(currentDateOrOverrides), overrides: maybeOverrides || {} };
  }
  return { currentDateLocalKey: toLocalDateKey(), overrides: currentDateOrOverrides || {} };
};

export const scopeTodayStatusToDate = (status: TodayStatus | undefined, currentDateLocalKey: string): TodayStatus => {
  const rawStatus = status || DEFAULT_STATUS;
  const statusDate = typeof rawStatus.date === 'string' && rawStatus.date ? rawStatus.date : undefined;
  return {
    ...DEFAULT_STATUS,
    ...rawStatus,
    soreness: statusDate === currentDateLocalKey ? normalizeSoreness(rawStatus.soreness) : normalizeSoreness(DEFAULT_STATUS.soreness),
    date: statusDate === currentDateLocalKey ? statusDate : currentDateLocalKey,
  };
};

const resolveActiveTemplate = (
  templates: TrainingTemplate[],
  activeProgramTemplateId?: string,
  selectedTemplateId?: string,
  activeSession?: TrainingSession | null,
) => {
  const candidates = [activeSession?.templateId, activeProgramTemplateId, selectedTemplateId].filter(Boolean) as string[];
  return candidates.map((id) => templates.find((template) => template.id === id)).find(Boolean) || templates[0];
};

export const buildTrainingDecisionContext = (
  data: Partial<AppData>,
  currentDateOrOverrides?: string | TrainingDecisionContextOverrides,
  maybeOverrides?: TrainingDecisionContextOverrides,
): TrainingDecisionContext => {
  const { currentDateLocalKey, overrides } = resolveOptions(currentDateOrOverrides, maybeOverrides);
  const allHistory = overrides.history ?? data.history ?? [];
  const normalHistory = overrides.normalHistory ?? filterAnalyticsHistory(allHistory);
  const testExcludedHistory = overrides.testExcludedHistory ?? allHistory.filter((session) => !isAnalyticsSession(session));
  const templates = overrides.templates ?? data.templates ?? [];
  const activeSession = overrides.activeSession ?? data.activeSession ?? null;
  const selectedTemplateId = overrides.selectedTemplateId ?? data.selectedTemplateId ?? templates[0]?.id ?? '';
  const activeProgramTemplateId = overrides.activeProgramTemplateId ?? data.activeProgramTemplateId ?? data.settings?.selectedTemplateId ?? selectedTemplateId;
  const currentTrainingTemplate =
    overrides.currentTrainingTemplate ?? resolveActiveTemplate(templates, activeProgramTemplateId, selectedTemplateId, activeSession);
  const healthMetricSamples = overrides.healthMetricSamples ?? data.healthMetricSamples ?? [];
  const importedWorkoutSamples = overrides.importedWorkoutSamples ?? data.importedWorkoutSamples ?? [];
  const useHealthDataForReadiness =
    overrides.useHealthDataForReadiness ?? (data.settings?.healthIntegrationSettings?.useHealthDataForReadiness !== false);
  const healthSummary =
    overrides.healthSummary ??
    buildHealthSummary(healthMetricSamples, importedWorkoutSamples, { endDate: `${currentDateLocalKey}T23:59:59` });
  const todayStatus = scopeTodayStatusToDate(overrides.todayStatus ?? data.todayStatus ?? DEFAULT_STATUS, currentDateLocalKey);
  const painPatterns = overrides.painPatterns ?? buildPainPatterns(normalHistory, { currentDate: currentDateLocalKey });
  const readinessResult =
    overrides.readinessResult ??
    buildTodayReadiness(
      {
        todayStatus,
        activeSession,
        history: normalHistory,
        healthMetricSamples,
        importedWorkoutSamples,
      },
      currentTrainingTemplate,
      {
        healthSummary: useHealthDataForReadiness === false ? undefined : healthSummary,
        useHealthDataForReadiness,
        painAreas: painPatterns.slice(0, 3).map((pattern) => pattern.area),
      },
    );
  const loadFeedbackSummary =
    overrides.loadFeedbackSummary ?? (currentTrainingTemplate?.exercises || []).map((exercise) => buildLoadFeedbackSummary(normalHistory, exercise.id));
  const trainingLevelAssessment =
    overrides.trainingLevelAssessment ?? buildTrainingLevelAssessment({ history: normalHistory, painPatterns });
  const trainingLevel = overrides.trainingLevel ?? trainingLevelAssessment.level;
  const currentProgramTemplate = overrides.currentProgramTemplate ?? overrides.programTemplate ?? data.programTemplate ?? DEFAULT_PROGRAM_TEMPLATE;

  return {
    todayStatus,
    history: normalHistory,
    allHistory,
    normalHistory,
    testExcludedHistory,
    activeSession,
    templates,
    currentTrainingTemplate,
    activeTemplate: overrides.activeTemplate ?? currentTrainingTemplate,
    healthMetricSamples,
    importedWorkoutSamples,
    healthSummary,
    useHealthDataForReadiness,
    screeningProfile: overrides.screeningProfile ?? data.screeningProfile ?? DEFAULT_SCREENING_PROFILE,
    mesocyclePlan: overrides.mesocyclePlan ?? data.mesocyclePlan,
    programTemplate: currentProgramTemplate,
    currentProgramTemplate,
    activeProgramTemplateId,
    selectedTemplateId,
    unitSettings: overrides.unitSettings ?? data.unitSettings ?? DEFAULT_UNIT_SETTINGS,
    trainingMode: overrides.trainingMode ?? data.trainingMode ?? 'hybrid',
    primaryGoal:
      overrides.primaryGoal ??
      data.userProfile?.primaryGoal ??
      currentProgramTemplate.primaryGoal ??
      DEFAULT_USER_PROFILE.primaryGoal,
    readinessResult,
    painPatterns,
    loadFeedbackSummary,
    trainingLevelAssessment,
    trainingLevel,
    currentDateLocalKey,
  };
};

export const toStatusRulesDecisionContext = (context: TrainingDecisionContext) => ({
  healthSummary: context.useHealthDataForReadiness === false ? undefined : context.healthSummary,
  useHealthDataForReadiness: context.useHealthDataForReadiness,
});
