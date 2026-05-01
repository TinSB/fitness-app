import type { SupportBlockType, SupportExerciseLog, TrainingSession } from '../models/training-model';
import { isCompletedSet, number } from './engineUtils';

export type SessionComposition = {
  mainPlannedSteps: number;
  mainCompletedSteps: number;
  correctionPlannedSteps: number;
  correctionCompletedSteps: number;
  correctionSkippedSteps: number;
  functionalPlannedSteps: number;
  functionalCompletedSteps: number;
  functionalSkippedSteps: number;
  mainShare: number;
  correctionShare: number;
  functionalShare: number;
  summary: string;
};

const percent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

const mainSets = (session: TrainingSession) =>
  (session.exercises || []).flatMap((exercise) => (Array.isArray(exercise.sets) ? exercise.sets : []));

const plannedMainSteps = (session: TrainingSession) => mainSets(session).length;

const completedMainSteps = (session: TrainingSession) =>
  mainSets(session).filter(
    (set) => isCompletedSet(set) && number(set.actualWeightKg ?? set.weight) > 0 && number(set.reps) > 0,
  ).length;

const supportLogs = (session: TrainingSession, blockType: SupportBlockType) =>
  (session.supportExerciseLogs || []).filter((log) => log.blockType === blockType);

const supportPlanned = (logs: SupportExerciseLog[]) =>
  logs.reduce((sum, log) => sum + Math.max(0, number(log.plannedSets)), 0);

const supportCompleted = (logs: SupportExerciseLog[]) =>
  logs.reduce(
    (sum, log) => sum + Math.min(Math.max(0, number(log.completedSets)), Math.max(0, number(log.plannedSets))),
    0,
  );

const supportSkipped = (logs: SupportExerciseLog[]) =>
  logs.reduce((sum, log) => {
    if (!log.skippedReason) return sum;
    return sum + Math.max(0, number(log.plannedSets) - number(log.completedSets));
  }, 0);

const supportActiveShareSteps = (logs: SupportExerciseLog[]) =>
  logs.reduce((sum, log) => {
    const planned = Math.max(0, number(log.plannedSets));
    const completed = Math.min(Math.max(0, number(log.completedSets)), planned);
    return sum + (log.skippedReason ? completed : planned);
  }, 0);

const skippedBothSummary = (mainShare: number) =>
  `\u4f60\u8df3\u8fc7\u4e86\u7ea0\u504f\u6a21\u5757\u548c\u529f\u80fd\u8865\u4e01\uff0c\u672c\u6b21\u8bad\u7ec3\u6784\u6210\u66f4\u504f\u5411\u4e3b\u8bad\u7ec3\uff0c\u4e3b\u8bad\u7ec3\u7ea6\u5360 ${mainShare}%\u3002`;

const skippedCorrectionSummary = (mainShare: number) =>
  `\u4f60\u8df3\u8fc7\u4e86\u7ea0\u504f\u6a21\u5757\uff0c\u672c\u6b21\u8bad\u7ec3\u6784\u6210\u66f4\u504f\u5411\u4e3b\u8bad\u7ec3\uff0c\u4e3b\u8bad\u7ec3\u7ea6\u5360 ${mainShare}%\u3002`;

const skippedFunctionalSummary = (mainShare: number) =>
  `\u4f60\u8df3\u8fc7\u4e86\u529f\u80fd\u8865\u4e01\uff0c\u672c\u6b21\u8bad\u7ec3\u6784\u6210\u66f4\u504f\u5411\u4e3b\u8bad\u7ec3\uff0c\u4e3b\u8bad\u7ec3\u7ea6\u5360 ${mainShare}%\u3002`;

const defaultSummary = (mainShare: number) =>
  `\u672c\u6b21\u8bad\u7ec3\u6784\u6210\u6309\u8ba1\u5212\u6267\u884c\uff0c\u4e3b\u8bad\u7ec3\u7ea6\u5360 ${mainShare}%\u3002`;

const buildSummary = ({
  correctionSkippedSteps,
  functionalSkippedSteps,
  mainShare,
}: Pick<SessionComposition, 'correctionSkippedSteps' | 'functionalSkippedSteps' | 'mainShare'>) => {
  if (correctionSkippedSteps > 0 && functionalSkippedSteps > 0) return skippedBothSummary(mainShare);
  if (correctionSkippedSteps > 0) return skippedCorrectionSummary(mainShare);
  if (functionalSkippedSteps > 0) return skippedFunctionalSummary(mainShare);
  return defaultSummary(mainShare);
};

export const buildSessionComposition = (session: TrainingSession): SessionComposition => {
  const correctionLogs = supportLogs(session, 'correction');
  const functionalLogs = supportLogs(session, 'functional');
  const mainPlannedSteps = plannedMainSteps(session);
  const mainCompletedSteps = completedMainSteps(session);
  const correctionPlannedSteps = supportPlanned(correctionLogs);
  const correctionCompletedSteps = supportCompleted(correctionLogs);
  const correctionSkippedSteps = supportSkipped(correctionLogs);
  const functionalPlannedSteps = supportPlanned(functionalLogs);
  const functionalCompletedSteps = supportCompleted(functionalLogs);
  const functionalSkippedSteps = supportSkipped(functionalLogs);
  const activeCorrectionSteps = supportActiveShareSteps(correctionLogs);
  const activeFunctionalSteps = supportActiveShareSteps(functionalLogs);
  const shareTotal = mainPlannedSteps + activeCorrectionSteps + activeFunctionalSteps;
  const mainShare = percent(mainPlannedSteps, shareTotal);
  const correctionShare = percent(activeCorrectionSteps, shareTotal);
  const functionalShare = Math.max(0, 100 - mainShare - correctionShare);
  const composition = {
    mainPlannedSteps,
    mainCompletedSteps,
    correctionPlannedSteps,
    correctionCompletedSteps,
    correctionSkippedSteps,
    functionalPlannedSteps,
    functionalCompletedSteps,
    functionalSkippedSteps,
    mainShare,
    correctionShare,
    functionalShare,
    summary: '',
  };

  return {
    ...composition,
    summary: buildSummary(composition),
  };
};
