import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataHealthIssue, DataHealthReport } from '../src/engines/dataHealthEngine';
import {
  dismissDataHealthIssueToday,
  filterDismissedDataHealthIssues,
} from '../src/engines/dataHealthEngine';
import { buildDataHealthViewModel } from '../src/presenters/dataHealthPresenter';
import { loadData, sanitizeData, saveData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

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

const issue = (id: string, title = id): DataHealthIssue => ({
  id,
  severity: 'warning',
  category: 'summary',
  title,
  message: '数据健康问题需要复查。',
  affectedIds: [id],
  canAutoFix: false,
});

const report = (issues: DataHealthIssue[]): DataHealthReport => ({
  status: issues.length ? 'has_warnings' : 'healthy',
  issues,
  summary: '数据健康检查发现需要复查的问题。',
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DataHealth issue dismiss filtering', () => {
  it('creates a today-scoped dismissed issue record', () => {
    expect(dismissDataHealthIssueToday('summary-volume-zero-session-1', '2026-04-30')).toEqual({
      issueId: 'summary-volume-zero-session-1',
      dismissedAt: '2026-04-30',
      scope: 'today',
    });
  });

  it('filters dismissed issue only for the same day', () => {
    const issues = [issue('issue-a'), issue('issue-b')];
    const dismissed = [dismissDataHealthIssueToday('issue-a', '2026-04-30')];

    expect(filterDismissedDataHealthIssues(issues, dismissed, '2026-04-30').map((item) => item.id)).toEqual(['issue-b']);
    expect(filterDismissedDataHealthIssues(issues, dismissed, '2026-05-01').map((item) => item.id)).toEqual(['issue-a', 'issue-b']);
  });

  it('hides dismissed issues from primary and secondary view-model lists without deleting report issues', () => {
    const issues = [issue('issue-a'), issue('issue-b'), issue('issue-c'), issue('issue-d')];
    const source = report(issues);
    const before = JSON.stringify(source);
    const dismissed = [dismissDataHealthIssueToday('issue-b', '2026-04-30')];

    const vm = buildDataHealthViewModel(source, { dismissedIssues: dismissed, currentDate: '2026-04-30' });
    const visibleIds = [...vm.primaryIssues, ...vm.secondaryIssues].map((item) => item.id);

    expect(visibleIds).not.toContain('issue-b');
    expect(visibleIds).toHaveLength(3);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('keeps the three-primary-issue limit after filtering', () => {
    const issues = [issue('a'), issue('b'), issue('c'), issue('d'), issue('e')];
    const dismissed = [dismissDataHealthIssueToday('b', '2026-04-30')];

    const vm = buildDataHealthViewModel(report(issues), { dismissedIssues: dismissed, currentDate: '2026-04-30' });

    expect(vm.primaryIssues).toHaveLength(3);
    expect(vm.secondaryIssues).toHaveLength(1);
    expect([...vm.primaryIssues, ...vm.secondaryIssues].map((item) => item.id)).not.toContain('b');
  });

  it('sanitizes, saves, and loads dismissedDataHealthIssues', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const dismissed = [dismissDataHealthIssueToday('issue-a', '2026-04-30')];
    const data = makeAppData({
      dismissedDataHealthIssues: dismissed,
      settings: { dismissedDataHealthIssues: dismissed },
    });

    saveData(data);
    const loaded = loadData();

    expect(loaded.dismissedDataHealthIssues).toEqual(dismissed);
    expect(loaded.settings.dismissedDataHealthIssues).toEqual(dismissed);
  });

  it('sanitizes legacy data without dismissedDataHealthIssues to an empty list', () => {
    const sanitized = sanitizeData(makeAppData({ dismissedDataHealthIssues: undefined }));

    expect(sanitized.dismissedDataHealthIssues).toEqual([]);
    expect(sanitized.settings.dismissedDataHealthIssues).toEqual([]);
  });
});
