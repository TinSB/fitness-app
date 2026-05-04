import type { TrainingSession } from '../models/training-model';

export type WorkoutCycleState = {
  orderedTemplateIds: string[];
  completedInCurrentCycle: string[];
  missingInCurrentCycle: string[];
  lastCompletedTemplateId?: string;
  isCycleComplete: boolean;
  nextTemplateId?: string;
  reason: string;
};

type BuildWorkoutCycleStateInput = {
  history?: TrainingSession[];
  orderedTemplateIds: string[];
  currentDate?: string;
};

const uniqueTemplateIds = (ids: string[]) => {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const value = String(id || '').trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const dateKey = (value?: string) => {
  const text = String(value || '');
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || '';
};

const sessionSortKey = (session: TrainingSession) =>
  String(session.finishedAt || session.startedAt || session.date || '');

const dayNumber = (key: string) => {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return Number.NaN;
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86400000;
};

const daysBetween = (from?: string, to?: string) => {
  const start = dayNumber(dateKey(from));
  const end = dayNumber(dateKey(to));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return end - start;
};

const isNormalCompletedSession = (session: TrainingSession, currentDate?: string) => {
  if (session.completed !== true) return false;
  const flag = session.dataFlag || 'normal';
  if (flag === 'test' || flag === 'excluded') return false;
  const current = dateKey(currentDate);
  const sessionDate = dateKey(session.finishedAt || session.startedAt || session.date);
  return !current || !sessionDate || sessionDate <= current;
};

const resolveSessionTemplateId = (session: TrainingSession, orderedSet: Set<string>) => {
  const candidates = [session.sourceProgramTemplateId, session.programTemplateId, session.templateId].filter(Boolean).map(String);
  return candidates.find((id) => orderedSet.has(id));
};

const templateLabel = (id: string) => {
  const labels: Record<string, string> = {
    'push-a': '推 A',
    'pull-a': '拉 A',
    'legs-a': '腿 A',
    push: '推',
    pull: '拉',
    legs: '腿',
  };
  return labels[id] || id.replace(/-/g, ' ');
};

const templateListLabel = (ids: string[]) => ids.map(templateLabel).join('、');

const completedSetFrom = (ids: string[], ordered: string[]) => {
  const completed = new Set(ids);
  return ordered.filter((id) => completed.has(id));
};

export const buildWorkoutCycleState = ({
  history = [],
  orderedTemplateIds,
  currentDate,
}: BuildWorkoutCycleStateInput): WorkoutCycleState => {
  const ordered = uniqueTemplateIds(orderedTemplateIds);
  if (!ordered.length) {
    return {
      orderedTemplateIds: [],
      completedInCurrentCycle: [],
      missingInCurrentCycle: [],
      isCycleComplete: false,
      reason: '当前没有可用训练日顺序，暂时无法判断下次训练。',
    };
  }

  const orderedSet = new Set(ordered);
  const completedSessions = [...history]
    .filter((session) => isNormalCompletedSession(session, currentDate))
    .sort((left, right) => sessionSortKey(left).localeCompare(sessionSortKey(right)));

  const latestPplSession = completedSessions[completedSessions.length - 1];
  if (latestPplSession && currentDate && daysBetween(latestPplSession.finishedAt || latestPplSession.startedAt || latestPplSession.date, currentDate) > 30) {
    return {
      orderedTemplateIds: ordered,
      completedInCurrentCycle: [],
      missingInCurrentCycle: ordered,
      lastCompletedTemplateId: resolveSessionTemplateId(latestPplSession, orderedSet),
      isCycleComplete: false,
      nextTemplateId: ordered[0],
      reason: `距离上次主轮转较久，系统从新一轮开始，建议从${templateLabel(ordered[0])}开始。`,
    };
  }

  const currentCycleCompleted = new Set<string>();
  let lastClosedCycleCompleted: string[] = [];
  let lastCompletedTemplateId: string | undefined;
  let closedCycleCount = 0;

  for (const session of completedSessions) {
    const templateId = resolveSessionTemplateId(session, orderedSet);
    if (!templateId) continue;
    lastCompletedTemplateId = templateId;
    currentCycleCompleted.add(templateId);
    if (currentCycleCompleted.size === ordered.length) {
      lastClosedCycleCompleted = completedSetFrom([...currentCycleCompleted], ordered);
      currentCycleCompleted.clear();
      closedCycleCount += 1;
    }
  }

  const hasOpenCycle = currentCycleCompleted.size > 0;
  const completedInCurrentCycle = hasOpenCycle ? ordered.filter((id) => currentCycleCompleted.has(id)) : closedCycleCount > 0 ? lastClosedCycleCompleted : [];
  const openMissingInCurrentCycle = ordered.filter((id) => !currentCycleCompleted.has(id));
  const missingInCurrentCycle = hasOpenCycle ? openMissingInCurrentCycle : closedCycleCount > 0 ? [] : ordered;
  const isCycleComplete = !hasOpenCycle && closedCycleCount > 0;
  const nextTemplateId = isCycleComplete ? ordered[0] : missingInCurrentCycle[0] || ordered[0];

  const reason = isCycleComplete
    ? `上一轮推、拉、腿已完成；下次进入新一轮，建议从${templateLabel(ordered[0])}开始。`
    : completedInCurrentCycle.length
      ? `当前这一轮已完成${templateListLabel(completedInCurrentCycle)}，还缺${templateListLabel(missingInCurrentCycle)}，因此今天建议${templateLabel(nextTemplateId || ordered[0])}。`
      : `还没有本轮正式完成记录，建议从${templateLabel(ordered[0])}开始。`;

  return {
    orderedTemplateIds: ordered,
    completedInCurrentCycle,
    missingInCurrentCycle,
    lastCompletedTemplateId,
    isCycleComplete,
    nextTemplateId,
    reason,
  };
};
