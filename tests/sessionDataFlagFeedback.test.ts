import { describe, expect, it } from 'vitest';
import { filterAnalyticsHistory, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { makeAppData, makeSession } from './fixtures';

const makeHistorySession = () =>
  makeSession({
    id: 'flag-session',
    date: '2026-04-30',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
  });

describe('session data flag feedback', () => {
  it('marks test data with a clear statistics impact message', () => {
    const data = makeAppData({ history: [makeHistorySession()] });

    const result = markSessionDataFlag(data, 'flag-session', 'test', true);

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.message).toBe('已标记为测试数据，不参与训练统计。');
    expect(filterAnalyticsHistory(result.data.history)).toHaveLength(0);
  });

  it('marks excluded data with PR and e1RM impact copy', () => {
    const data = makeAppData({ history: [makeHistorySession()] });

    const result = markSessionDataFlag(data, 'flag-session', 'excluded', true);

    expect(result.ok).toBe(true);
    expect(result.message).toBe('已排除该训练，不参与 PR、e1RM、有效组和统计。');
    expect(filterAnalyticsHistory(result.data.history)).toHaveLength(0);
  });

  it('restores normal data and brings the session back into analytics', () => {
    const excluded = { ...makeHistorySession(), dataFlag: 'excluded' as const };
    const data = makeAppData({ history: [excluded] });

    const result = markSessionDataFlag(data, 'flag-session', 'normal', true);

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.message).toBe('已恢复为正常数据，相关统计会重新计算。');
    expect(filterAnalyticsHistory(result.data.history)).toHaveLength(1);
  });

  it('does not fake a mutation when the target status is already set', () => {
    const data = makeAppData({ history: [makeHistorySession()] });

    const result = markSessionDataFlag(data, 'flag-session', 'normal', true);

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.message).toBe('这次训练已经是正常数据。');
  });

  it('fails explicitly when the session cannot be found', () => {
    const data = makeAppData({ history: [makeHistorySession()] });

    const result = markSessionDataFlag(data, 'missing-session', 'test', true);

    expect(result.ok).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.message).toBe('暂时无法定位到这次训练。');
  });
});
