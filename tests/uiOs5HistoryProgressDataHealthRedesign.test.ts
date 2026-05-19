import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('UI-OS 5 History Progress Data Health redesign', () => {
  const recordSource = read('src/features/RecordView.tsx');
  const cardsSource = read('src/uiOs/records/RecordOsCards.tsx');

  it('adds readable record OS surfaces for history progress and data health', () => {
    for (const marker of ['RecordOsOverview', 'RecordTimelineCard', 'ProgressInsightCard', 'DataHealthIssueCard']) {
      expect(cardsSource).toContain(marker);
      expect(recordSource).toContain(marker);
    }
    expect(cardsSource).toContain('bg-[#0a0a0b]');
    expect(cardsSource).toContain('rounded-[28px]');
  });

  it('keeps history as a recorded workout timeline with owner-friendly empty state', () => {
    expect(recordSource).toContain('历史、进步和数据健康放在同一条时间线里');
    expect(cardsSource).toContain('训练记录卡片');
    expect(recordSource).toContain('已记录 ·');
    expect(recordSource).toContain('暂无训练记录');
    expect(recordSource).toContain('完成一次训练后，这里会自动显示训练日历和当天详情。');
  });

  it('keeps progress labels and adds human-readable insight copy without changing calculations', () => {
    for (const expected of ['PR / e1RM', '当前 e1RM', '历史最佳 e1RM', '有效组', '训练量', '进步解读', '趋势说明']) {
      expect(recordSource).toContain(expected);
    }
    expect(recordSource).toContain('底层 PR、e1RM 和有效组计算保持不变');
    expect(recordSource).toContain('buildPrs(analyticsHistory)');
    expect(recordSource).toContain('buildE1RMProfile(analyticsHistory');
    expect(recordSource).toContain('buildEffectiveVolumeSummary(analyticsHistory)');
  });

  it('keeps Data Health owner-facing and blocks automatic repair copy', () => {
    expect(recordSource).toContain('DataHealthIssueCard');
    expect(recordSource).toContain('这里只报告问题');
    expect(recordSource).toContain('修正记录、删除或排除统计仍由你确认');
    expect(recordSource).not.toContain('/data-health/repair/apply');
    expect(recordSource).not.toContain('自动修复');
    expect(recordSource).not.toContain('自动删除');
  });
});
