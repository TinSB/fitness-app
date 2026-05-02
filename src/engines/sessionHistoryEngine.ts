import type { AppData, SessionDataFlag, TrainingSession } from '../models/training-model';
import { reconcileScreeningProfile } from './adaptiveFeedbackEngine';
import { toLocalDateKey } from './trainingCalendarEngine';

const excludedFlags = new Set<SessionDataFlag>(['test', 'excluded']);

export const isAnalyticsSession = (session: Pick<TrainingSession, 'dataFlag'> | null | undefined) =>
  !excludedFlags.has((session?.dataFlag || 'normal') as SessionDataFlag);

export const filterAnalyticsHistory = (history: TrainingSession[] = []) => history.filter(isAnalyticsSession);

export type SessionHistoryFilter = 'all' | 'normal' | 'test' | 'excluded';

const sessionSortKey = (session: TrainingSession) => session.finishedAt || session.startedAt || session.date || '';

export const listSessionHistory = (history: TrainingSession[] = [], filter: SessionHistoryFilter = 'all') =>
  history
    .filter((session) => {
      const flag = session.dataFlag || 'normal';
      return filter === 'all' ? true : flag === filter;
    })
    .sort((left, right) => sessionSortKey(right).localeCompare(sessionSortKey(left)));

export const getSessionLocalDate = (session: TrainingSession) => toLocalDateKey(session.date || session.startedAt || session.finishedAt);

export type SessionHistoryMutationResult = {
  ok: boolean;
  changed: boolean;
  data: AppData;
  message: string;
  session?: TrainingSession;
};

export const dataFlagFeedbackMessage = (dataFlag: SessionDataFlag) => {
  if (dataFlag === 'test') return '已标记为测试数据，不参与训练统计。';
  if (dataFlag === 'excluded') return '已排除该训练，不参与 PR、e1RM、有效组和统计。';
  return '已恢复为正常数据，相关统计会重新计算。';
};

export const deleteTrainingSession = (
  data: AppData,
  sessionId: string,
  confirmed: boolean,
): SessionHistoryMutationResult => {
  if (!confirmed) {
    return { ok: false, changed: false, data, message: '删除训练需要二次确认。' };
  }

  const exists = (data.history || []).some((session) => session.id === sessionId);
  if (!exists) {
    return { ok: false, changed: false, data, message: '暂时无法定位到这次训练。' };
  }

  const history = (data.history || []).filter((session) => session.id !== sessionId);
  return {
    ok: true,
    changed: true,
    data: {
      ...data,
      history,
      screeningProfile: reconcileScreeningProfile(data.screeningProfile, filterAnalyticsHistory(history)),
    },
    message: '训练已删除。',
  };
};

export const markSessionDataFlag = (
  data: AppData,
  sessionId: string,
  dataFlag: SessionDataFlag,
  confirmed = true,
): SessionHistoryMutationResult => {
  if (!confirmed) {
    return { ok: false, changed: false, data, message: '标记训练数据需要确认。' };
  }

  const target = (data.history || []).find((session) => session.id === sessionId);
  if (!target) {
    return { ok: false, changed: false, data, message: '暂时无法定位到这次训练。' };
  }

  if ((target.dataFlag || 'normal') === dataFlag) {
    return {
      ok: true,
      changed: false,
      data,
      session: target,
      message:
        dataFlag === 'normal'
          ? '这次训练已经是正常数据。'
          : dataFlag === 'test'
            ? '这次训练已经标记为测试数据。'
            : '这次训练已经排除统计。',
    };
  }

  const history = (data.history || []).map((session) => (session.id === sessionId ? { ...session, dataFlag } : session));
  const updated = history.find((session) => session.id === sessionId);
  return {
    ok: true,
    changed: true,
    data: {
      ...data,
      history,
      screeningProfile: reconcileScreeningProfile(data.screeningProfile, filterAnalyticsHistory(history)),
    },
    session: updated,
    message: dataFlagFeedbackMessage(dataFlag),
  };
};
