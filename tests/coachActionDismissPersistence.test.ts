import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { dismissCoachActionToday, filterDismissedCoachActions } from '../src/engines/coachActionDismissEngine';
import { loadData, sanitizeData, saveData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const makeAction = (id: string): CoachAction => ({
  id,
  title: '教练建议',
  description: '查看建议详情后再决定是否处理。',
  source: 'volumeAdaptation',
  actionType: 'review_volume',
  priority: 'medium',
  status: 'pending',
  requiresConfirmation: false,
  reversible: false,
  createdAt: '2026-04-30T09:00:00.000Z',
  reason: '训练记录提示需要复查。',
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('coach action dismiss persistence', () => {
  it('wires handleDismissCoachAction to write dismissedCoachActions and show the updated toast', () => {
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain('const handleDismissCoachAction = (actionId: string)');
    expect(source).toContain('dismissedCoachActions: nextDismissed');
    expect(source).toContain('dismissCoachActionToday(actionId, dismissedAt)');
    expect(source).toContain('已暂不处理，今天不再提醒。');
  });

  it('sanitizes legacy data without dismissed actions to an empty list', () => {
    const sanitized = sanitizeData(makeAppData({ dismissedCoachActions: undefined }));

    expect(sanitized.dismissedCoachActions).toEqual([]);
    expect(sanitized.settings.dismissedCoachActions).toEqual([]);
  });

  it('saves and loads dismissedCoachActions through persistence settings', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const dismissed = [dismissCoachActionToday('action-a', '2026-04-30')];
    const data = makeAppData({
      dismissedCoachActions: dismissed,
      settings: { dismissedCoachActions: dismissed },
    });

    saveData(data);
    const loaded = loadData();

    expect(loaded.dismissedCoachActions).toEqual(dismissed);
    expect(loaded.settings.dismissedCoachActions).toEqual(dismissed);
  });

  it('does not delete original action source data when storing dismiss state', () => {
    const historySession = makeSession({
      id: 'history-push',
      date: '2026-04-30',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6 }],
    });
    const dismissed = [dismissCoachActionToday('volume-preview-back-increase', '2026-04-30')];

    const sanitized = sanitizeData(makeAppData({ history: [historySession], dismissedCoachActions: dismissed }));

    expect(sanitized.history).toHaveLength(1);
    expect(sanitized.history[0]?.id).toBe('history-push');
    expect(sanitized.dismissedCoachActions).toEqual(dismissed);
  });

  it('filters visible actions after dismiss and keeps other actions visible', () => {
    const actions = [makeAction('action-a'), makeAction('action-b')];
    const dismissed = [dismissCoachActionToday('action-a', '2026-04-30')];

    const visible = filterDismissedCoachActions(actions, dismissed, '2026-04-30');

    expect(visible.map((action) => action.id)).toEqual(['action-b']);
    expect(actions.map((action) => action.id)).toEqual(['action-a', 'action-b']);
  });

  it('lets the dismissed action appear again the next day', () => {
    const actions = [makeAction('action-a')];
    const dismissed = [dismissCoachActionToday('action-a', '2026-04-30')];

    const visible = filterDismissedCoachActions(actions, dismissed, '2026-05-01');

    expect(visible.map((action) => action.id)).toEqual(['action-a']);
  });
});
