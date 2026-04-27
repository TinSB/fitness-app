import type { AppData, SessionDataFlag, TrainingSession } from '../models/training-model';
import { reconcileScreeningProfile } from './adaptiveFeedbackEngine';

const excludedFlags = new Set<SessionDataFlag>(['test', 'excluded']);

export const isAnalyticsSession = (session: Pick<TrainingSession, 'dataFlag'> | null | undefined) =>
  !excludedFlags.has((session?.dataFlag || 'normal') as SessionDataFlag);

export const filterAnalyticsHistory = (history: TrainingSession[] = []) => history.filter(isAnalyticsSession);

export const deleteTrainingSession = (
  data: AppData,
  sessionId: string,
  confirmed: boolean,
): { ok: boolean; data: AppData; message: string } => {
  if (!confirmed) {
    return { ok: false, data, message: '删除训练需要二次确认。' };
  }

  const history = (data.history || []).filter((session) => session.id !== sessionId);
  return {
    ok: true,
    data: {
      ...data,
      history,
      screeningProfile: reconcileScreeningProfile(data.screeningProfile, filterAnalyticsHistory(history)),
    },
    message: '训练历史已删除。进度、PR、e1RM 和日历会基于剩余记录重新计算。',
  };
};

export const markSessionDataFlag = (
  data: AppData,
  sessionId: string,
  dataFlag: SessionDataFlag,
  confirmed = true,
): { ok: boolean; data: AppData; message: string } => {
  if (!confirmed) {
    return { ok: false, data, message: '标记训练数据需要确认。' };
  }

  const history = (data.history || []).map((session) => (session.id === sessionId ? { ...session, dataFlag } : session));
  return {
    ok: true,
    data: {
      ...data,
      history,
      screeningProfile: reconcileScreeningProfile(data.screeningProfile, filterAnalyticsHistory(history)),
    },
    message: dataFlag === 'normal' ? '已恢复为正式训练数据。' : '已标记为测试/排除数据，不再计入进度分析。',
  };
};
