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
    .sort((left, right) => sessionSortKey(right).localeCompare(sessionSortKey(left)));

  const completed = new Set<string>();
  let lastCompletedTemplateId: string | undefined;

  for (const session of completedSessions) {
    const templateId = resolveSessionTemplateId(session, orderedSet);
    if (!templateId) continue;
    lastCompletedTemplateId ||= templateId;
    if (!completed.has(templateId)) completed.add(templateId);
    if (completed.size === ordered.length) break;
  }

  const completedInCurrentCycle = ordered.filter((id) => completed.has(id));
  const missingInCurrentCycle = ordered.filter((id) => !completed.has(id));
  const isCycleComplete = missingInCurrentCycle.length === 0;
  const nextTemplateId = isCycleComplete ? ordered[0] : missingInCurrentCycle[0];

  const reason = isCycleComplete
    ? `最近一轮已完成 ${templateListLabel(ordered)}，下次进入新一轮，建议从 ${templateLabel(ordered[0])} 开始。`
    : completedInCurrentCycle.length
      ? `最近一轮已完成 ${templateListLabel(completedInCurrentCycle)}，还缺 ${templateListLabel(missingInCurrentCycle)}，下次建议先完成 ${templateLabel(nextTemplateId || ordered[0])}。`
      : `还没有本轮正式完成记录，建议从 ${templateLabel(ordered[0])} 开始。`;

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
