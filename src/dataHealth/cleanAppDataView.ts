import type { AppData, ScreeningProfile, TrainingSession } from '../models/training-model';
import {
  applyDurationGuard,
  applyHealthDataGuard,
  applyIssueScoreCap,
  applyPerformanceDropGuard,
  applySessionLifecycleGuard,
  applyTodayStatusGuard,
  defaultGuardClock,
  stripLegacyAdviceFromSession,
  type DurationGuardOutcome,
  type HealthDataGuardOutcome,
  type IssueScoreCapOutcome,
  type PerformanceDropOutcome,
  type RuntimeGuardClock,
  type TodayStatusGuardOutcome,
} from './dataHealthRuntimeGuard';

export interface CleanAppDataView {
  raw: AppData;
  appData: AppData;
  durations: Map<string, DurationGuardOutcome>;
  todayStatus: TodayStatusGuardOutcome;
  healthData: HealthDataGuardOutcome;
  issueScoreCap: IssueScoreCapOutcome;
  performanceDrops: PerformanceDropOutcome;
  guardDiagnostics: CleanAppDataViewDiagnostics;
}

export interface CleanAppDataViewDiagnostics {
  lifecycleResidueSessionIds: string[];
  legacyAdviceSessionIds: string[];
  invalidDurationSessionIds: string[];
  cappedIssueScoreKeys: string[];
  staleTodayStatus: boolean;
  staleHealthData: boolean;
  filteredPerformanceDropIds: string[];
}

const buildCleanScreening = (
  screening: ScreeningProfile | undefined,
  issueScoreCap: IssueScoreCapOutcome,
  performanceDrops: PerformanceDropOutcome,
): ScreeningProfile | undefined => {
  if (!screening) return screening;
  const adaptiveState = screening.adaptiveState;
  if (!adaptiveState) return screening;
  return {
    ...screening,
    adaptiveState: {
      ...adaptiveState,
      issueScores: issueScoreCap.cappedScores,
      performanceDrops: performanceDrops.filteredDrops,
    },
  };
};

const buildCleanSession = (session: TrainingSession): {
  session: TrainingSession;
  durationOutcome: DurationGuardOutcome;
  residueChanged: boolean;
  legacyChanged: boolean;
} => {
  const lifecycle = applySessionLifecycleGuard(session);
  const stripped = stripLegacyAdviceFromSession(lifecycle.session);
  const durationOutcome = applyDurationGuard(stripped.session);
  let next = stripped.session;
  if (durationOutcome.derivedDurationMin !== undefined) {
    next = { ...next, durationMin: durationOutcome.derivedDurationMin };
  }
  if (durationOutcome.durationInvalid) {
    next = {
      ...next,
      durationMin: undefined,
    } as TrainingSession & { durationInvalid?: boolean };
    (next as TrainingSession & { durationInvalid?: boolean }).durationInvalid = true;
  }
  return {
    session: next,
    durationOutcome,
    residueChanged: lifecycle.changed,
    legacyChanged: stripped.changed,
  };
};

export const buildCleanAppDataView = (
  rawAppData: AppData,
  clock: RuntimeGuardClock = defaultGuardClock,
): CleanAppDataView => {
  const durations = new Map<string, DurationGuardOutcome>();
  const lifecycleResidueSessionIds: string[] = [];
  const legacyAdviceSessionIds: string[] = [];
  const invalidDurationSessionIds: string[] = [];

  const cleanedHistory = (rawAppData.history || []).map((session) => {
    const built = buildCleanSession(session);
    durations.set(session.id, built.durationOutcome);
    if (built.residueChanged) lifecycleResidueSessionIds.push(session.id);
    if (built.legacyChanged) legacyAdviceSessionIds.push(session.id);
    if (built.durationOutcome.durationInvalid) invalidDurationSessionIds.push(session.id);
    return built.session;
  });

  const cleanedActiveSession = rawAppData.activeSession
    ? buildCleanSession(rawAppData.activeSession).session
    : rawAppData.activeSession;

  const todayStatus = applyTodayStatusGuard(rawAppData, clock);
  const healthData = applyHealthDataGuard(rawAppData, clock);
  const issueScoreCap = applyIssueScoreCap(rawAppData.screeningProfile);
  const performanceDrops = applyPerformanceDropGuard(rawAppData.screeningProfile, cleanedHistory);
  const cleanedScreening = buildCleanScreening(rawAppData.screeningProfile, issueScoreCap, performanceDrops);

  const cleanedAppData: AppData = {
    ...rawAppData,
    history: cleanedHistory,
    activeSession: cleanedActiveSession,
    screeningProfile: cleanedScreening || rawAppData.screeningProfile,
  };

  const diagnostics: CleanAppDataViewDiagnostics = {
    lifecycleResidueSessionIds,
    legacyAdviceSessionIds,
    invalidDurationSessionIds,
    cappedIssueScoreKeys: issueScoreCap.changes.map((entry) => entry.key),
    staleTodayStatus: todayStatus.ignoredForCurrentReadiness,
    staleHealthData: healthData.staleForReadiness,
    filteredPerformanceDropIds: performanceDrops.removed,
  };

  return {
    raw: rawAppData,
    appData: cleanedAppData,
    durations,
    todayStatus,
    healthData,
    issueScoreCap,
    performanceDrops,
    guardDiagnostics: diagnostics,
  };
};

export const cleanAppDataViewIsDirty = (view: CleanAppDataView): boolean => {
  const d = view.guardDiagnostics;
  return (
    d.lifecycleResidueSessionIds.length > 0 ||
    d.legacyAdviceSessionIds.length > 0 ||
    d.invalidDurationSessionIds.length > 0 ||
    d.cappedIssueScoreKeys.length > 0 ||
    d.staleTodayStatus ||
    d.staleHealthData ||
    d.filteredPerformanceDropIds.length > 0
  );
};
