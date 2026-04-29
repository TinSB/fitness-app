export type CoachReminderView = {
  id: string;
  title: string;
  message: string;
  tone: 'info' | 'warning' | 'success' | 'danger';
  source?: string;
  priority: number;
};

const toneRank: Record<CoachReminderView['tone'], number> = {
  danger: 4,
  warning: 3,
  info: 2,
  success: 1,
};

const sanitizeId = (value: unknown, fallback: string) => {
  const text = String(value || '').replace(/\b(undefined|null)\b/gi, '').trim();
  return text || fallback;
};

const sanitizeVisibleText = (value: unknown, fallback: string) => {
  const text = String(value || '')
    .replace(/\b(undefined|null)\b/gi, '')
    .replace(/\b(modified_train|active_recovery|mobility_only|reduce_volume|reduce_intensity|skip_accessory|high|medium|low)\b/gi, '')
    .trim();
  return text || fallback;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[，。；：、,.!?;:()\[\]（）【】\s]/g, '')
    .replace(/模板|训练|建议|今天|今日|系统|提示|提醒/g, '');

const bodyAreaTokens = [
  { key: 'shoulder', tokens: ['肩', 'shoulder'] },
  { key: 'chest', tokens: ['胸', 'chest'] },
  { key: 'back', tokens: ['背', 'back'] },
  { key: 'leg', tokens: ['腿', '膝', '髋', '臀', 'leg', 'knee', 'hip'] },
  { key: 'arm', tokens: ['手臂', '二头', '三头', '肘', 'arm', 'biceps', 'triceps'] },
];

const recoveryWords = ['酸痛', '不适', '恢复', '冲突', '保守', '低冲突', '休息'];

const semanticKey = (reminder: CoachReminderView) => {
  const text = `${reminder.title} ${reminder.message}`;
  const normalized = normalizeText(text);
  const isRecoveryReminder = recoveryWords.some((word) => normalized.includes(normalizeText(word)));
  if (!isRecoveryReminder) return normalized.slice(0, 80);
  const areas = bodyAreaTokens
    .filter((area) => area.tokens.some((token) => normalized.includes(normalizeText(token))))
    .map((area) => area.key)
    .sort();
  return `recovery:${areas.length ? areas.join('|') : 'general'}`;
};

const betterReminder = (left: CoachReminderView, right: CoachReminderView) => {
  if (right.priority !== left.priority) return right.priority > left.priority ? right : left;
  if (toneRank[right.tone] !== toneRank[left.tone]) return toneRank[right.tone] > toneRank[left.tone] ? right : left;
  return right.message.length > left.message.length ? right : left;
};

export function dedupeCoachReminders(reminders: CoachReminderView[]): CoachReminderView[] {
  const byId = new Map<string, CoachReminderView>();

  reminders.forEach((reminder, index) => {
    const normalized: CoachReminderView = {
      id: sanitizeId(reminder.id, `coach-reminder-${index}`),
      title: sanitizeVisibleText(reminder.title, '教练提醒'),
      message: sanitizeVisibleText(reminder.message, '当前没有更多说明。'),
      tone: reminder.tone || 'info',
      source: reminder.source ? sanitizeId(reminder.source, '') : undefined,
      priority: Number.isFinite(reminder.priority) ? reminder.priority : 0,
    };
    const existing = byId.get(normalized.id);
    byId.set(normalized.id, existing ? betterReminder(existing, normalized) : normalized);
  });

  const bySemantic = new Map<string, CoachReminderView>();
  [...byId.values()].forEach((reminder) => {
    const key = semanticKey(reminder);
    const existing = bySemantic.get(key);
    bySemantic.set(key, existing ? betterReminder(existing, reminder) : reminder);
  });

  return [...bySemantic.values()].sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return toneRank[right.tone] - toneRank[left.tone];
  });
}

export const splitCoachReminders = (reminders: CoachReminderView[], maxVisible = 2) => {
  const deduped = dedupeCoachReminders(reminders);
  return {
    visible: deduped.slice(0, maxVisible),
    hidden: deduped.slice(maxVisible),
  };
};
