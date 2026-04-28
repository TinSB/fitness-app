import { buildTrainingCalendar } from '../engines/trainingCalendarEngine';
import { listSessionHistory } from '../engines/sessionHistoryEngine';
import type { AppData } from '../models/training-model';

export type RecordViewModel = {
  defaultTab: 'calendar';
  tabs: Array<'calendar' | 'history' | 'dashboard' | 'pr' | 'data'>;
  monthSessionCount: number;
  historyCount: number;
  emptyTitle?: string;
  emptyDescription?: string;
};

export const buildRecordViewModel = (data: AppData): RecordViewModel => {
  const calendar = buildTrainingCalendar(data.history || []);
  const history = listSessionHistory(data.history || [], 'all');
  const hasHistory = history.length > 0;
  return {
    defaultTab: 'calendar',
    tabs: ['calendar', 'history', 'dashboard', 'pr', 'data'],
    monthSessionCount: calendar.days.reduce((sum, day) => sum + day.totalSessions, 0),
    historyCount: history.length,
    emptyTitle: hasHistory ? undefined : '暂无训练记录',
    emptyDescription: hasHistory ? undefined : '完成一次训练后，这里会自动显示训练日历和历史详情。',
  };
};
